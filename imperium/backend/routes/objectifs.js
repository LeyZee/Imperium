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
    SELECT o.*, c.prenom as chatteur_prenom, c.couleur as chatteur_couleur,
      m.pseudo as modele_pseudo, m.couleur_fond as modele_couleur_fond, m.couleur_texte as modele_couleur_texte
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
    SELECT o.*, c.prenom as chatteur_prenom, c.couleur as chatteur_couleur,
      m.pseudo as modele_pseudo, m.couleur_fond as modele_couleur_fond, m.couleur_texte as modele_couleur_texte
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

// GET /api/objectifs/suggestions?chatteur_id=X — data-driven goal suggestions
router.get('/suggestions', authMiddleware, asyncHandler((req, res) => {
  let { chatteur_id } = req.query;

  // Chatteurs can only see their own suggestions
  if (req.user.role === 'chatteur') {
    chatteur_id = req.user.chatteur_id;
  }

  // Get last 6 periods of ventes data
  let query, params;
  if (chatteur_id) {
    query = `
      SELECT v.periode_debut, v.periode_fin,
        COALESCE(SUM(v.montant_brut), 0) as total_brut
      FROM ventes v
      WHERE v.chatteur_id = ? AND v.statut != 'rejetée'
      GROUP BY v.periode_debut, v.periode_fin
      ORDER BY v.periode_debut DESC
      LIMIT 6
    `;
    params = [chatteur_id];
  } else {
    // Global: sum all chatteurs
    query = `
      SELECT v.periode_debut, v.periode_fin,
        COALESCE(SUM(v.montant_brut), 0) as total_brut
      FROM ventes v
      WHERE v.statut != 'rejetée'
      GROUP BY v.periode_debut, v.periode_fin
      ORDER BY v.periode_debut DESC
      LIMIT 6
    `;
    params = [];
  }

  const periodes = db.prepare(query).all(...params);

  if (periodes.length === 0) {
    return res.json({
      periodes: [],
      moyenne: 0,
      mediane: 0,
      meilleure: 0,
      tendance: 0,
      suggestions: { realiste: 0, ambitieux: 0, challenge: 0 },
    });
  }

  const values = periodes.map(p => p.total_brut);
  const moyenne = values.reduce((s, v) => s + v, 0) / values.length;

  // Median
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const mediane = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  const meilleure = Math.max(...values);

  // Trend: compare recent 3 vs older 3
  let tendance = 0;
  if (periodes.length >= 4) {
    const half = Math.floor(periodes.length / 2);
    const recent = values.slice(0, half);
    const ancien = values.slice(half);
    const avgRecent = recent.reduce((s, v) => s + v, 0) / recent.length;
    const avgAncien = ancien.reduce((s, v) => s + v, 0) / ancien.length;
    if (avgAncien > 0) tendance = ((avgRecent - avgAncien) / avgAncien) * 100;
  }

  // Suggestions based on last 3 periods average
  const last3 = values.slice(0, Math.min(3, values.length));
  const moyLast3 = last3.reduce((s, v) => s + v, 0) / last3.length;

  const suggestions = {
    realiste: Math.round(moyLast3),
    ambitieux: Math.round(meilleure),
    challenge: Math.round(meilleure * 1.2),
  };

  res.json({
    periodes: periodes.reverse().map(p => ({
      debut: p.periode_debut,
      fin: p.periode_fin,
      total_brut: p.total_brut,
    })),
    moyenne: Math.round(moyenne),
    mediane: Math.round(mediane),
    meilleure: Math.round(meilleure),
    tendance: Math.round(tendance),
    suggestions,
  });
}));

// GET /api/objectifs/mon-objectif?periode_debut=&periode_fin= — chatteur's personal goal
router.get('/mon-objectif', authMiddleware, asyncHandler((req, res) => {
  const chatteur_id = req.user.chatteur_id;
  if (!chatteur_id) throw new ApiError(403, 'Pas de chatteur associé');
  const { periode_debut, periode_fin } = req.query;
  if (!periode_debut || !periode_fin) throw new ApiError(400, 'periode_debut et periode_fin requis');

  const obj = db.prepare(
    'SELECT * FROM objectifs_personnels WHERE chatteur_id = ? AND periode_debut = ? AND periode_fin = ?'
  ).get(chatteur_id, periode_debut, periode_fin);

  res.json(obj || null);
}));

// POST /api/objectifs/mon-objectif — chatteur sets personal goal
router.post('/mon-objectif', authMiddleware, asyncHandler((req, res) => {
  const chatteur_id = req.user.chatteur_id;
  if (!chatteur_id) throw new ApiError(403, 'Pas de chatteur associé');
  const { montant_cible, periode_debut, periode_fin } = req.body;
  if (!montant_cible || montant_cible <= 0) throw new ApiError(400, 'Montant cible invalide');
  if (!periode_debut || !periode_fin) throw new ApiError(400, 'periode_debut et periode_fin requis');

  const existing = db.prepare(
    'SELECT id FROM objectifs_personnels WHERE chatteur_id = ? AND periode_debut = ? AND periode_fin = ?'
  ).get(chatteur_id, periode_debut, periode_fin);

  if (existing) {
    db.prepare('UPDATE objectifs_personnels SET montant_cible = ? WHERE id = ?').run(montant_cible, existing.id);
    res.json({ id: existing.id, updated: true });
  } else {
    const result = db.prepare(
      'INSERT INTO objectifs_personnels (chatteur_id, montant_cible, periode_debut, periode_fin) VALUES (?, ?, ?, ?)'
    ).run(chatteur_id, montant_cible, periode_debut, periode_fin);
    res.status(201).json({ id: result.lastInsertRowid });
  }
}));

// DELETE /api/objectifs/mon-objectif — chatteur removes personal goal
router.delete('/mon-objectif', authMiddleware, asyncHandler((req, res) => {
  const chatteur_id = req.user.chatteur_id;
  if (!chatteur_id) throw new ApiError(403, 'Pas de chatteur associé');
  const { periode_debut, periode_fin } = req.query;
  db.prepare(
    'DELETE FROM objectifs_personnels WHERE chatteur_id = ? AND periode_debut = ? AND periode_fin = ?'
  ).run(chatteur_id, periode_debut, periode_fin);
  res.json({ message: 'Objectif supprimé' });
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
