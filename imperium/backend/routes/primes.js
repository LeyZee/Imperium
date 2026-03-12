const express = require('express');
const db = require('../database');
const { authMiddleware, adminOrManager } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { logActivity } = require('../utils/activityLogger');
const { recalculatePaies } = require('../services/paie-calculator');

const router = express.Router();

// Recalcul paies pour les périodes couvertes par une prime
function recalcForPrime(periode_debut, periode_fin) {
  try { recalculatePaies(periode_debut, periode_fin || periode_debut); } catch { /* ignore */ }
}

// GET /api/primes
router.get('/', authMiddleware, asyncHandler((req, res) => {
  const { chatteur_id, periode_debut, periode_fin } = req.query;

  let where = 'pm.actif = 1';
  const params = [];

  // Chatteurs only see their own
  if (req.user.role === 'chatteur') {
    where += ' AND pm.chatteur_id = ?';
    params.push(req.user.chatteur_id);
  } else if (chatteur_id) {
    where += ' AND pm.chatteur_id = ?';
    params.push(chatteur_id);
  }

  if (periode_debut) { where += ' AND pm.periode_debut >= ?'; params.push(periode_debut); }
  if (periode_fin) { where += ' AND pm.periode_fin <= ?'; params.push(periode_fin); }

  const rows = db.prepare(`
    SELECT pm.*, c.prenom as chatteur_prenom, c.couleur as chatteur_couleur
    FROM primes_manuelles pm
    JOIN chatteurs c ON c.id = pm.chatteur_id
    WHERE ${where}
    ORDER BY pm.created_at DESC
  `).all(...params);

  res.json(rows);
}));

// POST /api/primes
router.post('/', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { chatteur_id, montant, raison, periode_debut, periode_fin } = req.body;

  if (!chatteur_id || !montant || !periode_debut || !periode_fin) {
    throw new ApiError(400, 'chatteur_id, montant, periode_debut et periode_fin requis');
  }
  if (montant <= 0) throw new ApiError(400, 'Le montant doit être positif');

  const insertAndLog = db.transaction(() => {
    const result = db.prepare(
      'INSERT INTO primes_manuelles (chatteur_id, montant, raison, periode_debut, periode_fin, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(chatteur_id, montant, raison ?? null, periode_debut, periode_fin, req.user.id);
    logActivity(req.user.id, 'create_prime', 'prime', result.lastInsertRowid, `${montant}€ pour chatteur #${chatteur_id}`);
    return result;
  });
  const result = insertAndLog();
  recalcForPrime(periode_debut, periode_fin);

  res.status(201).json({ id: result.lastInsertRowid });
}));

// PUT /api/primes/:id
router.put('/:id', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { id } = req.params;
  const { montant, raison } = req.body;

  const existing = db.prepare('SELECT id FROM primes_manuelles WHERE id = ? AND actif = 1').get(id);
  if (!existing) throw new ApiError(404, 'Prime non trouvée');

  const updateAndLog = db.transaction(() => {
    db.prepare('UPDATE primes_manuelles SET montant = COALESCE(?, montant), raison = COALESCE(?, raison) WHERE id = ?')
      .run(montant ?? null, raison ?? null, id);
    logActivity(req.user.id, 'update_prime', 'prime', parseInt(id));
    return db.prepare('SELECT periode_debut, periode_fin FROM primes_manuelles WHERE id = ?').get(id);
  });
  const updated = updateAndLog();
  if (updated) recalcForPrime(updated.periode_debut, updated.periode_fin);

  res.json({ message: 'Prime mise à jour' });
}));

// DELETE /api/primes/:id (soft delete)
router.delete('/:id', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { id } = req.params;
  const deleteAndLog = db.transaction(() => {
    const p = db.prepare('SELECT periode_debut, periode_fin FROM primes_manuelles WHERE id = ? AND actif = 1').get(id);
    db.prepare('UPDATE primes_manuelles SET actif = 0 WHERE id = ?').run(id);
    logActivity(req.user.id, 'delete_prime', 'prime', parseInt(id));
    return p;
  });
  const prime = deleteAndLog();
  if (prime) recalcForPrime(prime.periode_debut, prime.periode_fin);
  res.json({ message: 'Prime supprimée' });
}));

module.exports = router;
