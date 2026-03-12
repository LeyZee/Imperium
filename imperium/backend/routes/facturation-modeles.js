const express = require('express');
const db = require('../database');
const { authMiddleware, adminOnly, adminOrManager } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const router = express.Router();

// GET /api/facturation-modeles?debut=YYYY-MM-DD&fin=YYYY-MM-DD
router.get('/', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { debut, fin } = req.query;
  if (!debut || !fin) {
    throw new ApiError(400, 'debut et fin requis');
  }

  // Taux de change USD→EUR
  const tauxRow = db.prepare(
    'SELECT taux FROM taux_change WHERE devise_base = ? AND devise_cible = ? ORDER BY date_maj DESC LIMIT 1'
  ).get('USD', 'EUR');
  const tauxChange = tauxRow?.taux || 0.92;

  // Ventes agrégées par modèle + plateforme
  const rows = db.prepare(`
    SELECT
      m.id as modele_id, m.pseudo, m.part_percent, m.photo, m.couleur_fond as modele_couleur_fond, m.couleur_texte as modele_couleur_texte,
      pl.id as plateforme_id, pl.nom as plateforme_nom, pl.devise,
      pl.tva_rate, pl.commission_rate,
      pl.couleur_fond, pl.couleur_texte,
      SUM(v.montant_brut) as total_brut,
      COUNT(*) as nb_ventes
    FROM ventes v
    JOIN modeles m ON m.id = v.modele_id
    JOIN plateformes pl ON pl.id = v.plateforme_id
    WHERE v.periode_debut = ? AND v.periode_fin = ?
    GROUP BY v.modele_id, v.plateforme_id
    ORDER BY m.pseudo, pl.nom
  `).all(debut, fin);

  // Calculer les montants pour chaque ligne
  const detailRows = rows.map(r => {
    const brut = r.total_brut;
    const isUSD = r.devise === 'USD';
    const ttcEur = isUSD ? brut * tauxChange : brut;
    const htEur = ttcEur / (1 + r.tva_rate);
    const netHtEur = htEur * (1 - r.commission_rate);
    const partAgence = netHtEur * r.part_percent;
    const partModele = netHtEur * (1 - r.part_percent);

    return {
      modele_id: r.modele_id,
      pseudo: r.pseudo,
      part_percent: r.part_percent,
      photo: r.photo,
      modele_couleur_fond: r.modele_couleur_fond,
      modele_couleur_texte: r.modele_couleur_texte,
      plateforme_id: r.plateforme_id,
      plateforme_nom: r.plateforme_nom,
      devise: r.devise,
      couleur_fond: r.couleur_fond,
      couleur_texte: r.couleur_texte,
      nb_ventes: r.nb_ventes,
      total_brut: brut,
      ttc_eur: ttcEur,
      ht_eur: htEur,
      net_ht_eur: netHtEur,
      part_agence: partAgence,
      part_modele: partModele,
    };
  });

  // Agréger par modèle
  const modeleMap = {};
  for (const d of detailRows) {
    if (!modeleMap[d.modele_id]) {
      modeleMap[d.modele_id] = {
        modele_id: d.modele_id,
        pseudo: d.pseudo,
        part_percent: d.part_percent,
        photo: d.photo,
        modele_couleur_fond: d.modele_couleur_fond,
        modele_couleur_texte: d.modele_couleur_texte,
        plateformes: [],
        nb_ventes: 0,
        total_brut: 0,
        net_ht_eur: 0,
        part_agence: 0,
        part_modele: 0,
      };
    }
    const m = modeleMap[d.modele_id];
    m.nb_ventes += d.nb_ventes;
    m.total_brut += d.total_brut;
    m.net_ht_eur += d.net_ht_eur;
    m.part_agence += d.part_agence;
    m.part_modele += d.part_modele;

    // Ajouter la plateforme si pas déjà présente
    if (!m.plateformes.find(p => p.plateforme_id === d.plateforme_id)) {
      m.plateformes.push({
        plateforme_id: d.plateforme_id,
        plateforme_nom: d.plateforme_nom,
        couleur_fond: d.couleur_fond,
        couleur_texte: d.couleur_texte,
        devise: d.devise,
        nb_ventes: d.nb_ventes,
        total_brut: d.total_brut,
        net_ht_eur: d.net_ht_eur,
        part_agence: d.part_agence,
        part_modele: d.part_modele,
      });
    }
  }

  const modeles = Object.values(modeleMap).sort((a, b) => b.net_ht_eur - a.net_ht_eur);

  // Résumé global
  const totalNetHT = modeles.reduce((s, m) => s + m.net_ht_eur, 0);
  const totalPartAgence = modeles.reduce((s, m) => s + m.part_agence, 0);
  const totalPartModeles = modeles.reduce((s, m) => s + m.part_modele, 0);

  res.json({
    modeles,
    taux_change: tauxChange,
    resume: {
      total_net_ht: totalNetHT,
      total_part_agence: totalPartAgence,
      total_part_modeles: totalPartModeles,
      nb_modeles: modeles.length,
    },
  });
}));

module.exports = router;
