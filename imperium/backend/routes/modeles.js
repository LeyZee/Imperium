const express = require('express');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const router = express.Router();

router.get('/', authMiddleware, asyncHandler((req, res) => {
  const modeles = db.prepare("SELECT * FROM modeles WHERE actif = 1 ORDER BY pseudo").all();

  // Attach plateformes for each model
  const allLinks = db.prepare(
    'SELECT mp.modele_id, p.id, p.nom FROM modeles_plateformes mp JOIN plateformes p ON p.id = mp.plateforme_id'
  ).all();
  const pfMap = {};
  for (const link of allLinks) {
    if (!pfMap[link.modele_id]) pfMap[link.modele_id] = [];
    pfMap[link.modele_id].push({ id: link.id, nom: link.nom });
  }
  for (const m of modeles) {
    m.plateformes = pfMap[m.id] || [];
  }

  res.json(modeles);
}));

router.get('/:id', authMiddleware, asyncHandler((req, res) => {
  const m = db.prepare('SELECT * FROM modeles WHERE id = ?').get(req.params.id);
  if (!m) throw new ApiError(404, 'Modèle introuvable');
  res.json(m);
}));

router.post('/', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const { pseudo, part_percent, photo, couleur_fond, couleur_texte } = req.body;
  if (!pseudo) throw new ApiError(400, 'Pseudo requis');

  const part = part_percent ?? 0.35;
  if (part < 0.20 || part > 0.50) {
    throw new ApiError(400, 'La part agence doit être entre 20% et 50%');
  }

  const result = db.prepare(
    'INSERT INTO modeles (pseudo, part_percent, photo, couleur_fond, couleur_texte) VALUES (?, ?, ?, ?, ?)'
  ).run(pseudo, part, photo ?? null, couleur_fond || '#f5b731', couleur_texte || '#ffffff');

  res.status(201).json({ id: result.lastInsertRowid, pseudo, part_percent: part });
}));

router.put('/:id', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const { pseudo, part_percent, actif, photo, couleur_fond, couleur_texte } = req.body;
  const existing = db.prepare('SELECT id FROM modeles WHERE id = ?').get(req.params.id);
  if (!existing) throw new ApiError(404, 'Modèle introuvable');

  if (part_percent !== undefined && (part_percent < 0.20 || part_percent > 0.50)) {
    throw new ApiError(400, 'La part agence doit être entre 20% et 50%');
  }

  const effectiveActif = actif !== undefined ? (actif ? 1 : 0) : null;

  db.prepare(`
    UPDATE modeles SET
      pseudo = COALESCE(?, pseudo),
      part_percent = COALESCE(?, part_percent),
      actif = COALESCE(?, actif),
      photo = COALESCE(?, photo),
      couleur_fond = COALESCE(?, couleur_fond),
      couleur_texte = COALESCE(?, couleur_texte)
    WHERE id = ?
  `).run(pseudo ?? null, part_percent ?? null, effectiveActif, photo ?? null, couleur_fond ?? null, couleur_texte ?? null, req.params.id);

  res.json({ message: 'Modèle mis à jour' });
}));

router.delete('/:id', authMiddleware, adminOnly, asyncHandler((req, res) => {
  db.prepare("UPDATE modeles SET actif = 0 WHERE id = ?").run(req.params.id);
  res.json({ message: 'Modèle désactivé' });
}));

// --- Model-Platform associations ---

router.get('/:id/plateformes', authMiddleware, asyncHandler((req, res) => {
  const rows = db.prepare(
    'SELECT p.* FROM plateformes p JOIN modeles_plateformes mp ON mp.plateforme_id = p.id WHERE mp.modele_id = ? ORDER BY p.id'
  ).all(req.params.id);
  res.json(rows);
}));

router.post('/:id/plateformes', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const { plateforme_id } = req.body;
  if (!plateforme_id) throw new ApiError(400, 'plateforme_id requis');
  db.prepare('INSERT OR IGNORE INTO modeles_plateformes (modele_id, plateforme_id) VALUES (?, ?)').run(req.params.id, plateforme_id);
  res.status(201).json({ message: 'Association créée' });
}));

router.delete('/:id/plateformes/:pid', authMiddleware, adminOnly, asyncHandler((req, res) => {
  db.prepare('DELETE FROM modeles_plateformes WHERE modele_id = ? AND plateforme_id = ?').run(req.params.id, req.params.pid);
  res.json({ message: 'Association supprimée' });
}));

module.exports = router;
