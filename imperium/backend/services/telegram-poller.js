const fetch = require('node-fetch');
const db = require('../database');
const { GROUP_PLATFORM, processMessage, findChatteur } = require('./telegram-parser');
const { notifyChatteur } = require('../utils/notifier');
const { logActivity } = require('../utils/activityLogger');
const logger = require('../utils/logger');
const { notifyVenteDetected } = require('../utils/telegramSender');

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

// --- DM Registration state ---
// Map<telegramUserId, { step: 'awaiting_name', startedAt: Date }>
const pendingRegistrations = new Map();

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
 * Send a message via Telegram Bot API
 */
async function sendMessage(chatId, text, options = {}) {
  try {
    await apiCall('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: options.parseMode || 'HTML',
      ...options,
    });
  } catch (err) {
    logger.error('Erreur envoi message Telegram', { chatId, error: err.message });
  }
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
  const alreadyLinked = db.prepare('SELECT id, prenom FROM chatteurs WHERE telegram_user_id = ? AND actif = 1').get(userId);

  // Handle /start command
  if (text === '/start' || text.startsWith('/start ')) {
    if (alreadyLinked) {
      await sendMessage(chatId,
        `\u2705 Tu es d\u00e9j\u00e0 enregistr\u00e9(e) comme <b>${alreadyLinked.prenom}</b> !\n\n` +
        `Tes rapports de shift dans les groupes seront automatiquement li\u00e9s \u00e0 ton compte.`
      );
      return true;
    }

    // Start registration flow
    pendingRegistrations.set(userId, { step: 'awaiting_name', startedAt: Date.now() });

    const chatteurs = db.prepare('SELECT prenom FROM chatteurs WHERE actif = 1 AND role != \'va\' AND telegram_user_id IS NULL ORDER BY prenom').all();
    const nameList = chatteurs.map(c => `\u2022 ${c.prenom}`).join('\n');

    let message = `\uD83D\uDC4B Bienvenue sur le bot <b>Imperium</b> !\n\n` +
      `Pour lier ton compte Telegram \u00e0 ton profil chatteur, envoie-moi ton <b>pr\u00e9nom</b> tel qu'il appara\u00eet dans l'application.`;

    if (nameList) {
      message += `\n\n<b>Chatteurs non encore li\u00e9s :</b>\n${nameList}`;
    }

    await sendMessage(chatId, message);
    return true;
  }

  // Handle /status command — let chatteur check their registration
  if (text === '/status') {
    if (alreadyLinked) {
      await sendMessage(chatId, `\u2705 Enregistr\u00e9(e) comme <b>${alreadyLinked.prenom}</b>.`);
    } else {
      await sendMessage(chatId, `\u274C Pas encore enregistr\u00e9(e). Envoie /start pour commencer.`);
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
      await sendMessage(chatId,
        `\u274C Je n'ai pas trouv\u00e9 de chatteur correspondant \u00e0 "<b>${text}</b>".\n\n` +
        `V\u00e9rifie l'orthographe et r\u00e9essaie avec /start.`
      );
      return true;
    }

    // Check if this chatteur already has a telegram_user_id
    if (chatteur.telegram_user_id && chatteur.telegram_user_id !== userId) {
      await sendMessage(chatId,
        `\u26A0\uFE0F Le chatteur <b>${chatteur.prenom}</b> est d\u00e9j\u00e0 li\u00e9 \u00e0 un autre compte Telegram.\n\n` +
        `Contacte un admin si c'est une erreur.`
      );
      return true;
    }

    // Link telegram_user_id to chatteur
    try {
      db.prepare('UPDATE chatteurs SET telegram_user_id = ?, telegram_dm_ok = 1 WHERE id = ?').run(userId, chatteur.id);
      registrationsCount++;
      logger.info(`Telegram registration: ${chatteur.prenom} lié à user_id ${userId} (DM activé)`);
      logActivity(null, 'telegram_registration', 'chatteur', chatteur.id, `${chatteur.prenom} — Telegram ID ${userId}`);

      await sendMessage(chatId,
        `\u2705 Parfait ! Tu es maintenant enregistr\u00e9(e) comme <b>${chatteur.prenom}</b>.\n\n` +
        `Tes rapports de shift dans les groupes seront automatiquement d\u00e9tect\u00e9s et import\u00e9s. \uD83D\uDE80`
      );
    } catch (err) {
      logger.error('Erreur enregistrement Telegram', { chatteur: chatteur.prenom, userId, error: err.message });
      await sendMessage(chatId,
        `\u274C Erreur lors de l'enregistrement. R\u00e9essaie plus tard ou contacte un admin.`
      );
    }
    return true;
  }

  // Unrecognized DM — give help
  await sendMessage(chatId,
    `\uD83E\uDD16 Bot Imperium\n\n` +
    `Commandes disponibles :\n` +
    `\u2022 /start \u2014 Enregistrer ton compte\n` +
    `\u2022 /status \u2014 V\u00e9rifier ton enregistrement`
  );
  return true;
}

/**
 * Process a single update
 */
function handleUpdate(update) {
  const msg = update.message;
  if (!msg) return;

  const chatId = String(msg.chat.id);
  const chatTitle = msg.chat.title || 'DM';
  const senderName = msg.from?.first_name || '';

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

  let result;
  try {
    result = processMessage({
      group_id: chatId,
      sender_name: senderName,
      sender_id: senderId,
      message: text,
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
    console.log(`✅ Vente importée: ${result.chatteur} — ${result.montant_brut}€ (plateforme ${result.plateforme_id}) [${result.date_rapport}]`);
    logActivity(null, 'telegram_import', 'vente', result.vente_id, `${result.chatteur} — ${result.montant_brut}€`);
    // Notify chatteur that a vente was detected (in-app + Telegram DM)
    if (result.chatteur_id) {
      notifyChatteur(
        result.chatteur_id,
        'vente',
        'Vente détectée par Telegram',
        `${result.montant_brut}€ — ${result.date_rapport}`,
        '/chatteur/mes-ventes'
      );
      // Also send a Telegram DM confirmation
      const platName = result.plateforme_id === 1 ? 'OnlyFans' : result.plateforme_id === 2 ? 'Reveal' : `Plateforme #${result.plateforme_id}`;
      notifyVenteDetected(result.chatteur_id, result.montant_brut, platName, result.date_rapport).catch(() => {});
    }
  } else if (result.error) {
    if (result.existing_id) {
      console.log(`   ↳ Doublon ignoré (vente #${result.existing_id})`);
    } else {
      console.warn(`⚠️  Telegram: ${result.error} (sender: "${senderName}", group: ${chatId})`);
    }
  }
}

/**
 * Main polling loop
 */
async function pollLoop() {
  while (running) {
    try {
      // Create an AbortController for this poll cycle
      pollController = new AbortController();

      const updates = await apiCall('getUpdates', {
        offset: currentOffset,
        timeout: POLL_TIMEOUT,
        allowed_updates: JSON.stringify(['message']),
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

  // Load last offset and reset counters
  currentOffset = loadOffset();
  running = true;
  startedAt = new Date();
  messagesProcessed = 0;
  errorsCount = 0;
  lastError = null;

  // Start polling in background (non-blocking)
  pollLoop().catch(err => {
    console.error('❌ Polling Telegram arrêté:', err.message);
    running = false;
    startedAt = null;
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
 * Get current bot status and metrics
 */
function getStatus() {
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
