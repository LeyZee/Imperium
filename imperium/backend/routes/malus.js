const express = require('express');
const db = require('../database');
const { authMiddleware, adminOrManager } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { logActivity } = require('../utils/activityLogger');
const { recalculatePaies } = require('../services/paie-calculator');

const router = express.Router();

// Recalcul paies pour les périodes couvertes par un malus
function recalcForMalus(periode, periode_fin) {
  try { recalculatePaies(periode, periode_fin || periode); } catch { /* ignore if no ventes */ }
}

// GET /api/malus?chatteur_id=&periode_debut=&periode_fin=
router.get('/', authMiddleware, asyncHandler((req, res) => {
  const { chatteur_id, periode_debut, periode_fin } = req.query;
  let query = `
    SELECT m.*, c.prenom as chatteur_prenom, c.couleur as chatteur_couleur
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

  // Overlap query: malus range [periode, periode_fin] overlaps with filter [debut, fin]
  if (periode_debut && periode_fin) {
    query += ' AND COALESCE(m.periode_fin, m.periode) >= ? AND m.periode <= ?';
    params.push(periode_debut, periode_fin);
  } else if (periode_debut) {
    query += ' AND COALESCE(m.periode_fin, m.periode) >= ?';
    params.push(periode_debut);
  } else if (periode_fin) {
    query += ' AND m.periode <= ?';
    params.push(periode_fin);
  }

  query += ' ORDER BY m.periode DESC, m.created_at DESC';
  res.json(db.prepare(query).all(...params));
}));

// POST /api/malus
router.post('/', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { chatteur_id, montant, raison, periode, periode_fin, type_malus } = req.body;
  if (!chatteur_id || montant == null || montant === '' || !periode) {
    throw new ApiError(400, 'chatteur_id, montant et periode requis');
  }
  const typeMalus = type_malus === 'pourcentage' ? 'pourcentage' : 'montant';
  const fin = periode_fin || periode;

  // Anti-doublon: même chatteur + même type sur période chevauchante
  const existing = db.prepare(`
    SELECT id FROM malus
    WHERE chatteur_id = ? AND type_malus = ? AND actif != 0
    AND COALESCE(periode_fin, periode) >= ? AND periode <= ?
  `).get(chatteur_id, typeMalus, periode, fin);
  if (existing) {
    throw new ApiError(409, `Un malus ${typeMalus === 'pourcentage' ? 'pourcentage' : 'montant fixe'} existe déjà pour ce chatteur sur cette période`);
  }

  const insertAndRecalc = db.transaction(() => {
    const result = db.prepare(
      'INSERT INTO malus (chatteur_id, montant, raison, periode, periode_fin, type_malus) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(chatteur_id, montant, raison || null, periode, fin, typeMalus);

    const label = typeMalus === 'pourcentage' ? `${montant}%` : `${montant}€`;
    logActivity(req.user.id, 'create_malus', 'malus', result.lastInsertRowid, label);
    return result;
  });
  const result = insertAndRecalc();
  recalcForMalus(periode, fin);

  res.status(201).json({ id: result.lastInsertRowid });
}));

// PUT /api/malus/:id
router.put('/:id', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { id } = req.params;
  const { montant, raison, type_malus, periode, periode_fin } = req.body;

  const existing = db.prepare('SELECT id FROM malus WHERE id = ? AND actif != 0').get(id);
  if (!existing) throw new ApiError(404, 'Malus non trouvé');

  const typeMalus = type_malus === 'pourcentage' ? 'pourcentage' : (type_malus === 'montant' ? 'montant' : null);
  const updateAndLog = db.transaction(() => {
    db.prepare(`UPDATE malus SET
      montant = COALESCE(?, montant),
      raison = COALESCE(?, raison),
      type_malus = COALESCE(?, type_malus),
      periode = COALESCE(?, periode),
      periode_fin = COALESCE(?, periode_fin)
      WHERE id = ?`
    ).run(montant ?? null, raison ?? null, typeMalus, periode ?? null, periode_fin ?? null, id);
    logActivity(req.user.id, 'update_malus', 'malus', parseInt(id));
    return db.prepare('SELECT periode, periode_fin FROM malus WHERE id = ?').get(id);
  });
  const updated = updateAndLog();
  if (updated) recalcForMalus(updated.periode, updated.periode_fin);

  res.json({ message: 'Malus mis à jour' });
}));

// DELETE /api/malus/:id (soft delete)
router.delete('/:id', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const deleteAndLog = db.transaction(() => {
    const m = db.prepare('SELECT periode, periode_fin FROM malus WHERE id = ? AND actif != 0').get(req.params.id);
    db.prepare('UPDATE malus SET actif = 0 WHERE id = ?').run(req.params.id);
    logActivity(req.user.id, 'delete_malus', 'malus', parseInt(req.params.id));
    return m;
  });
  const malus = deleteAndLog();
  if (malus) recalcForMalus(malus.periode, malus.periode_fin);
  res.json({ message: 'Malus supprimé' });
}));

module.exports = router;
