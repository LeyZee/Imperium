const db = require('../database');
const { notifyChatteur } = require('../utils/notifier');
const { notifyAdminsAndManagers } = require('../utils/notifier');
const { CRENEAUX } = require('../utils/constants');
const logger = require('../utils/logger');
const {
  notifyShiftReminder,
  notifyMissingReport,
  sendToChatteur,
} = require('../utils/telegramSender');

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

    // Group missing reports by chatteur to avoid spam
    const missingByChatteur = {}; // { chatteur_id: { prenom, shifts: [...] } }

    for (const shift of shifts) {
      const creneau = CRENEAUX[shift.creneau];
      if (!creneau) continue;

      const tz = shift.fuseau_horaire || 'Europe/Paris';
      const endHour = parseInt(creneau.end.split(':')[0]);

      const shiftDate = new Date(shift.date + 'T00:00:00');
      let endDate = new Date(shiftDate);
      endDate.setHours(endHour, 30, 0);

      if (shift.creneau === 3) {
        endDate.setDate(endDate.getDate() + 1);
        endDate.setHours(2, 30, 0);
      }

      const tzOffset = getTimezoneOffset(tz);
      const localNowMs = now.getTime() + (tzOffset * 60 * 60 * 1000);
      if (localNowMs < endDate.getTime()) continue;

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

      const hasReport = db.prepare(
        'SELECT 1 FROM shift_reports WHERE shift_id = ? LIMIT 1'
      ).get(shift.id);

      if (!hasSale && !hasReport) {
        if (!missingByChatteur[shift.chatteur_id]) {
          missingByChatteur[shift.chatteur_id] = { prenom: shift.chatteur_prenom, shifts: [] };
        }
        missingByChatteur[shift.chatteur_id].shifts.push({
          plateforme: shift.plateforme_nom || '?',
          modele: shift.modele_pseudo || '',
          date: shift.date,
          creneau: creneau.label || `Cr\u00e9neau ${shift.creneau}`,
        });
      }

      // Mark as notified regardless
      db.prepare('UPDATE shifts SET notification_sent = 1 WHERE id = ?').run(shift.id);
    }

    // Send ONE grouped notification per chatteur
    let notified = 0;
    for (const [chatteurId, data] of Object.entries(missingByChatteur)) {
      const count = data.shifts.length;
      const summary = data.shifts
        .slice(0, 3) // Max 3 shifts in the message
        .map(s => `${s.plateforme} ${s.modele ? `(${s.modele})` : ''} le ${s.date.split('-').reverse().join('/')} (${s.creneau})`)
        .join(', ');
      const extra = count > 3 ? ` et ${count - 3} autre(s)` : '';

      // One in-app notification
      notifyChatteur(
        parseInt(chatteurId),
        'shift',
        `${count} rapport${count > 1 ? 's' : ''} manquant${count > 1 ? 's' : ''}`,
        `${summary}${extra}. Pense \u00e0 poster tes feedbacks !`,
        '/chatteur/mes-ventes'
      );

      // One Telegram DM
      const formatDate = (d) => d.split('-').reverse().join('/');
      let dmText = `\u26A0\uFE0F <b>${count} rapport${count > 1 ? 's' : ''} manquant${count > 1 ? 's' : ''}</b>\n\n`;
      for (const s of data.shifts.slice(0, 5)) {
        dmText += `\u2022 ${s.plateforme}${s.modele ? ` (${s.modele})` : ''} \u2014 ${formatDate(s.date)} (${s.creneau})\n`;
      }
      if (count > 5) dmText += `\u2022 ... et ${count - 5} autre(s)\n`;
      dmText += `\nPoste tes montants dans le groupe pour que je puisse les importer !`;

      sendToChatteur(parseInt(chatteurId), dmText, {
        _type: 'missing_report',
        reply_markup: {
          inline_keyboard: [
            [{ text: '\uD83D\uDCCA Mes ventes', callback_data: 'cmd_mesventes' }, { text: '\uD83D\uDC49 Menu', callback_data: 'cmd_aide' }],
          ],
        },
      }).catch(() => {});
      notified++;
    }

    if (notified > 0) {
      logger.info(`Post-shift checker: ${notified} chatteur(s) notifié(s) (rapports manquants groupés)`);
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
 * Check for upcoming shifts and send Telegram DM reminders.
 * Looks for shifts starting in the next 1-2 hours that haven't been reminded yet.
 *
 * Uses a separate DB column `reminder_sent` (added via migration if missing).
 */
function checkShiftReminders() {
  try {
    // reminder_sent column is created via migration in database.js
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().slice(0, 10);

    // Find shifts from today/tomorrow that haven't been reminded
    const shifts = db.prepare(`
      SELECT s.id, s.chatteur_id, s.modele_id, s.plateforme_id, s.date, s.creneau, s.fuseau_horaire,
        c.prenom as chatteur_prenom, c.telegram_user_id,
        m.pseudo as modele_pseudo,
        p.nom as plateforme_nom
      FROM shifts s
      JOIN chatteurs c ON c.id = s.chatteur_id AND c.actif = 1
      LEFT JOIN modeles m ON m.id = s.modele_id
      LEFT JOIN plateformes p ON p.id = s.plateforme_id
      WHERE s.date IN (?, ?)
      AND COALESCE(s.reminder_sent, 0) = 0
      AND c.telegram_user_id IS NOT NULL
    `).all(todayStr, tomorrowStr);

    if (shifts.length === 0) return;

    let reminded = 0;

    for (const shift of shifts) {
      const creneau = CRENEAUX[shift.creneau];
      if (!creneau) continue;

      const tz = shift.fuseau_horaire || 'Europe/Paris';
      const startHour = parseInt(creneau.start.split(':')[0]);

      // Build shift start time
      const shiftDate = new Date(shift.date + 'T00:00:00');
      let startDate = new Date(shiftDate);
      startDate.setHours(startHour, 0, 0);

      // Approximate timezone offset
      const tzOffset = getTimezoneOffset(tz);
      const localNowMs = now.getTime() + (tzOffset * 60 * 60 * 1000);
      const startMs = startDate.getTime();

      // Send reminder if shift starts in the next 2 hours (but hasn't started yet)
      const hoursUntilStart = (startMs - localNowMs) / (60 * 60 * 1000);
      if (hoursUntilStart > 0 && hoursUntilStart <= 2) {
        notifyShiftReminder(
          shift.chatteur_id,
          shift.plateforme_nom || 'Plateforme',
          shift.modele_pseudo || null,
          shift.date,
          shift.creneau,
          creneau.label
        ).catch(() => {});

        // Also send in-app notification
        notifyChatteur(
          shift.chatteur_id,
          'shift_reminder',
          'Shift bient\u00f4t !',
          `Ton shift ${shift.plateforme_nom || ''} (${creneau.label}) commence bient\u00f4t.`,
          '/chatteur/planning'
        );

        db.prepare('UPDATE shifts SET reminder_sent = 1 WHERE id = ?').run(shift.id);
        reminded++;
      }
    }

    if (reminded > 0) {
      logger.info(`Shift reminders: ${reminded} rappel(s) envoy\u00e9(s)`);
    }
  } catch (err) {
    logger.error('Shift reminder error', { error: err.message });
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

// ─── Daily Summaries ────────────────────────────────────────

/**
 * Check if a daily task has already run today (persisted in DB).
 * Prevents duplicates across server restarts.
 */
function hasDailyTaskRun(taskKey) {
  try {
    const row = db.prepare("SELECT value FROM telegram_state WHERE key = ?").get(taskKey);
    const todayKey = new Date().toISOString().slice(0, 10);
    return row?.value === todayKey;
  } catch { return false; }
}

function markDailyTaskRun(taskKey) {
  try {
    const todayKey = new Date().toISOString().slice(0, 10);
    db.prepare("INSERT OR REPLACE INTO telegram_state (key, value) VALUES (?, ?)").run(taskKey, todayKey);
  } catch (e) { logger.warn('Failed to mark daily task', { taskKey, error: e.message }); }
}

/**
 * Send evening recap to each chatteur via Telegram DM.
 * Shows today's ventes count, total, and any issues.
 * Should be called around 22h (checked via the 30min interval from server.js).
 */
function checkDailyChatteurSummary() {
  try {
    const now = new Date();
    const hour = now.getHours();

    // Only send between 21h-22h, once per day (persisted in DB)
    if (hour < 21 || hour >= 22 || hasDailyTaskRun('daily_chatteur_summary')) return;
    markDailyTaskRun('daily_chatteur_summary');

    const chatteurs = db.prepare(`
      SELECT c.id, c.prenom, c.telegram_user_id, c.telegram_dm_ok
      FROM chatteurs c
      WHERE c.actif = 1 AND c.telegram_dm_ok = 1 AND c.telegram_user_id IS NOT NULL
    `).all();

    if (chatteurs.length === 0) return;

    let sent = 0;
    for (const c of chatteurs) {
      const ventes = db.prepare(`
        SELECT v.montant_brut, p.devise, p.nom AS plateforme, m.pseudo AS modele,
          v.modele_id, v.shift_id
        FROM ventes v
        JOIN plateformes p ON p.id = v.plateforme_id
        LEFT JOIN modeles m ON m.id = v.modele_id
        WHERE v.chatteur_id = ? AND date(v.created_at) = ? AND v.statut = 'validée'
      `).all(c.id, todayKey);

      // Check if chatteur had shifts today
      const shifts = db.prepare(`
        SELECT s.id, p.nom AS plateforme, m.pseudo AS modele
        FROM shifts s
        LEFT JOIN plateformes p ON p.id = s.plateforme_id
        LEFT JOIN modeles m ON m.id = s.modele_id
        WHERE s.chatteur_id = ? AND s.date = ?
      `).all(c.id, todayKey);

      // Skip if no shifts and no ventes today
      if (shifts.length === 0 && ventes.length === 0) continue;

      const totalEUR = ventes.filter(v => v.devise === 'EUR').reduce((s, v) => s + v.montant_brut, 0);
      const totalUSD = ventes.filter(v => v.devise === 'USD').reduce((s, v) => s + v.montant_brut, 0);
      const warnings = ventes.filter(v => !v.modele_id || !v.shift_id).length;

      let msg = `\uD83D\uDCCA <b>R\u00e9cap de ta journ\u00e9e</b>\n\n`;
      msg += `\uD83D\uDCC5 Shifts : <b>${shifts.length}</b>\n`;
      msg += `\uD83D\uDCB0 Ventes : <b>${ventes.length}</b>\n`;
      if (totalEUR > 0) msg += `\u2022 ${totalEUR.toFixed(2)}\u20AC\n`;
      if (totalUSD > 0) msg += `\u2022 $${totalUSD.toFixed(2)}\n`;

      if (ventes.length === 0 && shifts.length > 0) {
        msg += `\n\u26A0\uFE0F <b>Aucune vente d\u00e9tect\u00e9e</b> pour ${shifts.length} shift${shifts.length > 1 ? 's' : ''} aujourd'hui. Pense \u00e0 poster ton feedback dans le groupe !`;
      } else if (warnings > 0) {
        msg += `\n\u26A0\uFE0F ${warnings} vente${warnings > 1 ? 's' : ''} avec infos manquantes (mod\u00e8le ou shift)`;
      } else if (ventes.length > 0) {
        msg += `\n\u2705 Tout est bon !`;
      }

      sendToChatteur(c.id, msg, {
        _type: 'daily_summary',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '\uD83D\uDCCA D\u00e9tail ventes', callback_data: 'cmd_mesventes' },
              { text: '\uD83D\uDC49 Menu', callback_data: 'cmd_aide' },
            ],
          ],
        },
      }).catch(() => {});
      sent++;
    }

    if (sent > 0) {
      logger.info(`Daily chatteur summary: ${sent} recap(s) envoyé(s)`);
    }
  } catch (err) {
    logger.error('Daily chatteur summary error', { error: err.message });
  }
}

/**
 * Send morning admin summary notification (in-app).
 * Shows yesterday's import stats: total, complete, warnings, errors.
 * Should be called around 8h-9h.
 */
function checkDailyAdminSummary() {
  try {
    const now = new Date();
    const hour = now.getHours();

    // Only send between 8h-9h, once per day (persisted in DB)
    if (hour < 8 || hour >= 9 || hasDailyTaskRun('daily_admin_summary')) return;
    markDailyTaskRun('daily_admin_summary');

    // Yesterday's date
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const stats = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN modele_id IS NOT NULL AND shift_id IS NOT NULL THEN 1 ELSE 0 END) AS complete,
        SUM(CASE WHEN modele_id IS NULL OR shift_id IS NULL THEN 1 ELSE 0 END) AS warnings,
        COALESCE(SUM(montant_brut), 0) AS total_montant
      FROM ventes
      WHERE source = 'telegram' AND date(created_at) = ?
    `).get(yesterdayStr);

    const errors = db.prepare(`
      SELECT COUNT(*) AS count FROM telegram_log
      WHERE direction = 'in' AND success = 0
      AND date(created_at) = ?
    `).get(yesterdayStr);

    if (!stats || stats.total === 0) return;

    const msg = `Hier : ${stats.total} import(s) Telegram — ` +
      `${stats.complete} complet(s), ${stats.warnings} warning(s), ` +
      `${errors?.count || 0} erreur(s). ` +
      `Total : ${stats.total_montant.toFixed(2)}\u20AC`;

    const title = stats.warnings > 0 || (errors?.count || 0) > 0
      ? '\u26A0\uFE0F R\u00e9cap Telegram hier'
      : '\u2705 R\u00e9cap Telegram hier';

    notifyAdminsAndManagers('telegram', title, msg, '/admin/telegram');
    logger.info(`Daily admin summary sent: ${stats.total} imports yesterday`);
  } catch (err) {
    logger.error('Daily admin summary error', { error: err.message });
  }
}

module.exports = {
  checkPostShiftNotifications,
  checkPayDayReminder,
  checkShiftReminders,
  checkDailyChatteurSummary,
  checkDailyAdminSummary,
};
