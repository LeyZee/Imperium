const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { processMessage } = require('../services/telegram-parser');
const telegramPoller = require('../services/telegram-poller');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const db = require('../database');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { logActivity } = require('../utils/activityLogger');
const { recalculatePaies } = require('../services/paie-calculator');
const { broadcastToAll, getLog: getTelegramLog } = require('../utils/telegramSender');

const router = express.Router();

const TELEGRAM_SECRET = process.env.TELEGRAM_SECRET || '';

const telegramLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Trop de requêtes Telegram, réessayez dans 1 minute.' }
});

function telegramAuth(req, res, next) {
  if (!TELEGRAM_SECRET) {
    logger.warn('TELEGRAM_SECRET non configuré — endpoint Telegram désactivé');
    throw new ApiError(503, 'Endpoint Telegram non configuré (TELEGRAM_SECRET manquant)');
  }
  const token = req.headers['x-telegram-secret'] || req.body.secret;
  if (!token || typeof token !== 'string') {
    throw new ApiError(401, 'Token Telegram invalide');
  }
  // Timing-safe comparison to prevent timing attacks
  try {
    const tokenBuf = Buffer.from(token);
    const secretBuf = Buffer.from(TELEGRAM_SECRET);
    if (tokenBuf.length !== secretBuf.length || !crypto.timingSafeEqual(tokenBuf, secretBuf)) {
      throw new ApiError(401, 'Token Telegram invalide');
    }
  } catch {
    throw new ApiError(401, 'Token Telegram invalide');
  }
  next();
}

/**
 * POST /api/telegram/report — webhook endpoint (kept for compatibility)
 */
router.post('/report', telegramLimiter, telegramAuth, asyncHandler((req, res) => {
  const { group_id, sender_name, message } = req.body;

  if (!group_id || !message) {
    throw new ApiError(400, 'group_id et message requis');
  }

  const result = processMessage({ group_id, sender_name, message });

  if (result.skipped) {
    return res.status(200).json({ message: 'Message ignoré (pas un rapport)' });
  }

  if (result.error) {
    const status = result.existing_id ? 409 : result.error.includes('non trouvé') ? 404 : 422;
    return res.status(status).json(result);
  }

  res.status(201).json(result);
}));

/**
 * GET /api/telegram/report — list imported ventes
 */
router.get('/report', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const db = require('../database');
  const ventes = db.prepare(`
    SELECT v.*, c.prenom as chatteur, p.nom as plateforme
    FROM ventes v
    JOIN chatteurs c ON c.id = v.chatteur_id
    JOIN plateformes p ON p.id = v.plateforme_id
    WHERE v.source = 'telegram'
    ORDER BY v.created_at DESC
    LIMIT 50
  `).all();
  res.json(ventes);
}));

/* ─── Bot control endpoints (admin-only) ─── */

const controlLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Trop de requêtes, réessayez dans 1 minute.' }
});

/**
 * GET /api/telegram/status — Bot status + recent imports
 */
router.get('/status', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const status = telegramPoller.getStatus();

  const recentImports = db.prepare(`
    SELECT v.id, v.montant_brut, v.modele_id, v.shift_id, v.notes, v.created_at,
      v.periode_debut, v.periode_fin,
      c.prenom AS chatteur_prenom, c.couleur AS chatteur_couleur,
      p.nom AS plateforme_nom, p.devise, p.couleur_fond, p.couleur_texte,
      m.pseudo AS modele_pseudo
    FROM ventes v
    JOIN chatteurs c ON c.id = v.chatteur_id
    JOIN plateformes p ON p.id = v.plateforme_id
    LEFT JOIN modeles m ON m.id = v.modele_id
    WHERE v.source = 'telegram'
    ORDER BY v.created_at DESC
    LIMIT 20
  `).all();

  const todayCount = db.prepare(`
    SELECT COUNT(*) AS count FROM ventes
    WHERE source = 'telegram'
    AND date(created_at) = date('now')
  `).get();

  const todayComplete = db.prepare(`
    SELECT COUNT(*) AS count FROM ventes
    WHERE source = 'telegram'
    AND date(created_at) = date('now')
    AND modele_id IS NOT NULL AND shift_id IS NOT NULL
  `).get();

  const todayWarnings = db.prepare(`
    SELECT COUNT(*) AS count FROM ventes
    WHERE source = 'telegram'
    AND date(created_at) = date('now')
    AND (modele_id IS NULL OR shift_id IS NULL)
  `).get();

  // Chatteur Telegram registration status
  const chatteurs = db.prepare(`
    SELECT c.id, c.prenom, c.couleur, c.role, c.telegram_user_id, c.telegram_dm_ok,
      c.pays
    FROM chatteurs c
    WHERE c.actif = 1 AND c.role != 'va'
    ORDER BY c.prenom
  `).all();

  res.json({
    ...status,
    recentImports,
    todayImports: todayCount?.count || 0,
    todayComplete: todayComplete?.count || 0,
    todayWarnings: todayWarnings?.count || 0,
    chatteurs,
  });
}));

/**
 * POST /api/telegram/start — Start the bot
 */
router.post('/start', authMiddleware, adminOnly, controlLimiter, asyncHandler(async (req, res) => {
  const statusBefore = telegramPoller.getStatus();
  if (!statusBefore.hasBotToken) {
    throw new ApiError(400, 'TELEGRAM_BOT_TOKEN non configuré');
  }
  const wasRunning = statusBefore.running;
  // start() handles graceful restart if already running (stop + wait + start)
  await telegramPoller.start();
  const msg = wasRunning ? 'Bot Telegram redémarré' : 'Bot Telegram démarré';
  res.json({ message: msg, status: telegramPoller.getStatus() });
}));

/**
 * POST /api/telegram/stop — Stop the bot
 */
router.post('/stop', authMiddleware, adminOnly, controlLimiter, asyncHandler((req, res) => {
  const status = telegramPoller.getStatus();
  if (!status.running) {
    throw new ApiError(409, 'Le bot est déjà arrêté');
  }
  telegramPoller.stop();
  res.json({ message: 'Bot Telegram arrêté', status: telegramPoller.getStatus() });
}));

/**
 * DELETE /api/telegram/imports — Bulk delete all Telegram imports
 */
router.delete('/imports', authMiddleware, adminOnly, asyncHandler((req, res) => {
  // Collect affected periods for recalculation
  const periods = db.prepare(`
    SELECT DISTINCT periode_debut, periode_fin FROM ventes
    WHERE source = 'telegram'
  `).all();

  // Audit trail: log totals before deletion
  const totalAmount = db.prepare("SELECT COALESCE(SUM(montant_brut), 0) as total FROM ventes WHERE source = 'telegram'").get();

  const result = db.prepare("DELETE FROM ventes WHERE source = 'telegram'").run();

  // Recalculate paies for all affected periods
  for (const p of periods) {
    try { recalculatePaies(p.periode_debut, p.periode_fin); } catch (err) {
      logger.error('Erreur recalcul paies après suppression imports', { error: err.message });
    }
  }

  logActivity(req.user.id, 'delete_all_telegram_imports', 'vente', null,
    JSON.stringify({ count: result.changes, total_montant: totalAmount.total, periods: periods.length }));
  res.json({ message: `${result.changes} import(s) Telegram supprimé(s)`, count: result.changes });
}));

/**
 * POST /api/telegram/broadcast — Send a message to all chatteurs via Telegram DM
 */
router.post('/broadcast', authMiddleware, adminOnly, controlLimiter, asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) throw new ApiError(400, 'Message requis');

  // Limit message length (4096 = Telegram max)
  if (message.length > 4096) throw new ApiError(400, 'Message trop long (max 4096 caract\u00e8res)');

  const stats = await broadcastToAll(message.trim(), { _type: 'admin_broadcast' });
  logActivity(req.user.id, 'telegram_broadcast', 'telegram', null, `Envoy\u00e9: ${stats.sent}, \u00c9chou\u00e9: ${stats.failed}, Non li\u00e9s: ${stats.skipped}`);

  res.json({
    message: 'Broadcast envoy\u00e9',
    ...stats,
  });
}));

/**
 * GET /api/telegram/log — Journal des messages Telegram envoy\u00e9s
 */
router.get('/log', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  const filters = {};

  if (req.query.direction) filters.direction = req.query.direction;
  if (req.query.type) filters.messageType = req.query.type;
  if (req.query.chatteur_id) filters.chatteurId = parseInt(req.query.chatteur_id);
  if (req.query.success !== undefined) filters.success = req.query.success === '1' || req.query.success === 'true';
  if (req.query.date_from) filters.dateFrom = req.query.date_from;
  if (req.query.date_to) filters.dateTo = req.query.date_to;

  const result = getTelegramLog(limit, offset, filters);
  res.json(result);
}));

/**
 * DELETE /api/telegram/log — Clear all telegram log entries
 */
router.delete('/log', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const result = db.prepare('DELETE FROM telegram_log').run();
  logActivity(req.user.id, 'clear_telegram_log', 'telegram', null, `${result.changes} entrées supprimées`);
  res.json({ message: `${result.changes} entrée(s) supprimée(s)`, count: result.changes });
}));

/**
 * POST /api/telegram/announce-start — Send /start instructions to all shift groups
 */
router.post('/announce-start', authMiddleware, adminOnly, controlLimiter, asyncHandler(async (req, res) => {
  const status = telegramPoller.getStatus();
  if (!status.running) {
    throw new ApiError(409, 'Le bot doit \u00eatre d\u00e9marr\u00e9 pour envoyer des annonces');
  }

  // Categorize all active chatteurs by their Telegram status
  const registered = db.prepare(
    "SELECT prenom FROM chatteurs WHERE actif = 1 AND telegram_user_id IS NOT NULL AND telegram_dm_ok = 1 AND role != 'va' ORDER BY prenom"
  ).all();
  const unregistered = db.prepare(
    "SELECT prenom FROM chatteurs WHERE actif = 1 AND telegram_user_id IS NOT NULL AND (telegram_dm_ok = 0 OR telegram_dm_ok IS NULL) AND role != 'va' ORDER BY prenom"
  ).all();
  const noTelegram = db.prepare(
    "SELECT prenom FROM chatteurs WHERE actif = 1 AND telegram_user_id IS NULL AND role != 'va' ORDER BY prenom"
  ).all();

  let statusList = '';

  if (registered.length > 0) {
    statusList += '\n\n\u2705 <b>D\u00e9j\u00e0 enregistr\u00e9s :</b>\n' +
      registered.map(c => `\u2022 ${c.prenom} \u2714\uFE0F`).join('\n');
  }
  if (unregistered.length > 0) {
    statusList += '\n\n\uD83D\uDD34 <b>D\u00e9tect\u00e9s mais pas encore /start :</b>\n' +
      unregistered.map(c => `\u2022 <b>${c.prenom}</b> \u2190 doit faire /start !`).join('\n');
  }
  if (noTelegram.length > 0) {
    statusList += '\n\n\u26AA <b>Pas encore d\u00e9tect\u00e9s :</b>\n' +
      noTelegram.map(c => `\u2022 <b>${c.prenom}</b>`).join('\n');
  }

  const needAction = unregistered.length + noTelegram.length;
  const message =
    `\uD83D\uDCE2 <b>IMPORTANT \u2014 Activez vos notifications Imperium !</b>\n\n` +
    `Le bot <b>@${status.botUsername}</b> vous envoie des <b>notifications en DM</b> :\n` +
    `\u2022 \u2705 Confirmation quand votre vente est import\u00e9e\n` +
    `\u2022 \u23F0 Rappels de shift\n` +
    `\u2022 \uD83D\uDCCA R\u00e9cap quotidien de vos ventes\n` +
    `\u2022 \uD83C\uDFC6 Paliers de primes atteints\n\n` +
    (needAction > 0
      ? `\uD83D\uDC49 <b>${needAction} personne${needAction > 1 ? 's' : ''} ${needAction > 1 ? 'doivent' : 'doit'} encore s'enregistrer !</b>\n` +
        `Envoyez <code>/start</code> en message priv\u00e9 \u00e0 @${status.botUsername}\n` +
        `C'est rapide : cliquez sur votre pr\u00e9nom et c'est fait !`
      : `\u2705 <b>Tout le monde est enregistr\u00e9 !</b> Bravo \u00e0 toute l'\u00e9quipe.`) +
    statusList;

  const results = await telegramPoller.sendToGroups(message);
  logActivity(req.user.id, 'telegram_announce_start', 'telegram', null, `Envoy\u00e9 dans ${results.sent} groupe(s)`);

  res.json({
    message: `Annonce envoy\u00e9e dans ${results.sent} groupe(s)`,
    ...results,
    registeredCount: registered.length,
    unregisteredCount: unregistered.length,
    noTelegramCount: noTelegram.length,
  });
}));

module.exports = router;
