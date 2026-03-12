const express = require('express');
const db = require('../database');
const { authMiddleware, adminOrManager } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { logActivity } = require('../utils/activityLogger');

const router = express.Router();

// GET /api/objectifs
router.get('/', authMiddleware, asyncHandler((req, res) => {
  const { periode_debut, periode_fin, chatteur_id } = req.query;
  const isChatteur = req.user.role === 'chatteur';

  let where = 'o.actif = 1';
  const params = [];

  if (isChatteur) {
    where += ' AND (o.chatteur_id = ? OR o.chatteur_id IS NULL)';
    params.push(req.user.chatteur_id);
  } else if (chatteur_id) {
    where += ' AND (o.chatteur_id = ? OR o.chatteur_id IS NULL)';
    params.push(chatteur_id);
  }

  if (periode_debut) { where += ' AND o.periode_debut >= ?'; params.push(periode_debut); }
  if (periode_fin) { where += ' AND o.periode_fin <= ?'; params.push(periode_fin); }

  const rows = db.prepare(`
    SELECT o.*, c.prenom as chatteur_prenom, m.pseudo as modele_pseudo
    FROM objectifs o
    LEFT JOIN chatteurs c ON c.id = o.chatteur_id
    LEFT JOIN modeles m ON m.id = o.modele_id
    WHERE ${where}
    ORDER BY o.created_at DESC
  `).all(...params);

  res.json(rows);
}));

// GET /api/objectifs/progress?periode_debut=&periode_fin=
router.get('/progress', authMiddleware, asyncHandler((req, res) => {
  const { periode_debut, periode_fin } = req.query;
  if (!periode_debut || !periode_fin) throw new ApiError(400, 'periode_debut et periode_fin requis');

  const isChatteur = req.user.role === 'chatteur';

  let objWhere = 'o.actif = 1 AND o.periode_debut = ? AND o.periode_fin = ?';
  const objParams = [periode_debut, periode_fin];

  if (isChatteur) {
    objWhere += ' AND (o.chatteur_id = ? OR o.chatteur_id IS NULL)';
    objParams.push(req.user.chatteur_id);
  }

  const objectifs = db.prepare(`
    SELECT o.*, c.prenom as chatteur_prenom, m.pseudo as modele_pseudo
    FROM objectifs o
    LEFT JOIN chatteurs c ON c.id = o.chatteur_id
    LEFT JOIN modeles m ON m.id = o.modele_id
    WHERE ${objWhere}
  `).all(...objParams);

  // Compute progress for each objectif
  const results = objectifs.map(obj => {
    let venteWhere = 'v.periode_debut >= ? AND v.periode_fin <= ?';
    const venteParams = [periode_debut, periode_fin];

    if (obj.chatteur_id) {
      venteWhere += ' AND v.chatteur_id = ?';
      venteParams.push(obj.chatteur_id);
    }
    if (obj.modele_id) {
      venteWhere += ' AND v.modele_id = ?';
      venteParams.push(obj.modele_id);
    }

    const actual = db.prepare(`
      SELECT COALESCE(SUM(v.montant_brut), 0) as total
      FROM ventes v
      WHERE ${venteWhere}
    `).get(...venteParams);

    return {
      ...obj,
      actual: actual.total,
      progress: obj.montant_cible > 0 ? Math.round((actual.total / obj.montant_cible) * 100) : 0,
    };
  });

  res.json(results);
}));

// POST /api/objectifs
router.post('/', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { chatteur_id, modele_id, montant_cible, periode_debut, periode_fin } = req.body;

  if (!montant_cible || !periode_debut || !periode_fin) {
    throw new ApiError(400, 'montant_cible, periode_debut et periode_fin requis');
  }
  if (montant_cible <= 0) throw new ApiError(400, 'Le montant cible doit être positif');

  const result = db.prepare(
    'INSERT INTO objectifs (chatteur_id, modele_id, montant_cible, periode_debut, periode_fin, created_by) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(chatteur_id ?? null, modele_id ?? null, montant_cible, periode_debut, periode_fin, req.user.id);

  logActivity(req.user.id, 'create_objectif', 'objectif', result.lastInsertRowid, `${montant_cible}€`);

  res.status(201).json({ id: result.lastInsertRowid });
}));

// PUT /api/objectifs/:id
router.put('/:id', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { id } = req.params;
  const { montant_cible } = req.body;

  const existing = db.prepare('SELECT id FROM objectifs WHERE id = ? AND actif = 1').get(id);
  if (!existing) throw new ApiError(404, 'Objectif non trouvé');

  db.prepare('UPDATE objectifs SET montant_cible = COALESCE(?, montant_cible) WHERE id = ?')
    .run(montant_cible ?? null, id);

  logActivity(req.user.id, 'update_objectif', 'objectif', parseInt(id));

  res.json({ message: 'Objectif mis à jour' });
}));

// DELETE /api/objectifs/:id (soft delete)
router.delete('/:id', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { id } = req.params;
  db.prepare('UPDATE objectifs SET actif = 0 WHERE id = ?').run(id);
  logActivity(req.user.id, 'delete_objectif', 'objectif', parseInt(id));
  res.json({ message: 'Objectif supprimé' });
}));

module.exports = router;
