const db = require('../database');
const logger = require('../utils/logger');
const { notifyPalierReached, notifyCollectiveGoal } = require('../utils/telegramSender');
const { notifyChatteur } = require('../utils/notifier');

// PALIER_LABEL_META: fallback emoji/color by label name
const PALIER_META = {
  'bronze': { emoji: '\uD83E\uDD49', color: '#cd7f32' },
  'argent': { emoji: '\uD83E\uDD48', color: '#c0c0c0' },
  'or': { emoji: '\uD83E\uDD47', color: '#ffd700' },
  'diamant': { emoji: '\uD83D\uDC8E', color: '#64b5f6' },
};

/**
 * Compare paliers before and after a recalculation for a given period.
 * Call `snapshot()` BEFORE recalculation, then `notifyChanges()` AFTER.
 *
 * Usage:
 *   const snap = snapshotPaliers(debut, fin);
 *   recalculatePaies(debut, fin);
 *   await checkPalierChanges(snap, debut, fin);
 */

/**
 * Take a snapshot of current palier for each chatteur.
 * Returns a Map<chatteur_id, { palierLabel, palierBonus }>
 */
function snapshotPaliers(periodeDebut, periodeFin) {
  const snapshot = new Map();
  try {
    const paliers = db.prepare(
      'SELECT * FROM paliers_primes WHERE actif = 1 ORDER BY seuil_net_ht DESC'
    ).all();

    if (paliers.length === 0) return snapshot;

    // Get net_ht per chatteur
    const paies = db.prepare(`
      SELECT chatteur_id, SUM(net_ht_eur) as total_net_ht
      FROM paies WHERE periode_debut = ? AND periode_fin = ? AND plateforme_id IS NOT NULL
      GROUP BY chatteur_id
    `).all(periodeDebut, periodeFin);

    // Get manager IDs to exclude
    const managers = db.prepare("SELECT id FROM chatteurs WHERE role IN ('manager', 'directeur') AND actif = 1").all();
    const managerIds = new Set(managers.map(m => m.id));

    for (const p of paies) {
      if (managerIds.has(p.chatteur_id)) continue;
      const palier = paliers.find(pl => p.total_net_ht >= pl.seuil_net_ht);
      if (palier) {
        snapshot.set(p.chatteur_id, { label: palier.label, bonus: palier.bonus, seuil: palier.seuil_net_ht });
      }
    }
  } catch (err) {
    logger.warn('snapshotPaliers error', { error: err.message });
  }
  return snapshot;
}

/**
 * After recalculation, compare new paliers with the snapshot.
 * Send notifications for any upgrades.
 */
async function checkPalierChanges(oldSnapshot, periodeDebut, periodeFin) {
  try {
    const paliers = db.prepare(
      'SELECT * FROM paliers_primes WHERE actif = 1 ORDER BY seuil_net_ht DESC'
    ).all();

    if (paliers.length === 0) return;

    const paies = db.prepare(`
      SELECT chatteur_id, SUM(net_ht_eur) as total_net_ht
      FROM paies WHERE periode_debut = ? AND periode_fin = ? AND plateforme_id IS NOT NULL
      GROUP BY chatteur_id
    `).all(periodeDebut, periodeFin);

    const managers = db.prepare("SELECT id FROM chatteurs WHERE role IN ('manager', 'directeur') AND actif = 1").all();
    const managerIds = new Set(managers.map(m => m.id));

    for (const p of paies) {
      if (managerIds.has(p.chatteur_id)) continue;

      const newPalier = paliers.find(pl => p.total_net_ht >= pl.seuil_net_ht);
      if (!newPalier) continue;

      const oldPalier = oldSnapshot.get(p.chatteur_id);

      // Notify if: new palier reached (didn't have one before, or upgraded to higher seuil)
      if (!oldPalier || newPalier.seuil > oldPalier.seuil) {
        const labelLower = (newPalier.label || '').toLowerCase();
        const meta = PALIER_META[labelLower] || { emoji: '\uD83C\uDFC6' };

        // Telegram DM
        notifyPalierReached(
          p.chatteur_id,
          newPalier.label,
          meta.emoji,
          newPalier.bonus
        ).catch(() => {});

        // In-app notification
        notifyChatteur(
          p.chatteur_id,
          'palier',
          `Palier ${newPalier.label} atteint !`,
          `${meta.emoji} Tu as atteint le palier ${newPalier.label} (+${newPalier.bonus}\u20AC). Continue !`,
          '/chatteur/dashboard'
        );

        logger.info(`Palier upgrade: chatteur ${p.chatteur_id} \u2192 ${newPalier.label}`);
      }
    }
  } catch (err) {
    logger.warn('checkPalierChanges error', { error: err.message });
  }
}

module.exports = { snapshotPaliers, checkPalierChanges };
