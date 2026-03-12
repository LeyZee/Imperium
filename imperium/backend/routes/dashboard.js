const express = require('express');
const db = require('../database');
const { authMiddleware, adminOrManager } = require('../middleware/auth');
const { getPeriode } = require('../utils/period');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const router = express.Router();

/**
 * Get previous period relative to a given period
 */
function getPreviousPeriode(debut, fin) {
  const d = new Date(debut);
  const day = d.getDate();

  if (day === 1) {
    // Period was 1-15, previous is 15-1 of previous month
    const prevMonth = new Date(d.getFullYear(), d.getMonth() - 1, 15);
    const py = prevMonth.getFullYear();
    const pm = String(prevMonth.getMonth() + 1).padStart(2, '0');
    return { debut: `${py}-${pm}-15`, fin: debut };
  } else {
    // Period was 15-1, previous is 1-15 of same month
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return { debut: `${y}-${m}-01`, fin: `${y}-${m}-15` };
  }
}

/**
 * List all available periods (last 6 periods)
 */
function getAvailablePeriods() {
  const periods = [];
  let current = new Date();

  for (let i = 0; i < 6; i++) {
    const p = getPeriode(current);
    periods.push(p);
    // Move to previous period
    const d = new Date(p.debut);
    d.setDate(d.getDate() - 1);
    current = d;
  }

  return periods;
}

/**
 * Calculate sales totals for a period
 */
function calcTotals(periodDebut, periodFin, taux) {
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

  return { totalBrutEur, totalNetHt, nbVentes: ventes.length };
}

router.get('/', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  // Period: use query param or auto-detect current
  let periodDebut, periodFin;

  if (req.query.debut && req.query.fin) {
    periodDebut = req.query.debut;
    periodFin = req.query.fin;
  } else {
    const p = getPeriode(new Date());
    periodDebut = p.debut;
    periodFin = p.fin;
  }

  // Exchange rate
  const tauxRow = db.prepare("SELECT taux FROM taux_change WHERE devise_base='USD' ORDER BY date_maj DESC").get([]);
  const taux = tauxRow ? tauxRow.taux : 0.92;

  // Current period totals
  const current = calcTotals(periodDebut, periodFin, taux);

  // Previous period totals (for trends)
  const prevPeriod = getPreviousPeriode(periodDebut, periodFin);
  const prev = calcTotals(prevPeriod.debut, prevPeriod.fin, taux);

  // Trend calculation (percentage change)
  function trend(curr, previous) {
    if (!previous || previous === 0) return curr > 0 ? 100 : 0;
    return parseFloat((((curr - previous) / previous) * 100).toFixed(1));
  }

  // Nb chatteurs actifs
  const nbChatteurs = db.prepare("SELECT COUNT(*) as c FROM chatteurs WHERE actif = 1").get([]);

  // Dernières ventes (5)
  const dernieresVentes = db.prepare(`
    SELECT v.id, v.montant_brut, v.created_at, p.nom as plateforme, p.devise,
           c.prenom as chatteur_prenom,
           m.pseudo as modele_pseudo
    FROM ventes v
    JOIN plateformes p ON v.plateforme_id = p.id
    JOIN chatteurs c ON v.chatteur_id = c.id
    LEFT JOIN modeles m ON v.modele_id = m.id
    ORDER BY v.created_at DESC
    LIMIT 5
  `).all([]);

  // Top chatteur période
  const topChatteurs = db.prepare(`
    SELECT c.prenom, SUM(v.montant_brut) as total
    FROM ventes v
    JOIN chatteurs c ON v.chatteur_id = c.id
    WHERE v.periode_debut >= ? AND v.periode_fin <= ?
    GROUP BY v.chatteur_id
    ORDER BY total DESC
    LIMIT 1
  `).get([periodDebut, periodFin]);

  // Top chatteur previous period (for trend)
  const prevTopChatteur = db.prepare(`
    SELECT SUM(v.montant_brut) as total
    FROM ventes v
    WHERE v.periode_debut >= ? AND v.periode_fin <= ?
    GROUP BY v.chatteur_id
    ORDER BY total DESC
    LIMIT 1
  `).get([prevPeriod.debut, prevPeriod.fin]);

  // Sales by platform for current period
  const ventesParPlateforme = db.prepare(`
    SELECT p.nom as plateforme, SUM(v.montant_brut) as total, COUNT(*) as nb
    FROM ventes v
    JOIN plateformes p ON v.plateforme_id = p.id
    WHERE v.periode_debut >= ? AND v.periode_fin <= ?
    GROUP BY v.plateforme_id
    ORDER BY total DESC
  `).all([periodDebut, periodFin]);

  // Available periods for selector
  const periodes = getAvailablePeriods();

  res.json({
    periode: { debut: periodDebut, fin: periodFin },
    periodes,
    totalBrutEur: parseFloat(current.totalBrutEur.toFixed(2)),
    totalNetHt: parseFloat(current.totalNetHt.toFixed(2)),
    nbChatteurs: nbChatteurs ? nbChatteurs.c : 0,
    topChatteur: topChatteurs || null,
    dernieresVentes,
    ventesParPlateforme,
    tauxChange: taux,
    tendances: {
      ventes: trend(current.totalBrutEur, prev.totalBrutEur),
      netAgence: trend(current.totalNetHt, prev.totalNetHt),
      topChatteur: trend(
        topChatteurs?.total || 0,
        prevTopChatteur?.total || 0
      ),
    },
  });
}));

module.exports = router;
