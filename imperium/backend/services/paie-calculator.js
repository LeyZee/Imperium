const db = require('../database');

/**
 * Recalculate all paies for a given period.
 * Called automatically after vente POST/PUT/DELETE and manually via admin endpoint.
 *
 * Flow per chatteur per platform:
 *   Brut → TTC (×tauxChange if USD) → HT (÷(1+TVA)) → Net HT (×(1-commission_plateforme))
 *   Commission chatteur = Net HT × taux_commission
 *   Top 3 primes: 0.5%, 0.25%, 0.12% of total_net_ht_equipe
 *   Manager: taux_net_equipe × total_net_ht_equipe
 *   Total = commission + prime - malus
 */
function recalculatePaies(periode_debut, periode_fin) {
  // Get exchange rate USD→EUR
  const tauxRow = db.prepare(
    'SELECT taux FROM taux_change WHERE devise_base = ? AND devise_cible = ? ORDER BY date_maj DESC LIMIT 1'
  ).get('USD', 'EUR');
  const tauxChange = tauxRow?.taux || 0.92;

  // Get all active chatteurs (non-managers)
  const chatteurs = db.prepare('SELECT * FROM chatteurs WHERE actif = 1').all();
  const normalChatteurs = chatteurs.filter(c => c.role !== 'manager' && c.role !== 'va');
  const managers = chatteurs.filter(c => c.role === 'manager');

  // For each normal chatteur, get ventes grouped by plateforme
  const paieRows = [];

  for (const chatteur of normalChatteurs) {
    const ventesParPlateforme = db.prepare(`
      SELECT
        v.plateforme_id,
        p.nom as plateforme_nom,
        p.tva_rate,
        p.commission_rate,
        p.devise,
        SUM(v.montant_brut) as total_brut,
        COUNT(*) as nb_ventes
      FROM ventes v
      JOIN plateformes p ON p.id = v.plateforme_id
      WHERE v.chatteur_id = ?
        AND v.periode_debut >= ? AND v.periode_fin <= ?
      GROUP BY v.plateforme_id
    `).all(chatteur.id, periode_debut, periode_fin);

    if (ventesParPlateforme.length === 0) continue;

    // Malus total for this chatteur in this period
    const malusRow = db.prepare(`
      SELECT COALESCE(SUM(montant), 0) as total
      FROM malus
      WHERE chatteur_id = ? AND periode >= ? AND periode <= ?
    `).get(chatteur.id, periode_debut, periode_fin);
    const malusTotalChatteur = malusRow.total;

    // Calculate per-platform
    let chatteurTotalNetHT = 0;
    const platformRows = [];

    for (const vp of ventesParPlateforme) {
      const brut = vp.total_brut;
      const isUSD = vp.devise === 'USD';
      const ttc = isUSD ? brut * tauxChange : brut;
      const ht = ttc / (1 + vp.tva_rate);
      const netHT = ht * (1 - vp.commission_rate);
      const commission = netHT * chatteur.taux_commission;

      chatteurTotalNetHT += netHT;

      platformRows.push({
        chatteur_id: chatteur.id,
        plateforme_id: vp.plateforme_id,
        ventes_brutes: brut,
        taux_change: isUSD ? tauxChange : 1,
        ventes_ttc_eur: ttc,
        ventes_ht_eur: ht,
        net_ht_eur: netHT,
        commission_chatteur: commission,
        malus_total: 0, // distributed below
        prime: 0,       // filled in second pass
        total_chatteur: 0,
      });
    }

    // Distribute malus across platforms proportionally to net_ht
    if (malusTotalChatteur > 0 && chatteurTotalNetHT > 0) {
      for (const row of platformRows) {
        row.malus_total = malusTotalChatteur * (row.net_ht_eur / chatteurTotalNetHT);
      }
    }

    paieRows.push(...platformRows);
  }

  // Calculate total_net_ht_equipe (sum of all net_ht across all chatteurs/platforms)
  const totalNetHTEquipe = paieRows.reduce((sum, r) => sum + r.net_ht_eur, 0);

  // Aggregate net_ht per chatteur for top 3 ranking
  const chatteurNetHT = {};
  for (const row of paieRows) {
    chatteurNetHT[row.chatteur_id] = (chatteurNetHT[row.chatteur_id] || 0) + row.net_ht_eur;
  }

  // Sort chatteurs by net_ht DESC, take top 3
  const ranked = Object.entries(chatteurNetHT)
    .map(([id, netHT]) => ({ id: parseInt(id), netHT }))
    .sort((a, b) => b.netHT - a.netHT);

  const primeRates = [0.005, 0.0025, 0.0012]; // 0.5%, 0.25%, 0.12%
  const primeById = {};
  for (let i = 0; i < Math.min(3, ranked.length); i++) {
    primeById[ranked[i].id] = totalNetHTEquipe * primeRates[i];
  }

  // Distribute prime across platforms proportionally
  for (const row of paieRows) {
    const chatteurPrime = primeById[row.chatteur_id] || 0;
    if (chatteurPrime > 0) {
      const chatteurTotal = chatteurNetHT[row.chatteur_id] || 1;
      row.prime = chatteurPrime * (row.net_ht_eur / chatteurTotal);
    }
    row.total_chatteur = row.commission_chatteur + row.prime - row.malus_total;
  }

  // Save to DB in transaction
  const upsert = db.prepare(`
    INSERT INTO paies (
      chatteur_id, plateforme_id, periode_debut, periode_fin,
      ventes_brutes, taux_change,
      ventes_ttc_eur, ventes_ht_eur, net_ht_eur,
      commission_chatteur, malus_total, prime, total_chatteur, statut
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'calculé')
    ON CONFLICT(chatteur_id, plateforme_id, periode_debut, periode_fin) DO UPDATE SET
      ventes_brutes = excluded.ventes_brutes,
      taux_change = excluded.taux_change,
      ventes_ttc_eur = excluded.ventes_ttc_eur,
      ventes_ht_eur = excluded.ventes_ht_eur,
      net_ht_eur = excluded.net_ht_eur,
      commission_chatteur = excluded.commission_chatteur,
      malus_total = excluded.malus_total,
      prime = excluded.prime,
      total_chatteur = excluded.total_chatteur,
      statut = CASE WHEN paies.statut = 'payé' THEN 'payé' ELSE 'calculé' END
  `);

  const saveAll = db.transaction(() => {
    // Delete old paie rows for this period that no longer have ventes
    // (but keep 'payé' rows intact)
    const existingIds = paieRows.map(r => `${r.chatteur_id}-${r.plateforme_id}`);
    const oldRows = db.prepare(`
      SELECT id, chatteur_id, plateforme_id FROM paies
      WHERE periode_debut = ? AND periode_fin = ? AND statut != 'payé'
    `).all(periode_debut, periode_fin);

    for (const old of oldRows) {
      const key = `${old.chatteur_id}-${old.plateforme_id}`;
      if (!existingIds.includes(key)) {
        db.prepare('DELETE FROM paies WHERE id = ?').run(old.id);
      }
    }

    // Upsert all current rows
    for (const r of paieRows) {
      upsert.run(
        r.chatteur_id, r.plateforme_id, periode_debut, periode_fin,
        r.ventes_brutes, r.taux_change,
        r.ventes_ttc_eur, r.ventes_ht_eur, r.net_ht_eur,
        r.commission_chatteur, r.malus_total, r.prime, r.total_chatteur
      );
    }

    // Handle manager rows (plateforme_id = NULL)
    for (const mgr of managers) {
      const mgrTotal = totalNetHTEquipe * mgr.taux_net_equipe;
      if (mgrTotal > 0) {
        db.prepare(`
          INSERT INTO paies (
            chatteur_id, plateforme_id, periode_debut, periode_fin,
            ventes_brutes, taux_change,
            ventes_ttc_eur, ventes_ht_eur, net_ht_eur,
            commission_chatteur, malus_total, prime, total_chatteur, statut
          ) VALUES (?, NULL, ?, ?, 0, ?, 0, 0, 0, 0, 0, 0, ?, 'calculé')
          ON CONFLICT(chatteur_id, plateforme_id, periode_debut, periode_fin) DO UPDATE SET
            taux_change = excluded.taux_change,
            total_chatteur = excluded.total_chatteur,
            statut = CASE WHEN paies.statut = 'payé' THEN 'payé' ELSE 'calculé' END
        `).run(mgr.id, periode_debut, periode_fin, tauxChange, mgrTotal);
      }
    }
  });

  saveAll();

  return {
    periode_debut,
    periode_fin,
    taux_change: tauxChange,
    total_net_ht_equipe: totalNetHTEquipe,
    nb_paies: paieRows.length,
    top3: ranked.slice(0, 3).map((r, i) => ({
      chatteur_id: r.id,
      net_ht: r.netHT,
      prime: primeById[r.id] || 0,
      rang: i + 1,
    })),
  };
}

module.exports = { recalculatePaies };
