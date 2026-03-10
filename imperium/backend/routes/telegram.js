const express = require('express');
const rateLimit = require('express-rate-limit');
const { processMessage } = require('../services/telegram-parser');
const telegramPoller = require('../services/telegram-poller');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const db = require('../database');

const router = express.Router();

const TELEGRAM_SECRET = process.env.TELEGRAM_SECRET || '';

const telegramLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Trop de requêtes Telegram, réessayez dans 1 minute.' }
});

function telegramAuth(req, res, next) {
  if (!TELEGRAM_SECRET) {
    console.warn('⚠️  TELEGRAM_SECRET non configuré — endpoint Telegram désactivé');
    return res.status(503).json({ error: 'Endpoint Telegram non configuré (TELEGRAM_SECRET manquant)' });
  }
  const token = req.headers['x-telegram-secret'] || req.body.secret;
  if (token !== TELEGRAM_SECRET) {
    return res.status(401).json({ error: 'Token Telegram invalide' });
  }
  next();
}

/**
 * POST /api/telegram/report — webhook endpoint (kept for compatibility)
 */
router.post('/report', telegramLimiter, telegramAuth, (req, res) => {
  const { group_id, sender_name, message } = req.body;

  if (!group_id || !message) {
    return res.status(400).json({ error: 'group_id et message requis' });
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
});

/**
 * GET /api/telegram/report — list imported ventes
 */
router.get('/report', authMiddleware, adminOnly, (req, res) => {
  const db = require('../database');
  const ventes = db.prepare(`
    SELECT v.*, c.prenom as chatteur, p.nom as plateforme
    FROM ventes v
    JOIN chatteurs c ON c.id = v.chatteur_id
    JOIN plateformes p ON p.id = v.plateforme_id
    WHERE v.notes LIKE 'Import Telegram%'
    ORDER BY v.created_at DESC
    LIMIT 50
  `).all();
  res.json(ventes);
});

/* ─── Bot control endpoints (admin-only) ─── */

const controlLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Trop de requêtes, réessayez dans 1 minute.' }
});

/**
 * GET /api/telegram/status — Bot status + recent imports
 */
router.get('/status', authMiddleware, adminOnly, (req, res) => {
  const status = telegramPoller.getStatus();

  const recentImports = db.prepare(`
    SELECT v.id, v.montant_brut, v.notes, v.created_at,
      c.prenom AS chatteur_prenom,
      p.nom AS plateforme_nom, p.devise
    FROM ventes v
    JOIN chatteurs c ON c.id = v.chatteur_id
    JOIN plateformes p ON p.id = v.plateforme_id
    WHERE v.notes LIKE 'Import Telegram%'
    ORDER BY v.created_at DESC
    LIMIT 20
  `).all();

  const todayCount = db.prepare(`
    SELECT COUNT(*) AS count FROM ventes
    WHERE notes LIKE 'Import Telegram%'
    AND date(created_at) = date('now')
  `).get();

  res.json({
    ...status,
    recentImports,
    todayImports: todayCount?.count || 0,
  });
});

/**
 * POST /api/telegram/start — Start the bot
 */
router.post('/start', authMiddleware, adminOnly, controlLimiter, async (req, res) => {
  const status = telegramPoller.getStatus();
  if (status.running) {
    return res.status(409).json({ error: 'Le bot est déjà en cours d\'exécution' });
  }
  if (!status.hasBotToken) {
    return res.status(400).json({ error: 'TELEGRAM_BOT_TOKEN non configuré' });
  }
  try {
    await telegramPoller.start();
    res.json({ message: 'Bot Telegram démarré', status: telegramPoller.getStatus() });
  } catch (err) {
    res.status(500).json({ error: `Impossible de démarrer le bot: ${err.message}` });
  }
});

/**
 * POST /api/telegram/stop — Stop the bot
 */
router.post('/stop', authMiddleware, adminOnly, controlLimiter, (req, res) => {
  const status = telegramPoller.getStatus();
  if (!status.running) {
    return res.status(409).json({ error: 'Le bot est déjà arrêté' });
  }
  telegramPoller.stop();
  res.json({ message: 'Bot Telegram arrêté', status: telegramPoller.getStatus() });
});

module.exports = router;
