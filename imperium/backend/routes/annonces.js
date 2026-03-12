const express = require('express');
const db = require('../database');
const { authMiddleware, adminOrManager } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { logActivity } = require('../utils/activityLogger');

const router = express.Router();

// GET /api/annonces
router.get('/', authMiddleware, asyncHandler((req, res) => {
  // Chatteurs only see active announcements
  const isChatteur = req.user.role === 'chatteur';
  const where = isChatteur ? 'WHERE a.actif = 1' : '';

  const rows = db.prepare(`
    SELECT a.*, u.prenom as author_prenom, u.email as author_email
    FROM annonces a
    LEFT JOIN users u ON u.id = a.author_id
    ${where}
    ORDER BY a.created_at DESC
  `).all();

  res.json(rows);
}));

// POST /api/annonces
router.post('/', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { title, content } = req.body;
  if (!title?.trim() || !content?.trim()) throw new ApiError(400, 'Titre et contenu requis');

  const result = db.prepare(
    'INSERT INTO annonces (author_id, title, content) VALUES (?, ?, ?)'
  ).run(req.user.id, title.trim(), content.trim());

  logActivity(req.user.id, 'create_annonce', 'annonce', result.lastInsertRowid, title.trim());

  res.status(201).json({ id: result.lastInsertRowid });
}));

// PUT /api/annonces/:id
router.put('/:id', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  const existing = db.prepare('SELECT id FROM annonces WHERE id = ?').get(id);
  if (!existing) throw new ApiError(404, 'Annonce non trouvée');

  db.prepare('UPDATE annonces SET title = COALESCE(?, title), content = COALESCE(?, content) WHERE id = ?')
    .run(title?.trim() ?? null, content?.trim() ?? null, id);

  logActivity(req.user.id, 'update_annonce', 'annonce', parseInt(id));

  res.json({ message: 'Annonce mise à jour' });
}));

// DELETE /api/annonces/:id (soft delete)
router.delete('/:id', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { id } = req.params;
  db.prepare('UPDATE annonces SET actif = 0 WHERE id = ?').run(id);
  logActivity(req.user.id, 'delete_annonce', 'annonce', parseInt(id));
  res.json({ message: 'Annonce désactivée' });
}));

module.exports = router;
