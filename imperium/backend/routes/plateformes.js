const express = require('express');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const plateformes = db.prepare('SELECT * FROM plateformes WHERE actif = 1 ORDER BY nom').all();
  res.json(plateformes);
});

router.get('/:id', authMiddleware, (req, res) => {
  const p = db.prepare('SELECT * FROM plateformes WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Plateforme introuvable' });
  res.json(p);
});

router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { nom, tva_rate, commission_rate, devise } = req.body;
  if (!nom) return res.status(400).json({ error: 'Nom requis' });

  const result = db.prepare(
    'INSERT INTO plateformes (nom, tva_rate, commission_rate, devise) VALUES (?, ?, ?, ?)'
  ).run(nom, tva_rate ?? 0.0, commission_rate ?? 0.20, devise || 'USD');

  res.status(201).json({ id: result.lastInsertRowid, nom });
});

router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  const { nom, tva_rate, commission_rate, devise, actif } = req.body;
  const existing = db.prepare('SELECT id FROM plateformes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Plateforme introuvable' });

  db.prepare(`
    UPDATE plateformes SET
      nom = COALESCE(?, nom),
      tva_rate = COALESCE(?, tva_rate),
      commission_rate = COALESCE(?, commission_rate),
      devise = COALESCE(?, devise),
      actif = COALESCE(?, actif)
    WHERE id = ?
  `).run(nom, tva_rate, commission_rate, devise, actif !== undefined ? (actif ? 1 : 0) : null, req.params.id);

  res.json({ message: 'Plateforme mise à jour' });
});

router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  db.prepare('UPDATE plateformes SET actif = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Plateforme désactivée' });
});

module.exports = router;
