const express = require('express');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { recalculatePaies } = require('../services/paie-calculator');

const router = express.Router();

// GET /api/paies?debut=YYYY-MM-DD&fin=YYYY-MM-DD
router.get('/', authMiddleware, (req, res) => {
  const { debut, fin } = req.query;
  if (!debut || !fin) {
    return res.status(400).json({ error: 'debut et fin requis' });
  }

  // Fetch paie rows with chatteur + plateforme info
  const paies = db.prepare(`
    SELECT p.*,
      c.prenom as chatteur_prenom,
      c.taux_commission, c.role, c.taux_net_equipe,
      pl.nom as plateforme_nom, pl.devise
    FROM paies p
    JOIN chatteurs c ON c.id = p.chatteur_id
    LEFT JOIN plateformes pl ON pl.id = p.plateforme_id
    WHERE p.periode_debut = ? AND p.periode_fin = ?
    ORDER BY (c.role = 'manager') ASC, p.net_ht_eur DESC, c.prenom
  `).all(debut, fin);

  // Split into normal chatteurs and managers
  const normalPaies = paies.filter(p => p.role !== 'manager');
  const managerPaies = paies.filter(p => p.role === 'manager');

  // Calculate résumé
  const totalNetHTEquipe = normalPaies.reduce((s, p) => s + p.net_ht_eur, 0);
  const totalPayeEquipe = paies.reduce((s, p) => s + p.total_chatteur, 0);

  // Part modèles = sum of all commission_chatteur + primes (what chatteurs+managers get)
  const partModeles = totalPayeEquipe;
  // Trésorerie agence = net_ht - part modèles
  const tresorerieAgence = totalNetHTEquipe - normalPaies.reduce((s, p) => s + p.total_chatteur, 0)
    - managerPaies.reduce((s, p) => s + p.total_chatteur, 0);

  // Taux change
  const tauxRow = db.prepare(
    'SELECT taux FROM taux_change WHERE devise_base = ? AND devise_cible = ? ORDER BY date_maj DESC LIMIT 1'
  ).get('USD', 'EUR');
  const tauxChange = tauxRow?.taux || 0.92;

  // Top 3 chatteurs by aggregated net_ht
  const chatteurAgg = {};
  for (const p of normalPaies) {
    if (!chatteurAgg[p.chatteur_id]) {
      chatteurAgg[p.chatteur_id] = {
        chatteur_id: p.chatteur_id,
        nom: p.chatteur_prenom,
        net_ht: 0,
        prime: 0,
      };
    }
    chatteurAgg[p.chatteur_id].net_ht += p.net_ht_eur;
    chatteurAgg[p.chatteur_id].prime += p.prime;
  }
  const topChatteurs = Object.values(chatteurAgg)
    .sort((a, b) => b.net_ht - a.net_ht)
    .slice(0, 3);

  res.json({
    paies: normalPaies,
    managers: managerPaies,
    resume: {
      total_net_ht_equipe: totalNetHTEquipe,
      total_paye_equipe: totalPayeEquipe,
      tresorerie_agence: tresorerieAgence,
      taux_change: tauxChange,
      top_chatteurs: topChatteurs,
    },
  });
});

// POST /api/paies/recalculer — force recalculate for a period
router.post('/recalculer', authMiddleware, adminOnly, (req, res) => {
  const { debut, fin } = req.body;
  if (!debut || !fin) {
    return res.status(400).json({ error: 'debut et fin requis' });
  }

  try {
    const result = recalculatePaies(debut, fin);
    res.json(result);
  } catch (err) {
    console.error('Erreur recalcul paies:', err.message);
    res.status(500).json({ error: 'Erreur lors du recalcul des paies' });
  }
});

// PUT /api/paies/:id/statut — change status (calculé → validé → payé)
router.put('/:id/statut', authMiddleware, adminOnly, (req, res) => {
  const { statut } = req.body;
  if (!['calculé', 'validé', 'payé'].includes(statut)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }
  db.prepare('UPDATE paies SET statut = ? WHERE id = ?').run(statut, req.params.id);
  res.json({ message: 'Statut mis à jour' });
});

// GET /api/paies/periodes — list available periods
router.get('/periodes', authMiddleware, (req, res) => {
  const periodes = db.prepare(`
    SELECT DISTINCT periode_debut, periode_fin
    FROM paies
    ORDER BY periode_debut DESC
    LIMIT 20
  `).all();
  res.json(periodes);
});

module.exports = router;
