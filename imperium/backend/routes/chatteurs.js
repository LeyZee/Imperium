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
    WHERE c.statut != 'inactif'
    ORDER BY c.prenom
  `).all();
  res.json(chatteurs);
});

// GET /api/chatteurs/classement — leaderboard with prime data (accessible by chatteurs)
router.get('/classement', authMiddleware, (req, res) => {
  const { periode_debut, periode_fin } = req.query;

  if (!periode_debut || !periode_fin) {
    return res.status(400).json({ error: 'periode_debut et periode_fin requis' });
  }

  // Get ranking from paies (net_ht-based, excludes managers and VAs)
  const classement = db.prepare(`
    SELECT
      c.id, c.prenom, c.couleur, c.role, c.pays,
      COALESCE(SUM(p.net_ht_eur), 0) as total_net_ht,
      COALESCE(SUM(p.prime), 0) as prime,
      COALESCE(SUM(p.total_chatteur), 0) as total_paie
    FROM chatteurs c
    LEFT JOIN paies p ON p.chatteur_id = c.id
      AND p.periode_debut >= ? AND p.periode_fin <= ?
      AND p.plateforme_id IS NOT NULL
    WHERE c.actif = 1 AND c.role NOT IN ('va', 'manager')
    GROUP BY c.id
    HAVING total_net_ht > 0
    ORDER BY total_net_ht DESC
  `).all(periode_debut, periode_fin);

  // Total net HT of the entire team (for prime pool calculation)
  const totalRow = db.prepare(`
    SELECT COALESCE(SUM(net_ht_eur), 0) as total
    FROM paies
    WHERE periode_debut >= ? AND periode_fin <= ?
      AND plateforme_id IS NOT NULL
  `).get(periode_debut, periode_fin);

  const total_net_ht_equipe = totalRow?.total || 0;
  const prime_rates = [0.005, 0.0025, 0.0012]; // 0.5%, 0.25%, 0.12%

  res.json({
    classement,
    total_net_ht_equipe,
    prime_rates,
  });
});

// GET /api/chatteurs/classement/historique-cagnotte — historical prime pool data for gamification
router.get('/classement/historique-cagnotte', authMiddleware, (req, res) => {
  const nb = parseInt(req.query.nb_periodes, 10) || 6;

  const periodes = db.prepare(`
    SELECT periode_debut, periode_fin,
      COALESCE(SUM(net_ht_eur), 0) as total_net_ht_equipe,
      COALESCE(SUM(prime), 0) as total_prime_pool
    FROM paies
    WHERE plateforme_id IS NOT NULL
    GROUP BY periode_debut, periode_fin
    ORDER BY periode_debut DESC
    LIMIT ?
  `).all(nb);

  const moyenne_prime_pool = periodes.length > 0
    ? periodes.reduce((s, p) => s + p.total_prime_pool, 0) / periodes.length
    : 0;

  res.json({
    periodes: periodes.reverse(), // chronological order
    moyenne_prime_pool,
  });
});

// GET /api/chatteurs/:id
router.get('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  // Chatteur can only see themselves
  if (req.user.role === 'chatteur' && req.user.chatteur_id !== parseInt(id, 10)) {
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
    iban, taux_commission, is_nouveau, role, taux_net_equipe, taux_horaire, couleur,
    password, photo // optional: create associated user account (email = login ID)
  } = req.body;

  if (!prenom) return res.status(400).json({ error: 'Prénom requis' });

  let user_id = null;

  // Create user account if email + password provided
  if (email && password) {
    if (password.length < 8) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (exists) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

    const hash = bcrypt.hashSync(password, 10);
    const userResult = db.prepare(
      'INSERT INTO users (username, password_hash, role, email) VALUES (?, ?, ?, ?)'
    ).run(email, hash, 'chatteur', email);
    user_id = userResult.lastInsertRowid;
  }

  const result = db.prepare(`
    INSERT INTO chatteurs (prenom, email, adresse, code_postal, ville, pays, iban, taux_commission, is_nouveau, role, taux_net_equipe, taux_horaire, couleur, user_id, photo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    prenom, email || null, adresse || null, code_postal || null,
    ville || null, pays || 'France', iban || null,
    taux_commission ?? 0.15, is_nouveau ? 1 : 0,
    role || 'chatteur', taux_net_equipe ?? 0, taux_horaire ?? 0, couleur ?? 0, user_id, photo ?? null
  );

  res.status(201).json({ id: result.lastInsertRowid, prenom });
});

// PUT /api/chatteurs/:id
router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  const { id } = req.params;
  const {
    prenom, email, adresse, code_postal, ville, pays,
    iban, taux_commission, is_nouveau, actif, role, taux_net_equipe, taux_horaire, couleur, statut, photo
  } = req.body;

  const existing = db.prepare('SELECT id FROM chatteurs WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Chatteur introuvable' });

  // Sync actif from statut
  const effectiveActif = statut ? (statut === 'actif' ? 1 : 0) : (actif !== undefined ? (actif ? 1 : 0) : null);

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
      taux_horaire = COALESCE(?, taux_horaire),
      couleur = COALESCE(?, couleur),
      statut = COALESCE(?, statut),
      photo = COALESCE(?, photo)
    WHERE id = ?
  `).run(
    prenom ?? null, email ?? null, adresse ?? null,
    code_postal ?? null, ville ?? null, pays ?? null,
    iban ?? null, taux_commission ?? null,
    is_nouveau !== undefined ? (is_nouveau ? 1 : 0) : null,
    effectiveActif,
    role ?? null, taux_net_equipe ?? null, taux_horaire ?? null,
    couleur ?? null, statut ?? null, photo ?? null,
    id
  );

  res.json({ message: 'Chatteur mis à jour' });
});

// PUT /api/chatteurs/:id/account — admin manages chatteur's user account (email-based)
router.put('/:id/account', authMiddleware, adminOnly, (req, res) => {
  const { id } = req.params;
  const { email, new_password, confirm_password } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email requis' });
  }
  if (new_password && new_password !== confirm_password) {
    return res.status(400).json({ error: 'Les mots de passe ne correspondent pas' });
  }
  if (new_password && new_password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });
  }

  const chatteur = db.prepare('SELECT id, user_id, email FROM chatteurs WHERE id = ?').get(id);
  if (!chatteur) return res.status(404).json({ error: 'Chatteur introuvable' });

  if (chatteur.user_id) {
    // Update existing user account
    const conflict = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.trim(), chatteur.user_id);
    if (conflict) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

    db.prepare('UPDATE users SET email = ?, username = ? WHERE id = ?').run(email.trim(), email.trim(), chatteur.user_id);
    // Also sync email on the chatteur profile
    db.prepare('UPDATE chatteurs SET email = ? WHERE id = ?').run(email.trim(), id);

    if (new_password) {
      const hash = bcrypt.hashSync(new_password, 10);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, chatteur.user_id);
    }

    res.json({ message: new_password ? 'Compte et mot de passe mis à jour' : 'Email mis à jour' });
  } else {
    // Create new user account for this chatteur
    if (!new_password) {
      return res.status(400).json({ error: 'Mot de passe requis pour créer un compte' });
    }

    const conflict = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim());
    if (conflict) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

    const hash = bcrypt.hashSync(new_password, 10);
    const userResult = db.prepare(
      'INSERT INTO users (username, password_hash, role, email) VALUES (?, ?, ?, ?)'
    ).run(email.trim(), hash, 'chatteur', email.trim());

    db.prepare('UPDATE chatteurs SET user_id = ?, email = ? WHERE id = ?').run(userResult.lastInsertRowid, email.trim(), id);

    res.status(201).json({ message: 'Compte utilisateur créé et lié', user_id: userResult.lastInsertRowid });
  }
});

// DELETE /api/chatteurs/:id (soft delete)
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  const { id } = req.params;
  db.prepare("UPDATE chatteurs SET actif = 0, statut = 'inactif' WHERE id = ?").run(id);
  res.json({ message: 'Chatteur désactivé' });
});

// GET /api/chatteurs/:id/kpis
router.get('/:id/kpis', authMiddleware, (req, res) => {
  const { id } = req.params;
  if (req.user.role === 'chatteur' && req.user.chatteur_id !== parseInt(id, 10)) {
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

// GET /api/chatteurs/:id/historique — performance history over last N periods
router.get('/:id/historique', authMiddleware, (req, res) => {
  const { id } = req.params;
  // Chatteur can only see their own
  if (req.user.role === 'chatteur' && req.user.chatteur_id !== parseInt(id, 10)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  // Get all paies for this chatteur, grouped by period
  const historique = db.prepare(`
    SELECT
      p.periode_debut, p.periode_fin,
      SUM(p.ventes_brutes) as total_brut,
      SUM(p.ventes_ttc_eur) as total_ttc_eur,
      SUM(p.net_ht_eur) as total_net_ht,
      SUM(p.commission_chatteur) as total_commission,
      SUM(p.total_chatteur) as total_paie,
      SUM(p.malus_total) as total_malus,
      SUM(p.prime) as total_prime
    FROM paies p
    WHERE p.chatteur_id = ?
    GROUP BY p.periode_debut, p.periode_fin
    ORDER BY p.periode_debut DESC
    LIMIT 12
  `).all(id);

  res.json(historique.reverse()); // chronological order
});

module.exports = router;
