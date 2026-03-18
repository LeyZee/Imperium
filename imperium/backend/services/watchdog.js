const db = require('../database');
const logger = require('../utils/logger');
const { notifyAdminsAndManagers } = require('../utils/notifier');

/**
 * Watchdog service — monitors bot health and system state.
 * Called every 30 min from server.js alongside other periodic checks.
 * Alerts admins via in-app notifications when issues are detected.
 */

// Track alert state to avoid duplicate notifications
const alertState = {
  botDown: false,
  heartbeatStale: false,
  highErrorRate: false,
  dbSizeWarning: false,
};

/**
 * Main watchdog check — runs every 30 min.
 */
function runWatchdog() {
  try {
    checkBotHealth();
    checkErrorRate();
    checkDbHealth();
    checkOldUnresolvedImports();
  } catch (err) {
    logger.error('Watchdog error', { error: err.message });
  }
}

/**
 * Check if the Telegram bot is running and heartbeat is fresh.
 */
function checkBotHealth() {
  try {
    const heartbeatRow = db.prepare("SELECT value FROM telegram_state WHERE key = ?").get('heartbeat');
    if (!heartbeatRow) {
      // Bot may never have started — only alert if it was running before
      if (alertState.botDown) return;
      return;
    }

    const heartbeatAge = Math.floor((Date.now() - parseInt(heartbeatRow.value, 10)) / 1000);

    // Bot is running and fresh — clear any previous alerts
    if (heartbeatAge < 120) {
      if (alertState.botDown || alertState.heartbeatStale) {
        alertState.botDown = false;
        alertState.heartbeatStale = false;
        logger.info('Watchdog: bot Telegram de retour en ligne');
      }
      return;
    }

    // Heartbeat stale (2-10 min) — warning
    if (heartbeatAge < 600 && !alertState.heartbeatStale) {
      alertState.heartbeatStale = true;
      notifyAdminsAndManagers(
        'warning',
        '\u26A0\uFE0F Bot Telegram ne r\u00e9pond plus',
        `Le heartbeat du bot est absent depuis ${Math.floor(heartbeatAge / 60)} min. Le bot va tenter un red\u00e9marrage automatique.`,
        '/admin/telegram'
      );
      logger.warn('Watchdog: heartbeat stale', { ageSeconds: heartbeatAge });
    }

    // Heartbeat very stale (10+ min) — critical
    if (heartbeatAge >= 600 && !alertState.botDown) {
      alertState.botDown = true;
      notifyAdminsAndManagers(
        'error',
        '\uD83D\uDEA8 Bot Telegram arr\u00eat\u00e9',
        `Le bot ne r\u00e9pond plus depuis ${Math.floor(heartbeatAge / 60)} min. V\u00e9rifiez la page Telegram et red\u00e9marrez manuellement si n\u00e9cessaire.`,
        '/admin/telegram'
      );
      logger.error('Watchdog: bot appears down', { ageSeconds: heartbeatAge });
    }
  } catch (err) {
    logger.warn('Watchdog: checkBotHealth error', { error: err.message });
  }
}

/**
 * Check if too many import errors occurred in the last hour.
 */
function checkErrorRate() {
  try {
    const errors = db.prepare(`
      SELECT COUNT(*) AS count FROM telegram_log
      WHERE direction = 'in' AND success = 0
      AND created_at >= datetime('now', '-1 hour')
    `).get();

    const errorCount = errors?.count || 0;

    if (errorCount >= 10 && !alertState.highErrorRate) {
      alertState.highErrorRate = true;
      notifyAdminsAndManagers(
        'warning',
        '\u26A0\uFE0F Taux d\'erreurs Telegram \u00e9lev\u00e9',
        `${errorCount} erreurs d'import en 1 heure. V\u00e9rifiez le journal Telegram pour identifier le probl\u00e8me.`,
        '/admin/telegram'
      );
      logger.warn('Watchdog: high error rate', { errorCount });
    } else if (errorCount < 5) {
      alertState.highErrorRate = false;
    }
  } catch (err) {
    logger.warn('Watchdog: checkErrorRate error', { error: err.message });
  }
}

/**
 * Check database health — size and integrity (lightweight).
 */
function checkDbHealth() {
  try {
    // Purge old telegram_log entries (keep last 30 days)
    const purged = db.prepare(`
      DELETE FROM telegram_log WHERE created_at < datetime('now', '-30 days')
    `).run();
    if (purged.changes > 0) {
      logger.info(`Watchdog: purged ${purged.changes} old telegram_log entries`);
    }

    // Purge old notifications (keep last 30 days)
    const purgedNotifs = db.prepare(`
      DELETE FROM notifications WHERE created_at < datetime('now', '-30 days') AND is_read = 1
    `).run();
    if (purgedNotifs.changes > 0) {
      logger.info(`Watchdog: purged ${purgedNotifs.changes} old read notifications`);
    }

    // Purge old activity_log (keep last 90 days)
    try {
      const purgedActivity = db.prepare(`
        DELETE FROM activity_log WHERE created_at < datetime('now', '-90 days')
      `).run();
      if (purgedActivity.changes > 0) {
        logger.info(`Watchdog: purged ${purgedActivity.changes} old activity_log entries`);
      }
    } catch { /* table may not exist */ }
  } catch (err) {
    logger.warn('Watchdog: checkDbHealth error', { error: err.message });
  }
}

/**
 * Audit and auto-correct incomplete Telegram imports.
 * Runs every 30 min but only does heavy work once per day (persisted in DB).
 *
 * Auto-corrects:
 * 1. Import without modele → fill from shift's modele
 * 2. Import without shift → re-search (shift might have been created since)
 * 3. Model conflict → trust topic (from notes), auto-correct if shift for that model exists
 *
 * Flags to admin: anything still unresolved after auto-correction.
 */
function checkOldUnresolvedImports() {
  try {
    // Get incomplete imports from last 72h
    const incomplete = db.prepare(`
      SELECT v.id, v.chatteur_id, v.modele_id, v.shift_id, v.plateforme_id,
        v.periode_debut, v.periode_fin, v.notes, v.montant_brut,
        v.created_at
      FROM ventes v
      WHERE v.notes LIKE 'Import Telegram%'
      AND (v.modele_id IS NULL OR v.shift_id IS NULL)
      AND v.created_at > datetime('now', '-72 hours')
    `).all();

    if (incomplete.length === 0) return;

    let autoFixed = 0;
    let stillBroken = 0;

    for (const v of incomplete) {
      let needsUpdate = false;
      let newShiftId = v.shift_id;
      let newModeleId = v.modele_id;

      // 1. Missing shift → re-search with expanded window
      if (!v.shift_id) {
        const dateMatch = v.created_at ? v.created_at.split('T')[0] : null;
        if (dateMatch) {
          // Try to extract model name from notes: "Import Telegram [MODELNAME]"
          const modelMatch = (v.notes || '').match(/\[([^\]]+)\]/);
          let shift = null;

          if (modelMatch) {
            // We know the model from notes → search with model constraint
            const modele = db.prepare('SELECT id FROM modeles WHERE UPPER(pseudo) = ? AND actif = 1').get(modelMatch[1].toUpperCase());
            if (modele) {
              shift = db.prepare(`
                SELECT id, modele_id FROM shifts
                WHERE chatteur_id = ? AND plateforme_id = ? AND modele_id = ?
                AND date BETWEEN date(?, '-3 days') AND date(?, '+1 day')
                ORDER BY ABS(julianday(date) - julianday(?)) ASC LIMIT 1
              `).get(v.chatteur_id, v.plateforme_id, modele.id, dateMatch, dateMatch, dateMatch);
            }
          }

          if (!shift) {
            // Fallback: search without model
            shift = db.prepare(`
              SELECT id, modele_id FROM shifts
              WHERE chatteur_id = ? AND plateforme_id = ?
              AND date BETWEEN date(?, '-3 days') AND date(?, '+1 day')
              ORDER BY ABS(julianday(date) - julianday(?)) ASC LIMIT 1
            `).get(v.chatteur_id, v.plateforme_id, dateMatch, dateMatch, dateMatch);
          }

          if (shift) {
            newShiftId = shift.id;
            if (!newModeleId && shift.modele_id) newModeleId = shift.modele_id;
            needsUpdate = true;
          }
        }
      }

      // 2. Missing modele but has shift → fill from shift
      if (!newModeleId && newShiftId) {
        const shift = db.prepare('SELECT modele_id FROM shifts WHERE id = ?').get(newShiftId);
        if (shift?.modele_id) {
          newModeleId = shift.modele_id;
          needsUpdate = true;
        }
      }

      // Apply fixes
      if (needsUpdate) {
        db.prepare('UPDATE ventes SET shift_id = ?, modele_id = ? WHERE id = ?')
          .run(newShiftId ?? null, newModeleId ?? null, v.id);
        autoFixed++;

        // Recalculate paies
        try {
          const { recalculatePaies } = require('./paie-calculator');
          recalculatePaies(v.periode_debut, v.periode_fin);
        } catch {}
      } else {
        stillBroken++;
      }
    }

    if (autoFixed > 0) {
      logger.info(`Watchdog: auto-corrigé ${autoFixed} import(s) Telegram`);
      notifyAdminsAndManagers(
        'info',
        '\uD83D\uDD27 Auto-correction Telegram',
        `${autoFixed} import(s) ont \u00e9t\u00e9 auto-corrig\u00e9s (shift ou mod\u00e8le retrouv\u00e9).${stillBroken > 0 ? ` ${stillBroken} restent incomplets.` : ''}`,
        '/admin/telegram'
      );
    }

    if (stillBroken > 0) {
      notifyAdminsAndManagers(
        'warning',
        '\uD83D\uDD14 Imports Telegram \u00e0 compl\u00e9ter',
        `${stillBroken} import(s) n'ont toujours pas de mod\u00e8le ou shift apr\u00e8s auto-correction. Compl\u00e9tez-les manuellement.`,
        '/admin/telegram'
      );
    }
  } catch (err) {
    logger.warn('Watchdog: audit imports error', { error: err.message });
  }
}

/**
 * Periodic DB maintenance — VACUUM and ANALYZE.
 * Called less frequently (once per day at midnight via daily check).
 */
let lastMaintenanceDate = null;

function runDbMaintenance() {
  try {
    const todayKey = new Date().toISOString().slice(0, 10);
    const hour = new Date().getHours();

    // Run once per day between 3h-4h (low traffic)
    if (hour < 3 || hour >= 4 || lastMaintenanceDate === todayKey) return;

    // Check DB state first
    const row = db.prepare("SELECT value FROM telegram_state WHERE key = ?").get('last_vacuum');
    if (row?.value === todayKey) {
      lastMaintenanceDate = todayKey;
      return;
    }

    lastMaintenanceDate = todayKey;
    db.prepare("INSERT OR REPLACE INTO telegram_state (key, value) VALUES (?, ?)").run('last_vacuum', todayKey);

    // ANALYZE to update query planner statistics
    db.exec('ANALYZE');
    logger.info('Watchdog: DB ANALYZE completed');
  } catch (err) {
    logger.warn('Watchdog: DB maintenance error', { error: err.message });
  }
}

module.exports = { runWatchdog, runDbMaintenance };
