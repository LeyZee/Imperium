const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../database');
const { getPeriode } = require('../utils/period');

const router = express.Router();

// Secret token pour authentifier les requêtes du bot Telegram
const TELEGRAM_SECRET = process.env.TELEGRAM_SECRET || '';

// Rate limiting sur l'endpoint Telegram
const telegramLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Trop de requêtes Telegram, réessayez dans 1 minute.' }
});

/**
 * Middleware : vérifie le token secret Telegram
 */
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

// Map groupe Telegram → plateforme_id
const GROUP_PLATFORM = {
  '-1003327391292': 1, // OnlyFansShift → OnlyFans (USD)
  '-1003428313874': 2, // RevealShiftJournée → Reveal (EUR)
  '-1003438053612': 2, // RevealShiftSoirée → Reveal (EUR)
};

// Map prénom chatteur → id (insensible à la casse)
function findChatteur(name) {
  if (!name) return null;
  const normalized = name.toLowerCase().replace(/[-\s]/g, '');
  const all = db.prepare('SELECT * FROM chatteurs WHERE actif = 1').all([]);
  return all.find(c => {
    const p = c.prenom.toLowerCase().replace(/[-\s]/g, '');
    return p === normalized || normalized.includes(p) || p.includes(normalized);
  });
}

/**
 * POST /api/telegram/report
 * Body: {
 *   group_id: string,    // ex: "-1003327391292"
 *   sender_name: string, // prénom du chatteur
 *   sender_id: number,   // Telegram user ID
 *   message: string,     // texte brut du rapport
 *   date_unix: number    // timestamp unix optionnel
 * }
 */
router.post('/report', telegramLimiter, telegramAuth, (req, res) => {
  const { group_id, sender_name, message } = req.body;

  if (!group_id || !message) {
    return res.status(400).json({ error: 'group_id et message requis' });
  }

  // Identifier la plateforme
  const plateforme_id = GROUP_PLATFORM[group_id.toString()];
  if (!plateforme_id) {
    return res.status(400).json({ error: 'Groupe non reconnu: ' + group_id });
  }

  // Parser le message
  // Format: "Chatting report du DD/MM/YYYY\nMontant Brut: XX $"
  // ou variantes: "Montant Brut: XX$", "Montant brut: XX €", etc.
  const dateMatch = message.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}|\d{2})/);
  const montantMatch = message.match(/montant\s*brut\s*:?\s*([\d.,]+)\s*[$€]?/i);

  if (!montantMatch) {
    return res.status(422).json({ error: 'Impossible de parser le montant du message', message });
  }

  const montant_brut = parseFloat(montantMatch[1].replace(',', '.'));
  if (isNaN(montant_brut) || montant_brut <= 0) {
    return res.status(422).json({ error: 'Montant invalide: ' + montantMatch[1] });
  }

  // Date du rapport
  let reportDate;
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    const year = y.length === 2 ? '20' + y : y;
    reportDate = `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  } else {
    reportDate = new Date().toISOString().split('T')[0];
  }

  // Période : 1→15 ou 15→1er du mois suivant
  const { debut: periode_debut, fin: periode_fin } = getPeriode(reportDate);

  // Identifier le chatteur
  const chatteur = findChatteur(sender_name);
  if (!chatteur) {
    return res.status(404).json({
      error: `Chatteur non trouvé: "${sender_name}"`,
      suggestion: 'Vérifier le nom ou l\'assigner manuellement'
    });
  }

  // Déduplication : vérifier si une vente identique existe déjà
  const duplicate = db.prepare(`
    SELECT id FROM ventes
    WHERE chatteur_id = ? AND plateforme_id = ? AND montant_brut = ?
      AND periode_debut = ? AND periode_fin = ?
      AND notes LIKE 'Import Telegram%'
  `).get(chatteur.id, plateforme_id, montant_brut, periode_debut, periode_fin);

  if (duplicate) {
    return res.status(409).json({
      error: 'Vente déjà importée (doublon détecté)',
      existing_vente_id: duplicate.id
    });
  }

  // Insérer la vente
  const notes = `Import Telegram — ${message.substring(0, 100)}`;
  const result = db.prepare(`
    INSERT INTO ventes (chatteur_id, plateforme_id, montant_brut, periode_debut, periode_fin, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run([chatteur.id, plateforme_id, montant_brut, periode_debut, periode_fin, notes]);

  res.status(201).json({
    success: true,
    vente_id: result.lastInsertRowid,
    chatteur: `${chatteur.prenom} (id=${chatteur.id})`,
    plateforme_id,
    montant_brut,
    periode: `${periode_debut} → ${periode_fin}`,
    date_rapport: reportDate
  });
});

// GET /api/telegram/report — liste les rapports importés
router.get('/report', (req, res) => {
  const ventes = db.prepare(`
    SELECT v.*, c.prenom as chatteur, p.nom as plateforme
    FROM ventes v
    JOIN chatteurs c ON c.id = v.chatteur_id
    JOIN plateformes p ON p.id = v.plateforme_id
    WHERE v.notes LIKE 'Import Telegram%'
    ORDER BY v.created_at DESC
    LIMIT 50
  `).all([]);
  res.json(ventes);
});

module.exports = router;
