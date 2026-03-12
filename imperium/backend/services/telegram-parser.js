const db = require('../database');
const { getPeriode } = require('../utils/period');

// Map groupe Telegram → plateforme_id
const GROUP_PLATFORM = {
  '-1003327391292': 2, // REVEAL Shift Soirée 🌙 → Reveal (EUR)
  '-1003428313874': 2, // REVEAL Shift Journée ☀️ → Reveal (EUR)
  '-1003438053612': 1, // ONLYFANS Shift → OnlyFans (USD)
};

/**
 * Fuzzy match chatteur by first name
 */
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
  if (isNaN(montant_brut) || montant_brut <= 0) {
    return { error: 'Montant invalide: ' + montantMatch[1] };
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
    WHERE chatteur_id = ? AND plateforme_id = ? AND montant_brut = ?
      AND periode_debut = ? AND periode_fin = ?
      AND notes LIKE 'Import Telegram%'
  `).get(chatteur_id, plateforme_id, montant_brut, periode_debut, periode_fin);
  return dup || null;
}

/**
 * Insert a vente from Telegram
 */
function insertVente(chatteur_id, plateforme_id, montant_brut, periode_debut, periode_fin, notes) {
  const result = db.prepare(`
    INSERT INTO ventes (chatteur_id, plateforme_id, montant_brut, periode_debut, periode_fin, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(chatteur_id, plateforme_id, montant_brut, periode_debut, periode_fin, notes);
  return result;
}

/**
 * Process a single Telegram message and create a vente if valid
 * Returns { success, vente_id, ... } or { error, ... }
 */
function processMessage({ group_id, sender_name, message }) {
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
  const chatteur = findChatteur(sender_name);
  if (!chatteur) {
    return { error: `Chatteur non trouvé: "${sender_name}"` };
  }

  // Dedup check
  const dup = isDuplicate(chatteur.id, plateforme_id, parsed.montant_brut, periode_debut, periode_fin);
  if (dup) {
    return { error: 'Doublon détecté', existing_id: dup.id };
  }

  // Insert
  const notes = `Import Telegram — ${message.substring(0, 100)}`;
  const result = insertVente(chatteur.id, plateforme_id, parsed.montant_brut, periode_debut, periode_fin, notes);

  return {
    success: true,
    vente_id: result.lastInsertRowid,
    chatteur: chatteur.prenom,
    plateforme_id,
    montant_brut: parsed.montant_brut,
    periode: `${periode_debut} → ${periode_fin}`,
    date_rapport: parsed.date,
  };
}

module.exports = {
  GROUP_PLATFORM,
  findChatteur,
  parseReport,
  isShiftReport,
  isDuplicate,
  insertVente,
  processMessage,
};
