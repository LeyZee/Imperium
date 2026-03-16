const db = require('../database');
const logger = require('./logger');

/**
 * Log an activity to the activity_logs table.
 * Silent fail — activity logging should never break the main operation.
 *
 * @param {number|null} userId - ID of the user performing the action (null = system/bot action)
 * @param {string} action - Description of the action (e.g., 'create_chatteur', 'update_vente')
 * @param {string|null} entityType - Type of entity (e.g., 'chatteur', 'vente', 'paie')
 * @param {number|null} entityId - ID of the entity
 * @param {string|null} details - Additional details (JSON string or free text)
 */
function logActivity(userId, action, entityType = null, entityId = null, details = null) {
  // System actions (null userId) can't be inserted due to NOT NULL FK constraint.
  // Log them via structured logger instead.
  if (userId == null) {
    logger.info('System activity', { action, entityType, entityId, details });
    return;
  }
  try {
    db.prepare(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, action, entityType ?? null, entityId ?? null, details ?? null);
  } catch (e) {
    logger.warn('Activity log insert failed', { userId, action, error: e.message });
  }
}

module.exports = { logActivity };
