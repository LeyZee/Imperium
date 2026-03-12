const express = require('express');
const db = require('../database');
const { authMiddleware, adminOrManager } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { logActivity } = require('../utils/activityLogger');

const router = express.Router();

// GET /api/malus?chatteur_id=&periode_debut=&periode_fin=
router.get('/', authMiddleware, asyncHandler((req, res) => {
  const { chatteur_id, periode_debut, periode_fin } = req.query;
  let query = `
    SELECT m.*, c.prenom as chatteur_prenom
    FROM malus m
    JOIN chatteurs c ON c.id = m.chatteur_id
    WHERE m.actif != 0
  `;
  const params = [];

  if (req.user.role === 'chatteur') {
    query += ' AND m.chatteur_id = ?';
    params.push(req.user.chatteur_id);
  } else if (chatteur_id) {
    query += ' AND m.chatteur_id = ?';
    params.push(chatteur_id);
  }

  if (periode_debut) { query += ' AND m.periode >= ?'; params.push(periode_debut); }
  if (periode_fin) { query += ' AND m.periode <= ?'; params.push(periode_fin); }

  query += ' ORDER BY m.periode DESC, m.created_at DESC';
  res.json(db.prepare(query).all(...params));
}));

// POST /api/malus
router.post('/', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { chatteur_id, montant, raison, periode } = req.body;
  if (!chatteur_id || !montant || !periode) {
    throw new ApiError(400, 'chatteur_id, montant et periode requis');
  }

  const result = db.prepare(
    'INSERT INTO malus (chatteur_id, montant, raison, periode) VALUES (?, ?, ?, ?)'
  ).run(chatteur_id, montant, raison || null, periode);

  logActivity(req.user.id, 'create_malus', 'malus', result.lastInsertRowid, `${montant}€`);

  res.status(201).json({ id: result.lastInsertRowid });
}));

// PUT /api/malus/:id
router.put('/:id', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { id } = req.params;
  const { montant, raison } = req.body;

  const existing = db.prepare('SELECT id FROM malus WHERE id = ? AND actif != 0').get(id);
  if (!existing) throw new ApiError(404, 'Malus non trouvé');

  db.prepare('UPDATE malus SET montant = COALESCE(?, montant), raison = COALESCE(?, raison) WHERE id = ?')
    .run(montant ?? null, raison ?? null, id);

  logActivity(req.user.id, 'update_malus', 'malus', parseInt(id));

  res.json({ message: 'Malus mis à jour' });
}));

// DELETE /api/malus/:id (soft delete)
router.delete('/:id', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  db.prepare('UPDATE malus SET actif = 0 WHERE id = ?').run(req.params.id);
  logActivity(req.user.id, 'delete_malus', 'malus', parseInt(req.params.id));
  res.json({ message: 'Malus supprimé' });
}));

module.exports = router;
