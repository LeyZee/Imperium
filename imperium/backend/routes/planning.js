const express = require('express');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

const CRENEAUX = {
  1: { label: '08h–14h', start: '08:00', end: '14:00' },
  2: { label: '14h–20h', start: '14:00', end: '20:00' },
  3: { label: '20h–02h', start: '20:00', end: '02:00' },
  4: { label: '02h–08h', start: '02:00', end: '08:00' }
};

const FUSEAUX = ['Europe/Paris', 'Africa/Porto-Novo', 'Indian/Antananarivo'];

// GET /api/shifts?date_debut=&date_fin=&chatteur_id=&plateforme_id=
router.get('/', authMiddleware, (req, res) => {
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
      m.pseudo as modele_pseudo,
      p.nom as plateforme_nom
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
});

// POST /api/shifts
router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { chatteur_id, modele_id, plateforme_id, date, creneau, fuseau_horaire, notes } = req.body;

  if (!chatteur_id || !date || !creneau) {
    return res.status(400).json({ error: 'chatteur_id, date et creneau requis' });
  }

  if (![1, 2, 3, 4].includes(Number(creneau))) {
    return res.status(400).json({ error: 'Créneau invalide (1-4)' });
  }

  const fuseau = FUSEAUX.includes(fuseau_horaire) ? fuseau_horaire : 'Europe/Paris';

  // Conflict check: one model per platform per slot
  if (modele_id) {
    const conflict = db.prepare(
      'SELECT id FROM shifts WHERE modele_id = ? AND COALESCE(plateforme_id, 0) = COALESCE(?, 0) AND date = ? AND creneau = ?'
    ).get([modele_id, plateforme_id || 0, date, creneau]);

    if (conflict) {
      return res.status(409).json({ error: 'Ce modèle a déjà un chatteur assigné sur ce créneau pour cette plateforme' });
    }
  }

  const result = db.prepare(
    'INSERT INTO shifts (chatteur_id, modele_id, plateforme_id, date, creneau, fuseau_horaire, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run([chatteur_id, modele_id || null, plateforme_id || null, date, creneau, fuseau, notes || null]);

  res.status(201).json({ id: result.lastInsertRowid });
});

// DELETE /api/shifts/:id
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  db.prepare('DELETE FROM shifts WHERE id = ?').run([req.params.id]);
  res.json({ message: 'Shift supprimé' });
});

// --- Shift Templates (recurring weekly schedule) ---

// GET /api/shifts/template — get all templates
router.get('/template', authMiddleware, (req, res) => {
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
});

// POST /api/shifts/template/save — save current week as recurring template
router.post('/template/save', authMiddleware, adminOnly, (req, res) => {
  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'date requise' });

  const refDate = new Date(date);
  const day = refDate.getDay();
  const diff = refDate.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(refDate.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  const pad = n => String(n).padStart(2, '0');
  const dateDebut = `${monday.getFullYear()}-${pad(monday.getMonth()+1)}-${pad(monday.getDate())}`;
  const dateFin = `${sunday.getFullYear()}-${pad(sunday.getMonth()+1)}-${pad(sunday.getDate())}`;

  // Get all shifts for this week
  const shifts = db.prepare(
    'SELECT * FROM shifts WHERE date >= ? AND date <= ?'
  ).all([dateDebut, dateFin]);

  const saveTpl = db.transaction(() => {
    // Clear existing templates
    db.prepare('DELETE FROM shift_templates').run();

    // Convert each shift to a template (date → day_of_week)
    for (const s of shifts) {
      const d = new Date(s.date);
      let dow = d.getDay(); // 0=Sunday
      dow = dow === 0 ? 7 : dow; // Convert to 1=Monday..7=Sunday
      db.prepare(
        'INSERT INTO shift_templates (chatteur_id, modele_id, plateforme_id, day_of_week, creneau, fuseau_horaire) VALUES (?, ?, ?, ?, ?, ?)'
      ).run([s.chatteur_id, s.modele_id, s.plateforme_id, dow, s.creneau, s.fuseau_horaire]);
    }
  });

  saveTpl();
  res.json({ message: 'Planning récurrent sauvegardé', count: shifts.length });
});

// GET /api/shifts/semaine?date= — get week view (merges templates for empty slots)
router.get('/semaine', authMiddleware, (req, res) => {
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

  if (req.user.role === 'chatteur') {
    where += ' AND s.chatteur_id = ?';
    params.push(req.user.chatteur_id);
  }

  const shifts = db.prepare(`
    SELECT s.*,
      c.prenom as chatteur_prenom,
      m.pseudo as modele_pseudo,
      p.nom as plateforme_nom
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
      m.pseudo as modele_pseudo, p.nom as plateforme_nom
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
      modele_pseudo: t.modele_pseudo,
      plateforme_nom: t.plateforme_nom,
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
    fuseaux: FUSEAUX,
    plateformes,
    modeles_plateformes,
    shifts: enriched,
    has_templates: (hasTemplates?.c || 0) > 0,
  });
});

// POST /api/shifts/bulk — create multiple shifts at once (with optional replace)
router.post('/bulk', authMiddleware, adminOnly, (req, res) => {
  const { chatteur_id, modele_id, plateforme_id, dates, creneaux, fuseau_horaire, replace } = req.body;

  if (!chatteur_id || !dates?.length || !creneaux?.length) {
    return res.status(400).json({ error: 'chatteur_id, dates[] et creneaux[] requis' });
  }

  const fuseau = FUSEAUX.includes(fuseau_horaire) ? fuseau_horaire : 'Europe/Paris';
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

  res.status(201).json({ created, replaced });
});

module.exports = router;
