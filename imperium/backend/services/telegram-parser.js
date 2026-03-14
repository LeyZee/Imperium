const db = require('../database');
const { getPeriode } = require('../utils/period');
const { recalculatePaies } = require('./paie-calculator');
const logger = require('../utils/logger');

// Map groupe Telegram → plateforme_id
const GROUP_PLATFORM = {
  '-1003327391292': 2, // REVEAL Shift Soirée 🌙 → Reveal (EUR)
  '-1003428313874': 2, // REVEAL Shift Journée ☀️ → Reveal (EUR)
  '-1003438053612': 1, // ONLYFANS Shift → OnlyFans (USD)
};

/**
 * Find chatteur by Telegram user ID first, then fuzzy name match.
 * Auto-saves telegram_user_id on successful name match.
 */
function findChatteur(name, telegramUserId) {
  // 1. Try exact match by telegram_user_id
  if (telegramUserId) {
    const byId = db.prepare('SELECT * FROM chatteurs WHERE telegram_user_id = ? AND actif = 1').get(telegramUserId);
    if (byId) return byId;
  }

  // 2. Fallback: name match (exact → prefix, NO substring to avoid MARIE matching MARIE-ANGE)
  if (!name) return null;
  const normalized = name.toLowerCase().replace(/[-\s]/g, '');
  const all = db.prepare('SELECT * FROM chatteurs WHERE actif = 1').all([]);

  // 2a. Try exact match first
  let match = all.find(c => c.prenom.toLowerCase().replace(/[-\s]/g, '') === normalized);

  // 2b. Try prefix match only (normalized starts with prenom OR prenom starts with normalized)
  // but ONLY if there's exactly one match (ambiguity → reject)
  if (!match) {
    const prefixMatches = all.filter(c => {
      const p = c.prenom.toLowerCase().replace(/[-\s]/g, '');
      return normalized.startsWith(p) || p.startsWith(normalized);
    });
    if (prefixMatches.length === 1) {
      match = prefixMatches[0];
    } else if (prefixMatches.length > 1) {
      logger.warn(`Telegram: match ambigu pour "${name}" — ${prefixMatches.map(c => c.prenom).join(', ')}. Ignoré.`);
      return null;
    }
  }

  // 3. Auto-save telegram_user_id if matched by name and no ID stored yet
  if (match && telegramUserId && !match.telegram_user_id) {
    try {
      db.prepare('UPDATE chatteurs SET telegram_user_id = ? WHERE id = ?').run(telegramUserId, match.id);
      logger.info(`Telegram ID ${telegramUserId} auto-lié à ${match.prenom}`);
    } catch (e) {
      logger.warn(`Auto-link telegram_user_id échoué pour ${match.prenom}`, { error: e.message });
    }
  }

  return match;
}

/**
 * Patterns to extract monetary amounts from shift reports.
 * Ordered by specificity — first match wins.
 */
const MONTANT_PATTERNS = [
  /montant\s*brut\s*:?\s*([\d.,]+)\s*[$€]?/i,           // "Montant brut: 150€"
  /montants?\s*g[ée]n[ée]r[ée]s?\s*:?\s*([\d.,]+)\s*[$€]?/i, // "Montants générés: 18€"
  /montants?\s*:?\s*([\d.,]+)\s*[$€]/i,                   // "Montant: 50€" (with currency symbol)
];

/**
 * Detect if a message looks like a shift report.
 * Broader than just "montant brut" — accepts various report formats.
 */
function isShiftReport(message) {
  if (!message) return false;
  const lower = message.toLowerCase();
  // Check for keywords that indicate a shift report
  if (/montant\s*brut/i.test(message)) return true;
  if (/montants?\s*g[ée]n[ée]r[ée]s?/i.test(message)) return true;
  if (/fin\s*de\s*shift/i.test(message) && /\d+\s*[$€]/i.test(message)) return true;
  return false;
}

/**
 * Parse a Telegram report message
 * Returns { date, montant_brut } or { error }
 */
function parseReport(message) {
  let montantMatch = null;
  for (const pattern of MONTANT_PATTERNS) {
    montantMatch = message.match(pattern);
    if (montantMatch) break;
  }

  if (!montantMatch) {
    // Fallback: look for a standalone amount with currency symbol (e.g. "18€", "50$")
    montantMatch = message.match(/([\d.,]+)\s*[$€]/);
  }

  if (!montantMatch) {
    return { error: 'Impossible de parser le montant du message' };
  }

  const montant_brut = parseFloat(montantMatch[1].replace(',', '.'));
  if (isNaN(montant_brut) || montant_brut <= 0 || montant_brut > 100000) {
    return { error: 'Montant invalide: ' + montantMatch[1] + ' (doit être entre 0.01 et 100 000)' };
  }

  const dateMatch = message.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}|\d{2})/);
  let reportDate;
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    const year = y.length === 2 ? '20' + y : y;
    reportDate = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  } else {
    reportDate = new Date().toISOString().split('T')[0];
  }

  return { date: reportDate, montant_brut };
}

/**
 * Check for duplicate vente
 */
function isDuplicate(chatteur_id, plateforme_id, montant_brut, periode_debut, periode_fin) {
  const dup = db.prepare(`
    SELECT id FROM ventes
    WHERE chatteur_id = ? AND plateforme_id = ? AND ABS(montant_brut - ?) < 0.01
      AND periode_debut = ? AND periode_fin = ?
      AND notes LIKE 'Import Telegram%'
  `).get(chatteur_id, plateforme_id, montant_brut, periode_debut, periode_fin);
  return dup || null;
}

/**
 * Find the most likely shift for a vente (same chatteur, plateforme, recent date)
 */
function findShiftForVente(chatteur_id, plateforme_id, dateStr) {
  // Look for a shift on the same date or within 1 day for this chatteur+plateforme
  const shift = db.prepare(`
    SELECT id, modele_id FROM shifts
    WHERE chatteur_id = ? AND plateforme_id = ?
      AND date BETWEEN date(?, '-1 day') AND date(?, '+1 day')
    ORDER BY ABS(julianday(date) - julianday(?)) ASC
    LIMIT 1
  `).get(chatteur_id, plateforme_id, dateStr, dateStr, dateStr);
  return shift || null;
}

/**
 * Insert a vente from Telegram + recalculate paies atomically
 */
function insertVente(chatteur_id, plateforme_id, montant_brut, periode_debut, periode_fin, notes, shift_id, modele_id) {
  const insertAndRecalc = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO ventes (chatteur_id, modele_id, plateforme_id, montant_brut, periode_debut, periode_fin, notes, statut, shift_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'validée', ?)
    `).run(chatteur_id, modele_id ?? null, plateforme_id, montant_brut, periode_debut, periode_fin, notes, shift_id ?? null);
    recalculatePaies(periode_debut, periode_fin);
    return result;
  });
  return insertAndRecalc();
}

// In-memory set of recently processed message IDs for idempotence (cleared every hour)
const _processedMessages = new Set();
let _lastCleanup = Date.now();
const IDEMPOTENCE_TTL = 60 * 60 * 1000; // 1 hour

function _cleanupProcessed() {
  const now = Date.now();
  if (now - _lastCleanup > IDEMPOTENCE_TTL) {
    _processedMessages.clear();
    _lastCleanup = now;
  }
}

/**
 * Process a single Telegram message and create a vente if valid
 * Returns { success, vente_id, ... } or { error, ... }
 */
function processMessage({ group_id, sender_name, sender_id, message, message_id }) {
  // Idempotence: skip already-processed messages
  if (message_id) {
    _cleanupProcessed();
    if (_processedMessages.has(message_id)) {
      return { skipped: true, reason: 'already_processed' };
    }
  }
  // Identify platform
  const plateforme_id = GROUP_PLATFORM[group_id.toString()];
  if (!plateforme_id) {
    return { error: 'Groupe non reconnu: ' + group_id };
  }

  // Check if message contains a report
  if (!isShiftReport(message)) {
    return { skipped: true };
  }

  // Parse
  const parsed = parseReport(message);
  if (parsed.error) {
    return { error: parsed.error };
  }

  // Period
  const { debut: periode_debut, fin: periode_fin } = getPeriode(parsed.date);

  // Find chatteur
  const chatteur = findChatteur(sender_name, sender_id);
  if (!chatteur) {
    return { error: `Chatteur non trouvé: "${sender_name}"` };
  }
  const chatteur_id = chatteur.id;

  // Dedup check
  const dup = isDuplicate(chatteur.id, plateforme_id, parsed.montant_brut, periode_debut, periode_fin);
  if (dup) {
    return { error: 'Doublon détecté', existing_id: dup.id };
  }

  // Try to find matching shift
  const shift = findShiftForVente(chatteur.id, plateforme_id, parsed.date);

  // Insert + recalculate paies atomically
  const notes = `Import Telegram — ${message.substring(0, 100)}`;
  const result = insertVente(chatteur.id, plateforme_id, parsed.montant_brut, periode_debut, periode_fin, notes, shift?.id, shift?.modele_id);

  // Mark as processed for idempotence
  if (message_id) _processedMessages.add(message_id);

  logger.info('Telegram import réussi', { chatteur: chatteur.prenom, montant: parsed.montant_brut, plateforme_id, date: parsed.date });

  return {
    success: true,
    vente_id: result.lastInsertRowid,
    chatteur_id,
    chatteur: chatteur.prenom,
    plateforme_id,
    montant_brut: parsed.montant_brut,
    periode: `${periode_debut} → ${periode_fin}`,
    date_rapport: parsed.date,
    shift_id: shift?.id || null,
  };
}

module.exports = {
  GROUP_PLATFORM,
  findChatteur,
  parseReport,
  isShiftReport,
  isDuplicate,
  findShiftForVente,
  insertVente,
  processMessage,
};
