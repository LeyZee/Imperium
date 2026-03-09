const express = require('express');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { recalculatePaies } = require('../services/paie-calculator');

const router = express.Router();

// GET /api/ventes?periode_debut=&periode_fin=&chatteur_id=
router.get('/', authMiddleware, (req, res) => {
  const { periode_debut, periode_fin, chatteur_id } = req.query;

  let where = [];
  const params = [];

  // Chatteur can only see their own
  if (req.user.role === 'chatteur') {
    where.push('v.chatteur_id = ?');
    params.push(req.user.chatteur_id);
  } else if (chatteur_id) {
    where.push('v.chatteur_id = ?');
    params.push(chatteur_id);
  }

  if (periode_debut) {
    where.push('v.periode_debut >= ?');
    params.push(periode_debut);
  }
  if (periode_fin) {
    where.push('v.periode_fin <= ?');
    params.push(periode_fin);
  }

  const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const ventes = db.prepare(`
    SELECT v.*,
      c.prenom as chatteur_prenom,
      m.pseudo as modele_pseudo,
      p.nom as plateforme_nom, p.tva_rate, p.commission_rate, p.devise
    FROM ventes v
    JOIN chatteurs c ON c.id = v.chatteur_id
    LEFT JOIN modeles m ON m.id = v.modele_id
    JOIN plateformes p ON p.id = v.plateforme_id
    ${whereStr}
    ORDER BY v.periode_debut DESC, v.created_at DESC
  `).all(...params);

  res.json(ventes);
});

// POST /api/ventes
router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { chatteur_id, modele_id, plateforme_id, montant_brut, periode_debut, periode_fin, notes } = req.body;

  if (!chatteur_id || !plateforme_id || montant_brut === undefined || !periode_debut || !periode_fin) {
    return res.status(400).json({ error: 'Champs requis manquants' });
  }

  const montant = parseFloat(montant_brut);
  if (isNaN(montant) || montant <= 0) {
    return res.status(400).json({ error: 'Montant brut invalide (doit être un nombre positif)' });
  }

  const result = db.prepare(`
    INSERT INTO ventes (chatteur_id, modele_id, plateforme_id, montant_brut, periode_debut, periode_fin, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(chatteur_id, modele_id || null, plateforme_id, montant_brut, periode_debut, periode_fin, notes || null);

  // Auto-recalculate paies for this period
  try { recalculatePaies(periode_debut, periode_fin); } catch (err) {
    console.error('Erreur auto-recalcul paies:', err.message);
  }

  res.status(201).json({ id: result.lastInsertRowid });
});

// PUT /api/ventes/:id
router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  const { montant_brut, modele_id, plateforme_id, periode_debut, periode_fin, notes } = req.body;
  const existing = db.prepare('SELECT id FROM ventes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Vente introuvable' });

  // Get current period before update for recalcul
  const current = db.prepare('SELECT periode_debut, periode_fin FROM ventes WHERE id = ?').get(req.params.id);

  db.prepare(`
    UPDATE ventes SET
      montant_brut = COALESCE(?, montant_brut),
      modele_id = COALESCE(?, modele_id),
      plateforme_id = COALESCE(?, plateforme_id),
      periode_debut = COALESCE(?, periode_debut),
      periode_fin = COALESCE(?, periode_fin),
      notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(montant_brut, modele_id, plateforme_id, periode_debut, periode_fin, notes, req.params.id);

  // Auto-recalculate paies for affected periods
  try {
    const newPeriod = db.prepare('SELECT periode_debut, periode_fin FROM ventes WHERE id = ?').get(req.params.id);
    if (newPeriod) recalculatePaies(newPeriod.periode_debut, newPeriod.periode_fin);
    // If period changed, recalc old period too
    if (current && (current.periode_debut !== newPeriod?.periode_debut || current.periode_fin !== newPeriod?.periode_fin)) {
      recalculatePaies(current.periode_debut, current.periode_fin);
    }
  } catch (err) {
    console.error('Erreur auto-recalcul paies:', err.message);
  }

  res.json({ message: 'Vente mise à jour' });
});

// DELETE /api/ventes/:id
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  // Get period before deleting
  const vente = db.prepare('SELECT periode_debut, periode_fin FROM ventes WHERE id = ?').get(req.params.id);
  db.prepare('DELETE FROM ventes WHERE id = ?').run(req.params.id);

  // Auto-recalculate paies for the period
  if (vente) {
    try { recalculatePaies(vente.periode_debut, vente.periode_fin); } catch (err) {
      console.error('Erreur auto-recalcul paies:', err.message);
    }
  }

  res.json({ message: 'Vente supprimée' });
});

// GET /api/ventes/summary — dashboard summary
router.get('/summary', authMiddleware, (req, res) => {
  const { periode_debut, periode_fin } = req.query;

  let dateFilter = '';
  const params = [];
  if (periode_debut && periode_fin) {
    dateFilter = 'WHERE v.periode_debut >= ? AND v.periode_fin <= ?';
    params.push(periode_debut, periode_fin);
  }

  const taux = db.prepare('SELECT taux FROM taux_change WHERE devise_base = ? AND devise_cible = ? ORDER BY date_maj DESC LIMIT 1').get('USD', 'EUR');
  const tauxChange = taux?.taux || 0.92;

  const byPlateforme = db.prepare(`
    SELECT p.nom, p.tva_rate, p.commission_rate, p.devise,
      SUM(v.montant_brut) as total_brut,
      COUNT(DISTINCT v.chatteur_id) as nb_chatteurs
    FROM ventes v
    JOIN plateformes p ON p.id = v.plateforme_id
    ${dateFilter}
    GROUP BY p.id
  `).all(...params);

  // Compute totals
  let totalBrut = 0, totalTTC = 0, totalHT = 0, totalNetHT = 0;
  byPlateforme.forEach(p => {
    const ttc = p.total_brut * tauxChange;
    const ht = ttc / (1 + p.tva_rate);
    const netHT = ht * (1 - p.commission_rate);
    totalBrut += p.total_brut;
    totalTTC += ttc;
    totalHT += ht;
    totalNetHT += netHT;
    p.total_ttc = ttc;
    p.total_ht = ht;
    p.net_ht = netHT;
  });

  const topChatteur = db.prepare(`
    SELECT c.id, c.prenom, SUM(v.montant_brut) as total_brut
    FROM ventes v
    JOIN chatteurs c ON c.id = v.chatteur_id
    ${dateFilter}
    GROUP BY v.chatteur_id
    ORDER BY total_brut DESC
    LIMIT 1
  `).get(...params);

  res.json({
    taux_change: tauxChange,
    total_brut_usd: totalBrut,
    total_ttc_eur: totalTTC,
    total_ht_eur: totalHT,
    total_net_ht_eur: totalNetHT,
    by_plateforme: byPlateforme,
    top_chatteur: topChatteur
  });
});

module.exports = router;
