const db = require('../database');

/**
 * Log an activity to the activity_logs table.
 * Silent fail — activity logging should never break the main operation.
 *
 * @param {number} userId - ID of the user performing the action
 * @param {string} action - Description of the action (e.g., 'create_chatteur', 'update_vente')
 * @param {string|null} entityType - Type of entity (e.g., 'chatteur', 'vente', 'paie')
 * @param {number|null} entityId - ID of the entity
 * @param {string|null} details - Additional details (JSON string or free text)
 */
function logActivity(userId, action, entityType = null, entityId = null, details = null) {
  try {
    db.prepare(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)'
    ).run(userId ?? null, action, entityType ?? null, entityId ?? null, details ?? null);
  } catch (e) {
    // Silent fail
  }
}

module.exports = { logActivity };
