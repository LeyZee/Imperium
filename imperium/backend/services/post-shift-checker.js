const db = require('../database');
const { notifyChatteur } = require('../utils/notifier');
const { notifyAdminsAndManagers } = require('../utils/notifier');
const { CRENEAUX } = require('../utils/constants');
const logger = require('../utils/logger');
const { getPeriode } = require('../utils/period');
const { getExchangeRate } = require('../utils/rateCache');
const {
  notifyShiftReminder,
  notifyMissingReport,
  sendToChatteur,
  sendTelegramMessage,
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

    // Group upcoming shifts by chatteur to avoid spam
    const remindersByChatteur = {};

    for (const shift of shifts) {
      const creneau = CRENEAUX[shift.creneau];
      if (!creneau) continue;

      const tz = shift.fuseau_horaire || 'Europe/Paris';
      const startHour = parseInt(creneau.start.split(':')[0]);
      const shiftDate = new Date(shift.date + 'T00:00:00');
      let startDate = new Date(shiftDate);
      startDate.setHours(startHour, 0, 0);

      const tzOffset = getTimezoneOffset(tz);
      const localNowMs = now.getTime() + (tzOffset * 60 * 60 * 1000);
      const startMs = startDate.getTime();
      const hoursUntilStart = (startMs - localNowMs) / (60 * 60 * 1000);

      if (hoursUntilStart > 0 && hoursUntilStart <= 2) {
        if (!remindersByChatteur[shift.chatteur_id]) {
          remindersByChatteur[shift.chatteur_id] = [];
        }
        remindersByChatteur[shift.chatteur_id].push({
          id: shift.id,
          plateforme: shift.plateforme_nom || 'Plateforme',
          modele: shift.modele_pseudo || null,
          date: shift.date,
          creneau: shift.creneau,
          label: creneau.label,
        });
        db.prepare('UPDATE shifts SET reminder_sent = 1 WHERE id = ?').run(shift.id);
      }
    }

    // Send ONE grouped reminder per chatteur
    let reminded = 0;
    for (const [chatteurId, shiftList] of Object.entries(remindersByChatteur)) {
      const count = shiftList.length;
      const formatDate = (d) => d.split('-').reverse().join('/');

      // One Telegram DM
      let dmText = `\u23F0 <b>Shift${count > 1 ? 's' : ''} bient\u00f4t !</b>\n\n`;
      for (const s of shiftList.slice(0, 5)) {
        dmText += `\u2022 ${s.plateforme}${s.modele ? ` (${s.modele})` : ''} \u2014 ${formatDate(s.date)} (${s.label})\n`;
      }
      if (count > 5) dmText += `\u2022 ... et ${count - 5} autre(s)\n`;
      dmText += `\nN'oublie pas de poster ton feedback apr\u00e8s ! \uD83D\uDCAA`;

      sendToChatteur(parseInt(chatteurId), dmText, {
        _type: 'shift_reminder',
        reply_markup: {
          inline_keyboard: [
            [{ text: '\uD83D\uDCCA Mes ventes', callback_data: 'cmd_mesventes' }, { text: '\uD83D\uDC49 Menu', callback_data: 'cmd_aide' }],
          ],
        },
      }).catch(() => {});

      // One in-app notification
      const summary = shiftList.slice(0, 3).map(s => `${s.plateforme}${s.modele ? ` (${s.modele})` : ''}`).join(', ');
      notifyChatteur(
        parseInt(chatteurId),
        'shift_reminder',
        `${count} shift${count > 1 ? 's' : ''} bient\u00f4t !`,
        `${summary}${count > 3 ? ` et ${count - 3} autre(s)` : ''} \u2014 commence bient\u00f4t.`,
        '/chatteur/planning'
      );
      reminded++;
    }

    if (reminded > 0) {
      logger.info(`Shift reminders: ${reminded} chatteur(s) notifi\u00e9(s) (regroup\u00e9s)`);
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

    const todayKey = now.toISOString().slice(0, 10);

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
function fmtEur(n) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€';
}

function fmtDevise(n, devise) {
  if (devise === 'USD') return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return fmtEur(n);
}

function getPreviousPeriode(debut) {
  const d = new Date(debut);
  const day = d.getDate();
  if (day === 1) {
    const prevMonth = new Date(d.getFullYear(), d.getMonth() - 1, 15);
    const py = prevMonth.getFullYear();
    const pm = String(prevMonth.getMonth() + 1).padStart(2, '0');
    return { debut: `${py}-${pm}-15`, fin: debut };
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return { debut: `${y}-${m}-01`, fin: `${y}-${m}-15` };
}

function checkDailyAdminSummary() {
  try {
    const now = new Date();
    const hour = now.getHours();

    // Only send between 8h-9h, once per day (persisted in DB)
    if (hour < 8 || hour >= 9 || hasDailyTaskRun('daily_admin_summary')) return;
    markDailyTaskRun('daily_admin_summary');

    // ── Dates & period ──
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const periode = getPeriode(now);
    const prevPeriode = getPreviousPeriode(periode.debut);
    const taux = getExchangeRate();

    // ── 1. VENTES HIER (toutes sources) ──
    const ventesHier = db.prepare(`
      SELECT COUNT(*) AS nb, COALESCE(SUM(v.montant_brut), 0) AS brut
      FROM ventes v
      WHERE date(v.created_at) = ? AND v.statut != 'rejetée'
    `).get(yesterdayStr);

    const ventesHierParPlateforme = db.prepare(`
      SELECT p.nom, p.devise, COUNT(*) AS nb, COALESCE(SUM(v.montant_brut), 0) AS brut
      FROM ventes v
      JOIN plateformes p ON v.plateforme_id = p.id
      WHERE date(v.created_at) = ? AND v.statut != 'rejetée'
      GROUP BY v.plateforme_id
      ORDER BY brut DESC
    `).all(yesterdayStr);

    // ── 2. PÉRIODE EN COURS ──
    const periodVentes = db.prepare(`
      SELECT v.montant_brut, p.tva_rate, p.commission_rate, p.devise
      FROM ventes v
      JOIN plateformes p ON v.plateforme_id = p.id
      WHERE v.periode_debut >= ? AND v.periode_fin <= ? AND v.statut != 'rejetée'
    `).all(periode.debut, periode.fin);

    let periodBrutEur = 0, periodNetHt = 0;
    for (const v of periodVentes) {
      const ttc = v.devise === 'USD' ? v.montant_brut * taux : v.montant_brut;
      const ht = ttc / (1 + v.tva_rate);
      const net = ht * (1 - v.commission_rate);
      periodBrutEur += ttc;
      periodNetHt += net;
    }

    // Previous period for trend
    const prevVentes = db.prepare(`
      SELECT v.montant_brut, p.tva_rate, p.commission_rate, p.devise
      FROM ventes v
      JOIN plateformes p ON v.plateforme_id = p.id
      WHERE v.periode_debut >= ? AND v.periode_fin <= ? AND v.statut != 'rejetée'
    `).all(prevPeriode.debut, prevPeriode.fin);

    let prevBrutEur = 0;
    for (const v of prevVentes) {
      prevBrutEur += v.devise === 'USD' ? v.montant_brut * taux : v.montant_brut;
    }

    const trendPct = prevBrutEur > 0
      ? (((periodBrutEur - prevBrutEur) / prevBrutEur) * 100).toFixed(1)
      : (periodBrutEur > 0 ? 100 : 0);
    const trendIcon = trendPct > 0 ? '↗️' : trendPct < 0 ? '↘️' : '➡️';

    const topChatteur = db.prepare(`
      SELECT c.prenom, SUM(v.montant_brut) AS total
      FROM ventes v
      JOIN chatteurs c ON v.chatteur_id = c.id
      WHERE v.periode_debut >= ? AND v.periode_fin <= ? AND v.statut != 'rejetée'
      GROUP BY v.chatteur_id
      ORDER BY total DESC
      LIMIT 1
    `).get(periode.debut, periode.fin);

    // ── 3. SHIFTS HIER ──
    const shiftsHier = db.prepare(`
      SELECT s.id, s.chatteur_id, s.creneau, c.prenom
      FROM shifts s
      JOIN chatteurs c ON s.chatteur_id = c.id
      WHERE s.date = ? AND c.actif = 1
    `).all(yesterdayStr);

    const shiftsAvecVente = db.prepare(`
      SELECT DISTINCT s.id
      FROM shifts s
      JOIN ventes v ON v.shift_id = s.id
      WHERE s.date = ? AND v.statut != 'rejetée'
    `).all(yesterdayStr);
    const coveredIds = new Set(shiftsAvecVente.map(r => r.id));

    const shiftsSansRapport = shiftsHier.filter(s => !coveredIds.has(s.id));

    // ── 4. IMPORTS TELEGRAM ──
    const telegramStats = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN modele_id IS NOT NULL AND shift_id IS NOT NULL THEN 1 ELSE 0 END) AS complete,
        SUM(CASE WHEN modele_id IS NULL OR shift_id IS NULL THEN 1 ELSE 0 END) AS warnings
      FROM ventes
      WHERE source = 'telegram' AND date(created_at) = ?
    `).get(yesterdayStr);

    const telegramErrors = db.prepare(`
      SELECT COUNT(*) AS count FROM telegram_log
      WHERE direction = 'in' AND success = 0 AND date(created_at) = ?
    `).get(yesterdayStr);

    // ── 5. ÉQUIPE ──
    const equipe = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN telegram_user_id IS NOT NULL AND telegram_dm_ok = 1 THEN 1 ELSE 0 END) AS telegram_ok
      FROM chatteurs
      WHERE actif = 1 AND role NOT IN ('directeur')
    `).get();

    // ── Format date header ──
    const joursSemaine = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const moisNoms = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const dateLabel = `${joursSemaine[now.getDay()]} ${now.getDate()} ${moisNoms[now.getMonth()]}`;

    // ── Build Telegram DM message ──
    let dm = `📊 <b>Récap quotidien — ${dateLabel}</b>\n`;

    // Section 1: Ventes hier
    dm += `\n━━━ 💰 <b>VENTES HIER</b> ━━━\n`;
    if (ventesHier.nb > 0) {
      dm += `CA Brut : <b>${fmtEur(ventesHier.brut)}</b> (${ventesHier.nb} vente${ventesHier.nb > 1 ? 's' : ''})\n`;
      if (ventesHierParPlateforme.length > 1) {
        for (const p of ventesHierParPlateforme) {
          dm += `  • ${p.nom} : <b>${fmtDevise(p.brut, p.devise)}</b> (${p.nb})\n`;
        }
      }
    } else {
      dm += `Aucune vente enregistrée hier\n`;
    }

    // Section 2: Période en cours
    const periodLabel = `${periode.debut.slice(8, 10)}/${periode.debut.slice(5, 7)} – ${periode.fin.slice(8, 10)}/${periode.fin.slice(5, 7)}`;
    dm += `\n━━━ 📈 <b>PÉRIODE (${periodLabel})</b> ━━━\n`;
    dm += `CA Brut cumulé : <b>${fmtEur(periodBrutEur)}</b>\n`;
    dm += `Net HT agence : <b>${fmtEur(periodNetHt)}</b>\n`;
    dm += `Tendance : ${trendIcon} <b>${trendPct > 0 ? '+' : ''}${trendPct}%</b> vs période préc.\n`;
    if (topChatteur) {
      dm += `🏆 Top : <b>${topChatteur.prenom}</b> (${fmtEur(topChatteur.total)})\n`;
    }

    // Section 3: Shifts hier
    dm += `\n━━━ 📅 <b>SHIFTS HIER</b> ━━━\n`;
    if (shiftsHier.length > 0) {
      dm += `Couverture : <b>${shiftsHier.length - shiftsSansRapport.length}/${shiftsHier.length}</b> shifts couverts\n`;
      if (shiftsSansRapport.length > 0) {
        const manquants = shiftsSansRapport.map(s => `${s.prenom} (C${s.creneau})`).join(', ');
        dm += `Sans rapport : ${manquants}\n`;
      }
    } else {
      dm += `Aucun shift programmé hier\n`;
    }

    // Section 4: Imports Telegram
    const tgTotal = telegramStats?.total || 0;
    const tgComplete = telegramStats?.complete || 0;
    const tgWarnings = telegramStats?.warnings || 0;
    const tgErrors = telegramErrors?.count || 0;
    dm += `\n━━━ 📥 <b>IMPORTS TELEGRAM</b> ━━━\n`;
    if (tgTotal > 0) {
      dm += `✅ ${tgComplete} complet${tgComplete > 1 ? 's' : ''}`;
      if (tgWarnings > 0) dm += ` · ⚠️ ${tgWarnings} warning${tgWarnings > 1 ? 's' : ''}`;
      if (tgErrors > 0) dm += ` · ❌ ${tgErrors} erreur${tgErrors > 1 ? 's' : ''}`;
      dm += `\n`;
    } else {
      dm += `Aucun import hier\n`;
    }

    // Section 5: Équipe
    dm += `\n━━━ 👥 <b>ÉQUIPE</b> ━━━\n`;
    dm += `Chatteurs actifs : <b>${equipe.total}</b>\n`;
    dm += `Telegram liés : <b>${equipe.telegram_ok}/${equipe.total}</b>\n`;

    // ── In-app notification (short summary) ──
    const hasWarnings = tgWarnings > 0 || tgErrors > 0 || shiftsSansRapport.length > 0;
    const inAppTitle = hasWarnings
      ? '⚠️ Récap quotidien'
      : '✅ Récap quotidien';
    const inAppMsg = `Hier : ${ventesHier.nb} vente(s), ${fmtEur(ventesHier.brut)} brut. ` +
      `Période : ${fmtEur(periodBrutEur)} cumulé (${trendIcon}${trendPct > 0 ? '+' : ''}${trendPct}%). ` +
      `Shifts : ${shiftsHier.length - shiftsSansRapport.length}/${shiftsHier.length} couverts.`;

    notifyAdminsAndManagers('info', inAppTitle, inAppMsg, '/admin/dashboard');

    // ── Telegram DM to admins, managers & directeur ──
    try {
      const recipients = db.prepare(`
        SELECT c.telegram_user_id, c.prenom
        FROM chatteurs c
        JOIN users u ON u.id = c.user_id
        WHERE u.role IN ('admin', 'manager') AND c.actif = 1
          AND c.telegram_user_id IS NOT NULL AND c.telegram_dm_ok = 1
        UNION
        SELECT c.telegram_user_id, c.prenom
        FROM chatteurs c
        WHERE c.role = 'directeur' AND c.actif = 1
          AND c.telegram_user_id IS NOT NULL AND c.telegram_dm_ok = 1
      `).all();

      for (const r of recipients) {
        sendTelegramMessage(r.telegram_user_id, dm, {
          _type: 'daily_admin_summary',
          _chatteurPrenom: r.prenom,
          reply_markup: {
            inline_keyboard: [
              [{ text: '📊 Dashboard', callback_data: 'cmd_aide' }],
            ],
          },
        }).catch(() => {});
      }

      logger.info(`Daily admin summary sent to ${recipients.length} recipients: ${ventesHier.nb} sales yesterday, period ${fmtEur(periodBrutEur)}`);
    } catch (e) {
      logger.warn('Admin Telegram summary DM failed', { error: e.message });
    }
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
