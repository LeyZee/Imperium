const express = require('express');
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// GET /api/notifications
router.get('/', authMiddleware, asyncHandler((req, res) => {
  const rows = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.user.id);

  res.json(rows);
}));

// GET /api/notifications/count
router.get('/count', authMiddleware, asyncHandler((req, res) => {
  const row = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id);
  res.json({ count: row.count });
}));

// PUT /api/notifications/:id/read
router.put('/:id/read', authMiddleware, asyncHandler((req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ message: 'Notification lue' });
}));

// PUT /api/notifications/read-all
router.put('/read-all', authMiddleware, asyncHandler((req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
  res.json({ message: 'Toutes les notifications marquées comme lues' });
}));

module.exports = router;
