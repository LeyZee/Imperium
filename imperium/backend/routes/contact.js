const express = require('express');
const router = express.Router();
const db = require('../database');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../utils/logger');

// Create contact_submissions table if not exists
db.exec(`CREATE TABLE IF NOT EXISTS contact_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instagram TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  traite INTEGER DEFAULT 0
)`);

// POST /api/contact — public endpoint, no auth required
router.post('/', asyncHandler(async (req, res) => {
  const { instagram, whatsapp, message } = req.body;

  if (!instagram || !whatsapp) {
    return res.status(400).json({ error: 'Instagram et WhatsApp sont requis' });
  }

  // Basic sanitization
  const ig = String(instagram).trim().slice(0, 200);
  const wa = String(whatsapp).trim().slice(0, 50);
  const msg = message ? String(message).trim().slice(0, 2000) : null;

  db.prepare(
    'INSERT INTO contact_submissions (instagram, whatsapp, message) VALUES (?, ?, ?)'
  ).run(ig, wa, msg ?? null);

  logger.info('New contact submission', { instagram: ig });

  res.json({ success: true, message: 'Demande reçue' });
}));

module.exports = router;
