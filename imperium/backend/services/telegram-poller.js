const fetch = require('node-fetch');
const db = require('../database');
const { GROUP_PLATFORM, processMessage } = require('./telegram-parser');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const POLL_TIMEOUT = 30; // seconds
const RETRY_DELAY = 5000; // ms

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
  console.log(`📨 Telegram [${chatTitle}] from "${senderName}": ${preview}`);

  if (!hasText) return;

  // Only process messages from configured groups
  if (!GROUP_PLATFORM[chatId]) {
    console.log(`   ↳ Groupe ignoré (chat_id: ${chatId})`);
    return;
  }

  const text = msg.text;

  const result = processMessage({
    group_id: chatId,
    sender_name: senderName,
    message: text,
  });

  if (result.skipped) {
    console.log(`   ↳ Message ignoré (pas de "montant brut")`);
    return;
  }

  if (result.success) {
    messagesProcessed++;
    lastMessageAt = new Date();
    console.log(`✅ Vente importée: ${result.chatteur} — ${result.montant_brut}€ (plateforme ${result.plateforme_id}) [${result.date_rapport}]`);
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
  };
}

module.exports = { start, stop, getStatus };
