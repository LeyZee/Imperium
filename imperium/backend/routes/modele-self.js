const express = require('express');
const db = require('../database');
const { authMiddleware, modeleOnly } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { getPeriode } = require('../utils/period');
const { getExchangeRate } = require('../utils/rateCache');

const router = express.Router();

// All routes require modele authentication
router.use(authMiddleware, modeleOnly);

/* ─── Helpers ─── */

function getPreviousPeriode(debut) {
  const d = new Date(debut);
  const day = d.getDate();
  if (day === 1) {
    const prevMonth = new Date(d.getFullYear(), d.getMonth() - 1, 15);
    const py = prevMonth.getFullYear();
    const pm = String(prevMonth.getMonth() + 1).padStart(2, '0');
    return { debut: `${py}-${pm}-15`, fin: debut };
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return { debut: `${y}-${m}-01`, fin: `${y}-${m}-15` };
}

function calcModeleTotals(modeleId, periodDebut, periodFin, taux) {
  const ventes = db.prepare(`
    SELECT v.montant_brut, p.tva_rate, p.commission_rate, p.devise
    FROM ventes v
    JOIN plateformes p ON v.plateforme_id = p.id
    WHERE v.modele_id = ? AND v.periode_debut >= ? AND v.periode_fin <= ? AND v.statut != 'rejetée'
  `).all(modeleId, periodDebut, periodFin);

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

/* ─── GET /api/modele/dashboard ─── */
router.get('/dashboard', asyncHandler((req, res) => {
  const modeleId = req.user.modele_id;
  if (!modeleId) throw new ApiError(403, 'Modèle non lié');

  const modele = db.prepare('SELECT id, pseudo, part_percent FROM modeles WHERE id = ?').get(modeleId);
  if (!modele) throw new ApiError(404, 'Modèle introuvable');

  const taux = getExchangeRate();

  // Current period
  let periodDebut, periodFin;
  if (req.query.debut && req.query.fin) {
    periodDebut = req.query.debut;
    periodFin = req.query.fin;
  } else {
    const p = getPeriode(new Date());
    periodDebut = p.debut;
    periodFin = p.fin;
  }

  const current = calcModeleTotals(modeleId, periodDebut, periodFin, taux);
  const prevPeriode = getPreviousPeriode(periodDebut);
  const prev = calcModeleTotals(modeleId, prevPeriode.debut, prevPeriode.fin, taux);

  // Trend
  const trendPct = prev.totalBrutEur > 0
    ? parseFloat((((current.totalBrutEur - prev.totalBrutEur) / prev.totalBrutEur) * 100).toFixed(1))
    : (current.totalBrutEur > 0 ? 100 : 0);

  // Parts
  const partAgence = current.totalNetHt * modele.part_percent;
  const partModele = current.totalNetHt * (1 - modele.part_percent);

  // Ticket moyen
  const ticketMoyen = current.nbVentes > 0 ? current.totalBrutEur / current.nbVentes : 0;

  // Breakdown by platform
  const ventesParPlateforme = db.prepare(`
    SELECT p.nom as plateforme, p.couleur_fond, p.couleur_texte, p.devise,
           SUM(v.montant_brut) as total, COUNT(*) as nb
    FROM ventes v
    JOIN plateformes p ON v.plateforme_id = p.id
    WHERE v.modele_id = ? AND v.periode_debut >= ? AND v.periode_fin <= ? AND v.statut != 'rejetée'
    GROUP BY v.plateforme_id
    ORDER BY total DESC
  `).all(modeleId, periodDebut, periodFin);

  // Evolution over last 6 periods
  const evolution = [];
  let evoDate = new Date();
  for (let i = 0; i < 6; i++) {
    const p = getPeriode(evoDate);
    if (p.debut < '2026-03-01') break;
    const totals = calcModeleTotals(modeleId, p.debut, p.fin, taux);
    evolution.unshift({
      periode: p.debut,
      label: `${p.debut.slice(8, 10)}/${p.debut.slice(5, 7)}`,
      brut_eur: parseFloat(totals.totalBrutEur.toFixed(2)),
      net_ht: parseFloat(totals.totalNetHt.toFixed(2)),
    });
    const d = new Date(p.debut);
    d.setDate(d.getDate() - 1);
    evoDate = d;
  }

  // Activity: shifts & chatteurs (no names!)
  const activite = db.prepare(`
    SELECT
      COUNT(*) as shifts_total,
      COUNT(DISTINCT s.chatteur_id) as chatteurs_actifs
    FROM shifts s
    WHERE s.modele_id = ? AND s.date >= ? AND s.date < ?
  `).get(modeleId, periodDebut, periodFin);

  res.json({
    periode: { debut: periodDebut, fin: periodFin },
    totalBrutEur: parseFloat(current.totalBrutEur.toFixed(2)),
    totalNetHt: parseFloat(current.totalNetHt.toFixed(2)),
    partAgence: parseFloat(partAgence.toFixed(2)),
    partModele: parseFloat(partModele.toFixed(2)),
    nbVentes: current.nbVentes,
    ticketMoyen: parseFloat(ticketMoyen.toFixed(2)),
    tendance: trendPct,
    ventesParPlateforme,
    evolution,
    activite: {
      shifts: activite?.shifts_total || 0,
      chatteurs: activite?.chatteurs_actifs || 0,
    },
    shiftsAujourdhui: db.prepare(`
      SELECT s.id, s.creneau, c.prenom as chatteur_prenom, c.couleur as chatteur_couleur,
             p.nom as plateforme_nom, p.couleur_fond as plateforme_couleur_fond, p.couleur_texte as plateforme_couleur_texte
      FROM shifts s
      JOIN chatteurs c ON c.id = s.chatteur_id
      JOIN plateformes p ON p.id = s.plateforme_id
      WHERE s.modele_id = ? AND s.date = ?
      ORDER BY s.creneau, c.prenom
    `).all(modeleId, new Date().toISOString().slice(0, 10)),
    tauxChange: taux,
  });
}));

/* ─── GET /api/modele/facturation ─── */
router.get('/facturation', asyncHandler((req, res) => {
  const modeleId = req.user.modele_id;
  if (!modeleId) throw new ApiError(403, 'Modèle non lié');

  const { debut, fin } = req.query;
  if (!debut || !fin) throw new ApiError(400, 'debut et fin requis');

  const modele = db.prepare('SELECT id, pseudo, part_percent FROM modeles WHERE id = ?').get(modeleId);
  if (!modele) throw new ApiError(404, 'Modèle introuvable');

  const taux = getExchangeRate();

  // Sales by platform
  const rows = db.prepare(`
    SELECT
      pl.id as plateforme_id, pl.nom as plateforme_nom, pl.devise,
      pl.tva_rate, pl.commission_rate,
      pl.couleur_fond, pl.couleur_texte,
      SUM(v.montant_brut) as total_brut,
      COUNT(*) as nb_ventes
    FROM ventes v
    JOIN plateformes pl ON pl.id = v.plateforme_id
    WHERE v.modele_id = ? AND v.periode_debut = ? AND v.periode_fin = ? AND v.statut != 'rejetée'
    GROUP BY v.plateforme_id
    ORDER BY total_brut DESC
  `).all(modeleId, debut, fin);

  const plateformes = rows.map(r => {
    const brut = r.total_brut;
    const isUSD = r.devise === 'USD';
    const ttcEur = isUSD ? brut * taux : brut;
    const htEur = ttcEur / (1 + r.tva_rate);
    const netHtEur = htEur * (1 - r.commission_rate);
    const partModele = netHtEur * (1 - modele.part_percent);

    return {
      plateforme_id: r.plateforme_id,
      plateforme_nom: r.plateforme_nom,
      devise: r.devise,
      tva_rate: r.tva_rate,
      commission_rate: r.commission_rate,
      couleur_fond: r.couleur_fond,
      couleur_texte: r.couleur_texte,
      nb_ventes: r.nb_ventes,
      total_brut: brut,
      ttc_eur: ttcEur,
      ht_eur: htEur,
      net_ht_eur: netHtEur,
      part_agence: netHtEur * modele.part_percent,
      part_modele: partModele,
    };
  });

  const totalNetHt = plateformes.reduce((s, p) => s + p.net_ht_eur, 0);
  const totalPartAgence = plateformes.reduce((s, p) => s + p.part_agence, 0);
  const totalPartModele = plateformes.reduce((s, p) => s + p.part_modele, 0);

  res.json({
    pseudo: modele.pseudo,
    part_percent: modele.part_percent,
    plateformes,
    taux_change: taux,
    resume: {
      total_net_ht: totalNetHt,
      total_part_agence: totalPartAgence,
      total_part_modele: totalPartModele,
      nb_ventes: plateformes.reduce((s, p) => s + p.nb_ventes, 0),
    },
  });
}));

/* ─── GET /api/modele/ventes ─── */
router.get('/ventes', asyncHandler((req, res) => {
  const modeleId = req.user.modele_id;
  if (!modeleId) throw new ApiError(403, 'Modèle non lié');

  const { periode_debut, periode_fin } = req.query;
  if (!periode_debut || !periode_fin) throw new ApiError(400, 'periode_debut et periode_fin requis');

  const taux = getExchangeRate();

  const ventes = db.prepare(`
    SELECT v.id, v.montant_brut, v.periode_debut, v.periode_fin, v.notes, v.statut, v.source, v.created_at,
           v.plateforme_id,
           p.nom as plateforme_nom, p.devise, p.couleur_fond as plateforme_couleur_fond, p.couleur_texte as plateforme_couleur_texte,
           c.prenom as chatteur_prenom, c.couleur as chatteur_couleur,
           s.creneau as shift_creneau
    FROM ventes v
    JOIN plateformes p ON v.plateforme_id = p.id
    LEFT JOIN chatteurs c ON c.id = v.chatteur_id
    LEFT JOIN shifts s ON s.id = v.shift_id
    WHERE v.modele_id = ? AND v.periode_debut >= ? AND v.periode_fin <= ?
    ORDER BY v.created_at DESC
  `).all(modeleId, periode_debut, periode_fin);

  // Summary: total brut in EUR, nb ventes, per-platform breakdown
  let totalBrut = 0;
  const platMap = {};
  for (const v of ventes) {
    const eur = v.devise === 'USD' ? v.montant_brut * taux : v.montant_brut;
    totalBrut += eur;
    if (!platMap[v.plateforme_id]) {
      platMap[v.plateforme_id] = {
        plateforme: v.plateforme_nom,
        devise: v.devise,
        couleur_fond: v.plateforme_couleur_fond,
        couleur_texte: v.plateforme_couleur_texte,
        total: 0,
        totalEur: 0,
        nb: 0,
      };
    }
    platMap[v.plateforme_id].total += v.montant_brut;
    platMap[v.plateforme_id].totalEur += eur;
    platMap[v.plateforme_id].nb += 1;
  }

  // Trend: compare with previous period
  const prev = getPreviousPeriode(periode_debut);
  const prevTotal = calcModeleTotals(modeleId, prev.debut, prev.fin, taux);
  const trend = prevTotal.totalBrutEur > 0
    ? parseFloat((((totalBrut - prevTotal.totalBrutEur) / prevTotal.totalBrutEur) * 100).toFixed(1))
    : (totalBrut > 0 ? 100 : 0);

  res.json({
    ventes,
    taux_change: taux,
    summary: {
      totalBrut: parseFloat(totalBrut.toFixed(2)),
      nbVentes: ventes.length,
      trend,
      parPlateforme: Object.values(platMap).map(p => ({
        ...p,
        total: parseFloat(p.total.toFixed(2)),
        totalEur: parseFloat(p.totalEur.toFixed(2)),
      })),
    },
  });
}));

/* ─── GET /api/modele/shifts ─── */
router.get('/shifts', asyncHandler((req, res) => {
  const modeleId = req.user.modele_id;
  if (!modeleId) throw new ApiError(403, 'Modèle non lié');

  const { date } = req.query;
  if (!date) throw new ApiError(400, 'date requis');

  // Get the week (Monday to Sunday) around the given date
  const d = new Date(date);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const mondayStr = monday.toISOString().slice(0, 10);
  const sundayStr = sunday.toISOString().slice(0, 10);

  const shifts = db.prepare(`
    SELECT s.id, s.date, s.creneau, s.fuseau_horaire,
           p.nom as plateforme_nom, p.couleur_fond as plateforme_couleur_fond, p.couleur_texte as plateforme_couleur_texte,
           c.prenom as chatteur_prenom, c.couleur as chatteur_couleur
    FROM shifts s
    JOIN plateformes p ON p.id = s.plateforme_id
    LEFT JOIN chatteurs c ON c.id = s.chatteur_id
    WHERE s.modele_id = ? AND s.date >= ? AND s.date <= ?
    ORDER BY s.date, s.creneau
  `).all(modeleId, mondayStr, sundayStr);

  res.json(shifts);
}));

/* ─── GET /api/modele/profil ─── */
router.get('/profil', asyncHandler((req, res) => {
  const modeleId = req.user.modele_id;
  if (!modeleId) throw new ApiError(403, 'Modèle non lié');

  const modele = db.prepare('SELECT id, pseudo, photo, couleur_fond, couleur_texte, part_percent FROM modeles WHERE id = ?').get(modeleId);
  if (!modele) throw new ApiError(404, 'Modèle introuvable');

  const plateformes = db.prepare(`
    SELECT p.id, p.nom, p.couleur_fond, p.couleur_texte
    FROM plateformes p
    JOIN modeles_plateformes mp ON mp.plateforme_id = p.id
    WHERE mp.modele_id = ?
    ORDER BY p.nom
  `).all(modeleId);

  res.json({ ...modele, plateformes });
}));

module.exports = router;
