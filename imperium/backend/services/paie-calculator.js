const db = require('../database');
const { getExchangeRate } = require('../utils/rateCache');

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
 *
 * @param {string} periode_debut - Start date (YYYY-MM-DD)
 * @param {string} periode_fin - End date (YYYY-MM-DD)
 * @returns {{ periode_debut: string, periode_fin: string, taux_change: number, total_net_ht_equipe: number, nb_paies: number, top3: Array }}
 */
function recalculatePaies(periode_debut, periode_fin) {
  // Wrap entire calculation + save in a single transaction for atomicity
  const doRecalculate = db.transaction(() => {
    // Get exchange rate USD→EUR
    const tauxChange = getExchangeRate();

    // Get all active chatteurs (managers included — they can sell too)
    const chatteurs = db.prepare('SELECT * FROM chatteurs WHERE actif = 1').all();
    const allSellers = chatteurs.filter(c => c.role !== 'va'); // chatteurs + managers + directeurs
    const managers = chatteurs.filter(c => c.role === 'manager' || c.role === 'directeur');
    const managerIds = new Set(managers.map(m => m.id));

    // Batch fetch: all ventes grouped by chatteur + plateforme (1 query instead of N)
    const allVentes = db.prepare(`
      SELECT
        v.chatteur_id,
        v.plateforme_id,
        p.nom as plateforme_nom,
        p.tva_rate,
        p.commission_rate,
        p.devise,
        SUM(v.montant_brut) as total_brut,
        COUNT(*) as nb_ventes
      FROM ventes v
      JOIN plateformes p ON p.id = v.plateforme_id
      WHERE v.periode_debut >= ? AND v.periode_fin <= ?
      GROUP BY v.chatteur_id, v.plateforme_id
    `).all(periode_debut, periode_fin);

    // Batch fetch: all malus (montant fixe + pourcentage) grouped by chatteur
    const allMalusFixe = db.prepare(`
      SELECT chatteur_id, COALESCE(SUM(montant), 0) as total
      FROM malus
      WHERE COALESCE(periode_fin, periode) >= ? AND periode <= ? AND actif != 0 AND type_malus = 'montant'
      GROUP BY chatteur_id
    `).all(periode_debut, periode_fin);
    const malusFixeByChatteur = {};
    for (const m of allMalusFixe) malusFixeByChatteur[m.chatteur_id] = m.total;

    const allMalusPct = db.prepare(`
      SELECT chatteur_id, COALESCE(SUM(montant), 0) as total_pct
      FROM malus
      WHERE COALESCE(periode_fin, periode) >= ? AND periode <= ? AND actif != 0 AND type_malus = 'pourcentage'
      GROUP BY chatteur_id
    `).all(periode_debut, periode_fin);
    const malusPctByChatteur = {};
    for (const m of allMalusPct) malusPctByChatteur[m.chatteur_id] = m.total_pct;

    // Batch fetch: all primes manuelles grouped by chatteur (1 query instead of N)
    const allPrimesManuelles = db.prepare(`
      SELECT chatteur_id, COALESCE(SUM(montant), 0) as total
      FROM primes_manuelles
      WHERE actif = 1 AND periode_debut >= ? AND periode_fin <= ?
      GROUP BY chatteur_id
    `).all(periode_debut, periode_fin);
    const primesManuByChatteur = {};
    for (const pm of allPrimesManuelles) primesManuByChatteur[pm.chatteur_id] = pm.total;

    // Group ventes by chatteur_id
    const ventesByChatteur = {};
    for (const v of allVentes) {
      if (!ventesByChatteur[v.chatteur_id]) ventesByChatteur[v.chatteur_id] = [];
      ventesByChatteur[v.chatteur_id].push(v);
    }

    const paieRows = [];

    for (const chatteur of allSellers) {
      const ventesParPlateforme = ventesByChatteur[chatteur.id] || [];

      if (ventesParPlateforme.length === 0) continue;

      const malusFixe = malusFixeByChatteur[chatteur.id] || 0;
      const malusPct = malusPctByChatteur[chatteur.id] || 0;

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

      // Malus = fixe + pourcentage du net HT total du chatteur
      const malusTotalChatteur = malusFixe + (malusPct / 100) * chatteurTotalNetHT;

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

    // Sort chatteurs by net_ht DESC, take top 3 (exclude managers from primes)
    const ranked = Object.entries(chatteurNetHT)
      .map(([id, netHT]) => ({ id: parseInt(id), netHT }))
      .filter(r => !managerIds.has(r.id))
      .sort((a, b) => b.netHT - a.netHT);

    const primeRates = [0.005, 0.0025, 0.0012]; // 0.5%, 0.25%, 0.12%
    const primeById = {};
    for (let i = 0; i < Math.min(3, ranked.length); i++) {
      primeById[ranked[i].id] = totalNetHTEquipe * primeRates[i];
    }

    // Distribute prime (cagnotte + manuelles) across platforms proportionally
    for (const row of paieRows) {
      const chatteurPrimeCagnotte = primeById[row.chatteur_id] || 0;
      const chatteurPrimeManuelle = primesManuByChatteur[row.chatteur_id] || 0;
      const chatteurPrimeTotal = chatteurPrimeCagnotte + chatteurPrimeManuelle;
      if (chatteurPrimeTotal > 0) {
        const chatteurTotal = chatteurNetHT[row.chatteur_id] || 1;
        row.prime = chatteurPrimeTotal * (row.net_ht_eur / chatteurTotal);
      }
      row.total_chatteur = row.commission_chatteur + row.prime - row.malus_total;
    }

    // Save to DB
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

    // Delete old paie rows for this period that no longer have ventes
    // (but keep 'payé' rows intact)
    const existingIds = new Set(paieRows.map(r => `${r.chatteur_id}-${r.plateforme_id}`));
    const oldRows = db.prepare(`
      SELECT id, chatteur_id, plateforme_id FROM paies
      WHERE periode_debut = ? AND periode_fin = ? AND statut != 'payé'
        AND plateforme_id IS NOT NULL
    `).all(periode_debut, periode_fin);

    for (const old of oldRows) {
      const key = `${old.chatteur_id}-${old.plateforme_id}`;
      if (!existingIds.has(key)) {
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
    // SQLite treats NULL != NULL in UNIQUE constraints, so ON CONFLICT won't match.
    // Instead: update paid rows in-place, delete+reinsert non-paid rows.
    for (const mgr of managers) {
      const mgrTotal = totalNetHTEquipe * mgr.taux_net_equipe;
      const existing = db.prepare(`
        SELECT id, statut FROM paies
        WHERE chatteur_id = ? AND plateforme_id IS NULL
          AND periode_debut = ? AND periode_fin = ?
      `).all(mgr.id, periode_debut, periode_fin);

      if (mgrTotal > 0) {
        if (existing.length > 0) {
          const target = existing[0];
          db.prepare(`
            UPDATE paies SET
              taux_change = ?, total_chatteur = ?,
              statut = CASE WHEN statut = 'payé' THEN 'payé' ELSE 'calculé' END
            WHERE id = ?
          `).run(tauxChange, mgrTotal, target.id);
          for (let i = 1; i < existing.length; i++) {
            if (existing[i].statut !== 'payé') {
              db.prepare('DELETE FROM paies WHERE id = ?').run(existing[i].id);
            }
          }
        } else {
          db.prepare(`
            INSERT INTO paies (
              chatteur_id, plateforme_id, periode_debut, periode_fin,
              ventes_brutes, taux_change,
              ventes_ttc_eur, ventes_ht_eur, net_ht_eur,
              commission_chatteur, malus_total, prime, total_chatteur, statut
            ) VALUES (?, NULL, ?, ?, 0, ?, 0, 0, 0, 0, 0, 0, ?, 'calculé')
          `).run(mgr.id, periode_debut, periode_fin, tauxChange, mgrTotal);
        }
      } else {
        for (const row of existing) {
          if (row.statut !== 'payé') {
            db.prepare('DELETE FROM paies WHERE id = ?').run(row.id);
          }
        }
      }
    }

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
  });

  return doRecalculate();
}

module.exports = { recalculatePaies };
