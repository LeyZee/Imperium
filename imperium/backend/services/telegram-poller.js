const fetch = require('node-fetch');
const db = require('../database');
const { GROUP_PLATFORM, processMessage, findChatteur } = require('./telegram-parser');
const { notifyChatteur, notifyAdminsAndManagers } = require('../utils/notifier');
const { logActivity } = require('../utils/activityLogger');
const logger = require('../utils/logger');
const { notifyVenteDetected, notifyImportIncomplete, logTelegramIncoming } = require('../utils/telegramSender');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const POLL_TIMEOUT = 30; // seconds
const RETRY_DELAY = 5000; // ms
const REGISTRATION_TTL = 5 * 60 * 1000; // 5 minutes to complete registration

let running = false;
let currentOffset = 0;
let pollController = null; // AbortController for current poll request

// --- Metrics ---
let startedAt = null;
let messagesProcessed = 0;
let lastMessageAt = null;
let lastError = null;
let errorsCount = 0;
let botUsername = null;
let registrationsCount = 0;
let lastHeartbeat = null;
let autoRestartCount = 0;
const MAX_AUTO_RESTARTS = 5;
const BASE_RESTART_DELAY = 10000; // 10s, will double each retry

// --- DM Registration state ---
// Map<telegramUserId, { step: 'awaiting_name', startedAt: Date }>
const pendingRegistrations = new Map();

// --- Topic name cache (forum mode) ---
// Map<`${groupId}:${threadId}`, topicName>
const topicNameCache = new Map();
const MAX_TOPIC_CACHE_SIZE = 500;
const MAX_PENDING_REGISTRATIONS = 100;

/**
 * Load topic name cache from database (survives restarts)
 */
function loadTopicCache() {
  try {
    const row = db.prepare("SELECT value FROM telegram_state WHERE key = ?").get('topic_cache');
    if (row) {
      const data = JSON.parse(row.value);
      for (const [k, v] of Object.entries(data)) {
        topicNameCache.set(k, v);
      }
      logger.info(`Topic cache loaded: ${topicNameCache.size} topics`);
    }
  } catch (e) {
    logger.warn('Failed to load topic cache', { error: e.message });
  }
}

/**
 * Save topic name cache to database
 */
function saveTopicCache() {
  try {
    const data = Object.fromEntries(topicNameCache);
    db.prepare("INSERT OR REPLACE INTO telegram_state (key, value) VALUES (?, ?)")
      .run('topic_cache', JSON.stringify(data));
  } catch (e) {
    logger.warn('Failed to save topic cache', { error: e.message });
  }
}

/**
 * Save heartbeat timestamp to database
 */
function saveHeartbeat() {
  try {
    lastHeartbeat = Date.now();
    db.prepare("INSERT OR REPLACE INTO telegram_state (key, value) VALUES (?, ?)")
      .run('heartbeat', String(lastHeartbeat));
  } catch { /* silent */ }
}

/**
 * Add entry to topic cache with size limit (evicts oldest if full)
 */
function addToTopicCache(key, value) {
  if (topicNameCache.size >= MAX_TOPIC_CACHE_SIZE && !topicNameCache.has(key)) {
    // Evict oldest entry (first key in Map insertion order)
    const firstKey = topicNameCache.keys().next().value;
    topicNameCache.delete(firstKey);
  }
  topicNameCache.set(key, value);
}

/**
 * Resolve topic name for a message (from cache or message metadata)
 */
function resolveTopicName(chatId, msg) {
  if (!msg.message_thread_id) return null;

  const cacheKey = `${chatId}:${msg.message_thread_id}`;

  // Check cache first
  if (topicNameCache.has(cacheKey)) {
    return topicNameCache.get(cacheKey);
  }

  // Try to extract from reply_to_message (Telegram includes topic info here)
  const topicName = msg.reply_to_message?.forum_topic_created?.name;
  if (topicName) {
    addToTopicCache(cacheKey, topicName);
    saveTopicCache();
    logger.info(`Topic cached: ${cacheKey} → "${topicName}"`);
    return topicName;
  }

  return null;
}

/**
 * Load last processed offset from database
 */
function loadOffset() {
  try {
    const row = db.prepare("SELECT value FROM telegram_state WHERE key = ?").get('last_offset');
    return row ? parseInt(row.value, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Save offset to database
 */
function saveOffset(offset) {
  try {
    db.prepare(
      "INSERT OR REPLACE INTO telegram_state (key, value) VALUES (?, ?)"
    ).run('last_offset', String(offset));
  } catch (err) {
    console.error('⚠️  Erreur sauvegarde offset Telegram:', err.message);
  }
}

/**
 * Call Telegram Bot API (with abort support)
 */
async function apiCall(method, params = {}, signal) {
  const url = new URL(`${API_BASE}/${method}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  const opts = { timeout: (POLL_TIMEOUT + 10) * 1000 };
  if (signal) opts.signal = signal;
  const res = await fetch(url.toString(), opts);
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description || 'Unknown'}`);
  }
  return data.result;
}

/**
 * Call Telegram Bot API with JSON body (needed for reply_markup, inline keyboards, etc.)
 */
async function apiCallPost(method, body) {
  const url = `${API_BASE}/${method}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeout: 10000,
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API error: ${data.description || 'Unknown'}`);
  }
  return data.result;
}

/**
 * Send a message via Telegram Bot API (supports inline keyboards via reply_markup)
 */
async function sendMessage(chatId, text, options = {}) {
  try {
    const { reply_markup, parseMode, ...rest } = options;
    if (reply_markup) {
      // Use POST with JSON body for keyboards
      await apiCallPost('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: parseMode || 'HTML',
        reply_markup,
        ...rest,
      });
    } else {
      await apiCall('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: parseMode || 'HTML',
        ...rest,
      });
    }
  } catch (err) {
    logger.error('Erreur envoi message Telegram', { chatId, error: err.message });
  }
}

/**
 * Send the interactive help menu with inline keyboard buttons.
 */
async function sendHelpMenu(chatId, alreadyLinked) {
  const registered = !!alreadyLinked;
  const name = alreadyLinked?.prenom || '';

  let text = `\uD83E\uDD16 <b>Bot Imperium</b>\n\n`;
  if (registered) {
    text += `Salut <b>${name}</b> ! Voici ce que je peux faire pour toi :\n\n`;
    text += `\uD83D\uDCCA <b>/mesventes</b> \u2014 Voir tes ventes de la p\u00e9riode en cours (total, d\u00e9tail, alertes)\n\n`;
    text += `\u2705 <b>/status</b> \u2014 V\u00e9rifier que ton compte Telegram est bien li\u00e9\n\n`;
    text += `\u2753 <b>/aide</b> \u2014 Afficher ce menu\n\n`;
    text += `\u2014\u2014\u2014\n\n`;
    text += `\uD83D\uDCE8 <b>Automatiquement</b>, je te pr\u00e9viens quand :\n`;
    text += `\u2022 \u2705 Ta vente est import\u00e9e depuis le groupe\n`;
    text += `\u2022 \u26A0\uFE0F Une info manque sur un import\n`;
    text += `\u2022 \u23F0 Ton shift commence bient\u00f4t\n`;
    text += `\u2022 \uD83D\uDCCA R\u00e9cap de ta journ\u00e9e (chaque soir)`;
  } else {
    text += `Bienvenue ! Pour commencer, enregistre ton compte :\n\n`;
    text += `\uD83D\uDC4B <b>/start</b> \u2014 Lier ton Telegram \u00e0 ton profil Imperium\n\n`;
    text += `Une fois enregistr\u00e9(e), tu pourras :\n`;
    text += `\u2022 Voir tes ventes avec /mesventes\n`;
    text += `\u2022 Recevoir des confirmations de ventes\n`;
    text += `\u2022 Recevoir des rappels de shift\n`;
    text += `\u2022 Recevoir ton r\u00e9cap quotidien`;
  }

  const keyboard = registered
    ? [
        [{ text: '\uD83D\uDCCA Mes ventes', callback_data: 'cmd_mesventes' }],
        [{ text: '\u2705 Mon statut', callback_data: 'cmd_status' }, { text: '\uD83D\uDC4B Re-inscription', callback_data: 'cmd_start' }],
      ]
    : [
        [{ text: '\uD83D\uDC4B S\'enregistrer maintenant', callback_data: 'cmd_start' }],
      ];

  await sendMessage(chatId, text, {
    reply_markup: { inline_keyboard: keyboard },
  });
}

/**
 * Handle callback queries from inline keyboard buttons.
 */
async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message?.chat?.id;
  const userId = callbackQuery.from?.id ? String(callbackQuery.from.id) : null;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  // Acknowledge the button press (removes loading spinner)
  try {
    await apiCallPost('answerCallbackQuery', { callback_query_id: callbackQuery.id });
  } catch { /* silent */ }

  // Simulate the corresponding command by building a fake msg object
  const fakeMsg = {
    chat: { id: chatId, type: 'private' },
    from: callbackQuery.from,
    text: '',
  };

  // Handle registration name buttons (reg_PRENOM)
  if (data.startsWith('reg_')) {
    const prenom = data.substring(4);
    // Ensure we have a pending registration session (or create one)
    const userIdStr = callbackQuery.from?.id ? String(callbackQuery.from.id) : null;
    if (userIdStr) {
      pendingRegistrations.set(userIdStr, { step: 'awaiting_name', startedAt: Date.now() });
    }
    fakeMsg.text = prenom;
    await handlePrivateMessage(fakeMsg);
    return;
  }

  switch (data) {
    case 'cmd_start':
      fakeMsg.text = '/start';
      break;
    case 'cmd_mesventes':
      fakeMsg.text = '/mesventes';
      break;
    case 'cmd_status':
      fakeMsg.text = '/status';
      break;
    case 'cmd_aide':
      fakeMsg.text = '/aide';
      break;
    default:
      return;
  }

  await handlePrivateMessage(fakeMsg);
}

/**
 * Clean up expired registration sessions (older than REGISTRATION_TTL)
 */
function cleanupRegistrations() {
  const now = Date.now();
  for (const [userId, session] of pendingRegistrations) {
    if (now - session.startedAt > REGISTRATION_TTL) {
      pendingRegistrations.delete(userId);
    }
  }
}

/**
 * Handle private DM messages for /start registration flow.
 * Returns true if the message was handled (DM), false if it should continue to group processing.
 */
async function handlePrivateMessage(msg) {
  // Only handle private chats (DMs)
  if (msg.chat.type !== 'private') return false;

  const chatId = msg.chat.id;
  const userId = msg.from?.id ? String(msg.from.id) : null;
  const text = (msg.text || '').trim();

  if (!userId || !text) return true; // Ignore empty DMs

  // Clean up old sessions periodically
  cleanupRegistrations();

  // Check if already registered
  const alreadyLinked = db.prepare('SELECT id, prenom, telegram_dm_ok FROM chatteurs WHERE telegram_user_id = ? AND actif = 1').get(userId);

  // Handle /start command (also match /start@BotName sent by Telegram menu)
  if (text === '/start' || text.startsWith('/start ') || text.startsWith('/start@')) {
    if (alreadyLinked) {
      // FIX: If auto-linked from group but never did /start, activate DM notifications now
      if (!alreadyLinked.telegram_dm_ok) {
        try {
          db.prepare('UPDATE chatteurs SET telegram_dm_ok = 1 WHERE id = ?').run(alreadyLinked.id);
          logger.info(`Telegram DM activé pour ${alreadyLinked.prenom} via /start (était auto-linké)`);
          logTelegramIncoming(chatId, alreadyLinked.id, alreadyLinked.prenom, 'registration', `DM activé via /start — ${alreadyLinked.prenom} (était auto-linké)`);
          await sendMessage(chatId,
            `\u2705 Parfait <b>${alreadyLinked.prenom}</b> ! Tes notifications DM sont maintenant activ\u00e9es.\n\n` +
            `Tu recevras d\u00e9sormais :\n` +
            `\u2022 \u2705 Confirmations de ventes import\u00e9es\n` +
            `\u2022 \u23F0 Rappels de shift\n` +
            `\u2022 \uD83D\uDCCA R\u00e9cap quotidien\n` +
            `\u2022 \uD83C\uDFC6 Notifications de paliers`, {
            reply_markup: {
              inline_keyboard: [
                [{ text: '\uD83D\uDCCA Mes ventes', callback_data: 'cmd_mesventes' }],
                [{ text: '\u2753 Toutes les commandes', callback_data: 'cmd_aide' }],
              ],
            },
          });
          return true;
        } catch (err) {
          logger.error('Erreur activation DM via /start', { error: err.message });
        }
      }
      await sendMessage(chatId,
        `\u2705 Tu es d\u00e9j\u00e0 enregistr\u00e9(e) comme <b>${alreadyLinked.prenom}</b> !\n\n` +
        `Tes rapports de shift dans les groupes seront automatiquement li\u00e9s \u00e0 ton compte.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '\uD83D\uDCCA Mes ventes', callback_data: 'cmd_mesventes' }],
            [{ text: '\u2753 Toutes les commandes', callback_data: 'cmd_aide' }],
          ],
        },
      });
      return true;
    }

    // Start registration flow (with size limit to prevent memory exhaustion)
    if (pendingRegistrations.size >= MAX_PENDING_REGISTRATIONS) {
      cleanupRegistrations(); // Force cleanup before adding
    }
    pendingRegistrations.set(userId, { step: 'awaiting_name', startedAt: Date.now() });

    // Show available names as clickable buttons for easy registration
    const chatteurs = db.prepare("SELECT prenom FROM chatteurs WHERE actif = 1 AND role != 'va' AND telegram_user_id IS NULL ORDER BY prenom").all();

    let message = `\uD83D\uDC4B <b>Bienvenue sur le bot Imperium !</b>\n\n` +
      `Pour lier ton compte Telegram, envoie-moi ton <b>pr\u00e9nom</b> tel qu'il appara\u00eet dans l'application.\n\n`;

    if (chatteurs.length > 0) {
      message += `<b>Pr\u00e9noms disponibles :</b>\n${chatteurs.map(c => `\u2022 ${c.prenom}`).join('\n')}\n\n`;
      message += `\uD83D\uDC47 <b>Clique sur ton pr\u00e9nom ci-dessous ou tape-le :</b>`;
    } else {
      message += `Tous les chatteurs sont d\u00e9j\u00e0 li\u00e9s ! Contacte un admin si tu n'es pas dans la liste.`;
    }

    // Build inline keyboard with chatteur names as buttons (max 8 per row, max 3 rows)
    const nameButtons = chatteurs.slice(0, 24).map(c => ({
      text: c.prenom,
      callback_data: `reg_${c.prenom.substring(0, 30)}`,
    }));
    const rows = [];
    for (let i = 0; i < nameButtons.length; i += 3) {
      rows.push(nameButtons.slice(i, i + 3));
    }

    await sendMessage(chatId, message, {
      reply_markup: rows.length > 0 ? { inline_keyboard: rows } : undefined,
    });
    return true;
  }

  // Handle /status command — let chatteur check their registration
  if (text === '/status' || text.startsWith('/status@')) {
    if (alreadyLinked) {
      await sendMessage(chatId, `\u2705 Enregistr\u00e9(e) comme <b>${alreadyLinked.prenom}</b>.`, {
        reply_markup: {
          inline_keyboard: [[
            { text: '\uD83D\uDCCA Mes ventes', callback_data: 'cmd_mesventes' },
            { text: '\u2753 Aide', callback_data: 'cmd_aide' },
          ]],
        },
      });
    } else {
      await sendMessage(chatId, `\u274C Pas encore enregistr\u00e9(e).`, {
        reply_markup: {
          inline_keyboard: [[
            { text: '\uD83D\uDC4B S\'enregistrer', callback_data: 'cmd_start' },
          ]],
        },
      });
    }
    return true;
  }

  // Handle /aide or /help command — show interactive help menu
  if (text === '/aide' || text === '/help' || text.startsWith('/aide@') || text.startsWith('/help@')) {
    await sendHelpMenu(chatId, alreadyLinked);
    return true;
  }

  // Handle /mes-ventes command — show current period ventes summary
  if (text === '/mes-ventes' || text === '/mesventes' || text.startsWith('/mesventes@') || text.startsWith('/mes-ventes@')) {
    if (!alreadyLinked) {
      await sendMessage(chatId, `\u274C Tu dois d'abord t'enregistrer pour voir tes ventes.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '\uD83D\uDC4B S\'enregistrer maintenant', callback_data: 'cmd_start' }],
          ],
        },
      });
      return true;
    }
    try {
      const { getPeriode } = require('../utils/period');
      const today = new Date().toISOString().split('T')[0];
      const { debut, fin } = getPeriode(today);
      const ventes = db.prepare(`
        SELECT v.montant_brut, v.created_at, v.source, v.modele_id, v.shift_id,
          p.nom AS plateforme, p.devise,
          m.pseudo AS modele
        FROM ventes v
        JOIN plateformes p ON p.id = v.plateforme_id
        LEFT JOIN modeles m ON m.id = v.modele_id
        WHERE v.chatteur_id = ? AND v.periode_debut = ? AND v.periode_fin = ?
          AND v.statut = 'valid\u00e9e'
        ORDER BY v.created_at DESC
      `).all(alreadyLinked.id, debut, fin);

      if (ventes.length === 0) {
        await sendMessage(chatId,
          `\uD83D\uDCCA <b>Mes ventes (${debut} \u2192 ${fin})</b>\n\n` +
          `Aucune vente enregistr\u00e9e sur cette p\u00e9riode.`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '\uD83D\uDC49 Menu', callback_data: 'cmd_aide' }],
            ],
          },
        });
        return true;
      }

      const totalEUR = ventes.filter(v => v.devise === 'EUR').reduce((s, v) => s + v.montant_brut, 0);
      const totalUSD = ventes.filter(v => v.devise === 'USD').reduce((s, v) => s + v.montant_brut, 0);
      const telegramCount = ventes.filter(v => v.source === 'telegram').length;
      const warnings = ventes.filter(v => !v.modele_id || !v.shift_id).length;

      let msg = `\uD83D\uDCCA <b>Mes ventes (${debut} \u2192 ${fin})</b>\n\n`;
      msg += `\uD83D\uDCB0 <b>${ventes.length}</b> vente${ventes.length > 1 ? 's' : ''} valid\u00e9e${ventes.length > 1 ? 's' : ''}\n`;
      if (totalEUR > 0) msg += `\u2022 ${totalEUR.toFixed(2)}\u20AC (EUR)\n`;
      if (totalUSD > 0) msg += `\u2022 $${totalUSD.toFixed(2)} (USD)\n`;
      msg += `\n\uD83E\uDD16 ${telegramCount} import\u00e9e${telegramCount > 1 ? 's' : ''} via Telegram\n`;

      if (warnings > 0) {
        msg += `\u26A0\uFE0F ${warnings} vente${warnings > 1 ? 's' : ''} avec infos manquantes\n`;
      }

      // List last 5 ventes
      msg += `\n<b>Derni\u00e8res ventes :</b>\n`;
      const last5 = ventes.slice(0, 5);
      for (const v of last5) {
        const currency = v.devise === 'USD' ? '$' : '\u20AC';
        const src = v.source === 'telegram' ? '\uD83E\uDD16' : '\u270D\uFE0F';
        const modelTag = v.modele ? ` (${v.modele})` : '';
        msg += `${src} ${v.montant_brut.toFixed(2)}${currency} \u2014 ${v.plateforme}${modelTag}\n`;
      }
      if (ventes.length > 5) {
        msg += `\n<i>... et ${ventes.length - 5} autre(s)</i>`;
      }

      await sendMessage(chatId, msg, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '\uD83D\uDD04 Actualiser', callback_data: 'cmd_mesventes' }, { text: '\uD83D\uDC49 Menu', callback_data: 'cmd_aide' }],
          ],
        },
      });
    } catch (err) {
      logger.error('Erreur /mes-ventes', { error: err.message });
      await sendMessage(chatId, `\u274C Erreur lors de la r\u00e9cup\u00e9ration de tes ventes. R\u00e9essaie plus tard.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '\uD83D\uDD04 R\u00e9essayer', callback_data: 'cmd_mesventes' }, { text: '\uD83D\uDC49 Menu', callback_data: 'cmd_aide' }],
          ],
        },
      });
    }
    return true;
  }

  // Handle name response during registration
  const session = pendingRegistrations.get(userId);
  if (session && session.step === 'awaiting_name') {
    pendingRegistrations.delete(userId);

    // Try to find chatteur by name (reuse existing fuzzy matching)
    const chatteur = findChatteur(text, null);

    if (!chatteur) {
      logTelegramIncoming(chatId, null, null, 'registration_failed', `Prénom non trouvé: "${text}"`, false, 'Chatteur introuvable');
      // Show available names to help the chatteur
      const available = db.prepare("SELECT prenom FROM chatteurs WHERE actif = 1 AND role != 'va' AND telegram_user_id IS NULL ORDER BY prenom").all();
      let errorMsg = `\u274C Je n'ai pas trouv\u00e9 de chatteur correspondant \u00e0 "<b>${text}</b>".\n\n`;
      if (available.length > 0) {
        errorMsg += `<b>Noms disponibles :</b>\n${available.map(c => `\u2022 ${c.prenom}`).join('\n')}\n\n`;
        errorMsg += `Envoie ton pr\u00e9nom exactement comme ci-dessus.`;
        // Re-open the registration session so they can try again without /start
        pendingRegistrations.set(userId, { step: 'awaiting_name', startedAt: Date.now() });
      } else {
        errorMsg += `V\u00e9rifie l'orthographe et r\u00e9essaie.`;
      }
      await sendMessage(chatId, errorMsg, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '\uD83D\uDD04 R\u00e9essayer', callback_data: 'cmd_start' }, { text: '\u2753 Aide', callback_data: 'cmd_aide' }],
          ],
        },
      });
      return true;
    }

    // Check if this chatteur already has a telegram_user_id
    if (chatteur.telegram_user_id && chatteur.telegram_user_id !== userId) {
      logTelegramIncoming(chatId, chatteur.id, chatteur.prenom, 'registration_failed', `${chatteur.prenom} déjà lié à un autre compte`, false, 'Déjà lié');
      await sendMessage(chatId,
        `\u26A0\uFE0F Le chatteur <b>${chatteur.prenom}</b> est d\u00e9j\u00e0 li\u00e9 \u00e0 un autre compte Telegram.\n\n` +
        `Si c'est une erreur, contacte un admin pour d\u00e9lier l'ancien compte.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '\uD83D\uDD04 Essayer un autre pr\u00e9nom', callback_data: 'cmd_start' }, { text: '\u2753 Aide', callback_data: 'cmd_aide' }],
          ],
        },
      });
      return true;
    }

    // Link telegram_user_id to chatteur
    try {
      db.prepare('UPDATE chatteurs SET telegram_user_id = ?, telegram_dm_ok = 1 WHERE id = ?').run(userId, chatteur.id);
      registrationsCount++;
      logger.info(`Telegram registration: ${chatteur.prenom} lié à user_id ${userId} (DM activé)`);
      logActivity(null, 'telegram_registration', 'chatteur', chatteur.id, `${chatteur.prenom} — Telegram ID ${userId}`);
      logTelegramIncoming(chatId, chatteur.id, chatteur.prenom, 'registration', `Enregistrement DM réussi — ${chatteur.prenom} lié à Telegram ID ${userId}`);

      await sendMessage(chatId,
        `\u2705 Parfait ! Tu es maintenant enregistr\u00e9(e) comme <b>${chatteur.prenom}</b>.\n\n` +
        `Tes rapports de shift dans les groupes seront automatiquement d\u00e9tect\u00e9s et import\u00e9s. \uD83D\uDE80`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '\uD83D\uDCCA Voir mes ventes', callback_data: 'cmd_mesventes' }],
            [{ text: '\u2753 Toutes les commandes', callback_data: 'cmd_aide' }],
          ],
        },
      });
    } catch (err) {
      logger.error('Erreur enregistrement Telegram', { chatteur: chatteur.prenom, userId, error: err.message });
      logTelegramIncoming(chatId, null, text, 'registration', `Échec enregistrement — ${err.message}`, false, err.message);
      await sendMessage(chatId,
        `\u274C Erreur lors de l'enregistrement. R\u00e9essaie plus tard ou contacte un admin.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '\uD83D\uDD04 R\u00e9essayer', callback_data: 'cmd_start' }],
          ],
        },
      });
    }
    return true;
  }

  // Unrecognized DM — show interactive help menu
  await sendHelpMenu(chatId, alreadyLinked);
  return true;
}

/**
 * Process a single update
 */
function handleUpdate(update) {
  // Handle inline keyboard button presses
  if (update.callback_query) {
    handleCallbackQuery(update.callback_query).catch(err => {
      logger.error('Erreur callback query Telegram', { error: err.message });
    });
    return;
  }

  const msg = update.message;
  if (!msg) return;

  const chatId = String(msg.chat.id);
  const chatTitle = msg.chat.title || 'DM';
  const senderName = msg.from?.first_name || '';

  // Cache forum topic names from service messages
  if (msg.forum_topic_created) {
    const cacheKey = `${chatId}:${msg.message_thread_id}`;
    addToTopicCache(cacheKey, msg.forum_topic_created.name);
    saveTopicCache();
    logger.info(`Forum topic created cached: ${cacheKey} → "${msg.forum_topic_created.name}"`);
    return;
  }
  if (msg.forum_topic_edited?.name) {
    const cacheKey = `${chatId}:${msg.message_thread_id}`;
    addToTopicCache(cacheKey, msg.forum_topic_edited.name);
    saveTopicCache();
    logger.info(`Forum topic edited cached: ${cacheKey} → "${msg.forum_topic_edited.name}"`);
  }

  // Log ALL incoming messages for debugging
  const hasText = !!msg.text;
  const preview = hasText ? msg.text.substring(0, 60).replace(/\n/g, ' ') : '[no text]';
  console.log(`\uD83D\uDCE8 Telegram [${chatTitle}] from "${senderName}": ${preview}`);

  if (!hasText) return;

  // Handle private DMs (registration flow) — async but fire-and-forget
  if (msg.chat.type === 'private') {
    handlePrivateMessage(msg).catch(err => {
      logger.error('Erreur DM Telegram', { error: err.message });
    });
    return;
  }

  // Only process messages from configured groups
  if (!GROUP_PLATFORM[chatId]) {
    console.log(`   \u21B3 Groupe ignor\u00e9 (chat_id: ${chatId})`);
    return;
  }

  const text = msg.text;

  const senderId = msg.from?.id ? String(msg.from.id) : null;

  // Resolve topic name for modele identification (forum mode)
  const topicName = resolveTopicName(chatId, msg);

  let result;
  try {
    result = processMessage({
      group_id: chatId,
      sender_name: senderName,
      sender_id: senderId,
      message: text,
      message_id: msg.message_id,
      topic_name: topicName,
    });
  } catch (err) {
    logger.warn('processMessage exception', { chatTitle, senderName, error: err.message });
    return;
  }

  if (result.skipped) {
    console.log(`   ↳ Message ignoré (pas un rapport de shift)`);
    return;
  }

  if (result.success) {
    messagesProcessed++;
    lastMessageAt = new Date();
    const platName = result.plateforme_id === 1 ? 'OnlyFans' : result.plateforme_id === 2 ? 'Reveal' : `Plateforme #${result.plateforme_id}`;
    console.log(`✅ Vente importée: ${result.chatteur} — ${result.montant_brut}€ (${platName}) [${result.date_rapport}]${result.modele ? ` modèle: ${result.modele}` : ''}`);
    logActivity(null, 'telegram_import', 'vente', result.vente_id, `${result.chatteur} — ${result.montant_brut}€`);
    logTelegramIncoming(chatId, result.chatteur_id, result.chatteur, 'vente_import', `${result.montant_brut}€ — ${result.date_rapport} (${platName})${result.modele ? ` [${result.modele}]` : ''}`);

    // Notify chatteur (in-app + Telegram DM with enriched info)
    if (result.chatteur_id) {
      notifyChatteur(
        result.chatteur_id,
        'vente',
        'Vente détectée par Telegram',
        `${result.montant_brut}€ — ${result.date_rapport}${result.modele ? ` (${result.modele})` : ''}`,
        '/chatteur/mes-ventes'
      );
      notifyVenteDetected(result.chatteur_id, result.montant_brut, platName, result.date_rapport, {
        modele: result.modele || null,
        shiftLinked: !!result.shift_id,
      }).catch(() => {});
    }

    // ⚠️ Handle incomplete imports (missing modele or shift)
    const missingFields = [];
    if (!result.modele_id) missingFields.push('modèle inconnu');
    if (!result.shift_id) missingFields.push('shift non trouvé');
    if (missingFields.length > 0) {
      // Notify admins (in-app)
      const warningMsg = `Import Telegram partiel pour ${result.chatteur} — ${result.montant_brut}€ ${platName} [${result.date_rapport}] : ${missingFields.join(', ')}. Vérifiez et complétez manuellement.`;
      notifyAdminsAndManagers('warning', '⚠️ Import Telegram incomplet', warningMsg, '/admin/telegram');
      logger.warn('Telegram import incomplet', { chatteur: result.chatteur, missingFields, vente_id: result.vente_id });

      // Alert chatteur via DM about the incomplete import
      if (result.chatteur_id) {
        const dmMissing = [];
        if (!result.modele_id) dmMissing.push('modele');
        if (!result.shift_id) dmMissing.push('shift');
        notifyImportIncomplete(result.chatteur_id, result.montant_brut, platName, result.date_rapport, dmMissing).catch(() => {});
      }
    }
  } else if (result.error) {
    if (result.existing_id) {
      console.log(`   ↳ Doublon ignoré (vente #${result.existing_id})`);
      logTelegramIncoming(chatId, null, senderName, 'vente_duplicate', `Doublon ignoré — vente #${result.existing_id}`, true);
    } else {
      console.warn(`⚠️  Telegram: ${result.error} (sender: "${senderName}", group: ${chatId})`);
      logTelegramIncoming(chatId, null, senderName, 'vente_error', result.error, false, result.error);

      // Notify admins of import errors (chatteur not found, parse errors, etc.)
      const isChatteurNotFound = result.error.includes('Chatteur non trouvé');
      const isParseError = result.error.includes('Impossible de parser');
      if (isChatteurNotFound || isParseError) {
        const preview = text ? text.substring(0, 80) : '';
        const errorMsg = `${result.error}\nExpéditeur: "${senderName}"\nGroupe: ${chatTitle}\n${topicName ? `Topic: ${topicName}\n` : ''}Message: "${preview}"`;
        notifyAdminsAndManagers('error', '❌ Erreur import Telegram', errorMsg, '/admin/telegram');
      }
    }
  }
}

/**
 * Main polling loop
 */
async function pollLoop() {
  while (running) {
    try {
      // Update heartbeat each cycle
      saveHeartbeat();

      // Create an AbortController for this poll cycle
      pollController = new AbortController();

      const updates = await apiCall('getUpdates', {
        offset: currentOffset,
        timeout: POLL_TIMEOUT,
        allowed_updates: JSON.stringify(['message', 'callback_query']),
      }, pollController.signal);

      pollController = null;

      for (const update of updates) {
        try {
          handleUpdate(update);
        } catch (err) {
          console.error('❌ Erreur traitement message Telegram:', err.message);
        }
        currentOffset = update.update_id + 1;
      }

      // Save offset after processing batch
      if (updates.length > 0) {
        saveOffset(currentOffset);
      }
    } catch (err) {
      pollController = null;
      // If aborted (stop was called), exit silently
      if (err.name === 'AbortError' || !running) {
        break;
      }
      errorsCount++;
      lastError = { message: err.message, at: new Date() };
      console.error(`❌ Erreur polling Telegram: ${err.message} — retry dans ${RETRY_DELAY / 1000}s`);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
    }
  }
}

/**
 * Start the Telegram polling bot
 */
async function start() {
  if (!BOT_TOKEN) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN non configuré — bot Telegram désactivé');
    return;
  }

  // If already running, stop first and wait for poll to finish
  if (running) {
    stop();
    await new Promise(r => setTimeout(r, 1000));
  }

  // Verify bot token works
  try {
    const me = await apiCall('getMe');
    botUsername = me.username;
    console.log(`🤖 Telegram Bot connecté: @${me.username} (polling mode)`);
  } catch (err) {
    console.error(`❌ Impossible de connecter le bot Telegram: ${err.message}`);
    throw err;
  }

  // Register commands in Telegram's native menu (the "/" button)
  try {
    await apiCallPost('setMyCommands', {
      commands: [
        { command: 'start', description: '\uD83D\uDC4B S\'enregistrer sur Imperium' },
        { command: 'mesventes', description: '\uD83D\uDCCA Voir mes ventes de la p\u00e9riode' },
        { command: 'status', description: '\u2705 V\u00e9rifier mon enregistrement' },
        { command: 'aide', description: '\u2753 Afficher l\'aide et les commandes' },
      ],
    });
    logger.info('Telegram bot commands registered');
  } catch (err) {
    logger.warn('Failed to register bot commands', { error: err.message });
  }

  // Load last offset, topic cache, and reset counters
  currentOffset = loadOffset();
  loadTopicCache();
  running = true;
  startedAt = new Date();
  messagesProcessed = 0;
  errorsCount = 0;
  lastError = null;

  // Reset restart counter on successful start
  autoRestartCount = 0;

  // Start polling in background (non-blocking) with auto-recovery + circuit breaker
  pollLoop().then(() => {
    if (!running) return; // Normal stop (stop() was called)
    // Unexpected exit while still supposed to be running — auto-restart with backoff
    running = false;
    scheduleAutoRestart('pollLoop exited unexpectedly');
  }).catch(err => {
    logger.error('Polling Telegram arrêté', { error: err.message });
    running = false;
    startedAt = null;
    scheduleAutoRestart(err.message);
  });
}

/**
 * Stop the polling bot
 */
function stop() {
  running = false;
  startedAt = null;
  // Abort in-flight poll request immediately
  if (pollController) {
    pollController.abort();
    pollController = null;
  }
  console.log('🤖 Telegram Bot arrêté');
}

/**
 * Schedule an auto-restart with exponential backoff and circuit breaker.
 */
function scheduleAutoRestart(reason) {
  autoRestartCount++;
  if (autoRestartCount > MAX_AUTO_RESTARTS) {
    logger.error(`Telegram bot: ${MAX_AUTO_RESTARTS} auto-restarts échoués — circuit breaker activé. Restart manuel requis.`, { reason });
    const { notifyAdminsAndManagers } = require('../utils/notifier');
    notifyAdminsAndManagers('error', '🚨 Bot Telegram arrêté', `Le bot a crashé ${MAX_AUTO_RESTARTS} fois de suite et ne redémarrera plus automatiquement. Raison: ${reason}. Redémarrez-le manuellement.`, '/admin/telegram');
    return;
  }
  const delay = BASE_RESTART_DELAY * Math.pow(2, autoRestartCount - 1); // 10s, 20s, 40s, 80s, 160s
  const delaySec = Math.round(delay / 1000);
  logger.warn(`Telegram auto-restart ${autoRestartCount}/${MAX_AUTO_RESTARTS} dans ${delaySec}s...`, { reason });
  setTimeout(() => {
    start().then(() => {
      autoRestartCount = 0; // Reset on successful start
    }).catch(err => {
      logger.error('Telegram auto-restart échoué', { error: err.message, attempt: autoRestartCount });
    });
  }, delay);
}

/**
 * Get current bot status and metrics
 */
function getStatus() {
  const heartbeatAge = lastHeartbeat ? Math.floor((Date.now() - lastHeartbeat) / 1000) : null;
  return {
    running,
    botUsername,
    startedAt: startedAt ? startedAt.toISOString() : null,
    uptime: startedAt ? Math.floor((Date.now() - startedAt.getTime()) / 1000) : 0,
    messagesProcessed,
    lastMessageAt: lastMessageAt ? lastMessageAt.toISOString() : null,
    lastError: lastError ? { message: lastError.message, at: lastError.at.toISOString() } : null,
    errorsCount,
    currentOffset,
    hasBotToken: !!BOT_TOKEN,
    registrationsCount,
    pendingRegistrations: pendingRegistrations.size,
    lastHeartbeat: lastHeartbeat ? new Date(lastHeartbeat).toISOString() : null,
    heartbeatStale: running && heartbeatAge !== null && heartbeatAge > 120,
    topicsCached: topicNameCache.size,
  };
}

/**
 * Send a message to all configured Telegram groups (shift groups).
 * @returns {{ sent: number, failed: number, groups: string[] }}
 */
async function sendToGroups(text) {
  const results = { sent: 0, failed: 0, groups: [] };
  const groupIds = Object.keys(GROUP_PLATFORM);
  // Deduplicate (in case multiple groups share a platform)
  const uniqueGroups = [...new Set(groupIds)];

  for (const groupId of uniqueGroups) {
    try {
      await sendMessage(groupId, text);
      results.sent++;
      results.groups.push(groupId);
    } catch (err) {
      results.failed++;
      logger.warn('sendToGroups failed for group', { groupId, error: err.message });
    }
  }
  return results;
}

module.exports = { start, stop, getStatus, sendToGroups };
