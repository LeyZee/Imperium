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
const { notifyPaieSummary } = require('../utils/telegramSender');
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

  // Auto-recalculate: if there are validated ventes but no paies yet, trigger recalculation
  const paieCount = db.prepare('SELECT COUNT(*) as cnt FROM paies WHERE periode_debut = ? AND periode_fin = ?').get(debut, fin);
  if (paieCount.cnt === 0) {
    const venteCount = db.prepare("SELECT COUNT(*) as cnt FROM ventes WHERE periode_debut = ? AND periode_fin = ? AND statut = 'validée'").get(debut, fin);
    if (venteCount.cnt > 0) {
      try {
        recalculatePaies(debut, fin);
        logger.info('Auto-recalcul des paies déclenché', { debut, fin, nb_ventes: venteCount.cnt });
      } catch (err) {
        logger.error('Auto-recalcul des paies échoué', { debut, fin, error: err.message });
      }
    }
  }

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
    WHERE v.periode_debut = ? AND v.periode_fin = ? AND v.statut = 'en_attente'
  `).get(tauxChange, debut, fin);

  // Fetch palier thresholds (global, not period-specific)
  const paliersRow = db.prepare(
    'SELECT * FROM paliers_primes WHERE actif = 1 ORDER BY seuil_net_ht DESC'
  ).all();

  res.json({
    paies: normalPaies,
    managers: managerPaies,
    directeurs: directeurPaies,
    paliers_primes: paliersRow,
    resume: {
      total_net_ht_equipe: totalNetHTEquipe,
      total_paye_equipe: totalPayeEquipe,
      total_primes: Object.values(chatteurAgg).reduce((s, c) => s + c.prime, 0),
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

  // Notify chatteur when paie is validated or paid (in-app + Telegram DM)
  if (paie && (statut === 'validé' || statut === 'payé')) {
    const label = statut === 'validé' ? 'validée' : 'payée';
    notifyChatteur(paie.chatteur_id, 'paie_statut', `Paie ${label}`, `Votre paie a été ${label}.`, '/chatteur/factures');

    // Send Telegram DM with paie summary
    try {
      const paieDetail = db.prepare(`
        SELECT p.*, pl.nom as plateforme_nom
        FROM paies p LEFT JOIN plateformes pl ON pl.id = p.plateforme_id
        WHERE p.id = ?
      `).get(req.params.id);
      if (paieDetail) {
        // Aggregate all paies for this chatteur+period for full summary
        const allPaies = db.prepare(`
          SELECT SUM(commission_chatteur) as total_commission, SUM(prime) as total_prime,
            SUM(malus_total) as total_malus, SUM(total_chatteur) as grand_total
          FROM paies WHERE chatteur_id = ? AND periode_debut = ? AND periode_fin = ?
        `).get(paieDetail.chatteur_id, paieDetail.periode_debut, paieDetail.periode_fin);

        if (allPaies) {
          const rc = n => Math.round((n || 0) * 100) / 100;
          notifyPaieSummary(
            paieDetail.chatteur_id,
            paieDetail.periode_debut,
            paieDetail.periode_fin,
            rc(allPaies.total_commission),
            rc(allPaies.total_prime),
            rc(allPaies.total_malus),
            rc(allPaies.grand_total),
            label
          ).catch(() => {});
        }
      }
    } catch (err) {
      logger.warn('Telegram paie notification failed', { error: err.message });
    }
  }

  res.json({ message: 'Statut mis à jour' });
}));

// GET /api/paies/mes-paies — chatteur: get own paies with full calculation details + estimates
router.get('/mes-paies', authMiddleware, asyncHandler((req, res) => {
  if (req.user.role !== 'chatteur' || !req.user.chatteur_id) {
    throw new ApiError(403, 'Accès réservé aux chatteurs');
  }

  const chatteurId = req.user.chatteur_id;
  const chatteur = db.prepare('SELECT taux_commission, role, taux_net_equipe FROM chatteurs WHERE id = ?')
    .get(chatteurId);
  const tauxCommission = chatteur?.taux_commission || 0;

  const paies = db.prepare(`
    SELECT p.*,
      pl.nom as plateforme_nom, pl.devise, pl.tva_rate, pl.commission_rate,
      pl.couleur_fond, pl.couleur_texte
    FROM paies p
    LEFT JOIN plateformes pl ON pl.id = p.plateforme_id
    WHERE p.chatteur_id = ?
    ORDER BY p.periode_debut DESC
    LIMIT 50
  `).all(chatteurId);

  // Build set of periods that already have real paies
  const existingPeriods = new Set(paies.map(p => `${p.periode_debut}|${p.periode_fin}`));

  // Find periods with ventes but no paies → compute estimates
  const ventePeriods = db.prepare(`
    SELECT v.periode_debut, v.periode_fin, v.plateforme_id,
      SUM(v.montant_brut) as total_brut,
      COUNT(*) as nb_ventes,
      pl.nom as plateforme_nom, pl.devise, pl.tva_rate, pl.commission_rate,
      pl.couleur_fond, pl.couleur_texte
    FROM ventes v
    JOIN plateformes pl ON pl.id = v.plateforme_id
    WHERE v.chatteur_id = ? AND v.statut != 'rejetée'
    GROUP BY v.periode_debut, v.periode_fin, v.plateforme_id
    ORDER BY v.periode_debut DESC
  `).all(chatteurId);

  const tauxChange = getExchangeRate();
  const rc = (n) => Math.round((n || 0) * 100) / 100;

  // Group ventePeriods by period key for multi-platform estimation
  const periodGroups = {};
  for (const vp of ventePeriods) {
    const key = `${vp.periode_debut}|${vp.periode_fin}`;
    if (existingPeriods.has(key)) continue;
    if (!periodGroups[key]) periodGroups[key] = { debut: vp.periode_debut, fin: vp.periode_fin, rows: [] };
    periodGroups[key].rows.push(vp);
  }

  const estimates = [];

  for (const pg of Object.values(periodGroups)) {
    // Step 1: compute base per-platform rows + total net HT
    let chatteurTotalNetHT = 0;
    const platformRows = [];

    for (const vp of pg.rows) {
      const brut = vp.total_brut;
      const ttc = vp.devise === 'USD' ? brut * tauxChange : brut;
      const ht = ttc / (1 + (vp.tva_rate || 0));
      const netHT = ht * (1 - (vp.commission_rate || 0));
      const commission = netHT * tauxCommission;
      chatteurTotalNetHT += netHT;

      platformRows.push({
        id: null,
        chatteur_id: chatteurId,
        plateforme_id: vp.plateforme_id,
        periode_debut: pg.debut,
        periode_fin: pg.fin,
        ventes_brutes: rc(brut),
        nb_ventes: vp.nb_ventes,
        taux_change: tauxChange,
        ventes_ttc_eur: rc(ttc),
        ventes_ht_eur: rc(ht),
        net_ht_eur: rc(netHT),
        commission_chatteur: rc(commission),
        malus_total: 0,
        prime: 0,
        total_chatteur: 0,
        statut: 'estimé',
        plateforme_nom: vp.plateforme_nom,
        devise: vp.devise,
        tva_rate: vp.tva_rate,
        commission_rate: vp.commission_rate,
        couleur_fond: vp.couleur_fond,
        couleur_texte: vp.couleur_texte,
      });
    }

    // Step 2: Malus (fixe + pourcentage)
    const malusFixeRow = db.prepare(`
      SELECT COALESCE(SUM(montant), 0) as total
      FROM malus WHERE chatteur_id = ? AND periode <= ? AND COALESCE(periode_fin, periode) >= ?
        AND actif != 0 AND type_malus = 'montant'
    `).get(chatteurId, pg.fin, pg.debut);
    const malusPctRow = db.prepare(`
      SELECT COALESCE(SUM(montant), 0) as total_pct
      FROM malus WHERE chatteur_id = ? AND periode <= ? AND COALESCE(periode_fin, periode) >= ?
        AND actif != 0 AND type_malus = 'pourcentage'
    `).get(chatteurId, pg.fin, pg.debut);
    let malusTotal = rc((malusFixeRow?.total || 0) + ((malusPctRow?.total_pct || 0) / 100) * chatteurTotalNetHT);
    // Cap malus at total net HT
    if (malusTotal > chatteurTotalNetHT) malusTotal = rc(chatteurTotalNetHT);

    // Step 3: Primes (palier individuel + manuelles + collectif)
    const palier = db.prepare(
      'SELECT bonus FROM paliers_primes WHERE actif = 1 AND seuil_net_ht <= ? ORDER BY seuil_net_ht DESC LIMIT 1'
    ).get(chatteurTotalNetHT);
    const primeManuelle = db.prepare(
      'SELECT COALESCE(SUM(montant), 0) as total FROM primes_manuelles WHERE chatteur_id = ? AND actif = 1 AND periode_debut >= ? AND periode_fin <= ?'
    ).get(chatteurId, pg.debut, pg.fin);

    // Collectif: need total net_ht of ALL chatteurs for this period
    let collectifBonus = 0;
    const objCollectif = db.prepare(
      'SELECT * FROM objectifs_collectifs WHERE periode_debut = ? AND periode_fin = ? AND actif = 1'
    ).get(pg.debut, pg.fin);
    if (objCollectif && objCollectif.montant_cible > 0) {
      // Sum all non-rejected ventes for ALL chatteurs in this period
      const equipeNetHT = db.prepare(`
        SELECT COALESCE(SUM(
          CASE WHEN pl.devise = 'USD' THEN v.montant_brut * ? ELSE v.montant_brut END
          / (1 + pl.tva_rate) * (1 - pl.commission_rate)
        ), 0) as total
        FROM ventes v JOIN plateformes pl ON pl.id = v.plateforme_id
        WHERE v.statut != 'rejetée' AND v.periode_debut = ? AND v.periode_fin = ?
      `).get(tauxChange, pg.debut, pg.fin);
      const progressPct = ((equipeNetHT?.total || 0) / objCollectif.montant_cible) * 100;
      const palierCol = db.prepare(
        'SELECT bonus_par_chatteur FROM paliers_collectifs WHERE objectif_collectif_id = ? AND seuil_pct <= ? ORDER BY seuil_pct DESC LIMIT 1'
      ).get(objCollectif.id, progressPct);
      if (palierCol) collectifBonus = palierCol.bonus_par_chatteur;
    }

    const primeTotal = (palier?.bonus || 0) + (primeManuelle?.total || 0) + collectifBonus;

    // Step 4: Distribute prime & malus across platforms proportionally
    for (const row of platformRows) {
      const ratio = chatteurTotalNetHT > 0 ? row.net_ht_eur / chatteurTotalNetHT : 0;
      row.prime = rc(primeTotal * ratio);
      row.malus_total = rc(malusTotal * ratio);
      row.total_chatteur = rc(row.commission_chatteur + row.prime - row.malus_total);
    }

    estimates.push(...platformRows);
  }

  // Merge real paies + estimates, sorted by periode_debut DESC
  const allPaies = [...paies, ...estimates].sort((a, b) => b.periode_debut.localeCompare(a.periode_debut));

  res.json({
    paies: allPaies,
    taux_commission: tauxCommission,
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
