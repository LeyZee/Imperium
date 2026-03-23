const express = require('express');
const db = require('../database');
const { authMiddleware, adminOrManager } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { logActivity } = require('../utils/activityLogger');
const { notifyAdminsAndManagers, notifyChatteur } = require('../utils/notifier');

const router = express.Router();

// GET /api/demandes
router.get('/', authMiddleware, asyncHandler((req, res) => {
  const { statut, chatteur_id } = req.query;
  const isChatteur = req.user.role === 'chatteur';

  let where = '1=1';
  const params = [];

  if (isChatteur) {
    where += ' AND d.chatteur_id = ?';
    params.push(req.user.chatteur_id);
  } else if (chatteur_id) {
    where += ' AND d.chatteur_id = ?';
    params.push(chatteur_id);
  }

  if (statut) { where += ' AND d.statut = ?'; params.push(statut); }

  const rows = db.prepare(`
    SELECT d.*,
      c.prenom as chatteur_prenom, c.couleur as chatteur_couleur,
      e.prenom as echange_avec_prenom, e.couleur as echange_avec_couleur,
      r.prenom as reviewed_by_prenom
    FROM demandes d
    JOIN chatteurs c ON c.id = d.chatteur_id
    LEFT JOIN chatteurs e ON e.id = d.echange_avec_id
    LEFT JOIN users r ON r.id = d.reviewed_by
    WHERE ${where}
    ORDER BY d.created_at DESC
  `).all(...params);

  res.json(rows);
}));

// GET /api/demandes/pending
router.get('/pending', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const rows = db.prepare(`
    SELECT d.*, c.prenom as chatteur_prenom, c.couleur as chatteur_couleur, e.prenom as echange_avec_prenom, e.couleur as echange_avec_couleur
    FROM demandes d
    JOIN chatteurs c ON c.id = d.chatteur_id
    LEFT JOIN chatteurs e ON e.id = d.echange_avec_id
    WHERE d.statut = 'en_attente'
    ORDER BY d.created_at ASC
  `).all();

  res.json(rows);
}));

// POST /api/demandes
router.post('/', authMiddleware, asyncHandler((req, res) => {
  const { type, date_debut, date_fin, motif, echange_avec_id } = req.body;

  if (!type || !date_debut || !date_fin) throw new ApiError(400, 'type, date_debut et date_fin requis');
  if (!['conge', 'echange'].includes(type)) throw new ApiError(400, 'Type invalide');

  const chatteur_id = req.user.chatteur_id;
  if (!chatteur_id) throw new ApiError(403, 'Seuls les chatteurs peuvent soumettre des demandes');

  if (type === 'echange' && !echange_avec_id) {
    throw new ApiError(400, 'echange_avec_id requis pour un échange');
  }

  const result = db.prepare(
    'INSERT INTO demandes (chatteur_id, type, date_debut, date_fin, motif, echange_avec_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(chatteur_id, type, date_debut, date_fin, motif ?? null, echange_avec_id ?? null);

  const chatteur = db.prepare('SELECT prenom FROM chatteurs WHERE id = ?').get(chatteur_id);
  const typeLabel = type === 'conge' ? 'congé' : 'échange';
  logActivity(req.user.id, 'create_demande', 'demande', result.lastInsertRowid, `${typeLabel} du ${date_debut} au ${date_fin}`);
  notifyAdminsAndManagers('demande', `Nouvelle demande de ${typeLabel}`, `${chatteur?.prenom || 'Chatteur'} demande un ${typeLabel} du ${date_debut} au ${date_fin}`, '/admin/demandes');

  res.status(201).json({ id: result.lastInsertRowid });
}));

// PUT /api/demandes/:id/review
router.put('/:id/review', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { id } = req.params;
  const { statut } = req.body;

  if (!['approuve', 'refuse'].includes(statut)) throw new ApiError(400, 'Statut invalide (approuve ou refuse)');

  const demande = db.prepare('SELECT * FROM demandes WHERE id = ?').get(id);
  if (!demande) throw new ApiError(404, 'Demande non trouvée');
  if (demande.statut !== 'en_attente') throw new ApiError(400, 'Cette demande a déjà été traitée');

  db.prepare('UPDATE demandes SET statut = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(statut, req.user.id, id);

  const statusLabel = statut === 'approuve' ? 'approuvée' : 'refusée';
  logActivity(req.user.id, 'review_demande', 'demande', parseInt(id), statusLabel);
  notifyChatteur(demande.chatteur_id, 'demande_review', `Demande ${statusLabel}`, `Votre demande de ${demande.type === 'conge' ? 'congé' : 'échange'} a été ${statusLabel}.`, '/chatteur/demandes');

  res.json({ message: `Demande ${statusLabel}` });
}));

// DELETE /api/demandes/:id (chatteur can cancel own pending request)
router.delete('/:id', authMiddleware, asyncHandler((req, res) => {
  const { id } = req.params;
  const demande = db.prepare('SELECT * FROM demandes WHERE id = ?').get(id);
  if (!demande) throw new ApiError(404, 'Demande non trouvée');

  // Only the chatteur can delete their own pending request, or admin
  if (req.user.role === 'chatteur') {
    if (demande.chatteur_id !== req.user.chatteur_id) throw new ApiError(403, 'Non autorisé');
    if (demande.statut !== 'en_attente') throw new ApiError(400, 'Seules les demandes en attente peuvent être annulées');
  }

  db.prepare('DELETE FROM demandes WHERE id = ?').run(id);
  logActivity(req.user.id, 'delete_demande', 'demande', parseInt(id));

  res.json({ message: 'Demande annulée' });
}));

module.exports = router;
