const express = require('express');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const router = express.Router();

router.get('/', authMiddleware, asyncHandler((req, res) => {
  const plateformes = db.prepare('SELECT * FROM plateformes WHERE actif = 1 ORDER BY nom').all();
  res.json(plateformes);
}));

router.get('/:id', authMiddleware, asyncHandler((req, res) => {
  const p = db.prepare('SELECT * FROM plateformes WHERE id = ? AND actif = 1').get(req.params.id);
  if (!p) throw new ApiError(404, 'Plateforme introuvable');
  res.json(p);
}));

router.post('/', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const { nom, tva_rate, commission_rate, devise, couleur_fond, couleur_texte } = req.body;
  if (!nom) throw new ApiError(400, 'Nom requis');

  const result = db.prepare(
    'INSERT INTO plateformes (nom, tva_rate, commission_rate, devise, couleur_fond, couleur_texte) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(nom, tva_rate ?? 0.0, commission_rate ?? 0.20, devise || 'USD', couleur_fond || '#1b2e4b', couleur_texte || '#ffffff');

  res.status(201).json({ id: result.lastInsertRowid, nom });
}));

router.put('/:id', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const { nom, tva_rate, commission_rate, devise, actif, couleur_fond, couleur_texte } = req.body;
  const existing = db.prepare('SELECT id FROM plateformes WHERE id = ?').get(req.params.id);
  if (!existing) throw new ApiError(404, 'Plateforme introuvable');

  db.prepare(`
    UPDATE plateformes SET
      nom = COALESCE(?, nom),
      tva_rate = COALESCE(?, tva_rate),
      commission_rate = COALESCE(?, commission_rate),
      devise = COALESCE(?, devise),
      actif = COALESCE(?, actif),
      couleur_fond = COALESCE(?, couleur_fond),
      couleur_texte = COALESCE(?, couleur_texte)
    WHERE id = ?
  `).run(nom ?? null, tva_rate ?? null, commission_rate ?? null, devise ?? null, actif !== undefined ? (actif ? 1 : 0) : null, couleur_fond ?? null, couleur_texte ?? null, req.params.id);

  res.json({ message: 'Plateforme mise à jour' });
}));

router.delete('/:id', authMiddleware, adminOnly, asyncHandler((req, res) => {
  db.prepare('UPDATE plateformes SET actif = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Plateforme désactivée' });
}));

module.exports = router;
