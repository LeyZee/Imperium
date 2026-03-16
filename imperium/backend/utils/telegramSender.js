const db = require('../database');
const logger = require('./logger');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ─── Security: HTML sanitization for Telegram messages ───────────
// Telegram HTML only supports: <b>, <i>, <u>, <s>, <a>, <code>, <pre>
// Strip any other HTML tags to prevent injection
const ALLOWED_TAGS = ['b', 'i', 'u', 's', 'a', 'code', 'pre', 'em', 'strong'];
function sanitizeHTML(text) {
  if (typeof text !== 'string') return '';
  // Escape user-provided content that could contain HTML
  return text
    .replace(/<\/?([a-zA-Z]+)[^>]*>/g, (match, tag) => {
      return ALLOWED_TAGS.includes(tag.toLowerCase()) ? match : '';
    });
}

// Escape ALL HTML for user-provided strings (names, amounts, etc.)
function escapeHTML(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Rate limiting per chat ───────────────────────────────
const _lastSent = new Map(); // chat_id → timestamp
const MIN_INTERVAL = 1000; // 1 second between messages to same chat (Telegram API limit)

function canSendTo(chatId) {
  const last = _lastSent.get(chatId);
  if (last && Date.now() - last < MIN_INTERVAL) return false;
  _lastSent.set(chatId, Date.now());
  return true;
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const [id, ts] of _lastSent) {
    if (ts < cutoff) _lastSent.delete(id);
  }
}, 300000);

// ─── Message length limit ─────────────────────────────────
const MAX_MESSAGE_LENGTH = 4096; // Telegram API limit

function truncateMessage(text) {
  if (text.length <= MAX_MESSAGE_LENGTH) return text;
  return text.substring(0, MAX_MESSAGE_LENGTH - 20) + '\n\n[message tronqu\u00e9]';
}

// ─── DB Logging ───────────────────────────────────────────
// Table telegram_log is created via migration in database.js

function logTelegramMessage(chatId, chatteurId, chatteurPrenom, messageType, content, success, errorMessage) {
  try {
    db.prepare(`
      INSERT INTO telegram_log (direction, chat_id, chatteur_id, chatteur_prenom, message_type, content, success, error_message)
      VALUES ('out', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(chatId ?? ''),
      chatteurId ?? null,
      chatteurPrenom ?? null,
      messageType ?? 'message',
      (content ?? '').substring(0, 1000), // Limit stored content
      success ? 1 : 0,
      errorMessage ?? null
    );
  } catch (e) {
    logger.debug('telegram_log insert failed', { error: e.message });
  }
}

/**
 * Log an incoming Telegram event (registration, auto-link, vente import, etc.)
 */
function logTelegramIncoming(chatId, chatteurId, chatteurPrenom, messageType, content, success = true, errorMessage = null) {
  try {
    db.prepare(`
      INSERT INTO telegram_log (direction, chat_id, chatteur_id, chatteur_prenom, message_type, content, success, error_message)
      VALUES ('in', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      String(chatId ?? ''),
      chatteurId ?? null,
      chatteurPrenom ?? null,
      messageType ?? 'event',
      (content ?? '').substring(0, 1000),
      success ? 1 : 0,
      errorMessage ?? null
    );
  } catch (e) {
    logger.debug('telegram_log incoming insert failed', { error: e.message });
  }
}

// ─── Core send function ───────────────────────────────────

/**
 * Send a Telegram message to a specific chat_id.
 * Silent fail — never breaks the caller.
 * @returns {boolean} true if sent successfully
 */
async function sendTelegramMessage(chatId, text, options = {}) {
  if (!BOT_TOKEN) {
    logger.debug('Telegram DM skipped \u2014 no BOT_TOKEN');
    return false;
  }

  // Validate inputs
  if (!chatId || typeof text !== 'string' || !text.trim()) {
    logger.warn('sendTelegramMessage: invalid params', { chatId, textLength: text?.length });
    return false;
  }

  // Rate limit check
  if (!canSendTo(String(chatId))) {
    logger.debug('Telegram rate limited', { chatId });
    // Retry after a short delay
    await new Promise(r => setTimeout(r, MIN_INTERVAL));
  }

  // Truncate if needed
  const finalText = truncateMessage(text);

  try {
    const fetch = require('node-fetch');
    const params = new URLSearchParams({
      chat_id: String(chatId),
      text: finalText,
      parse_mode: options.parseMode || 'HTML',
    });
    const res = await fetch(`${API_BASE}/sendMessage?${params}`, { timeout: 10000 });
    const data = await res.json();
    if (!data.ok) {
      // Downgrade "can't initiate conversation" to debug (expected when user hasn't /start the bot)
      const isForbidden = (data.description || '').includes('bot can\'t initiate conversation');
      if (isForbidden) {
        logger.debug('Telegram DM skipped — user has not started conversation with bot', { chatId, chatteur: options._chatteurPrenom });
      } else {
        logger.warn('Telegram sendMessage failed', { chatId, error: data.description });
      }
      logTelegramMessage(chatId, options._chatteurId, options._chatteurPrenom, options._type, finalText, false, data.description);
      return false;
    }
    logTelegramMessage(chatId, options._chatteurId, options._chatteurPrenom, options._type, finalText, true, null);
    return true;
  } catch (err) {
    logger.warn('Telegram sendMessage error', { chatId, error: err.message });
    logTelegramMessage(chatId, options._chatteurId, options._chatteurPrenom, options._type, finalText, false, err.message);
    return false;
  }
}

/**
 * Send a Telegram DM to a chatteur by their chatteur_id.
 * Looks up telegram_user_id from DB. Skips silently if not linked.
 * @returns {boolean} true if sent
 */
async function sendToChatteur(chatteurId, text, options = {}) {
  try {
    const chatteur = db.prepare('SELECT telegram_user_id, telegram_dm_ok, prenom FROM chatteurs WHERE id = ?').get(chatteurId);
    if (!chatteur?.telegram_user_id) return false;
    // Only send DMs to chatteurs who completed /start registration (not just auto-linked from group)
    if (!chatteur.telegram_dm_ok) {
      logger.debug('Telegram DM skipped — chatteur auto-linked but has not /start the bot', { chatteur: chatteur.prenom });
      return false;
    }
    return await sendTelegramMessage(chatteur.telegram_user_id, text, {
      ...options,
      _chatteurId: chatteurId,
      _chatteurPrenom: chatteur.prenom,
    });
  } catch (err) {
    logger.warn('sendToChatteur failed', { chatteurId, error: err.message });
    return false;
  }
}

/**
 * Broadcast a Telegram message to ALL active chatteurs with telegram_user_id.
 * @returns {{ sent: number, failed: number, skipped: number }}
 */
async function broadcastToAll(text, options = {}) {
  const stats = { sent: 0, failed: 0, skipped: 0 };
  try {
    const chatteurs = db.prepare(
      'SELECT id, telegram_user_id, prenom FROM chatteurs WHERE actif = 1 AND telegram_user_id IS NOT NULL'
    ).all();

    for (const c of chatteurs) {
      const ok = await sendTelegramMessage(c.telegram_user_id, text, {
        ...options,
        _chatteurId: c.id,
        _chatteurPrenom: c.prenom,
      });
      if (ok) {
        stats.sent++;
      } else {
        stats.failed++;
      }
    }

    // Count chatteurs without Telegram linked
    const totalActive = db.prepare('SELECT COUNT(*) as n FROM chatteurs WHERE actif = 1 AND role != \'va\'').get();
    stats.skipped = (totalActive?.n || 0) - chatteurs.length;
  } catch (err) {
    logger.error('broadcastToAll failed', { error: err.message });
  }
  return stats;
}

// ─── Notification Templates ───────────────────────────────

/**
 * Notify chatteur that their vente was detected from Telegram.
 */
async function notifyVenteDetected(chatteurId, montant, plateforme, date) {
  const text = `\u2705 <b>Vente d\u00e9tect\u00e9e !</b>\n\n` +
    `Montant : <b>${escapeHTML(montant)}\u20AC</b>\n` +
    `Plateforme : ${escapeHTML(plateforme)}\n` +
    `Date : ${escapeHTML(date)}\n\n` +
    `Ta vente a bien \u00e9t\u00e9 import\u00e9e automatiquement.`;
  return sendToChatteur(chatteurId, text, { _type: 'vente_detected' });
}

/**
 * Notify chatteur that they reached a new palier.
 */
async function notifyPalierReached(chatteurId, palierLabel, palierEmoji, bonus) {
  const text = `\uD83C\uDFC6 <b>Nouveau palier atteint !</b>\n\n` +
    `${escapeHTML(palierEmoji)} Tu as atteint le palier <b>${escapeHTML(palierLabel)}</b> !\n` +
    `Bonus : +${escapeHTML(bonus)}\u20AC\n\n` +
    `Continue comme \u00E7a ! \uD83D\uDCAA`;
  return sendToChatteur(chatteurId, text, { _type: 'palier_reached' });
}

/**
 * Notify chatteur of their paie summary.
 */
async function notifyPaieSummary(chatteurId, periodeDebut, periodeFin, commission, prime, malus, total, statut) {
  const formatDate = (d) => d.split('-').reverse().join('/');
  const text = `\uD83D\uDCB0 <b>R\u00e9sum\u00e9 de paie</b>\n\n` +
    `P\u00e9riode : ${formatDate(periodeDebut)} \u2192 ${formatDate(periodeFin)}\n` +
    `Commission : ${escapeHTML(commission)}\u20AC\n` +
    (prime > 0 ? `Prime : +${escapeHTML(prime)}\u20AC\n` : '') +
    (malus > 0 ? `Malus : -${escapeHTML(malus)}\u20AC\n` : '') +
    `\n<b>Total : ${escapeHTML(total)}\u20AC</b>\n` +
    `Statut : ${escapeHTML(statut)}`;
  return sendToChatteur(chatteurId, text, { _type: 'paie_summary' });
}

/**
 * Notify chatteur of an upcoming shift.
 */
async function notifyShiftReminder(chatteurId, plateforme, modele, date, creneau, heures) {
  const formatDate = (d) => d.split('-').reverse().join('/');
  const text = `\u23F0 <b>Rappel de shift</b>\n\n` +
    `Plateforme : ${escapeHTML(plateforme)}\n` +
    (modele ? `Mod\u00e8le : ${escapeHTML(modele)}\n` : '') +
    `Date : ${formatDate(date)}\n` +
    `Cr\u00e9neau : ${escapeHTML(heures)}\n\n` +
    `N'oublie pas de poster ton rapport dans le groupe \u00e0 la fin !`;
  return sendToChatteur(chatteurId, text, { _type: 'shift_reminder' });
}

/**
 * Notify chatteur that their shift report is missing.
 */
async function notifyMissingReport(chatteurId, plateforme, date, creneau, heures) {
  const formatDate = (d) => d.split('-').reverse().join('/');
  const text = `\u26A0\uFE0F <b>Rapport manquant</b>\n\n` +
    `Tu avais un shift <b>${escapeHTML(plateforme)}</b> le ${formatDate(date)} (${escapeHTML(heures)}).\n\n` +
    `Je n'ai pas re\u00E7u de rapport. N'oublie pas de poster ton montant dans le groupe !`;
  return sendToChatteur(chatteurId, text, { _type: 'missing_report' });
}

/**
 * Send admin announcement to all chatteurs via Telegram.
 */
async function broadcastAnnouncement(title, content, authorName) {
  // Sanitize user-provided content
  const text = `\uD83D\uDCE2 <b>Annonce${authorName ? ` de ${escapeHTML(authorName)}` : ''}</b>\n\n` +
    `<b>${escapeHTML(title)}</b>\n\n` +
    escapeHTML(content);
  return broadcastToAll(text, { _type: 'announcement' });
}

/**
 * Notify about collective goal progress.
 */
async function notifyCollectiveGoal(progressPct, remaining, bonusPerChatteur) {
  const text = `\uD83C\uDFAF <b>Objectif collectif</b>\n\n` +
    `L'\u00e9quipe a atteint <b>${progressPct.toFixed(0)}%</b> de l'objectif !\n` +
    (remaining > 0 ? `Plus que <b>${remaining.toFixed(0)}\u20AC HT</b> pour d\u00e9bloquer le bonus.\n` : '') +
    (bonusPerChatteur > 0 ? `\nBonus actuel : <b>+${bonusPerChatteur}\u20AC</b> par chatteur` : '');
  return broadcastToAll(text, { _type: 'collective_goal' });
}

/**
 * Get recent telegram log entries (for admin journal view).
 */
function getLog(limit = 100, offset = 0, filters = {}) {
  let where = 'WHERE 1=1';
  const params = [];

  if (filters.direction) {
    where += ' AND direction = ?';
    params.push(filters.direction);
  }
  if (filters.messageType) {
    where += ' AND message_type = ?';
    params.push(filters.messageType);
  }
  if (filters.chatteurId) {
    where += ' AND chatteur_id = ?';
    params.push(filters.chatteurId);
  }
  if (filters.success !== undefined) {
    where += ' AND success = ?';
    params.push(filters.success ? 1 : 0);
  }
  if (filters.dateFrom) {
    where += ' AND created_at >= ?';
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    where += ' AND created_at <= ?';
    params.push(filters.dateTo + ' 23:59:59');
  }

  const rows = db.prepare(`
    SELECT * FROM telegram_log ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const total = db.prepare(`SELECT COUNT(*) as n FROM telegram_log ${where}`).get(...params);

  return { rows, total: total?.n || 0 };
}

module.exports = {
  sendTelegramMessage,
  sendToChatteur,
  broadcastToAll,
  escapeHTML,
  sanitizeHTML,
  getLog,
  logTelegramIncoming,
  // Notification templates
  notifyVenteDetected,
  notifyPalierReached,
  notifyPaieSummary,
  notifyShiftReminder,
  notifyMissingReport,
  broadcastAnnouncement,
  notifyCollectiveGoal,
};
