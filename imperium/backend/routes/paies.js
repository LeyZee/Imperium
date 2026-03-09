const express = require('express');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/paies?periode_debut=&periode_fin=&chatteur_id=
router.get('/', authMiddleware, (req, res) => {
  const { periode_debut, periode_fin, chatteur_id } = req.query;

  let where = [];
  const params = [];

  if (req.user.role === 'chatteur') {
    where.push('p.chatteur_id = ?');
    params.push(req.user.chatteur_id);
  } else if (chatteur_id) {
    where.push('p.chatteur_id = ?');
    params.push(chatteur_id);
  }

  if (periode_debut) { where.push('p.periode_debut >= ?'); params.push(periode_debut); }
  if (periode_fin) { where.push('p.periode_fin <= ?'); params.push(periode_fin); }

  const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const paies = db.prepare(`
    SELECT p.*,
      c.nom as chatteur_nom, c.prenom as chatteur_prenom,
      c.taux_commission, c.pays, c.iban, c.email as chatteur_email
    FROM paies p
    JOIN chatteurs c ON c.id = p.chatteur_id
    ${whereStr}
    ORDER BY p.periode_debut DESC, c.nom
  `).all(...params);

  res.json(paies);
});

// POST /api/paies/calculer — calculate payroll for a period
router.post('/calculer', authMiddleware, adminOnly, (req, res) => {
  const { periode_debut, periode_fin } = req.body;
  if (!periode_debut || !periode_fin) {
    return res.status(400).json({ error: 'periode_debut et periode_fin requis' });
  }

  // Get exchange rate
  const tauxRow = db.prepare(
    'SELECT taux FROM taux_change WHERE devise_base = ? AND devise_cible = ? ORDER BY date_maj DESC LIMIT 1'
  ).get('USD', 'EUR');
  const tauxChange = tauxRow?.taux || 0.92;

  // Get all chatteurs with their sales in the period
  const chatteurs = db.prepare('SELECT * FROM chatteurs WHERE actif = 1').all();

  const results = [];
  let totalNetHTAgence = 0;
  const chatteurNetHT = {};

  // First pass: calculate net HT per chatteur
  for (const chatteur of chatteurs) {
    const ventes = db.prepare(`
      SELECT v.montant_brut, p.tva_rate, p.commission_rate
      FROM ventes v
      JOIN plateformes p ON p.id = v.plateforme_id
      WHERE v.chatteur_id = ? AND v.periode_debut >= ? AND v.periode_fin <= ?
    `).all(chatteur.id, periode_debut, periode_fin);

    if (ventes.length === 0) continue;

    let ventesBrutesUSD = 0;
    let ventesTTCEUR = 0;
    let ventesHTEUR = 0;
    let netHTEUR = 0;

    for (const vente of ventes) {
      const brut = vente.montant_brut;
      const ttc = brut * tauxChange;
      const ht = ttc / (1 + vente.tva_rate);
      const netHT = ht * (1 - vente.commission_rate);

      ventesBrutesUSD += brut;
      ventesTTCEUR += ttc;
      ventesHTEUR += ht;
      netHTEUR += netHT;
    }

    // Malus for period
    const malusRow = db.prepare(`
      SELECT COALESCE(SUM(montant), 0) as total
      FROM malus
      WHERE chatteur_id = ? AND periode >= ? AND periode <= ?
    `).get(chatteur.id, periode_debut, periode_fin);
    const malusTotal = malusRow.total;

    // Commission chatteur
    const tauxComm = chatteur.taux_commission;
    const commissionChatteur = netHTEUR * tauxComm;

    chatteurNetHT[chatteur.id] = netHTEUR;
    totalNetHTAgence += netHTEUR;

    results.push({
      chatteur_id: chatteur.id,
      chatteur_nom: chatteur.nom,
      chatteur_prenom: chatteur.prenom,
      ventes_brutes_usd: ventesBrutesUSD,
      taux_change: tauxChange,
      ventes_ttc_eur: ventesTTCEUR,
      ventes_ht_eur: ventesHTEUR,
      net_ht_eur: netHTEUR,
      commission_chatteur: commissionChatteur,
      malus_total: malusTotal,
      prime: 0 // filled in second pass
    });
  }

  // Second pass: determine top chatteur and assign prime
  // Prime = 0.5% of total agency Net HT → top chatteur
  const primeAgence = totalNetHTAgence * 0.005;
  let topChatteurId = null;
  let topNetHT = 0;
  for (const r of results) {
    if (r.net_ht_eur > topNetHT) {
      topNetHT = r.net_ht_eur;
      topChatteurId = r.chatteur_id;
    }
  }

  // Save to DB (upsert)
  const upsert = db.prepare(`
    INSERT INTO paies (
      chatteur_id, periode_debut, periode_fin,
      ventes_brutes_usd, taux_change,
      ventes_ttc_eur, ventes_ht_eur, net_ht_eur,
      commission_chatteur, malus_total, prime, total_chatteur, statut
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'calculé')
    ON CONFLICT(chatteur_id, periode_debut, periode_fin) DO UPDATE SET
      ventes_brutes_usd = excluded.ventes_brutes_usd,
      taux_change = excluded.taux_change,
      ventes_ttc_eur = excluded.ventes_ttc_eur,
      ventes_ht_eur = excluded.ventes_ht_eur,
      net_ht_eur = excluded.net_ht_eur,
      commission_chatteur = excluded.commission_chatteur,
      malus_total = excluded.malus_total,
      prime = excluded.prime,
      total_chatteur = excluded.total_chatteur,
      statut = 'calculé'
  `);

  const saveAll = db.transaction(() => {
    for (const r of results) {
      const prime = r.chatteur_id === topChatteurId ? primeAgence : 0;
      r.prime = prime;
      r.total_chatteur = r.commission_chatteur + prime - r.malus_total;

      upsert.run(
        r.chatteur_id, periode_debut, periode_fin,
        r.ventes_brutes_usd, r.taux_change,
        r.ventes_ttc_eur, r.ventes_ht_eur, r.net_ht_eur,
        r.commission_chatteur, r.malus_total, r.prime, r.total_chatteur
      );
    }
  });

  saveAll();

  res.json({
    periode_debut,
    periode_fin,
    taux_change: tauxChange,
    total_net_ht_agence: totalNetHTAgence,
    prime_agence: primeAgence,
    top_chatteur_id: topChatteurId,
    nb_chatteurs: results.length,
    paies: results
  });
});

// PUT /api/paies/:id/statut
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
