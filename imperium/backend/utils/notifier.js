const db = require('../database');

/**
 * Create a notification for a specific user.
 * Silent fail — notification should never break the main operation.
 */
function notify(userId, type, title, message = null, link = null) {
  try {
    db.prepare(
      'INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, type, title, message ?? null, link ?? null);
  } catch (e) {
    // Silent fail
  }
}

/**
 * Notify all admin and manager users.
 */
function notifyAdminsAndManagers(type, title, message = null, link = null) {
  try {
    const users = db.prepare("SELECT id FROM users WHERE role IN ('admin', 'manager')").all();
    for (const u of users) {
      notify(u.id, type, title, message, link);
    }
  } catch (e) {
    // Silent fail
  }
}

/**
 * Notify a chatteur by their chatteur_id (finds linked user_id).
 */
function notifyChatteur(chatteurId, type, title, message = null, link = null) {
  try {
    const chatteur = db.prepare('SELECT user_id FROM chatteurs WHERE id = ?').get(chatteurId);
    if (chatteur?.user_id) {
      notify(chatteur.user_id, type, title, message, link);
    }
  } catch (e) {
    // Silent fail
  }
}

/**
 * Notify all active chatteurs (for announcements, etc.).
 */
function notifyAllChatteurs(type, title, message = null, link = null) {
  try {
    const chatteurs = db.prepare('SELECT user_id FROM chatteurs WHERE actif = 1 AND user_id IS NOT NULL').all();
    for (const c of chatteurs) {
      notify(c.user_id, type, title, message, link);
    }
  } catch (e) {
    // Silent fail
  }
}

module.exports = { notify, notifyAdminsAndManagers, notifyChatteur, notifyAllChatteurs };
