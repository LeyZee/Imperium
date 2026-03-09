const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/chatteurs
router.get('/', authMiddleware, (req, res) => {
  const chatteurs = db.prepare(`
    SELECT c.*, u.username, u.email as user_email
    FROM chatteurs c
    LEFT JOIN users u ON u.id = c.user_id
    WHERE c.actif = 1
    ORDER BY c.prenom
  `).all();
  res.json(chatteurs);
});

// GET /api/chatteurs/:id
router.get('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  // Chatteur can only see themselves
  if (req.user.role === 'chatteur' && req.user.chatteur_id != id) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const chatteur = db.prepare(`
    SELECT c.*, u.username, u.email as user_email
    FROM chatteurs c
    LEFT JOIN users u ON u.id = c.user_id
    WHERE c.id = ?
  `).get(id);

  if (!chatteur) return res.status(404).json({ error: 'Chatteur introuvable' });
  res.json(chatteur);
});

// POST /api/chatteurs
router.post('/', authMiddleware, adminOnly, (req, res) => {
  const {
    prenom, email, adresse, code_postal, ville, pays,
    iban, taux_commission, is_nouveau, role, taux_net_equipe, couleur,
    username, password // optional: create associated user account
  } = req.body;

  if (!prenom) return res.status(400).json({ error: 'Prénom requis' });

  let user_id = null;

  // Create user account if credentials provided
  if (username && password) {
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (exists) return res.status(409).json({ error: 'Ce nom d\'utilisateur existe déjà' });

    const hash = bcrypt.hashSync(password, 10);
    const userResult = db.prepare(
      'INSERT INTO users (username, password_hash, role, email) VALUES (?, ?, ?, ?)'
    ).run(username, hash, 'chatteur', email || null);
    user_id = userResult.lastInsertRowid;
  }

  const result = db.prepare(`
    INSERT INTO chatteurs (prenom, email, adresse, code_postal, ville, pays, iban, taux_commission, is_nouveau, role, taux_net_equipe, couleur, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    prenom, email || null, adresse || null, code_postal || null,
    ville || null, pays || 'France', iban || null,
    taux_commission ?? 0.15, is_nouveau ? 1 : 0,
    role || 'chatteur', taux_net_equipe ?? 0, couleur ?? 0, user_id
  );

  res.status(201).json({ id: result.lastInsertRowid, prenom });
});

// PUT /api/chatteurs/:id
router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  const { id } = req.params;
  const {
    prenom, email, adresse, code_postal, ville, pays,
    iban, taux_commission, is_nouveau, actif, role, taux_net_equipe, couleur
  } = req.body;

  const existing = db.prepare('SELECT id FROM chatteurs WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Chatteur introuvable' });

  db.prepare(`
    UPDATE chatteurs SET
      prenom = COALESCE(?, prenom),
      email = COALESCE(?, email),
      adresse = COALESCE(?, adresse),
      code_postal = COALESCE(?, code_postal),
      ville = COALESCE(?, ville),
      pays = COALESCE(?, pays),
      iban = COALESCE(?, iban),
      taux_commission = COALESCE(?, taux_commission),
      is_nouveau = COALESCE(?, is_nouveau),
      actif = COALESCE(?, actif),
      role = COALESCE(?, role),
      taux_net_equipe = COALESCE(?, taux_net_equipe),
      couleur = COALESCE(?, couleur)
    WHERE id = ?
  `).run(
    prenom ?? null, email ?? null, adresse ?? null,
    code_postal ?? null, ville ?? null, pays ?? null,
    iban ?? null, taux_commission ?? null,
    is_nouveau !== undefined ? (is_nouveau ? 1 : 0) : null,
    actif !== undefined ? (actif ? 1 : 0) : null,
    role ?? null, taux_net_equipe ?? null,
    couleur ?? null,
    id
  );

  res.json({ message: 'Chatteur mis à jour' });
});

// DELETE /api/chatteurs/:id (soft delete)
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  const { id } = req.params;
  db.prepare('UPDATE chatteurs SET actif = 0 WHERE id = ?').run(id);
  res.json({ message: 'Chatteur désactivé' });
});

// GET /api/chatteurs/:id/kpis
router.get('/:id/kpis', authMiddleware, (req, res) => {
  const { id } = req.params;
  if (req.user.role === 'chatteur' && req.user.chatteur_id != id) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const { periode_debut, periode_fin } = req.query;

  let dateFilter = '';
  const params = [id];
  if (periode_debut && periode_fin) {
    dateFilter = 'AND v.periode_debut >= ? AND v.periode_fin <= ?';
    params.push(periode_debut, periode_fin);
  }

  // Total ventes
  const ventes = db.prepare(`
    SELECT
      SUM(v.montant_brut) as total_brut,
      COUNT(*) as nb_ventes,
      p.devise
    FROM ventes v
    JOIN plateformes p ON p.id = v.plateforme_id
    WHERE v.chatteur_id = ? ${dateFilter}
    GROUP BY p.devise
  `).all(...params);

  // Paies récentes
  const paies = db.prepare(`
    SELECT * FROM paies
    WHERE chatteur_id = ?
    ORDER BY periode_debut DESC
    LIMIT 6
  `).all(id);

  // Rang par ventes brutes (dans la période ou tous temps)
  let rangQuery = `
    SELECT chatteur_id, SUM(montant_brut) as total
    FROM ventes
    ${periode_debut && periode_fin ? 'WHERE periode_debut >= ? AND periode_fin <= ?' : ''}
    GROUP BY chatteur_id
    ORDER BY total DESC
  `;
  const rangParams = periode_debut && periode_fin ? [periode_debut, periode_fin] : [];
  const classement = db.prepare(rangQuery).all(...rangParams);
  const rang = classement.findIndex(r => r.chatteur_id == id) + 1;

  // Malus
  const malusTotal = db.prepare(`
    SELECT COALESCE(SUM(montant), 0) as total FROM malus WHERE chatteur_id = ?
    ${periode_debut && periode_fin ? 'AND periode >= ? AND periode <= ?' : ''}
  `).get(id, ...(periode_debut && periode_fin ? [periode_debut, periode_fin] : []));

  res.json({ ventes, paies, rang, nb_chatteurs: classement.length, malus_total: malusTotal.total });
});

module.exports = router;
