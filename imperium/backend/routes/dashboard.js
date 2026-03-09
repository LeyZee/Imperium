const express = require('express');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { getPeriode } = require('../utils/period');

const router = express.Router();

router.get('/', authMiddleware, adminOnly, (req, res) => {
  try {
    // Current period: 1→15 ou 15→1er du mois suivant
    const { debut: periodDebut, fin: periodFin } = getPeriode(new Date());

    // Total ventes brutes période (en EUR, toutes plateformes)
    const tauxRow = db.prepare("SELECT taux FROM taux_change WHERE devise_base='USD' ORDER BY date_maj DESC").get([]);
    const taux = tauxRow ? tauxRow.taux : 0.92;

    const ventes = db.prepare(`
      SELECT v.montant_brut, p.tva_rate, p.commission_rate, p.devise
      FROM ventes v
      JOIN plateformes p ON v.plateforme_id = p.id
      WHERE v.periode_debut >= ? AND v.periode_fin <= ?
    `).all([periodDebut, periodFin]);

    let totalBrutEur = 0, totalNetHt = 0;
    for (const v of ventes) {
      const ttc = v.devise === 'USD' ? v.montant_brut * taux : v.montant_brut;
      const ht = ttc / (1 + v.tva_rate);
      const net = ht * (1 - v.commission_rate);
      totalBrutEur += ttc;
      totalNetHt += net;
    }

    // Nb chatteurs actifs
    const nbChatteurs = db.prepare("SELECT COUNT(*) as c FROM chatteurs WHERE actif=1").get([]);

    // Dernières ventes (5)
    const dernieresVentes = db.prepare(`
      SELECT v.id, v.montant_brut, v.created_at, p.nom as plateforme, p.devise,
             c.prenom as chatteur_prenom, c.nom as chatteur_nom,
             m.prenom as modele_prenom, m.nom as modele_nom
      FROM ventes v
      JOIN plateformes p ON v.plateforme_id = p.id
      JOIN chatteurs c ON v.chatteur_id = c.id
      LEFT JOIN modeles m ON v.modele_id = m.id
      ORDER BY v.created_at DESC
      LIMIT 5
    `).all([]);

    // Top chatteur période
    const topChatteurs = db.prepare(`
      SELECT c.prenom, c.nom, SUM(v.montant_brut) as total
      FROM ventes v
      JOIN chatteurs c ON v.chatteur_id = c.id
      WHERE v.periode_debut >= ? AND v.periode_fin <= ?
      GROUP BY v.chatteur_id
      ORDER BY total DESC
      LIMIT 1
    `).get([periodDebut, periodFin]);

    res.json({
      periode: { debut: periodDebut, fin: periodFin },
      totalBrutEur: parseFloat(totalBrutEur.toFixed(2)),
      totalNetHt: parseFloat(totalNetHt.toFixed(2)),
      nbChatteurs: nbChatteurs ? nbChatteurs.c : 0,
      topChatteur: topChatteurs || null,
      dernieresVentes,
      tauxChange: taux,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur dashboard' });
  }
});

module.exports = router;
