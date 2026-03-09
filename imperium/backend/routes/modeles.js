const express = require('express');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const modeles = db.prepare('SELECT * FROM modeles WHERE actif = 1 ORDER BY nom, prenom').all();
  res.json(modeles);
});

router.get('/:id', authMiddleware, (req, res) => {
  const m = db.prepare('SELECT * FROM modeles WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Modèle introuvable' });
  res.json(m);
});

router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { nom, prenom, part_percent } = req.body;
  if (!nom || !prenom) return res.status(400).json({ error: 'Nom et prénom requis' });

  const part = part_percent ?? 0.35;
  if (part < 0.35 || part > 0.40) {
    return res.status(400).json({ error: 'La part doit être entre 35% et 40%' });
  }

  const result = db.prepare(
    'INSERT INTO modeles (nom, prenom, part_percent) VALUES (?, ?, ?)'
  ).run(nom, prenom, part);

  res.status(201).json({ id: result.lastInsertRowid, nom, prenom, part_percent: part });
});

router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  const { nom, prenom, part_percent, actif } = req.body;
  const existing = db.prepare('SELECT id FROM modeles WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Modèle introuvable' });

  if (part_percent !== undefined && (part_percent < 0.35 || part_percent > 0.40)) {
    return res.status(400).json({ error: 'La part doit être entre 35% et 40%' });
  }

  db.prepare(`
    UPDATE modeles SET
      nom = COALESCE(?, nom),
      prenom = COALESCE(?, prenom),
      part_percent = COALESCE(?, part_percent),
      actif = COALESCE(?, actif)
    WHERE id = ?
  `).run(nom, prenom, part_percent, actif !== undefined ? (actif ? 1 : 0) : null, req.params.id);

  res.json({ message: 'Modèle mis à jour' });
});

router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  db.prepare('UPDATE modeles SET actif = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Modèle désactivé' });
});

module.exports = router;
