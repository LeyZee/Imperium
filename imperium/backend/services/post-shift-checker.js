const db = require('../database');
const { notifyChatteur } = require('../utils/notifier');
const { notifyAdminsAndManagers } = require('../utils/notifier');
const { CRENEAUX } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Check for recently completed shifts that have no associated sales.
 * Sends a notification to the chatteur so they can add their sales manually.
 *
 * Called periodically (every 30 min) from server.js.
 */
function checkPostShiftNotifications() {
  try {
    const now = new Date();

    // For each timezone, check if any créneau ended in the last 60 minutes
    const timezones = [
      { tz: 'Europe/Paris', offset: getTimezoneOffset('Europe/Paris') },
      { tz: 'Africa/Porto-Novo', offset: getTimezoneOffset('Africa/Porto-Novo') },
      { tz: 'Indian/Antananarivo', offset: getTimezoneOffset('Indian/Antananarivo') },
    ];

    // Get today's date in YYYY-MM-DD
    const todayStr = now.toISOString().slice(0, 10);
    // Also yesterday for overnight shifts
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    // Find shifts from today and yesterday that haven't been notified yet
    const shifts = db.prepare(`
      SELECT s.id, s.chatteur_id, s.modele_id, s.plateforme_id, s.date, s.creneau, s.fuseau_horaire,
        c.prenom as chatteur_prenom,
        m.pseudo as modele_pseudo,
        p.nom as plateforme_nom
      FROM shifts s
      JOIN chatteurs c ON c.id = s.chatteur_id AND c.actif = 1
      LEFT JOIN modeles m ON m.id = s.modele_id
      LEFT JOIN plateformes p ON p.id = s.plateforme_id
      WHERE s.date IN (?, ?)
      AND s.notification_sent = 0
    `).all(todayStr, yesterdayStr);

    if (shifts.length === 0) return;

    // Current period
    const day = now.getDate();
    const y = now.getFullYear(), mo = now.getMonth();
    let periodeDebut, periodeFin;
    if (day < 15) {
      periodeDebut = `${y}-${String(mo + 1).padStart(2, '0')}-01`;
      periodeFin = `${y}-${String(mo + 1).padStart(2, '0')}-15`;
    } else {
      const next = new Date(y, mo + 1, 1);
      periodeDebut = `${y}-${String(mo + 1).padStart(2, '0')}-15`;
      periodeFin = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
    }

    let notified = 0;

    for (const shift of shifts) {
      // Check if the shift's créneau has ended (with 30min buffer)
      const creneau = CRENEAUX[shift.creneau];
      if (!creneau) continue;

      const tz = shift.fuseau_horaire || 'Europe/Paris';
      const endHour = parseInt(creneau.end.split(':')[0]);

      // Build the shift end time in the shift's timezone
      const shiftDate = new Date(shift.date + 'T00:00:00');
      let endDate = new Date(shiftDate);
      endDate.setHours(endHour, 30, 0); // 30 min buffer after shift end

      // For overnight shifts (créneau 3: 20h-02h, créneau 4: 02h-08h)
      if (shift.creneau === 3) {
        // Ends at 02h next day
        endDate.setDate(endDate.getDate() + 1);
        endDate.setHours(2, 30, 0);
      }

      // Approximate timezone offset correction
      const tzOffset = getTimezoneOffset(tz);
      const localNowMs = now.getTime() + (tzOffset * 60 * 60 * 1000);
      const endMs = endDate.getTime();

      // Has the shift ended? (compare in local time approximation)
      if (localNowMs < endMs) continue;

      // Check if there's already a sale for this chatteur + modele + plateforme in the current period
      const hasSale = db.prepare(`
        SELECT 1 FROM ventes
        WHERE chatteur_id = ?
        AND (modele_id = ? OR ? IS NULL)
        AND plateforme_id = ?
        AND periode_debut >= ? AND periode_fin <= ?
        LIMIT 1
      `).get(
        shift.chatteur_id,
        shift.modele_id ?? null, shift.modele_id ?? null,
        shift.plateforme_id,
        periodeDebut, periodeFin
      );

      // Check if chatteur already declared 0 sales for this shift
      const hasReport = db.prepare(
        'SELECT 1 FROM shift_reports WHERE shift_id = ? LIMIT 1'
      ).get(shift.id);

      if (!hasSale && !hasReport) {
        // Send notification to chatteur
        notifyChatteur(
          shift.chatteur_id,
          'shift',
          'Aucune vente détectée',
          `Ton shift ${shift.modele_pseudo || ''} (${shift.plateforme_nom || ''}) est terminé mais aucune vente n'a été trouvée. Pense à les ajouter !`,
          '/chatteur/mes-ventes'
        );
        notified++;
      }

      // Mark as notified regardless (don't re-check completed shifts)
      db.prepare('UPDATE shifts SET notification_sent = 1 WHERE id = ?').run(shift.id);
    }

    if (notified > 0) {
      logger.info(`Post-shift checker: ${notified} notification(s) envoyée(s)`);
    }
  } catch (err) {
    logger.error('Post-shift checker error', { error: err.message });
  }
}

/**
 * Check if today is a pay day (1st, 15th, or 28th) and send a reminder to admins.
 * Uses a simple in-memory flag to avoid duplicate notifications on the same day.
 */
let lastPayDayReminder = null;

function checkPayDayReminder() {
  try {
    const now = new Date();
    const day = now.getDate();
    const todayKey = now.toISOString().slice(0, 10);

    if ([1, 15, 28].includes(day) && lastPayDayReminder !== todayKey) {
      lastPayDayReminder = todayKey;

      // Compute the period that just ended
      let periodeDebut, periodeFin;
      if (day === 1) {
        // Period 15 → 1er: the previous month's second half
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 15);
        periodeDebut = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-15`;
        periodeFin = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      } else if (day === 15) {
        // Period 1 → 15: first half of current month
        periodeDebut = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        periodeFin = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
      } else {
        // Day 28: same as 15 → 1er (second half)
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        periodeDebut = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
        periodeFin = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
      }

      // Check if there are uncalculated paies to validate
      const pending = db.prepare(`
        SELECT COUNT(*) as c FROM paies
        WHERE periode_debut = ? AND periode_fin = ? AND statut = 'calculé'
      `).get(periodeDebut, periodeFin);

      if (pending && pending.c > 0) {
        notifyAdminsAndManagers(
          'paie',
          'Jour de paie !',
          `${pending.c} paie(s) à valider pour la période ${periodeDebut} → ${periodeFin}`,
          '/admin/paies'
        );
        logger.info(`Pay day reminder sent: ${pending.c} paies to validate`);
      }
    }
  } catch (err) {
    logger.error('Pay day reminder error', { error: err.message });
  }
}

/**
 * Approximate timezone offset in hours from UTC.
 * Good enough for shift end time comparison.
 */
function getTimezoneOffset(tz) {
  const offsets = {
    'Europe/Paris': 1,     // CET (UTC+1, +2 in summer)
    'Africa/Porto-Novo': 1, // WAT (UTC+1, no DST)
    'Indian/Antananarivo': 3, // EAT (UTC+3, no DST)
  };
  return offsets[tz] || 0;
}

module.exports = { checkPostShiftNotifications, checkPayDayReminder };
