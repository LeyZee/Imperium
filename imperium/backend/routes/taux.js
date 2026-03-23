const express = require('express');
const fetch = require('node-fetch');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');
const { invalidateRateCache } = require('../utils/rateCache');

const router = express.Router();

// GET /api/taux — get current rates
router.get('/', authMiddleware, asyncHandler((req, res) => {
  const rates = db.prepare(
    'SELECT * FROM taux_change ORDER BY date_maj DESC, devise_base'
  ).all();
  res.json(rates);
}));

// GET /api/taux/current?from=USD&to=EUR
router.get('/current', authMiddleware, asyncHandler((req, res) => {
  const { from = 'USD', to = 'EUR' } = req.query;
  const rate = db.prepare(
    'SELECT * FROM taux_change WHERE devise_base = ? AND devise_cible = ? ORDER BY date_maj DESC LIMIT 1'
  ).get(from, to);
  res.json(rate || { taux: 0.92 });
}));

// POST /api/taux/refresh — fetch latest rates from frankfurter.app
router.post('/refresh', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  try {
    const response = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR');
    if (!response.ok) throw new Error('API unavailable');
    const data = await response.json();

    const taux = data.rates.EUR;
    const today = new Date().toISOString().split('T')[0];

    db.prepare(`
      INSERT OR REPLACE INTO taux_change (devise_base, devise_cible, taux, date_maj)
      VALUES (?, ?, ?, ?)
    `).run('USD', 'EUR', taux, today);

    invalidateRateCache();
    res.json({ taux, date_maj: today, source: 'frankfurter.app' });
  } catch (err) {
    // Fallback: update date only
    const today = new Date().toISOString().split('T')[0];
    const existing = db.prepare('SELECT taux FROM taux_change WHERE devise_base = ? ORDER BY date_maj DESC LIMIT 1').get('USD');
    res.status(200).json({
      taux: existing?.taux || 0.92,
      date_maj: today,
      error: 'API indisponible, taux inchangé',
      fallback: true
    });
  }
}));

// Check if refresh is needed (1st or 15th of month)
router.post('/check', authMiddleware, asyncHandler(async (req, res) => {
  const today = new Date();
  const day = today.getDate();
  const todayStr = today.toISOString().split('T')[0];

  if (day !== 1 && day !== 15) {
    return res.json({ needed: false, message: 'Pas de mise à jour nécessaire aujourd\'hui' });
  }

  const latest = db.prepare('SELECT date_maj FROM taux_change WHERE devise_base = ? ORDER BY date_maj DESC LIMIT 1').get('USD');
  if (latest?.date_maj === todayStr) {
    return res.json({ needed: false, message: 'Taux déjà à jour aujourd\'hui' });
  }

  res.json({ needed: true, message: `Mise à jour du ${day}` });
}));

module.exports = router;
