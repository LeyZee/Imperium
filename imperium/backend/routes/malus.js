const express = require('express');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/malus?chatteur_id=
router.get('/', authMiddleware, (req, res) => {
  const { chatteur_id } = req.query;
  let query = `
    SELECT m.*, c.prenom as chatteur_prenom
    FROM malus m
    JOIN chatteurs c ON c.id = m.chatteur_id
  `;
  const params = [];

  if (req.user.role === 'chatteur') {
    query += ' WHERE m.chatteur_id = ?';
    params.push(req.user.chatteur_id);
  } else if (chatteur_id) {
    query += ' WHERE m.chatteur_id = ?';
    params.push(chatteur_id);
  }

  query += ' ORDER BY m.periode DESC, m.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

// POST /api/malus
router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { chatteur_id, montant, raison, periode } = req.body;
  if (!chatteur_id || !montant || !periode) {
    return res.status(400).json({ error: 'chatteur_id, montant et periode requis' });
  }

  const result = db.prepare(
    'INSERT INTO malus (chatteur_id, montant, raison, periode) VALUES (?, ?, ?, ?)'
  ).run(chatteur_id, montant, raison || null, periode);

  res.status(201).json({ id: result.lastInsertRowid });
});

// DELETE /api/malus/:id
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  db.prepare('DELETE FROM malus WHERE id = ?').run(req.params.id);
  res.json({ message: 'Malus supprimé' });
});

module.exports = router;
