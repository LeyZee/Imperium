const express = require('express');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

const CRENEAUX = {
  1: { label: '00h–06h', start: '00:00', end: '06:00' },
  2: { label: '06h–12h', start: '06:00', end: '12:00' },
  3: { label: '12h–18h', start: '12:00', end: '18:00' },
  4: { label: '18h–00h', start: '18:00', end: '24:00' }
};

const FUSEAUX = ['Europe/Paris', 'America/New_York', 'Asia/Tokyo'];

// GET /api/planning?date_debut=&date_fin=&chatteur_id=
router.get('/', authMiddleware, (req, res) => {
  const { date_debut, date_fin, chatteur_id } = req.query;

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

  const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const shifts = db.prepare(`
    SELECT s.*,
      c.nom as chatteur_nom, c.prenom as chatteur_prenom,
      m.nom as modele_nom, m.prenom as modele_prenom
    FROM shifts s
    JOIN chatteurs c ON c.id = s.chatteur_id
    LEFT JOIN modeles m ON m.id = s.modele_id
    ${whereStr}
    ORDER BY s.date, s.creneau
  `).all(params);

  // Enrich with creneau labels
  const enriched = shifts.map(s => ({
    ...s,
    creneau_label: CRENEAUX[s.creneau]?.label || '',
    creneau_start: CRENEAUX[s.creneau]?.start || '',
    creneau_end: CRENEAUX[s.creneau]?.end || ''
  }));

  res.json(enriched);
});

// POST /api/planning
router.post('/', authMiddleware, adminOnly, (req, res) => {
  const { chatteur_id, modele_id, date, creneau, fuseau_horaire, notes } = req.body;

  if (!chatteur_id || !date || !creneau) {
    return res.status(400).json({ error: 'chatteur_id, date et creneau requis' });
  }

  if (![1, 2, 3, 4].includes(Number(creneau))) {
    return res.status(400).json({ error: 'Créneau invalide (1-4)' });
  }

  const fuseau = FUSEAUX.includes(fuseau_horaire) ? fuseau_horaire : 'Europe/Paris';

  // Check for conflict
  const conflict = db.prepare(
    'SELECT id FROM shifts WHERE chatteur_id = ? AND date = ? AND creneau = ? AND fuseau_horaire = ?'
  ).get([chatteur_id, date, creneau, fuseau]);

  if (conflict) {
    return res.status(409).json({ error: 'Ce créneau est déjà assigné à ce chatteur' });
  }

  const result = db.prepare(
    'INSERT INTO shifts (chatteur_id, modele_id, date, creneau, fuseau_horaire, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run([chatteur_id, modele_id || null, date, creneau, fuseau, notes || null]);

  res.status(201).json({ id: result.lastInsertRowid });
});

// DELETE /api/planning/:id
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  db.prepare('DELETE FROM shifts WHERE id = ?').run([req.params.id]);
  res.json({ message: 'Shift supprimé' });
});

// GET /api/planning/semaine?date= — get week view
router.get('/semaine', authMiddleware, (req, res) => {
  const { date } = req.query;
  const refDate = date ? new Date(date) : new Date();

  // Get Monday of the week
  const day = refDate.getDay();
  const diff = refDate.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(refDate.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  const dateDebut = monday.toISOString().split('T')[0];
  const dateFin = sunday.toISOString().split('T')[0];

  let where = 's.date >= ? AND s.date <= ?';
  const params = [dateDebut, dateFin];

  if (req.user.role === 'chatteur') {
    where += ' AND s.chatteur_id = ?';
    params.push(req.user.chatteur_id);
  }

  const shifts = db.prepare(`
    SELECT s.*,
      c.nom as chatteur_nom, c.prenom as chatteur_prenom,
      m.nom as modele_nom, m.prenom as modele_prenom
    FROM shifts s
    JOIN chatteurs c ON c.id = s.chatteur_id
    LEFT JOIN modeles m ON m.id = s.modele_id
    WHERE ${where}
    ORDER BY s.date, s.creneau
  `).all(params);

  const enriched = shifts.map(s => ({
    ...s,
    creneau_label: CRENEAUX[s.creneau]?.label || '',
  }));

  res.json({
    date_debut: dateDebut,
    date_fin: dateFin,
    creneaux: CRENEAUX,
    fuseaux: FUSEAUX,
    shifts: enriched
  });
});

module.exports = router;
