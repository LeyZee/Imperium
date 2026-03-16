const express = require('express');
const db = require('../database');
const { authMiddleware, adminOrManager } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { logActivity } = require('../utils/activityLogger');

const router = express.Router();

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

// ========== OBJECTIF COLLECTIF (must be before /:id routes) ==========

// GET /api/objectifs/collectif?periode_debut=&periode_fin=
router.get('/collectif', authMiddleware, asyncHandler((req, res) => {
  const { periode_debut, periode_fin } = req.query;
  if (!periode_debut || !periode_fin) throw new ApiError(400, 'periode_debut et periode_fin requis');

  const objectif = db.prepare(
    'SELECT * FROM objectifs_collectifs WHERE periode_debut = ? AND periode_fin = ? AND actif = 1'
  ).get(periode_debut, periode_fin);

  if (!objectif) return res.json(null);

  const paliers = db.prepare(
    'SELECT * FROM paliers_collectifs WHERE objectif_collectif_id = ? ORDER BY seuil_pct ASC'
  ).all(objectif.id);

  // Compute current team net_ht from paies
  const actual = db.prepare(
    'SELECT COALESCE(SUM(net_ht_eur), 0) as total FROM paies WHERE periode_debut = ? AND periode_fin = ?'
  ).get(periode_debut, periode_fin);

  let actual_net_ht = actual.total;

  // Fallback: estimate from ventes when paies haven't been generated yet
  if (actual_net_ht === 0) {
    const ventesRows = db.prepare(
      `SELECT v.montant_brut, pl.devise, pl.tva_rate, pl.commission_rate
       FROM ventes v
       JOIN plateformes pl ON pl.id = v.plateforme_id
       WHERE v.periode_debut = ? AND v.periode_fin = ?
         AND v.statut != 'rejetée'`
    ).all(periode_debut, periode_fin);
    actual_net_ht = ventesRows.reduce((sum, v) => {
      const brut = v.montant_brut || 0;
      const tva = v.tva_rate ?? 0.2;
      const comm = v.commission_rate ?? 0.2;
      const brutEur = v.devise === 'USD' ? brut * 0.92 : brut;
      return sum + (brutEur / (1 + tva)) * (1 - comm);
    }, 0);
  }
  const progress_pct = objectif.montant_cible > 0
    ? Math.round((actual_net_ht / objectif.montant_cible) * 10000) / 100
    : 0;

  // Highest reached palier
  const palier_atteint = paliers
    .filter(p => progress_pct >= p.seuil_pct)
    .sort((a, b) => b.seuil_pct - a.seuil_pct)[0] || null;

  res.json({
    ...objectif,
    paliers,
    actual_net_ht: Math.round(actual_net_ht * 100) / 100,
    progress_pct,
    palier_atteint,
  });
}));

// POST /api/objectifs/collectif
router.post('/collectif', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { montant_cible, periode_debut, periode_fin, description, paliers } = req.body;

  if (!montant_cible || montant_cible <= 0) throw new ApiError(400, 'montant_cible doit être positif');
  if (!periode_debut || !periode_fin) throw new ApiError(400, 'periode_debut et periode_fin requis');
  if (!paliers || !Array.isArray(paliers) || paliers.length === 0) {
    throw new ApiError(400, 'Au moins un palier requis');
  }

  for (const p of paliers) {
    if (!p.seuil_pct || p.seuil_pct <= 0) throw new ApiError(400, 'seuil_pct doit être positif');
    if (!p.bonus_par_chatteur || p.bonus_par_chatteur <= 0) throw new ApiError(400, 'bonus_par_chatteur doit être positif');
    if (!p.label) throw new ApiError(400, 'label requis pour chaque palier');
  }

  const existingActive = db.prepare(
    'SELECT id FROM objectifs_collectifs WHERE periode_debut = ? AND periode_fin = ? AND actif = 1'
  ).get(periode_debut, periode_fin);
  if (existingActive) throw new ApiError(409, 'Un objectif collectif existe déjà pour cette période');

  // Check for soft-deleted record (UNIQUE constraint on periode_debut, periode_fin)
  const existingSoft = db.prepare(
    'SELECT id FROM objectifs_collectifs WHERE periode_debut = ? AND periode_fin = ? AND actif = 0'
  ).get(periode_debut, periode_fin);

  const insertPalier = db.prepare(
    'INSERT INTO paliers_collectifs (objectif_collectif_id, seuil_pct, bonus_par_chatteur, label, emoji) VALUES (?, ?, ?, ?, ?)'
  );

  const txn = db.transaction(() => {
    let objId;
    if (existingSoft) {
      // Reactivate soft-deleted record
      db.prepare(
        'UPDATE objectifs_collectifs SET montant_cible = ?, description = ?, actif = 1, created_by = ? WHERE id = ?'
      ).run(montant_cible, description ?? null, req.user.id, existingSoft.id);
      objId = existingSoft.id;
      // Clear old paliers
      db.prepare('DELETE FROM paliers_collectifs WHERE objectif_collectif_id = ?').run(objId);
    } else {
      const result = db.prepare(
        'INSERT INTO objectifs_collectifs (montant_cible, periode_debut, periode_fin, description, created_by) VALUES (?, ?, ?, ?, ?)'
      ).run(montant_cible, periode_debut, periode_fin, description ?? null, req.user.id);
      objId = result.lastInsertRowid;
    }
    for (const p of paliers) {
      insertPalier.run(objId, p.seuil_pct, p.bonus_par_chatteur, p.label, p.emoji ?? null);
    }
    return objId;
  });

  const id = txn();
  logActivity(req.user.id, 'create_objectif_collectif', 'objectif_collectif', id, `${montant_cible}€`);
  res.status(201).json({ id });
}));

// PUT /api/objectifs/collectif/:id
router.put('/collectif/:id', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { id } = req.params;
  const { montant_cible, description, paliers } = req.body;

  const existing = db.prepare('SELECT id FROM objectifs_collectifs WHERE id = ? AND actif = 1').get(id);
  if (!existing) throw new ApiError(404, 'Objectif collectif non trouvé');

  const txn = db.transaction(() => {
    if (montant_cible !== undefined || description !== undefined) {
      db.prepare(
        'UPDATE objectifs_collectifs SET montant_cible = COALESCE(?, montant_cible), description = COALESCE(?, description) WHERE id = ?'
      ).run(montant_cible ?? null, description ?? null, id);
    }

    if (paliers && Array.isArray(paliers)) {
      db.prepare('DELETE FROM paliers_collectifs WHERE objectif_collectif_id = ?').run(id);
      const ins = db.prepare(
        'INSERT INTO paliers_collectifs (objectif_collectif_id, seuil_pct, bonus_par_chatteur, label, emoji) VALUES (?, ?, ?, ?, ?)'
      );
      for (const p of paliers) {
        ins.run(id, p.seuil_pct, p.bonus_par_chatteur, p.label, p.emoji ?? null);
      }
    }
  });

  txn();
  logActivity(req.user.id, 'update_objectif_collectif', 'objectif_collectif', parseInt(id));
  res.json({ message: 'Objectif collectif mis à jour' });
}));

// DELETE /api/objectifs/collectif/:id (soft delete)
router.delete('/collectif/:id', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { id } = req.params;
  db.prepare('UPDATE objectifs_collectifs SET actif = 0 WHERE id = ?').run(id);
  logActivity(req.user.id, 'delete_objectif_collectif', 'objectif_collectif', parseInt(id));
  res.json({ message: 'Objectif collectif supprimé' });
}));

// ========== PALIERS PRIMES INDIVIDUELLES (must be before /:id routes) ==========

// GET /api/objectifs/paliers-primes — global (not period-specific)
router.get('/paliers-primes', authMiddleware, asyncHandler((req, res) => {
  const paliers = db.prepare(
    'SELECT * FROM paliers_primes WHERE actif = 1 ORDER BY seuil_net_ht ASC'
  ).all();

  res.json(paliers);
}));

// POST /api/objectifs/paliers-primes — global (not period-specific)
router.post('/paliers-primes', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { paliers } = req.body;

  if (!paliers || !Array.isArray(paliers) || paliers.length === 0) {
    throw new ApiError(400, 'Au moins un palier requis');
  }

  for (const p of paliers) {
    if (!p.seuil_net_ht || p.seuil_net_ht <= 0) throw new ApiError(400, 'seuil_net_ht doit être positif');
    if (!p.bonus || p.bonus <= 0) throw new ApiError(400, 'bonus doit être positif');
    if (!p.label) throw new ApiError(400, 'label requis pour chaque palier');
  }

  const existing = db.prepare(
    'SELECT id FROM paliers_primes WHERE actif = 1 LIMIT 1'
  ).get();
  if (existing) throw new ApiError(409, 'Des paliers existent déjà');

  const ins = db.prepare(
    "INSERT INTO paliers_primes (periode_debut, periode_fin, seuil_net_ht, bonus, label, emoji, couleur) VALUES ('global', 'global', ?, ?, ?, ?, ?)"
  );

  const txn = db.transaction(() => {
    for (const p of paliers) {
      ins.run(p.seuil_net_ht, p.bonus, p.label, p.emoji ?? null, p.couleur ?? null);
    }
  });

  txn();
  logActivity(req.user.id, 'create_paliers_primes', 'paliers_primes', null, `${paliers.length} paliers`);
  res.status(201).json({ message: 'Paliers créés', count: paliers.length });
}));

// PUT /api/objectifs/paliers-primes — replace all paliers (global)
router.put('/paliers-primes', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { paliers } = req.body;

  if (!paliers || !Array.isArray(paliers) || paliers.length === 0) {
    throw new ApiError(400, 'Au moins un palier requis');
  }

  for (const p of paliers) {
    if (!p.seuil_net_ht || p.seuil_net_ht <= 0) throw new ApiError(400, 'seuil_net_ht doit être positif');
    if (!p.bonus || p.bonus <= 0) throw new ApiError(400, 'bonus doit être positif');
    if (!p.label) throw new ApiError(400, 'label requis pour chaque palier');
  }

  const del = db.prepare('DELETE FROM paliers_primes WHERE actif = 1');
  const ins = db.prepare(
    "INSERT INTO paliers_primes (periode_debut, periode_fin, seuil_net_ht, bonus, label, emoji, couleur) VALUES ('global', 'global', ?, ?, ?, ?, ?)"
  );

  const txn = db.transaction(() => {
    del.run();
    for (const p of paliers) {
      ins.run(p.seuil_net_ht, p.bonus, p.label, p.emoji ?? null, p.couleur ?? null);
    }
  });

  txn();
  logActivity(req.user.id, 'update_paliers_primes', 'paliers_primes', null, `${paliers.length} paliers`);
  res.json({ message: 'Paliers mis à jour', count: paliers.length });
}));

// DELETE /api/objectifs/paliers-primes (soft delete — global)
router.delete('/paliers-primes', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  db.prepare('UPDATE paliers_primes SET actif = 0 WHERE actif = 1').run();

  logActivity(req.user.id, 'delete_paliers_primes', 'paliers_primes');
  res.json({ message: 'Paliers supprimés' });
}));

module.exports = router;
