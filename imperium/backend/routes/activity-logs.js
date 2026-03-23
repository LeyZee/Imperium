const express = require('express');
const db = require('../database');
const { authMiddleware, adminOnly, adminOrManager } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

const router = express.Router();

// GET /api/activity-logs
router.get('/', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { entity_type, user_id, date_debut, date_fin } = req.query;
  const { page, limit } = parsePagination(req.query.page, req.query.limit || 50);

  let where = '1=1';
  const params = [];

  if (entity_type) { where += ' AND a.entity_type = ?'; params.push(entity_type); }
  if (user_id) { where += ' AND a.user_id = ?'; params.push(user_id); }
  if (date_debut) { where += ' AND a.created_at >= ?'; params.push(date_debut); }
  if (date_fin) { where += " AND a.created_at <= ? || ' 23:59:59'"; params.push(date_fin); }

  const total = db.prepare(`SELECT COUNT(*) as count FROM activity_logs a WHERE ${where}`).get(...params).count;

  const rows = db.prepare(`
    SELECT a.*, u.prenom as user_prenom, u.email as user_email
    FROM activity_logs a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE ${where}
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, (page - 1) * limit);

  res.json(paginatedResponse(rows, total, page, limit));
}));

// DELETE /api/activity-logs — clear all logs (admin only)
router.delete('/', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const result = db.prepare('DELETE FROM activity_logs').run();
  res.json({ message: `${result.changes} entrée(s) supprimée(s)`, count: result.changes });
}));

module.exports = router;
