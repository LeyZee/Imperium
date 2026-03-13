const express = require('express');
const db = require('../database');
const { authMiddleware, adminOrManager } = require('../middleware/auth');
const { getPeriode } = require('../utils/period');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getExchangeRate } = require('../utils/rateCache');

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
 * List all available periods (last 6 periods, no earlier than March 2026)
 */
const APP_START_DATE = '2026-03-01';

function getAvailablePeriods() {
  const periods = [];
  let current = new Date();

  for (let i = 0; i < 12; i++) {
    const p = getPeriode(current);
    // Stop if period is before app launch
    if (p.debut < APP_START_DATE) break;
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
    WHERE v.periode_debut >= ? AND v.periode_fin <= ? AND v.statut != 'rejetée'
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

  // Exchange rate (cached)
  const taux = getExchangeRate();

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
  const nbChatteurs = db.prepare("SELECT COUNT(*) as c FROM chatteurs WHERE actif = 1 AND role NOT IN ('manager', 'directeur')").get([]);

  // Dernières ventes (5) — filtered by selected period
  const dernieresVentes = db.prepare(`
    SELECT v.id, v.montant_brut, v.created_at,
           p.nom as plateforme, p.devise, p.couleur_fond as plateforme_couleur_fond, p.couleur_texte as plateforme_couleur_texte,
           c.prenom as chatteur_prenom, c.couleur as chatteur_couleur,
           m.pseudo as modele_pseudo, m.couleur_fond as modele_couleur_fond, m.couleur_texte as modele_couleur_texte
    FROM ventes v
    JOIN plateformes p ON v.plateforme_id = p.id
    JOIN chatteurs c ON v.chatteur_id = c.id
    LEFT JOIN modeles m ON v.modele_id = m.id
    WHERE v.periode_debut >= ? AND v.periode_fin <= ? AND v.statut != 'rejetée'
    ORDER BY v.created_at DESC
    LIMIT 5
  `).all([periodDebut, periodFin]);

  // Top chatteur période
  const topChatteurs = db.prepare(`
    SELECT c.prenom, SUM(v.montant_brut) as total
    FROM ventes v
    JOIN chatteurs c ON v.chatteur_id = c.id
    WHERE v.periode_debut >= ? AND v.periode_fin <= ? AND v.statut != 'rejetée'
    GROUP BY v.chatteur_id
    ORDER BY total DESC
    LIMIT 1
  `).get([periodDebut, periodFin]);

  // Top chatteur previous period (for trend)
  const prevTopChatteur = db.prepare(`
    SELECT SUM(v.montant_brut) as total
    FROM ventes v
    WHERE v.periode_debut >= ? AND v.periode_fin <= ? AND v.statut != 'rejetée'
    GROUP BY v.chatteur_id
    ORDER BY total DESC
    LIMIT 1
  `).get([prevPeriod.debut, prevPeriod.fin]);

  // Sales by platform for current period
  const ventesParPlateforme = db.prepare(`
    SELECT p.nom as plateforme, p.couleur_fond as couleur_fond, p.couleur_texte as couleur_texte, SUM(v.montant_brut) as total, COUNT(*) as nb
    FROM ventes v
    JOIN plateformes p ON v.plateforme_id = p.id
    WHERE v.periode_debut >= ? AND v.periode_fin <= ? AND v.statut != 'rejetée'
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
