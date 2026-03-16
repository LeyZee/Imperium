const express = require('express');
const db = require('../database');
const { authMiddleware, adminOnly, adminOrManager } = require('../middleware/auth');
const { recalculatePaies: _recalculatePaies } = require('../services/paie-calculator');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { getExchangeRate } = require('../utils/rateCache');
const { validateDate } = require('../utils/validation');
const { notifyAdminsAndManagers, notifyChatteur } = require('../utils/notifier');
const { logActivity } = require('../utils/activityLogger');
const { snapshotPaliers, checkPalierChanges } = require('../services/palier-notifier');

/**
 * Wrapper around recalculatePaies that also checks for palier changes
 * and sends notifications (async, fire-and-forget).
 */
function recalculatePaies(debut, fin) {
  const snap = snapshotPaliers(debut, fin);
  const result = _recalculatePaies(debut, fin);
  // Async check — fire-and-forget, never blocks
  checkPalierChanges(snap, debut, fin).catch(() => {});
  return result;
}

const router = express.Router();

/* ─── Helper: check if a period is locked (validé or payé) for a chatteur ─── */
function isPeriodeLocked(chatteur_id, periode_debut, periode_fin) {
  const paie = db.prepare(`
    SELECT statut FROM paies
    WHERE chatteur_id = ? AND periode_debut = ? AND periode_fin = ?
    AND statut IN ('validé', 'payé')
  `).get(chatteur_id, periode_debut, periode_fin);
  return !!paie;
}

/* ─── Helper: compute period from a date string ─── */
function computePeriode(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDate();
  const year = d.getFullYear();
  const month = d.getMonth();
  if (day < 15) {
    return {
      debut: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      fin: `${year}-${String(month + 1).padStart(2, '0')}-15`,
    };
  }
  const next = new Date(year, month + 1, 1);
  return {
    debut: `${year}-${String(month + 1).padStart(2, '0')}-15`,
    fin: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`,
  };
}

// GET /api/ventes?periode_debut=&periode_fin=&chatteur_id=&page=&limit=
router.get('/', authMiddleware, asyncHandler((req, res) => {
  const { periode_debut, periode_fin, chatteur_id, page } = req.query;

  let where = [];
  const params = [];

  // Chatteur can only see their own — ignore chatteur_id param
  if (req.user.role === 'chatteur') {
    where.push('v.chatteur_id = ?');
    params.push(req.user.chatteur_id);
  } else if (chatteur_id && (req.user.role === 'admin' || req.user.role === 'manager')) {
    where.push('v.chatteur_id = ?');
    params.push(chatteur_id);
  }

  if (periode_debut) {
    where.push('v.periode_debut >= ?');
    params.push(periode_debut);
  }
  if (periode_fin) {
    where.push('v.periode_fin <= ?');
    params.push(periode_fin);
  }

  const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

  // Support optional pagination (backward compatible — returns array if no page param)
  if (page) {
    const pg = parsePagination(req.query);
    const total = db.prepare(`SELECT COUNT(*) as c FROM ventes v ${whereStr}`).get(...params);
    const ventes = db.prepare(`
      SELECT v.*,
        c.prenom as chatteur_prenom, c.couleur as chatteur_couleur,
        m.pseudo as modele_pseudo, m.couleur_fond as modele_couleur_fond, m.couleur_texte as modele_couleur_texte,
        p.nom as plateforme_nom, p.couleur_fond as plateforme_couleur_fond, p.couleur_texte as plateforme_couleur_texte, p.tva_rate, p.commission_rate, p.devise,
        sh.date as shift_date, sh.creneau as shift_creneau
      FROM ventes v
      JOIN chatteurs c ON c.id = v.chatteur_id
      LEFT JOIN modeles m ON m.id = v.modele_id
      JOIN plateformes p ON p.id = v.plateforme_id
      LEFT JOIN shifts sh ON sh.id = v.shift_id
      ${whereStr}
      ORDER BY v.periode_debut DESC, v.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, pg.limit, pg.offset);
    return res.json(paginatedResponse(ventes, total.c, pg.page, pg.limit));
  }

  const ventes = db.prepare(`
    SELECT v.*,
      c.prenom as chatteur_prenom, c.couleur as chatteur_couleur,
      m.pseudo as modele_pseudo, m.couleur_fond as modele_couleur_fond, m.couleur_texte as modele_couleur_texte,
      p.nom as plateforme_nom, p.couleur_fond as plateforme_couleur_fond, p.couleur_texte as plateforme_couleur_texte, p.tva_rate, p.commission_rate, p.devise,
      sh.date as shift_date, sh.creneau as shift_creneau
    FROM ventes v
    JOIN chatteurs c ON c.id = v.chatteur_id
    LEFT JOIN modeles m ON m.id = v.modele_id
    JOIN plateformes p ON p.id = v.plateforme_id
    LEFT JOIN shifts sh ON sh.id = v.shift_id
    ${whereStr}
    ORDER BY v.periode_debut DESC, v.created_at DESC
  `).all(...params);

  res.json(ventes);
}));

// GET /api/ventes/par-modele — sales grouped by model (global for admin, filtered for chatteur)
router.get('/par-modele', authMiddleware, asyncHandler((req, res) => {
  const { periode_debut, periode_fin } = req.query;

  const where = [];
  const params = [];

  // Chatteur: filtre obligatoire. Admin sans chatteur_id: vue globale
  if (req.user.role === 'chatteur') {
    if (!req.user.chatteur_id) return res.json([]);
    where.push('v.chatteur_id = ?');
    params.push(req.user.chatteur_id);
  } else if (req.query.chatteur_id) {
    where.push('v.chatteur_id = ?');
    params.push(req.query.chatteur_id);
  }

  if (periode_debut) {
    where.push('v.periode_debut >= ?');
    params.push(periode_debut);
  }
  if (periode_fin) {
    where.push('v.periode_fin <= ?');
    params.push(periode_fin);
  }

  where.push("v.statut != 'rejetée'");
  const whereStr = 'WHERE ' + where.join(' AND ');
  const result = db.prepare(`
    SELECT m.pseudo, m.couleur_fond, m.couleur_texte, SUM(v.montant_brut) as total_brut, COUNT(*) as nb_ventes
    FROM ventes v
    LEFT JOIN modeles m ON m.id = v.modele_id
    ${whereStr}
    GROUP BY v.modele_id
    ORDER BY total_brut DESC
  `).all(...params);

  res.json(result);
}));

// POST /api/ventes
router.post('/', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { chatteur_id, modele_id, plateforme_id, montant_brut, periode_debut, periode_fin, notes, shift_id } = req.body;

  if (!chatteur_id || !plateforme_id || montant_brut === undefined || !periode_debut || !periode_fin || !shift_id) {
    throw new ApiError(400, 'Champs requis manquants (shift_id obligatoire)');
  }

  const montant = parseFloat(montant_brut);
  if (isNaN(montant) || montant <= 0 || montant > 100000) {
    throw new ApiError(400, 'Montant brut invalide (doit être entre 0.01 et 100 000)');
  }

  // Validate shift exists and belongs to the chatteur
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shift_id);
  if (!shift) {
    throw new ApiError(400, 'Shift introuvable');
  }
  if (shift.chatteur_id !== Number(chatteur_id)) {
    throw new ApiError(400, 'Ce shift n\'appartient pas à ce chatteur');
  }

  // Use shift's modele_id and plateforme_id as source of truth
  const effectiveModeleId = modele_id || shift.modele_id;
  const effectivePlateformeId = plateforme_id || shift.plateforme_id;

  // Validate modele+plateforme association
  if (effectiveModeleId && effectivePlateformeId) {
    const link = db.prepare(
      'SELECT 1 FROM modeles_plateformes WHERE modele_id = ? AND plateforme_id = ?'
    ).get(effectiveModeleId, effectivePlateformeId);
    if (!link) {
      const modele = db.prepare('SELECT pseudo FROM modeles WHERE id = ?').get(effectiveModeleId);
      const pf = db.prepare('SELECT nom FROM plateformes WHERE id = ?').get(effectivePlateformeId);
      throw new ApiError(400, `${modele?.pseudo || 'Ce modèle'} n'est pas sur ${pf?.nom || 'cette plateforme'}`);
    }
  }

  // Determine source based on user role
  const source = req.user.role === 'manager' ? 'manager' : 'admin';

  // Insert vente then recalculate paies (recalculatePaies has its own transaction)
  let recalcWarning = null;
  const result = db.prepare(`
    INSERT INTO ventes (chatteur_id, modele_id, plateforme_id, montant_brut, periode_debut, periode_fin, notes, statut, shift_id, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'validée', ?, ?)
  `).run(chatteur_id, effectiveModeleId || null, effectivePlateformeId, montant_brut, periode_debut, periode_fin, notes || null, shift_id ?? null, source);

  try {
    recalculatePaies(periode_debut, periode_fin);
  } catch (err) {
    logger.error('Recalcul paies échoué après insert vente', { error: err.message });
    recalcWarning = 'Vente enregistrée mais recalcul des paies échoué';
  }

  // Notify the chatteur
  const chatteur = db.prepare('SELECT prenom FROM chatteurs WHERE id = ?').get(chatteur_id);
  const pf = db.prepare('SELECT nom, devise FROM plateformes WHERE id = ?').get(plateforme_id);
  const symbol = pf?.devise === 'USD' ? '$' : '€';
  notifyChatteur(chatteur_id, 'vente', 'Nouvelle vente enregistrée',
    `${montant_brut}${symbol} — ${pf?.nom || '?'}`, '/chatteur/mes-ventes');

  logActivity(req.user.id, 'create_vente', 'vente', result.lastInsertRowid, `${montant_brut}${symbol} — ${pf?.nom || '?'}`);

  res.status(201).json({ id: result.lastInsertRowid, warning: recalcWarning });
}));

// PUT /api/ventes/:id
router.put('/:id', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { montant_brut, modele_id, plateforme_id, periode_debut, periode_fin, notes, shift_id } = req.body;
  const existing = db.prepare('SELECT id FROM ventes WHERE id = ?').get(req.params.id);
  if (!existing) throw new ApiError(404, 'Vente introuvable');

  // Get current period before update for recalcul
  const current = db.prepare('SELECT * FROM ventes WHERE id = ?').get(req.params.id);

  // Validate modele+plateforme association (use new values or fall back to current)
  const effectiveModele = modele_id ?? current.modele_id;
  const effectivePf = plateforme_id ?? current.plateforme_id;
  if (effectiveModele && effectivePf) {
    const link = db.prepare(
      'SELECT 1 FROM modeles_plateformes WHERE modele_id = ? AND plateforme_id = ?'
    ).get(effectiveModele, effectivePf);
    if (!link) {
      const mod = db.prepare('SELECT pseudo FROM modeles WHERE id = ?').get(effectiveModele);
      const pf = db.prepare('SELECT nom FROM plateformes WHERE id = ?').get(effectivePf);
      return res.status(400).json({
        error: `${mod?.pseudo || 'Ce modèle'} n'est pas sur ${pf?.nom || 'cette plateforme'}`
      });
    }
  }

  // Update vente then recalculate paies (recalculatePaies has its own transaction)
  let recalcWarning = null;
  db.prepare(`
    UPDATE ventes SET
      montant_brut = COALESCE(?, montant_brut),
      modele_id = COALESCE(?, modele_id),
      plateforme_id = COALESCE(?, plateforme_id),
      periode_debut = COALESCE(?, periode_debut),
      periode_fin = COALESCE(?, periode_fin),
      notes = COALESCE(?, notes),
      shift_id = COALESCE(?, shift_id)
    WHERE id = ?
  `).run(montant_brut ?? null, modele_id ?? null, plateforme_id ?? null, periode_debut ?? null, periode_fin ?? null, notes ?? null, shift_id ?? null, req.params.id);

  try {
    const newPeriod = db.prepare('SELECT periode_debut, periode_fin FROM ventes WHERE id = ?').get(req.params.id);
    if (newPeriod) recalculatePaies(newPeriod.periode_debut, newPeriod.periode_fin);
    if (current && (current.periode_debut !== newPeriod?.periode_debut || current.periode_fin !== newPeriod?.periode_fin)) {
      recalculatePaies(current.periode_debut, current.periode_fin);
    }
  } catch (err) {
    logger.error('Recalcul paies échoué après update vente', { error: err.message });
    recalcWarning = 'Vente modifiée mais recalcul des paies échoué';
  }

  notifyChatteur(current.chatteur_id, 'vente', 'Vente modifiée',
    'Une de vos ventes a été modifiée par un administrateur', '/chatteur/mes-ventes');

  logActivity(req.user.id, 'update_vente', 'vente', parseInt(req.params.id));

  res.json({ message: 'Vente mise à jour', warning: recalcWarning });
}));

// DELETE /api/ventes/:id
router.delete('/:id', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  // Get period + chatteur before deleting
  const vente = db.prepare('SELECT chatteur_id, montant_brut, periode_debut, periode_fin FROM ventes WHERE id = ?').get(req.params.id);
  if (!vente) throw new ApiError(404, 'Vente introuvable');

  // Delete vente then recalculate paies (recalculatePaies has its own transaction)
  let recalcWarning = null;
  db.prepare('DELETE FROM ventes WHERE id = ?').run(req.params.id);

  try {
    recalculatePaies(vente.periode_debut, vente.periode_fin);
  } catch (err) {
    logger.error('Recalcul paies échoué après suppression vente', { error: err.message });
    recalcWarning = 'Vente supprimée mais recalcul des paies échoué';
  }

  notifyChatteur(vente.chatteur_id, 'vente', 'Vente supprimée',
    'Une de vos ventes a été supprimée par un administrateur', '/chatteur/mes-ventes');

  logActivity(req.user.id, 'delete_vente', 'vente', parseInt(req.params.id), `${vente.montant_brut}`);

  res.json({ message: 'Vente supprimée', warning: recalcWarning });
}));

// GET /api/ventes/summary — dashboard summary
router.get('/summary', authMiddleware, asyncHandler((req, res) => {
  const { periode_debut, periode_fin } = req.query;

  const where = ["v.statut != 'rejetée'"];
  const params = [];
  if (periode_debut && periode_fin) {
    where.push('v.periode_debut >= ? AND v.periode_fin <= ?');
    params.push(periode_debut, periode_fin);
  }
  const dateFilter = 'WHERE ' + where.join(' AND ');

  const tauxChange = getExchangeRate();

  const byPlateforme = db.prepare(`
    SELECT p.nom, p.tva_rate, p.commission_rate, p.devise,
      SUM(v.montant_brut) as total_brut,
      COUNT(DISTINCT v.chatteur_id) as nb_chatteurs
    FROM ventes v
    JOIN plateformes p ON p.id = v.plateforme_id
    ${dateFilter}
    GROUP BY p.id
  `).all(...params);

  // Compute totals
  let totalBrut = 0, totalTTC = 0, totalHT = 0, totalNetHT = 0;
  byPlateforme.forEach(p => {
    const ttc = p.devise === 'USD' ? p.total_brut * tauxChange : p.total_brut;
    const ht = ttc / (1 + p.tva_rate);
    const netHT = ht * (1 - p.commission_rate);
    totalBrut += p.total_brut;
    totalTTC += ttc;
    totalHT += ht;
    totalNetHT += netHT;
    p.total_ttc = ttc;
    p.total_ht = ht;
    p.net_ht = netHT;
  });

  const topChatteur = db.prepare(`
    SELECT c.id, c.prenom, SUM(v.montant_brut) as total_brut
    FROM ventes v
    JOIN chatteurs c ON c.id = v.chatteur_id
    ${dateFilter}
    GROUP BY v.chatteur_id
    ORDER BY total_brut DESC
    LIMIT 1
  `).get(...params);

  // Fetch primes & total payé from paies table for this period
  let totalPrimes = 0, totalPaye = 0;
  if (periode_debut && periode_fin) {
    const paiesSummary = db.prepare(`
      SELECT
        COALESCE(SUM(prime), 0) as total_primes,
        COALESCE(SUM(total_chatteur), 0) as total_paye
      FROM paies
      WHERE periode_debut = ? AND periode_fin = ?
    `).get(periode_debut, periode_fin);
    if (paiesSummary) {
      totalPrimes = paiesSummary.total_primes;
      totalPaye = paiesSummary.total_paye;
    }
  }

  res.json({
    taux_change: tauxChange,
    total_brut_usd: totalBrut,
    total_ttc_eur: totalTTC,
    total_ht_eur: totalHT,
    total_net_ht_eur: totalNetHT,
    total_primes: totalPrimes,
    total_paye: totalPaye,
    by_plateforme: byPlateforme,
    top_chatteur: topChatteur
  });
}));

// GET /api/ventes/export-csv?periode_debut=&periode_fin=
router.get('/export-csv', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { periode_debut, periode_fin } = req.query;
  if (!periode_debut || !periode_fin) throw new ApiError(400, 'periode_debut et periode_fin requis');
  const dateErr = validateDate(periode_debut) || validateDate(periode_fin);
  if (dateErr) throw new ApiError(400, dateErr);

  const { sendCSV } = require('../utils/csvExport');

  const ventes = db.prepare(`
    SELECT v.periode_debut, v.periode_fin,
      c.prenom as chatteur, m.pseudo as modele, p.nom as plateforme,
      p.devise, v.montant_brut, v.notes
    FROM ventes v
    JOIN chatteurs c ON c.id = v.chatteur_id
    LEFT JOIN modeles m ON m.id = v.modele_id
    JOIN plateformes p ON p.id = v.plateforme_id
    WHERE v.periode_debut >= ? AND v.periode_fin <= ? AND v.statut != 'rejetée'
    ORDER BY v.periode_debut, c.prenom
  `).all(periode_debut, periode_fin);

  sendCSV(res, `ventes_${periode_debut}_${periode_fin}.csv`, ventes, [
    { key: 'periode_debut', label: 'Début période' },
    { key: 'periode_fin', label: 'Fin période' },
    { key: 'chatteur', label: 'Chatteur' },
    { key: 'modele', label: 'Modèle' },
    { key: 'plateforme', label: 'Plateforme' },
    { key: 'devise', label: 'Devise' },
    { key: 'montant_brut', label: 'Montant brut' },
    { key: 'notes', label: 'Notes' },
  ]);
}));

// PUT /api/ventes/:id/valider — approve or reject a vente
router.put('/:id/valider', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { statut } = req.body;
  if (!['validée', 'rejetée'].includes(statut)) {
    throw new ApiError(400, "Statut invalide (attendu : 'validée' ou 'rejetée')");
  }

  const vente = db.prepare('SELECT * FROM ventes WHERE id = ?').get(req.params.id);
  if (!vente) throw new ApiError(404, 'Vente introuvable');

  db.prepare('UPDATE ventes SET statut = ? WHERE id = ?').run(statut, req.params.id);

  // Recalculate paies on both approval AND rejection (rejection removes the vente from paies)
  let recalcWarning = null;
  try { recalculatePaies(vente.periode_debut, vente.periode_fin); } catch (err) {
    logger.error('Erreur auto-recalcul paies (validation)', { error: err.message });
    recalcWarning = `Vente ${statut === 'validée' ? 'validée' : 'rejetée'} mais le recalcul des paies a échoué.`;
  }

  const label = statut === 'validée' ? 'validée' : 'rejetée';
  notifyChatteur(vente.chatteur_id, 'vente', `Vente ${label}`,
    `Votre vente de ${vente.montant_brut}$ a été ${label}.`, '/chatteur/mes-ventes');

  logActivity(req.user.id, statut === 'validée' ? 'validate_vente' : 'reject_vente', 'vente', parseInt(req.params.id), `${vente.montant_brut} — ${label}`);

  res.json({ message: `Vente ${label}`, warning: recalcWarning });
}));

/* ═══════════════════════════════════════════════════════════════
   Chatteur self-service routes — /api/ventes/mes-ventes
   ═══════════════════════════════════════════════════════════════ */

// POST /api/ventes/mes-ventes — chatteur creates own sale
router.post('/mes-ventes', authMiddleware, asyncHandler((req, res) => {
  if (!req.user.chatteur_id) throw new ApiError(403, 'Accès réservé aux chatteurs');

  const { modele_id, plateforme_id, montant_brut, date, notes, shift_id } = req.body;

  if (!modele_id || !plateforme_id || montant_brut === undefined || !date || !shift_id) {
    throw new ApiError(400, 'Champs requis : modele_id, plateforme_id, montant_brut, date, shift_id');
  }

  const montant = parseFloat(montant_brut);
  if (isNaN(montant) || montant <= 0 || montant > 100000) {
    throw new ApiError(400, 'Montant brut invalide (doit être entre 0.01 et 100 000)');
  }

  const dateErr = validateDate(date);
  if (dateErr) throw new ApiError(400, dateErr);

  // Validate shift exists and belongs to THIS chatteur
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shift_id);
  if (!shift) {
    throw new ApiError(400, 'Shift introuvable');
  }
  if (shift.chatteur_id !== req.user.chatteur_id) {
    throw new ApiError(403, 'Ce shift ne vous appartient pas');
  }

  const periode = computePeriode(date);

  // Check period lock
  if (isPeriodeLocked(req.user.chatteur_id, periode.debut, periode.fin)) {
    throw new ApiError(403, 'Cette période est validée, les modifications ne sont plus possibles');
  }

  // Validate modele+plateforme association
  if (modele_id && plateforme_id) {
    const link = db.prepare(
      'SELECT 1 FROM modeles_plateformes WHERE modele_id = ? AND plateforme_id = ?'
    ).get(modele_id, plateforme_id);
    if (!link) {
      const modele = db.prepare('SELECT pseudo FROM modeles WHERE id = ?').get(modele_id);
      const pf = db.prepare('SELECT nom FROM plateformes WHERE id = ?').get(plateforme_id);
      throw new ApiError(400, `${modele?.pseudo || 'Ce modèle'} n'est pas sur ${pf?.nom || 'cette plateforme'}`);
    }
  }

  const chatteur = db.prepare('SELECT prenom FROM chatteurs WHERE id = ?').get(req.user.chatteur_id);
  const autoNotes = notes || `Ajout manuel — ${chatteur?.prenom || 'Chatteur'}`;

  const result = db.prepare(`
    INSERT INTO ventes (chatteur_id, modele_id, plateforme_id, montant_brut, periode_debut, periode_fin, notes, statut, shift_id, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente', ?, 'chatteur')
  `).run(req.user.chatteur_id, modele_id || null, plateforme_id, montant, periode.debut, periode.fin, autoNotes, shift_id ?? null);

  // Recalculate paies (vente counts in paie preview even before validation)
  let recalcWarning = null;
  try { recalculatePaies(periode.debut, periode.fin); } catch (err) {
    logger.error('Erreur auto-recalcul paies (chatteur)', { error: err.message });
    recalcWarning = 'Vente enregistrée mais le recalcul des paies a échoué.';
  }

  const pf = db.prepare('SELECT nom FROM plateformes WHERE id = ?').get(plateforme_id);
  const mod = modele_id ? db.prepare('SELECT pseudo FROM modeles WHERE id = ?').get(modele_id) : null;
  notifyAdminsAndManagers('vente',
    `Vente ajoutée par ${chatteur?.prenom || 'Chatteur'}`,
    `${montant}$ — ${mod?.pseudo || '?'} (${pf?.nom || '?'})`,
    `/admin/ventes?validate=${result.lastInsertRowid}`
  );

  logActivity(req.user.id, 'create_vente_chatteur', 'vente', result.lastInsertRowid, `${montant}$ self-service`);

  res.status(201).json({ id: result.lastInsertRowid, periode_debut: periode.debut, periode_fin: periode.fin, warning: recalcWarning });
}));

// PUT /api/ventes/mes-ventes/:id — chatteur edits own sale
router.put('/mes-ventes/:id', authMiddleware, asyncHandler((req, res) => {
  if (!req.user.chatteur_id) throw new ApiError(403, 'Accès réservé aux chatteurs');

  const vente = db.prepare('SELECT * FROM ventes WHERE id = ?').get(req.params.id);
  if (!vente) throw new ApiError(404, 'Vente introuvable');
  if (vente.chatteur_id !== req.user.chatteur_id) throw new ApiError(403, 'Vous ne pouvez modifier que vos propres ventes');

  // Check period lock
  if (isPeriodeLocked(req.user.chatteur_id, vente.periode_debut, vente.periode_fin)) {
    throw new ApiError(403, 'Cette période est validée, les modifications ne sont plus possibles');
  }

  const { montant_brut, modele_id, plateforme_id, notes, shift_id } = req.body;

  if (montant_brut !== undefined) {
    const montant = parseFloat(montant_brut);
    if (isNaN(montant) || montant <= 0 || montant > 100000) {
      throw new ApiError(400, 'Montant brut invalide (doit être entre 0.01 et 100 000)');
    }
  }

  // Validate modele+plateforme association
  const effectiveModele = modele_id ?? vente.modele_id;
  const effectivePf = plateforme_id ?? vente.plateforme_id;
  if (effectiveModele && effectivePf) {
    const link = db.prepare(
      'SELECT 1 FROM modeles_plateformes WHERE modele_id = ? AND plateforme_id = ?'
    ).get(effectiveModele, effectivePf);
    if (!link) {
      const mod = db.prepare('SELECT pseudo FROM modeles WHERE id = ?').get(effectiveModele);
      const pf = db.prepare('SELECT nom FROM plateformes WHERE id = ?').get(effectivePf);
      throw new ApiError(400, `${mod?.pseudo || 'Ce modèle'} n'est pas sur ${pf?.nom || 'cette plateforme'}`);
    }
  }

  db.prepare(`
    UPDATE ventes SET
      montant_brut = COALESCE(?, montant_brut),
      modele_id = COALESCE(?, modele_id),
      plateforme_id = COALESCE(?, plateforme_id),
      notes = COALESCE(?, notes),
      shift_id = COALESCE(?, shift_id)
    WHERE id = ?
  `).run(montant_brut ?? null, modele_id ?? null, plateforme_id ?? null, notes ?? null, shift_id ?? null, req.params.id);

  // Auto-recalculate paies
  let recalcWarning = null;
  try { recalculatePaies(vente.periode_debut, vente.periode_fin); } catch (err) {
    logger.error('Erreur auto-recalcul paies (chatteur edit)', { error: err.message });
    recalcWarning = 'Vente modifiée mais le recalcul des paies a échoué.';
  }

  const chatteur = db.prepare('SELECT prenom FROM chatteurs WHERE id = ?').get(req.user.chatteur_id);
  notifyAdminsAndManagers('vente',
    `Vente modifiée par ${chatteur?.prenom || 'Chatteur'}`,
    `Vente #${req.params.id} mise à jour`,
    '/admin/ventes'
  );

  logActivity(req.user.id, 'update_vente_chatteur', 'vente', parseInt(req.params.id));

  res.json({ message: 'Vente mise à jour', warning: recalcWarning });
}));

// DELETE /api/ventes/mes-ventes/:id — chatteur deletes own sale
router.delete('/mes-ventes/:id', authMiddleware, asyncHandler((req, res) => {
  if (!req.user.chatteur_id) throw new ApiError(403, 'Accès réservé aux chatteurs');

  const vente = db.prepare('SELECT * FROM ventes WHERE id = ?').get(req.params.id);
  if (!vente) throw new ApiError(404, 'Vente introuvable');
  if (vente.chatteur_id !== req.user.chatteur_id) throw new ApiError(403, 'Vous ne pouvez supprimer que vos propres ventes');

  // Check period lock
  if (isPeriodeLocked(req.user.chatteur_id, vente.periode_debut, vente.periode_fin)) {
    throw new ApiError(403, 'Cette période est validée, les modifications ne sont plus possibles');
  }

  db.prepare('DELETE FROM ventes WHERE id = ?').run(req.params.id);

  // Auto-recalculate paies
  let recalcWarning = null;
  try { recalculatePaies(vente.periode_debut, vente.periode_fin); } catch (err) {
    logger.error('Erreur auto-recalcul paies (chatteur delete)', { error: err.message });
    recalcWarning = 'Vente supprimée mais le recalcul des paies a échoué.';
  }

  const chatteur = db.prepare('SELECT prenom FROM chatteurs WHERE id = ?').get(req.user.chatteur_id);
  notifyAdminsAndManagers('vente',
    `Vente supprimée par ${chatteur?.prenom || 'Chatteur'}`,
    `${vente.montant_brut}$ supprimés`,
    '/admin/ventes'
  );

  logActivity(req.user.id, 'delete_vente_chatteur', 'vente', parseInt(req.params.id), `${vente.montant_brut}`);

  res.json({ message: 'Vente supprimée', warning: recalcWarning });
}));

// GET /api/ventes/periode-status — check if current period is locked for the chatteur
router.get('/periode-status', authMiddleware, asyncHandler((req, res) => {
  if (!req.user.chatteur_id) throw new ApiError(403, 'Accès réservé aux chatteurs');
  const { periode_debut, periode_fin } = req.query;
  if (!periode_debut || !periode_fin) throw new ApiError(400, 'periode_debut et periode_fin requis');
  res.json({ locked: isPeriodeLocked(req.user.chatteur_id, periode_debut, periode_fin) });
}));

module.exports = router;
