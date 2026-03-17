const express = require('express');
const db = require('../database');
const { authMiddleware, adminOnly, adminOrManager } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { TIMEZONES, CRENEAUX } = require('../utils/constants');
const { notifyChatteur } = require('../utils/notifier');
const { logActivity } = require('../utils/activityLogger');

const router = express.Router();

// GET /api/shifts?date_debut=&date_fin=&chatteur_id=&plateforme_id=
router.get('/', authMiddleware, asyncHandler((req, res) => {
  const { date_debut, date_fin, chatteur_id, plateforme_id } = req.query;

  let where = [];
  const params = [];

  if (req.user.role === 'chatteur') {
    where.push('s.chatteur_id = ?');
    params.push(req.user.chatteur_id);
  } else if (chatteur_id) {
    where.push('s.chatteur_id = ?');
    params.push(chatteur_id);
  }

  if (date_debut) { where.push('s.date >= ?'); params.push(date_debut); }
  if (date_fin) { where.push('s.date <= ?'); params.push(date_fin); }
  if (plateforme_id) { where.push('s.plateforme_id = ?'); params.push(plateforme_id); }

  const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const shifts = db.prepare(`
    SELECT s.*,
      c.prenom as chatteur_prenom,
      m.pseudo as modele_pseudo, m.couleur_fond as modele_couleur_fond, m.couleur_texte as modele_couleur_texte,
      p.nom as plateforme_nom, p.couleur_fond as plateforme_couleur_fond, p.couleur_texte as plateforme_couleur_texte
    FROM shifts s
    JOIN chatteurs c ON c.id = s.chatteur_id
    LEFT JOIN modeles m ON m.id = s.modele_id
    LEFT JOIN plateformes p ON p.id = s.plateforme_id
    ${whereStr}
    ORDER BY s.date, s.creneau
  `).all(params);

  const enriched = shifts.map(s => ({
    ...s,
    creneau_label: CRENEAUX[s.creneau]?.label || '',
    creneau_start: CRENEAUX[s.creneau]?.start || '',
    creneau_end: CRENEAUX[s.creneau]?.end || ''
  }));

  res.json(enriched);
}));

// POST /api/shifts
router.post('/', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { chatteur_id, modele_id, plateforme_id, date, creneau, fuseau_horaire, notes } = req.body;

  if (!chatteur_id || !date || !creneau) {
    throw new ApiError(400, 'chatteur_id, date et creneau requis');
  }

  if (![1, 2, 3, 4].includes(Number(creneau))) {
    throw new ApiError(400, 'Créneau invalide (1-4)');
  }

  const fuseau = TIMEZONES.includes(fuseau_horaire) ? fuseau_horaire : 'Europe/Paris';

  // Conflict check: one model per platform per slot
  if (modele_id) {
    const conflict = db.prepare(
      'SELECT id FROM shifts WHERE modele_id = ? AND COALESCE(plateforme_id, 0) = COALESCE(?, 0) AND date = ? AND creneau = ?'
    ).get([modele_id, plateforme_id || 0, date, creneau]);

    if (conflict) {
      throw new ApiError(409, 'Ce modèle a déjà un chatteur assigné sur ce créneau pour cette plateforme');
    }
  }

  const result = db.prepare(
    'INSERT INTO shifts (chatteur_id, modele_id, plateforme_id, date, creneau, fuseau_horaire, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run([chatteur_id, modele_id || null, plateforme_id || null, date, creneau, fuseau, notes || null]);

  // Notify the chatteur
  const creneauLabel = CRENEAUX[creneau]?.label || `Créneau ${creneau}`;
  notifyChatteur(chatteur_id, 'shift', 'Shift assigné',
    `${date} — ${creneauLabel}`, '/chatteur/planning');

  res.status(201).json({ id: result.lastInsertRowid });
}));

// DELETE /api/shifts/bulk — Supprimer les shifts d'une période (dates obligatoires)
router.delete('/bulk', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { date_debut, date_fin } = req.query;
  if (!date_debut || !date_fin) {
    throw new ApiError(400, 'date_debut et date_fin requis pour la suppression en masse');
  }
  const result = db.prepare('DELETE FROM shifts WHERE date >= ? AND date <= ?').run([date_debut, date_fin]);
  logActivity(req.user.id, 'bulk_delete_shifts', 'shift', null, `${result.changes} shifts supprimés (${date_debut} → ${date_fin})`);
  res.json({ message: `${result.changes} shift(s) supprimé(s)`, count: result.changes });
}));

// DELETE /api/shifts/:id
router.delete('/:id', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  db.prepare('DELETE FROM shifts WHERE id = ?').run([req.params.id]);
  res.json({ message: 'Shift supprimé' });
}));

// GET /api/shifts/chatteur-modeles/:chatteurId — distinct models+platforms a chatteur has shifts for
router.get('/chatteur-modeles/:chatteurId', authMiddleware, asyncHandler((req, res) => {
  const cid = req.params.chatteurId;

  // Chatteur can only see their own models
  if (req.user.role === 'chatteur' && req.user.chatteur_id !== parseInt(cid, 10)) {
    throw new ApiError(403, 'Accès refusé');
  }
  const combos = db.prepare(`
    SELECT DISTINCT src.modele_id, src.plateforme_id, m.pseudo as modele_pseudo, p.nom as plateforme_nom
    FROM (
      SELECT modele_id, plateforme_id FROM shifts WHERE chatteur_id = ? AND modele_id IS NOT NULL
      UNION
      SELECT modele_id, plateforme_id FROM shift_templates WHERE chatteur_id = ? AND modele_id IS NOT NULL
    ) src
    JOIN modeles m ON m.id = src.modele_id AND m.actif = 1
    LEFT JOIN plateformes p ON p.id = src.plateforme_id AND p.actif = 1
    ORDER BY m.pseudo, p.nom
  `).all([cid, cid]);

  // Group by model with platforms list
  const modelMap = {};
  for (const c of combos) {
    if (!modelMap[c.modele_id]) {
      modelMap[c.modele_id] = { id: c.modele_id, pseudo: c.modele_pseudo, plateformes: [] };
    }
    if (c.plateforme_id && !modelMap[c.modele_id].plateformes.find(p => p.id === c.plateforme_id)) {
      modelMap[c.modele_id].plateformes.push({ id: c.plateforme_id, nom: c.plateforme_nom });
    }
  }
  res.json(Object.values(modelMap));
}));

// --- Shift Templates (recurring weekly schedule) ---

// GET /api/shifts/template — get all templates
router.get('/template', authMiddleware, asyncHandler((req, res) => {
  const templates = db.prepare(`
    SELECT t.*, c.prenom as chatteur_prenom,
      m.pseudo as modele_pseudo, p.nom as plateforme_nom
    FROM shift_templates t
    JOIN chatteurs c ON c.id = t.chatteur_id
    LEFT JOIN modeles m ON m.id = t.modele_id
    LEFT JOIN plateformes p ON p.id = t.plateforme_id
    ORDER BY t.day_of_week, t.creneau
  `).all();
  res.json(templates);
}));

// POST /api/shifts/template/save — save current week as recurring template
// Merges real shifts + existing template virtual shifts (same view as displayed)
router.post('/template/save', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { date } = req.body;
  if (!date) throw new ApiError(400, 'date requise');

  const refDate = new Date(date);
  const day = refDate.getDay();
  const diff = refDate.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(refDate.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  const pad = n => String(n).padStart(2, '0');
  const dateDebut = `${monday.getFullYear()}-${pad(monday.getMonth()+1)}-${pad(monday.getDate())}`;
  const dateFin = `${sunday.getFullYear()}-${pad(sunday.getMonth()+1)}-${pad(sunday.getDate())}`;

  // Get real shifts for this week
  const shifts = db.prepare(
    'SELECT * FROM shifts WHERE date >= ? AND date <= ?'
  ).all([dateDebut, dateFin]);

  // Build occupied slots set (same logic as GET /semaine)
  const occupied = new Set();
  for (const s of shifts) {
    occupied.add(`${s.date}|${s.creneau}|${s.modele_id || 0}|${s.plateforme_id || 0}`);
  }

  // Load existing templates to keep unoccupied slots
  const existingTemplates = db.prepare('SELECT * FROM shift_templates').all();

  // Map day_of_week to actual dates for this week
  const dowToDate = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    dowToDate[i + 1] = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  // Find template entries that fill empty slots (not overridden by real shifts)
  const templateEntries = [];
  for (const t of existingTemplates) {
    const tDate = dowToDate[t.day_of_week];
    if (!tDate) continue;
    const key = `${tDate}|${t.creneau}|${t.modele_id || 0}|${t.plateforme_id || 0}`;
    if (!occupied.has(key)) {
      templateEntries.push(t);
    }
  }

  const saveTpl = db.transaction(() => {
    db.prepare('DELETE FROM shift_templates').run();

    // Save real shifts as templates
    for (const s of shifts) {
      const d = new Date(s.date + 'T12:00:00'); // noon to avoid timezone issues
      let dow = d.getDay();
      dow = dow === 0 ? 7 : dow;
      db.prepare(
        'INSERT INTO shift_templates (chatteur_id, modele_id, plateforme_id, day_of_week, creneau, fuseau_horaire) VALUES (?, ?, ?, ?, ?, ?)'
      ).run([s.chatteur_id, s.modele_id, s.plateforme_id, dow, s.creneau, s.fuseau_horaire]);
    }

    // Re-save template entries that weren't overridden by real shifts
    for (const t of templateEntries) {
      db.prepare(
        'INSERT INTO shift_templates (chatteur_id, modele_id, plateforme_id, day_of_week, creneau, fuseau_horaire) VALUES (?, ?, ?, ?, ?, ?)'
      ).run([t.chatteur_id, t.modele_id, t.plateforme_id, t.day_of_week, t.creneau, t.fuseau_horaire]);
    }
  });

  saveTpl();
  const totalCount = shifts.length + templateEntries.length;
  res.json({ message: 'Planning récurrent sauvegardé', count: totalCount });
}));

// GET /api/shifts/semaine?date= — get week view (merges templates for empty slots)
router.get('/semaine', authMiddleware, asyncHandler((req, res) => {
  const { date } = req.query;
  const refDate = date ? new Date(date) : new Date();

  // Get Monday of the week
  const day = refDate.getDay();
  const diff = refDate.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(refDate.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  const pad = n => String(n).padStart(2, '0');
  const dateDebut = `${monday.getFullYear()}-${pad(monday.getMonth()+1)}-${pad(monday.getDate())}`;
  const dateFin = `${sunday.getFullYear()}-${pad(sunday.getMonth()+1)}-${pad(sunday.getDate())}`;

  let where = 's.date >= ? AND s.date <= ?';
  const params = [dateDebut, dateFin];

  if (req.user.role === 'chatteur' && req.query.general !== 'true') {
    where += ' AND s.chatteur_id = ?';
    params.push(req.user.chatteur_id);
  }

  const shifts = db.prepare(`
    SELECT s.*,
      c.prenom as chatteur_prenom,
      c.couleur as chatteur_couleur,
      m.pseudo as modele_pseudo, m.couleur_fond as modele_couleur_fond, m.couleur_texte as modele_couleur_texte,
      p.nom as plateforme_nom, p.couleur_fond as plateforme_couleur_fond, p.couleur_texte as plateforme_couleur_texte
    FROM shifts s
    JOIN chatteurs c ON c.id = s.chatteur_id
    LEFT JOIN modeles m ON m.id = s.modele_id
    LEFT JOIN plateformes p ON p.id = s.plateforme_id
    WHERE ${where}
    ORDER BY s.date, s.creneau
  `).all(params);

  const enriched = shifts.map(s => ({
    ...s,
    creneau_label: CRENEAUX[s.creneau]?.label || '',
    from_template: false,
  }));

  // Build a set of occupied slots: "date|creneau|modele_id|plateforme_id"
  const occupied = new Set();
  for (const s of shifts) {
    occupied.add(`${s.date}|${s.creneau}|${s.modele_id || 0}|${s.plateforme_id || 0}`);
  }

  // Load templates and generate virtual shifts for empty slots
  const templates = db.prepare(`
    SELECT t.*, c.prenom as chatteur_prenom,
      c.couleur as chatteur_couleur,
      m.pseudo as modele_pseudo, m.couleur_fond as modele_couleur_fond, m.couleur_texte as modele_couleur_texte,
      p.nom as plateforme_nom, p.couleur_fond as plateforme_couleur_fond, p.couleur_texte as plateforme_couleur_texte
    FROM shift_templates t
    JOIN chatteurs c ON c.id = t.chatteur_id
    LEFT JOIN modeles m ON m.id = t.modele_id
    LEFT JOIN plateformes p ON p.id = t.plateforme_id
  `).all();

  // Map day_of_week (1=Mon..7=Sun) to actual dates of this week
  const dowToDate = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    dowToDate[i + 1] = iso; // 1=Monday(+0), 2=Tuesday(+1), etc.
  }

  for (const t of templates) {
    const tDate = dowToDate[t.day_of_week];
    if (!tDate) continue;
    const key = `${tDate}|${t.creneau}|${t.modele_id || 0}|${t.plateforme_id || 0}`;
    if (occupied.has(key)) continue; // Real shift exists, skip template

    enriched.push({
      id: `tpl_${t.id}_${tDate}`,
      chatteur_id: t.chatteur_id,
      modele_id: t.modele_id,
      plateforme_id: t.plateforme_id,
      date: tDate,
      creneau: t.creneau,
      fuseau_horaire: t.fuseau_horaire,
      chatteur_prenom: t.chatteur_prenom,
      chatteur_couleur: t.chatteur_couleur,
      modele_pseudo: t.modele_pseudo,
      modele_couleur_fond: t.modele_couleur_fond,
      modele_couleur_texte: t.modele_couleur_texte,
      plateforme_nom: t.plateforme_nom,
      plateforme_couleur_fond: t.plateforme_couleur_fond,
      plateforme_couleur_texte: t.plateforme_couleur_texte,
      creneau_label: CRENEAUX[t.creneau]?.label || '',
      from_template: true,
    });
  }

  // Sort merged list
  enriched.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.creneau - b.creneau);

  const plateformes = db.prepare('SELECT * FROM plateformes WHERE actif = 1 ORDER BY id').all();
  const modeles_plateformes = db.prepare('SELECT * FROM modeles_plateformes').all();

  // Check if templates exist
  const hasTemplates = db.prepare('SELECT COUNT(*) as c FROM shift_templates').get();

  res.json({
    date_debut: dateDebut,
    date_fin: dateFin,
    creneaux: CRENEAUX,
    fuseaux: TIMEZONES,
    plateformes,
    modeles_plateformes,
    shifts: enriched,
    has_templates: (hasTemplates?.c || 0) > 0,
  });
}));

// POST /api/shifts/bulk — create multiple shifts at once (with optional replace)
router.post('/bulk', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { chatteur_id, modele_id, plateforme_id, dates, creneaux, fuseau_horaire, replace } = req.body;

  if (!chatteur_id || !dates?.length || !creneaux?.length) {
    throw new ApiError(400, 'chatteur_id, dates[] et creneaux[] requis');
  }

  const fuseau = TIMEZONES.includes(fuseau_horaire) ? fuseau_horaire : 'Europe/Paris';
  let created = 0, replaced = 0;

  const insertBulk = db.transaction(() => {
    for (const date of dates) {
      for (const creneau of creneaux) {
        if (![1, 2, 3, 4].includes(Number(creneau))) continue;

        if (modele_id) {
          const existing = db.prepare(
            'SELECT id FROM shifts WHERE modele_id = ? AND COALESCE(plateforme_id, 0) = COALESCE(?, 0) AND date = ? AND creneau = ?'
          ).get([modele_id, plateforme_id || 0, date, creneau]);

          if (existing) {
            if (replace) {
              db.prepare('DELETE FROM shifts WHERE id = ?').run([existing.id]);
              replaced++;
            } else {
              continue; // skip conflict
            }
          }
        }

        db.prepare(
          'INSERT INTO shifts (chatteur_id, modele_id, plateforme_id, date, creneau, fuseau_horaire) VALUES (?, ?, ?, ?, ?, ?)'
        ).run([chatteur_id, modele_id || null, plateforme_id || null, date, creneau, fuseau]);
        created++;
      }
    }
  });

  insertBulk();

  // Notify the chatteur once for all created shifts
  if (created > 0) {
    notifyChatteur(chatteur_id, 'shift', 'Shifts assignés',
      `${created} shift${created > 1 ? 's' : ''} assigné${created > 1 ? 's' : ''}`, '/chatteur/planning');
  }

  res.status(201).json({ created, replaced });
}));

// GET /api/shifts/en-ligne — who is currently online based on today's shifts (incl. templates)
router.get('/en-ligne', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  // Real shifts for today
  const realShifts = db.prepare(`
    SELECT s.*, c.prenom as chatteur_prenom, c.couleur as chatteur_couleur,
      m.pseudo as modele_pseudo, m.couleur_fond as modele_couleur_fond, m.couleur_texte as modele_couleur_texte,
      p.nom as plateforme_nom, p.couleur_fond as plateforme_couleur_fond, p.couleur_texte as plateforme_couleur_texte
    FROM shifts s
    JOIN chatteurs c ON c.id = s.chatteur_id
    LEFT JOIN modeles m ON m.id = s.modele_id
    LEFT JOIN plateformes p ON p.id = s.plateforme_id
    WHERE s.date = ?
    ORDER BY s.creneau, c.prenom
  `).all(today);

  // Build occupied set from real shifts
  const occupied = new Set();
  for (const s of realShifts) {
    occupied.add(`${s.creneau}|${s.modele_id || 0}|${s.plateforme_id || 0}`);
  }

  // Merge template shifts for today's day_of_week
  const todayDate = new Date(today + 'T00:00:00');
  const jsDay = todayDate.getDay(); // 0=Sun, 1=Mon...
  const dow = jsDay === 0 ? 7 : jsDay; // Convert to 1=Mon..7=Sun

  const templates = db.prepare(`
    SELECT t.*, c.prenom as chatteur_prenom, c.couleur as chatteur_couleur,
      m.pseudo as modele_pseudo, m.couleur_fond as modele_couleur_fond, m.couleur_texte as modele_couleur_texte,
      p.nom as plateforme_nom, p.couleur_fond as plateforme_couleur_fond, p.couleur_texte as plateforme_couleur_texte
    FROM shift_templates t
    JOIN chatteurs c ON c.id = t.chatteur_id
    LEFT JOIN modeles m ON m.id = t.modele_id
    LEFT JOIN plateformes p ON p.id = t.plateforme_id
    WHERE t.day_of_week = ?
  `).all(dow);

  const allShifts = realShifts.map(s => ({ ...s, from_template: false }));
  for (const t of templates) {
    const key = `${t.creneau}|${t.modele_id || 0}|${t.plateforme_id || 0}`;
    if (occupied.has(key)) continue; // Real shift exists, skip template
    allShifts.push({
      id: `tpl_${t.id}`,
      chatteur_id: t.chatteur_id,
      modele_id: t.modele_id,
      plateforme_id: t.plateforme_id,
      date: today,
      creneau: t.creneau,
      fuseau_horaire: t.fuseau_horaire,
      chatteur_prenom: t.chatteur_prenom,
      chatteur_couleur: t.chatteur_couleur,
      modele_pseudo: t.modele_pseudo,
      modele_couleur_fond: t.modele_couleur_fond,
      modele_couleur_texte: t.modele_couleur_texte,
      plateforme_nom: t.plateforme_nom,
      plateforme_couleur_fond: t.plateforme_couleur_fond,
      plateforme_couleur_texte: t.plateforme_couleur_texte,
      from_template: true,
    });
  }

  allShifts.sort((a, b) => a.creneau - b.creneau || (a.chatteur_prenom || '').localeCompare(b.chatteur_prenom || ''));

  // Determine current creneau based on France timezone
  const frHour = parseInt(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric', hour12: false }).format(now));
  let currentCreneau;
  if (frHour >= 8 && frHour < 14) currentCreneau = 1;
  else if (frHour >= 14 && frHour < 20) currentCreneau = 2;
  else if (frHour >= 20 || frHour < 2) currentCreneau = 3;
  else currentCreneau = 4;

  const enLigne = allShifts.filter(s => s.creneau === currentCreneau);

  res.json({
    en_ligne: enLigne,
    all_shifts: allShifts,
    creneau_actuel: currentCreneau,
    creneau_label: CRENEAUX[currentCreneau]?.label || '',
    total_shifts_today: allShifts.length,
  });
}));

// GET /api/shifts/conflits?date_debut=&date_fin= — detect scheduling conflicts
router.get('/conflits', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { date_debut, date_fin } = req.query;
  if (!date_debut || !date_fin) throw new ApiError(400, 'date_debut et date_fin requis');

  // Get all modeles_plateformes associations (expected coverage)
  const modPlats = db.prepare(`
    SELECT mp.modele_id, mp.plateforme_id, m.pseudo as modele_pseudo, p.nom as plateforme_nom
    FROM modeles_plateformes mp
    JOIN modeles m ON m.id = mp.modele_id AND m.actif = 1
    JOIN plateformes p ON p.id = mp.plateforme_id AND p.actif = 1
  `).all();

  // Get all real shifts in the date range
  const shifts = db.prepare(`
    SELECT s.*, c.prenom as chatteur_prenom
    FROM shifts s
    JOIN chatteurs c ON c.id = s.chatteur_id
    WHERE s.date >= ? AND s.date <= ?
  `).all(date_debut, date_fin);

  // Build set of covered slots: "date|creneau|modele_id|plateforme_id"
  const covered = {};
  const doublons = [];
  // Track which dates have any real shifts (to know where templates should fill in)
  const datesWithShifts = new Set();

  for (const s of shifts) {
    datesWithShifts.add(s.date);
    const key = `${s.date}|${s.creneau}|${s.modele_id || 0}|${s.plateforme_id || 0}`;
    if (covered[key]) {
      doublons.push({
        date: s.date, creneau: s.creneau,
        modele_id: s.modele_id, plateforme_id: s.plateforme_id,
        chatteurs: [covered[key], s.chatteur_prenom],
      });
    } else {
      covered[key] = s.chatteur_prenom;
    }
  }

  // Expand shift_templates for dates that don't have real shifts
  const templates = db.prepare(`
    SELECT t.*, c.prenom as chatteur_prenom
    FROM shift_templates t
    JOIN chatteurs c ON c.id = t.chatteur_id
  `).all();

  const padN = n => String(n).padStart(2, '0');
  const startDate = new Date(date_debut);
  const endDate = new Date(date_fin);

  if (templates.length > 0) {
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = `${d.getFullYear()}-${padN(d.getMonth() + 1)}-${padN(d.getDate())}`;
      // Only apply templates for dates without real shifts
      if (datesWithShifts.has(dateStr)) continue;
      let dow = d.getDay();
      dow = dow === 0 ? 7 : dow; // 1=Monday..7=Sunday
      for (const t of templates) {
        if (t.day_of_week !== dow) continue;
        const key = `${dateStr}|${t.creneau}|${t.modele_id || 0}|${t.plateforme_id || 0}`;
        if (!covered[key]) {
          covered[key] = t.chatteur_prenom;
        }
      }
    }
  }

  // Find uncovered slots: date × creneau where nobody is working at all
  const nonCouverts = [];
  // Build set of covered date|creneau (regardless of model/platform)
  const coveredCreneaux = new Set();
  for (const key of Object.keys(covered)) {
    const [date, creneau] = key.split('|');
    coveredCreneaux.add(`${date}|${creneau}`);
  }

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = `${d.getFullYear()}-${padN(d.getMonth() + 1)}-${padN(d.getDate())}`;
    for (const creneau of [1, 2, 3, 4]) {
      if (!coveredCreneaux.has(`${dateStr}|${creneau}`)) {
        nonCouverts.push({
          date: dateStr, creneau, creneau_label: CRENEAUX[creneau]?.label || '',
        });
      }
    }
  }

  res.json({ doublons, non_couverts: nonCouverts });
}));

// GET /api/shifts/export-csv?date_debut=&date_fin=
router.get('/export-csv', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { date_debut, date_fin } = req.query;
  if (!date_debut || !date_fin) throw new ApiError(400, 'date_debut et date_fin requis');

  const { sendCSV } = require('../utils/csvExport');

  const shifts = db.prepare(`
    SELECT s.date, c.prenom as chatteur, m.pseudo as modele, p.nom as plateforme,
      s.creneau, s.fuseau_horaire
    FROM shifts s
    JOIN chatteurs c ON c.id = s.chatteur_id
    LEFT JOIN modeles m ON m.id = s.modele_id
    LEFT JOIN plateformes p ON p.id = s.plateforme_id
    WHERE s.date >= ? AND s.date <= ?
    ORDER BY s.date, s.creneau, c.prenom
  `).all(date_debut, date_fin);

  const enriched = shifts.map(s => ({
    ...s,
    creneau_label: CRENEAUX[s.creneau]?.label || `Créneau ${s.creneau}`,
  }));

  sendCSV(res, `shifts_${date_debut}_${date_fin}.csv`, enriched, [
    { key: 'date', label: 'Date' },
    { key: 'chatteur', label: 'Chatteur' },
    { key: 'modele', label: 'Modèle' },
    { key: 'plateforme', label: 'Plateforme' },
    { key: 'creneau_label', label: 'Créneau' },
    { key: 'fuseau_horaire', label: 'Fuseau horaire' },
  ]);
}));

// GET /api/shifts/for-vente — shifts matching criteria for vente association
router.get('/for-vente', authMiddleware, asyncHandler((req, res) => {
  let { chatteur_id, modele_id, plateforme_id, days } = req.query;
  const maxDays = parseInt(days) || 7;

  // Chatteur can only see their own shifts
  if (req.user.role === 'chatteur') {
    chatteur_id = req.user.chatteur_id;
  }
  if (!chatteur_id) throw new ApiError(400, 'chatteur_id requis');

  let where = ['s.chatteur_id = ?', `s.date >= date('now', '-${maxDays} days')`];
  const params = [chatteur_id];

  if (modele_id) { where.push('s.modele_id = ?'); params.push(modele_id); }
  if (plateforme_id) { where.push('s.plateforme_id = ?'); params.push(plateforme_id); }

  const shifts = db.prepare(`
    SELECT s.id, s.date, s.creneau,
      m.pseudo as modele_pseudo, p.nom as plateforme_nom
    FROM shifts s
    LEFT JOIN modeles m ON m.id = s.modele_id
    LEFT JOIN plateformes p ON p.id = s.plateforme_id
    WHERE ${where.join(' AND ')}
    ORDER BY s.date DESC, s.creneau ASC
  `).all(...params);

  res.json(shifts);
}));

module.exports = router;
