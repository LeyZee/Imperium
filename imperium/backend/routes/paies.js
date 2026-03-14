const express = require('express');
const archiver = require('archiver');
const db = require('../database');
const { authMiddleware, adminOnly, adminOrManager } = require('../middleware/auth');
const { recalculatePaies } = require('../services/paie-calculator');
const { generateFacture } = require('../services/facture-generator');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { logActivity } = require('../utils/activityLogger');
const { notifyChatteur } = require('../utils/notifier');
const { getExchangeRate } = require('../utils/rateCache');
const { validateDate } = require('../utils/validation');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

const router = express.Router();

// GET /api/paies?debut=YYYY-MM-DD&fin=YYYY-MM-DD
router.get('/', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { debut, fin } = req.query;
  if (!debut || !fin) {
    throw new ApiError(400, 'debut et fin requis');
  }
  const dateErr = validateDate(debut) || validateDate(fin);
  if (dateErr) throw new ApiError(400, dateErr);

  // Fetch paie rows with chatteur + plateforme info + user role
  const paies = db.prepare(`
    SELECT p.*,
      c.prenom as chatteur_prenom, c.couleur as chatteur_couleur,
      c.taux_commission, c.role, c.taux_net_equipe,
      pl.nom as plateforme_nom, pl.devise, pl.couleur_fond, pl.couleur_texte,
      u.role as user_role
    FROM paies p
    JOIN chatteurs c ON c.id = p.chatteur_id
    LEFT JOIN users u ON u.id = c.user_id
    LEFT JOIN plateformes pl ON pl.id = p.plateforme_id
    WHERE p.periode_debut = ? AND p.periode_fin = ?
    ORDER BY (c.role = 'manager') ASC, p.net_ht_eur DESC, c.prenom
  `).all(debut, fin);

  // Split into normal chatteurs, managers, and directeurs
  // Manager/directeur platform sales (plateforme_id NOT NULL) stay with normal paies for correct total
  // Manager/directeur summary rows (plateforme_id NULL = team revenue share) go to managers/directeurs
  const normalPaies = paies.filter(p => (p.role !== 'manager' && p.role !== 'directeur') || p.plateforme_id != null);
  const managerPaies = paies.filter(p => p.role === 'manager' && p.plateforme_id == null);
  const directeurPaies = paies.filter(p => p.role === 'directeur' && p.plateforme_id == null);

  // Taux change (cached)
  const tauxChange = getExchangeRate();

  // Calculate résumé — include ALL platform sales (including managers' own) for consistency with paie-calculator
  const totalNetHTEquipe = paies.reduce((s, p) => s + (p.net_ht_eur || 0), 0);
  const totalPayeEquipe = paies.reduce((s, p) => s + p.total_chatteur, 0);

  // Trésorerie agence = part agence du CA - ce qu'on paye aux chatteurs/managers
  // On calcule le revenu agence depuis les ventes validées (net_ht × part_percent par modèle)
  const agencyGrossRow = db.prepare(`
    SELECT COALESCE(SUM(
      (CASE WHEN pl.devise = 'USD' THEN v.montant_brut * ? ELSE v.montant_brut END)
      / (1 + pl.tva_rate)
      * (1 - pl.commission_rate)
      * COALESCE(m.part_percent, 0.35)
    ), 0) as agency_gross
    FROM ventes v
    JOIN plateformes pl ON pl.id = v.plateforme_id
    LEFT JOIN modeles m ON m.id = v.modele_id
    WHERE v.periode_debut = ? AND v.periode_fin = ? AND v.statut = 'validée'
  `).get(tauxChange, debut, fin);
  const agencyGross = agencyGrossRow?.agency_gross || 0;
  const tresorerieAgence = agencyGross - totalPayeEquipe;

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

  // Preview: calculate estimated total if all en_attente ventes were validated
  const pendingRow = db.prepare(`
    SELECT COALESCE(SUM(
      (CASE WHEN pl.devise = 'USD' THEN v.montant_brut * ? ELSE v.montant_brut END)
      / (1 + pl.tva_rate)
      * (1 - pl.commission_rate)
    ), 0) as pending_net_ht,
    COUNT(*) as nb_pending
    FROM ventes v
    JOIN plateformes pl ON pl.id = v.plateforme_id
    WHERE v.periode_debut >= ? AND v.periode_fin <= ? AND v.statut = 'en_attente'
  `).get(tauxChange, debut, fin);

  res.json({
    paies: normalPaies,
    managers: managerPaies,
    directeurs: directeurPaies,
    resume: {
      total_net_ht_equipe: totalNetHTEquipe,
      total_paye_equipe: totalPayeEquipe,
      part_agence_brut: agencyGross,
      tresorerie_agence: tresorerieAgence,
      taux_change: tauxChange,
      top_chatteurs: topChatteurs,
    },
    preview: {
      pending_net_ht: pendingRow?.pending_net_ht || 0,
      nb_pending: pendingRow?.nb_pending || 0,
      total_net_ht_with_pending: totalNetHTEquipe + (pendingRow?.pending_net_ht || 0),
    },
  });
}));

// POST /api/paies/recalculer — force recalculate for a period
router.post('/recalculer', authMiddleware, adminOnly, asyncHandler((req, res) => {
  const { debut, fin } = req.body;
  if (!debut || !fin) {
    throw new ApiError(400, 'debut et fin requis');
  }
  const dateErr = validateDate(debut) || validateDate(fin);
  if (dateErr) throw new ApiError(400, dateErr);

  const result = recalculatePaies(debut, fin);
  res.json(result);
}));

// PUT /api/paies/:id/statut — change status (calculé → validé → payé)
router.put('/:id/statut', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { statut } = req.body;
  if (!['calculé', 'validé', 'payé'].includes(statut)) {
    throw new ApiError(400, 'Statut invalide');
  }
  // Manager cannot mark paies as paid
  if (req.user.role === 'manager' && statut === 'payé') {
    throw new ApiError(403, 'Seul un administrateur peut marquer une paie comme payée');
  }
  const paie = db.prepare('SELECT p.chatteur_id, c.role as chatteur_role FROM paies p JOIN chatteurs c ON c.id = p.chatteur_id WHERE p.id = ?').get(req.params.id);
  // Manager cannot modify directeur paies
  if (req.user.role === 'manager' && paie?.chatteur_role === 'directeur') {
    throw new ApiError(403, 'Seul un administrateur peut modifier la paie du directeur');
  }
  db.prepare('UPDATE paies SET statut = ? WHERE id = ?').run(statut, req.params.id);

  logActivity(req.user.id, 'update_paie_statut', 'paie', parseInt(req.params.id), statut);

  // Notify chatteur when paie is validated or paid
  if (paie && (statut === 'validé' || statut === 'payé')) {
    const label = statut === 'validé' ? 'validée' : 'payée';
    notifyChatteur(paie.chatteur_id, 'paie_statut', `Paie ${label}`, `Votre paie a été ${label}.`, '/chatteur/factures');
  }

  res.json({ message: 'Statut mis à jour' });
}));

// GET /api/paies/mes-paies — chatteur: get own paies with full calculation details
router.get('/mes-paies', authMiddleware, asyncHandler((req, res) => {
  if (req.user.role !== 'chatteur' || !req.user.chatteur_id) {
    throw new ApiError(403, 'Accès réservé aux chatteurs');
  }

  const chatteur = db.prepare('SELECT taux_commission, role, taux_net_equipe FROM chatteurs WHERE id = ?')
    .get(req.user.chatteur_id);

  const paies = db.prepare(`
    SELECT p.*,
      pl.nom as plateforme_nom, pl.devise, pl.tva_rate, pl.commission_rate,
      pl.couleur_fond, pl.couleur_texte
    FROM paies p
    LEFT JOIN plateformes pl ON pl.id = p.plateforme_id
    WHERE p.chatteur_id = ?
    ORDER BY p.periode_debut DESC
    LIMIT 50
  `).all(req.user.chatteur_id);

  res.json({
    paies,
    taux_commission: chatteur?.taux_commission || 0,
    role: chatteur?.role || 'chatteur',
  });
}));

// GET /api/paies/periodes — list available periods
router.get('/periodes', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const periodes = db.prepare(`
    SELECT DISTINCT periode_debut, periode_fin
    FROM paies
    ORDER BY periode_debut DESC
    LIMIT 20
  `).all();
  res.json(periodes);
}));

// GET /api/paies/factures-zip?debut=YYYY-MM-DD&fin=YYYY-MM-DD — ZIP of all invoices for a period
router.get('/factures-zip', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { debut, fin } = req.query;
  if (!debut || !fin) {
    throw new ApiError(400, 'debut et fin requis');
  }

  // Find all unique chatteurs with paies for this period
  const rows = db.prepare(`
    SELECT DISTINCT p.chatteur_id, c.prenom
    FROM paies p JOIN chatteurs c ON c.id = p.chatteur_id
    WHERE p.periode_debut = ? AND p.periode_fin = ?
    ORDER BY c.prenom
  `).all(debut, fin);

  if (rows.length === 0) {
    throw new ApiError(404, 'Aucune paie pour cette période');
  }

  // Block if any ventes are pending validation
  const pendingVentes = db.prepare(`
    SELECT COUNT(*) as cnt FROM ventes
    WHERE periode_debut >= ? AND periode_fin <= ? AND statut = 'en_attente'
  `).get(debut, fin);
  if (pendingVentes.cnt > 0) {
    throw new ApiError(400, `Impossible de générer les factures : ${pendingVentes.cnt} vente(s) en attente de validation`);
  }

  // Setup ZIP stream
  const zipFilename = `IMPERA_Factures_${debut}_${fin}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    logger.error('Erreur ZIP', { error: err.message });
    if (!res.headersSent) res.status(500).json({ error: 'Erreur génération ZIP' });
  });
  archive.pipe(res);

  // Generate each PDF and append to ZIP
  for (const row of rows) {
    try {
      const { stream, filename } = generateFacture(row.chatteur_id, debut, fin);
      archive.append(stream, { name: filename });
    } catch (err) {
      logger.error(`Erreur facture ${row.prenom}`, { error: err.message });
    }
  }

  archive.finalize();
}));

// GET /api/paies/facture?chatteur_id=X&debut=YYYY-MM-DD&fin=YYYY-MM-DD — generate PDF invoice
router.get('/facture', authMiddleware, asyncHandler((req, res) => {
  const { chatteur_id, debut, fin } = req.query;
  if (!chatteur_id || !debut || !fin) {
    throw new ApiError(400, 'chatteur_id, debut et fin requis');
  }

  // Admins and managers can generate any invoice; chatteurs only their own
  if (req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.chatteur_id !== parseInt(chatteur_id)) {
    throw new ApiError(403, 'Accès refusé');
  }

  // Block facture if there are unvalidated ventes for this chatteur in this period
  const pendingVentes = db.prepare(`
    SELECT COUNT(*) as cnt FROM ventes
    WHERE chatteur_id = ? AND periode_debut >= ? AND periode_fin <= ? AND statut = 'en_attente'
  `).get(parseInt(chatteur_id), debut, fin);
  if (pendingVentes.cnt > 0) {
    throw new ApiError(400, `Impossible de générer la facture : ${pendingVentes.cnt} vente(s) en attente de validation`);
  }

  const { stream, filename } = generateFacture(parseInt(chatteur_id), debut, fin);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  stream.pipe(res);
}));

// GET /api/paies/previsionnel?debut=&fin= — forecast for current period using historical data
router.get('/previsionnel', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { debut, fin } = req.query;
  if (!debut || !fin) throw new ApiError(400, 'debut et fin requis');

  const now = new Date();
  const startDate = new Date(debut);
  const endDate = new Date(fin);
  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  const elapsedDays = Math.min(Math.ceil((now - startDate) / (1000 * 60 * 60 * 24)), totalDays);

  // Get actual totals for current period
  const actual = db.prepare(`
    SELECT
      COALESCE(SUM(ventes_brutes), 0) as total_brut,
      COALESCE(SUM(net_ht_eur), 0) as total_net_ht,
      COALESCE(SUM(commission_chatteur), 0) as total_commission,
      COALESCE(SUM(total_chatteur), 0) as total_paie
    FROM paies
    WHERE periode_debut = ? AND periode_fin = ?
  `).get(debut, fin);

  // Get historical periods (last 6 completed periods) for smart forecasting
  const historique = db.prepare(`
    SELECT periode_debut, periode_fin,
      COALESCE(SUM(ventes_brutes), 0) as total_brut,
      COALESCE(SUM(net_ht_eur), 0) as total_net_ht,
      COALESCE(SUM(commission_chatteur), 0) as total_commission,
      COALESCE(SUM(total_chatteur), 0) as total_paie
    FROM paies
    WHERE periode_debut < ? AND plateforme_id IS NOT NULL
    GROUP BY periode_debut, periode_fin
    ORDER BY periode_debut DESC
    LIMIT 6
  `).all(debut);

  // Calculate historical averages
  const nbPeriodes = historique.length;
  const moyennes = {
    total_brut: nbPeriodes > 0 ? historique.reduce((s, h) => s + h.total_brut, 0) / nbPeriodes : 0,
    total_net_ht: nbPeriodes > 0 ? historique.reduce((s, h) => s + h.total_net_ht, 0) / nbPeriodes : 0,
    total_commission: nbPeriodes > 0 ? historique.reduce((s, h) => s + h.total_commission, 0) / nbPeriodes : 0,
    total_paie: nbPeriodes > 0 ? historique.reduce((s, h) => s + h.total_paie, 0) / nbPeriodes : 0,
  };

  // Best period
  const meilleure = historique.length > 0
    ? historique.reduce((best, h) => h.total_net_ht > best.total_net_ht ? h : best, historique[0])
    : null;

  // Trend: compare avg of last 3 vs avg of first 3 (if 6+ periods)
  let tendance = 0;
  if (historique.length >= 4) {
    const recent = historique.slice(0, Math.floor(historique.length / 2));
    const ancien = historique.slice(Math.floor(historique.length / 2));
    const avgRecent = recent.reduce((s, h) => s + h.total_net_ht, 0) / recent.length;
    const avgAncien = ancien.reduce((s, h) => s + h.total_net_ht, 0) / ancien.length;
    if (avgAncien > 0) tendance = ((avgRecent - avgAncien) / avgAncien) * 100;
  }

  // Smart forecast: weighted blend of linear extrapolation + historical average
  // If period barely started (< 30%), rely more on historical. As period progresses, trust actuals more.
  const progressRatio = elapsedDays / Math.max(totalDays, 1);
  const linearRatio = totalDays / Math.max(elapsedDays, 1);

  const blend = (actualVal, linearVal, histVal) => {
    if (elapsedDays <= 0) return histVal; // Period not started → use history
    // Weight: at start → 70% history, at end → 90% linear
    const linearWeight = Math.min(0.3 + progressRatio * 0.6, 0.9);
    return linearVal * linearWeight + histVal * (1 - linearWeight);
  };

  const forecasts = {
    total_brut: blend(actual.total_brut, actual.total_brut * linearRatio, moyennes.total_brut),
    total_net_ht: blend(actual.total_net_ht, actual.total_net_ht * linearRatio, moyennes.total_net_ht),
    total_commission: blend(actual.total_commission, actual.total_commission * linearRatio, moyennes.total_commission),
    total_paie: blend(actual.total_paie, actual.total_paie * linearRatio, moyennes.total_paie),
  };

  res.json({
    elapsed_days: elapsedDays,
    total_days: totalDays,
    progress_ratio: progressRatio,
    actuals: actual,
    forecasts,
    historique: {
      nb_periodes: nbPeriodes,
      moyennes,
      meilleure_net_ht: meilleure?.total_net_ht || 0,
      tendance,
      periodes: historique.map(h => ({
        debut: h.periode_debut,
        fin: h.periode_fin,
        net_ht: h.total_net_ht,
      })),
    },
  });
}));

// GET /api/paies/export-csv?debut=&fin=
router.get('/export-csv', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { debut, fin } = req.query;
  if (!debut || !fin) throw new ApiError(400, 'debut et fin requis');
  const dateErr = validateDate(debut) || validateDate(fin);
  if (dateErr) throw new ApiError(400, dateErr);

  const { sendCSV } = require('../utils/csvExport');

  const paies = db.prepare(`
    SELECT c.prenom as chatteur, pl.nom as plateforme,
      p.ventes_brutes, p.taux_change, p.ventes_ttc_eur, p.ventes_ht_eur,
      p.net_ht_eur, p.commission_chatteur, p.malus_total, p.prime, p.total_chatteur, p.statut
    FROM paies p
    JOIN chatteurs c ON c.id = p.chatteur_id
    LEFT JOIN plateformes pl ON pl.id = p.plateforme_id
    WHERE p.periode_debut = ? AND p.periode_fin = ?
    ORDER BY c.prenom, pl.nom
  `).all(debut, fin);

  sendCSV(res, `paies_${debut}_${fin}.csv`, paies, [
    { key: 'chatteur', label: 'Chatteur' },
    { key: 'plateforme', label: 'Plateforme' },
    { key: 'ventes_brutes', label: 'Ventes brutes' },
    { key: 'taux_change', label: 'Taux change' },
    { key: 'ventes_ttc_eur', label: 'Ventes TTC €' },
    { key: 'ventes_ht_eur', label: 'Ventes HT €' },
    { key: 'net_ht_eur', label: 'Net HT €' },
    { key: 'commission_chatteur', label: 'Commission' },
    { key: 'malus_total', label: 'Malus' },
    { key: 'prime', label: 'Prime' },
    { key: 'total_chatteur', label: 'Total' },
    { key: 'statut', label: 'Statut' },
  ]);
}));

module.exports = router;
