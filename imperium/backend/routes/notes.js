const express = require('express');
const db = require('../database');
const { authMiddleware, adminOrManager } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { logActivity } = require('../utils/activityLogger');

const router = express.Router();

// GET /api/notes?chatteur_id=
router.get('/', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { chatteur_id } = req.query;
  if (!chatteur_id) throw new ApiError(400, 'chatteur_id requis');

  const rows = db.prepare(`
    SELECT n.*, u.prenom as author_prenom, u.email as author_email
    FROM notes n
    LEFT JOIN users u ON u.id = n.author_id
    WHERE n.chatteur_id = ?
    ORDER BY n.created_at DESC
  `).all(chatteur_id);

  res.json(rows);
}));

// POST /api/notes
router.post('/', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { chatteur_id, content } = req.body;
  if (!chatteur_id || !content?.trim()) throw new ApiError(400, 'chatteur_id et content requis');

  const result = db.prepare(
    'INSERT INTO notes (chatteur_id, author_id, content) VALUES (?, ?, ?)'
  ).run(chatteur_id, req.user.id, content.trim());

  logActivity(req.user.id, 'create_note', 'chatteur', chatteur_id, content.trim().substring(0, 100));

  res.status(201).json({ id: result.lastInsertRowid });
}));

// DELETE /api/notes/:id
router.delete('/:id', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { id } = req.params;
  const note = db.prepare('SELECT author_id, chatteur_id FROM notes WHERE id = ?').get(id);
  if (!note) throw new ApiError(404, 'Note non trouvée');

  // Only the author or admin can delete
  if (req.user.role !== 'admin' && note.author_id !== req.user.id) {
    throw new ApiError(403, 'Seul l\'auteur ou un admin peut supprimer cette note');
  }

  db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  logActivity(req.user.id, 'delete_note', 'chatteur', note.chatteur_id);

  res.json({ message: 'Note supprimée' });
}));

module.exports = router;
