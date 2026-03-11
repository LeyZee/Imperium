const express = require('express');
const archiver = require('archiver');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { recalculatePaies } = require('../services/paie-calculator');
const { generateFacture } = require('../services/facture-generator');

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
      c.prenom as chatteur_prenom, c.couleur as chatteur_couleur,
      c.taux_commission, c.role, c.taux_net_equipe,
      pl.nom as plateforme_nom, pl.devise, pl.couleur_fond, pl.couleur_texte
    FROM paies p
    JOIN chatteurs c ON c.id = p.chatteur_id
    LEFT JOIN plateformes pl ON pl.id = p.plateforme_id
    WHERE p.periode_debut = ? AND p.periode_fin = ?
    ORDER BY (c.role = 'manager') ASC, p.net_ht_eur DESC, c.prenom
  `).all(debut, fin);

  // Split into normal chatteurs and managers
  const normalPaies = paies.filter(p => p.role !== 'manager');
  const managerPaies = paies.filter(p => p.role === 'manager');

  // Taux change
  const tauxRow = db.prepare(
    'SELECT taux FROM taux_change WHERE devise_base = ? AND devise_cible = ? ORDER BY date_maj DESC LIMIT 1'
  ).get('USD', 'EUR');
  const tauxChange = tauxRow?.taux || 0.92;

  // Calculate résumé
  const totalNetHTEquipe = normalPaies.reduce((s, p) => s + p.net_ht_eur, 0);
  const totalPayeEquipe = paies.reduce((s, p) => s + p.total_chatteur, 0);

  // Trésorerie agence = part agence du CA - ce qu'on paye aux chatteurs/managers
  // On calcule le revenu agence depuis les ventes (net_ht × part_percent par modèle)
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
    WHERE v.periode_debut = ? AND v.periode_fin = ?
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

  res.json({
    paies: normalPaies,
    managers: managerPaies,
    resume: {
      total_net_ht_equipe: totalNetHTEquipe,
      total_paye_equipe: totalPayeEquipe,
      part_agence_brut: agencyGross,
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

// GET /api/paies/mes-paies — chatteur: get own paies with full calculation details
router.get('/mes-paies', authMiddleware, (req, res) => {
  if (req.user.role !== 'chatteur' || !req.user.chatteur_id) {
    return res.status(403).json({ error: 'Accès réservé aux chatteurs' });
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

// GET /api/paies/factures-zip?debut=YYYY-MM-DD&fin=YYYY-MM-DD — ZIP of all invoices for a period
router.get('/factures-zip', authMiddleware, adminOnly, (req, res) => {
  const { debut, fin } = req.query;
  if (!debut || !fin) {
    return res.status(400).json({ error: 'debut et fin requis' });
  }

  // Find all unique chatteurs with paies for this period
  const rows = db.prepare(`
    SELECT DISTINCT p.chatteur_id, c.prenom
    FROM paies p JOIN chatteurs c ON c.id = p.chatteur_id
    WHERE p.periode_debut = ? AND p.periode_fin = ?
    ORDER BY c.prenom
  `).all(debut, fin);

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Aucune paie pour cette période' });
  }

  // Setup ZIP stream
  const zipFilename = `IMPERA_Factures_${debut}_${fin}.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    console.error('Erreur ZIP:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur génération ZIP' });
  });
  archive.pipe(res);

  // Generate each PDF and append to ZIP
  for (const row of rows) {
    try {
      const { stream, filename } = generateFacture(row.chatteur_id, debut, fin);
      archive.append(stream, { name: filename });
    } catch (err) {
      console.error(`Erreur facture ${row.prenom}:`, err.message);
    }
  }

  archive.finalize();
});

// GET /api/paies/facture?chatteur_id=X&debut=YYYY-MM-DD&fin=YYYY-MM-DD — generate PDF invoice
router.get('/facture', authMiddleware, (req, res) => {
  const { chatteur_id, debut, fin } = req.query;
  if (!chatteur_id || !debut || !fin) {
    return res.status(400).json({ error: 'chatteur_id, debut et fin requis' });
  }

  // Admins can generate any invoice; chatteurs only their own
  if (req.user.role !== 'admin' && req.user.chatteur_id !== parseInt(chatteur_id)) {
    return res.status(403).json({ error: 'Acc\u00e8s refus\u00e9' });
  }

  try {
    const { stream, filename } = generateFacture(parseInt(chatteur_id), debut, fin);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    stream.pipe(res);
  } catch (err) {
    console.error('Erreur g\u00e9n\u00e9ration facture:', err.message);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
