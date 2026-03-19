const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { authMiddleware, adminOnly, adminOrManager } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { sendEmail, buildInvitationEmail } = require('../utils/email');
const { getExchangeRate } = require('../utils/rateCache');

const PENDING_HASH = '!PENDING_INVITATION!';

const router = express.Router();

// GET /api/chatteurs
router.get('/', authMiddleware, asyncHandler((req, res) => {
  const chatteurs = db.prepare(`
    SELECT c.*, u.username, u.email as user_email, u.password_hash
    FROM chatteurs c
    LEFT JOIN users u ON u.id = c.user_id
    WHERE c.actif = 1
    ORDER BY c.prenom
  `).all();

  // Strip sensitive fields for non-admin/manager users
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.json(chatteurs.map(({ adresse, code_postal, ville, taux_commission, taux_net_equipe, taux_horaire, user_id, user_email, password_hash, iban, ...safe }) => safe));
  }
  // Add pending_invitation flag, remove password_hash and iban (not used — payment via Worldremit)
  res.json(chatteurs.map(({ password_hash, iban, ...c }) => ({
    ...c,
    pending_invitation: password_hash === PENDING_HASH,
  })));
}));

// GET /api/chatteurs/classement — leaderboard with prime data (accessible by chatteurs)
router.get('/classement', authMiddleware, asyncHandler((req, res) => {
  const { periode_debut, periode_fin } = req.query;

  if (!periode_debut || !periode_fin) {
    throw new ApiError(400, 'periode_debut et periode_fin requis');
  }

  // Get ranking from paies (net_ht-based, excludes managers and VAs)
  let classement = db.prepare(`
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

  let total_net_ht_equipe = totalRow?.total || 0;

  // Complement: estimate from ventes for chatteurs who have no paies yet
  // This ensures chatteurs with validated ventes but no generated paies still appear in ranking
  const paieChatteurIds = new Set(classement.map(c => c.id));
  const tauxChange = getExchangeRate();

  const ventesClassement = db.prepare(`
    SELECT
      c.id, c.prenom, c.couleur, c.role, c.pays,
      v.montant_brut, pl.devise, pl.tva_rate, pl.commission_rate
    FROM ventes v
    JOIN chatteurs c ON c.id = v.chatteur_id
    JOIN plateformes pl ON pl.id = v.plateforme_id
    WHERE v.periode_debut = ? AND v.periode_fin = ?
      AND v.statut != 'rejetée'
      AND c.actif = 1 AND c.role NOT IN ('va', 'manager')
  `).all(periode_debut, periode_fin);

  if (ventesClassement.length > 0) {
    const byChatteur = {};
    for (const v of ventesClassement) {
      // Skip chatteurs who already have paies
      if (paieChatteurIds.has(v.id)) continue;
      if (!byChatteur[v.id]) {
        byChatteur[v.id] = { id: v.id, prenom: v.prenom, couleur: v.couleur, role: v.role, pays: v.pays, total_net_ht: 0, prime: 0, total_paie: 0, estimated: true };
      }
      const brut = v.montant_brut || 0;
      const tva = v.tva_rate ?? 0.2;
      const comm = v.commission_rate ?? 0.2;
      const brutEur = v.devise === 'USD' ? brut * tauxChange : brut;
      byChatteur[v.id].total_net_ht += (brutEur / (1 + tva)) * (1 - comm);
    }
    const estimated = Object.values(byChatteur)
      .map(c => ({ ...c, total_net_ht: Math.round(c.total_net_ht * 100) / 100 }))
      .filter(c => c.total_net_ht > 0);
    classement = [...classement, ...estimated].sort((a, b) => b.total_net_ht - a.total_net_ht);
    total_net_ht_equipe = classement.reduce((s, c) => s + c.total_net_ht, 0);
  }

  // Fetch individual paliers (global)
  const paliers_primes = db.prepare(
    'SELECT * FROM paliers_primes WHERE actif = 1 ORDER BY seuil_net_ht ASC'
  ).all();

  // Total active chatteurs (role=chatteur only, for display "sur X")
  const nbChatteurs = db.prepare("SELECT COUNT(*) as cnt FROM chatteurs WHERE actif = 1 AND role = 'chatteur'").get();

  res.json({
    classement,
    total_net_ht_equipe,
    paliers_primes,
    nb_chatteurs: nbChatteurs.cnt,
  });
}));

// GET /api/chatteurs/classement/historique-cagnotte — historical prime pool data for gamification
router.get('/classement/historique-cagnotte', authMiddleware, asyncHandler((req, res) => {
  const nb = Math.min(Math.max(parseInt(req.query.nb_periodes, 10) || 6, 1), 52);

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
}));

// GET /api/chatteurs/:id
router.get('/:id', authMiddleware, asyncHandler((req, res) => {
  const { id } = req.params;
  const parsedId = parseInt(id, 10);
  if (isNaN(parsedId)) throw new ApiError(400, 'ID invalide');

  // Chatteur can only see themselves
  if (req.user.role === 'chatteur' && req.user.chatteur_id !== parsedId) {
    throw new ApiError(403, 'Accès refusé');
  }

  const chatteur = db.prepare(`
    SELECT c.*, u.username, u.email as user_email, u.password_hash
    FROM chatteurs c
    LEFT JOIN users u ON u.id = c.user_id
    WHERE c.id = ?
  `).get(parsedId);

  if (!chatteur) throw new ApiError(404, 'Chatteur introuvable');

  // Strip sensitive fields for chatteur role
  if (req.user.role === 'chatteur') {
    const { taux_net_equipe, taux_horaire, password_hash, iban, ...safe } = chatteur;
    return res.json(safe);
  }

  // Add pending_invitation flag, remove password_hash and iban
  const { password_hash, iban, ...safe } = chatteur;
  res.json({ ...safe, pending_invitation: password_hash === PENDING_HASH });
}));

// POST /api/chatteurs
router.post('/', authMiddleware, adminOrManager, asyncHandler(async (req, res) => {
  const {
    prenom, email, adresse, code_postal, ville, pays,
    taux_commission, is_nouveau, role, taux_net_equipe, taux_horaire, couleur,
    password, photo, telegram_user_id // optional: create associated user account (email = login ID)
  } = req.body;

  if (!prenom) throw new ApiError(400, 'Prénom requis');

  // Validate commission rate (0 to 1, i.e. 0% to 100%)
  if (taux_commission !== undefined && taux_commission !== null) {
    if (typeof taux_commission !== 'number' || taux_commission < 0 || taux_commission > 1) {
      throw new ApiError(400, 'Le taux de commission doit être entre 0 et 1 (ex: 0.15 pour 15%)');
    }
  }

  // Manager can only create chatteurs, not other managers/directeurs
  if (req.user.role === 'manager' && (role === 'manager' || role === 'directeur')) {
    throw new ApiError(403, 'Un manager ne peut pas créer d\'autres managers ou directeurs');
  }

  let user_id = null;
  let invitation_sent = false;

  // Atomic: create user + chatteur in a single transaction
  const createChatteur = db.transaction(() => {
    if (email) {
      const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (exists) throw new ApiError(409, 'Cet email est déjà utilisé');

      const userRole = (role === 'manager' || role === 'directeur') ? 'manager' : 'chatteur';

      if (password) {
        // Legacy: admin provides password directly (backward compat for seed.js)
        if (password.length < 8) throw new ApiError(400, 'Le mot de passe doit contenir au moins 8 caractères');
        const hash = bcrypt.hashSync(password, 10);
        const userResult = db.prepare(
          'INSERT INTO users (username, password_hash, role, email) VALUES (?, ?, ?, ?)'
        ).run(email, hash, userRole, email);
        user_id = userResult.lastInsertRowid;
      } else {
        // New: invitation-based — create user with pending hash
        const userResult = db.prepare(
          'INSERT INTO users (username, password_hash, role, email) VALUES (?, ?, ?, ?)'
        ).run(email, PENDING_HASH, userRole, email);
        user_id = userResult.lastInsertRowid;
      }
    }

    return db.prepare(`
      INSERT INTO chatteurs (prenom, email, adresse, code_postal, ville, pays, taux_commission, is_nouveau, role, taux_net_equipe, taux_horaire, couleur, user_id, photo, telegram_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      prenom, email || null, adresse || null, code_postal || null,
      ville || null, pays || 'France',
      taux_commission ?? 0.15, is_nouveau ? 1 : 0,
      role || 'chatteur', taux_net_equipe ?? 0, taux_horaire ?? 0, couleur ?? 0, user_id, photo ?? null, telegram_user_id || null
    );
  });

  const result = createChatteur();

  // Send invitation email for passwordless creation
  if (user_id && !password && email) {
    try {
      const token = crypto.randomBytes(32).toString('hex');
      db.prepare(
        'INSERT INTO invitation_tokens (user_id, token, expires_at) VALUES (?, ?, datetime(\'now\', \'+48 hours\'))'
      ).run(user_id, token);
      await sendEmail(email, 'Bienvenue sur Imperium — Définissez votre mot de passe', buildInvitationEmail(prenom, token));
      invitation_sent = true;
    } catch (err) {
      logger.error('Failed to send invitation email', { email, error: err.message });
    }
  }

  res.status(201).json({ id: result.lastInsertRowid, prenom, invitation_sent });
}));

// POST /api/chatteurs/:id/resend-invite — resend invitation email
router.post('/:id/resend-invite', authMiddleware, adminOrManager, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const chatteur = db.prepare(`
    SELECT c.*, u.id as uid, u.email as user_email, u.password_hash
    FROM chatteurs c
    JOIN users u ON u.id = c.user_id
    WHERE c.id = ?
  `).get(id);

  if (!chatteur) throw new ApiError(404, 'Chatteur introuvable');
  if (!chatteur.uid) throw new ApiError(400, 'Aucun compte utilisateur lié');
  if (chatteur.password_hash !== PENDING_HASH) {
    throw new ApiError(400, 'Ce compte a déjà un mot de passe défini');
  }

  // Invalidate previous tokens
  db.prepare('UPDATE invitation_tokens SET used_at = datetime(\'now\') WHERE user_id = ? AND used_at IS NULL').run(chatteur.uid);

  // Generate new token
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(
    'INSERT INTO invitation_tokens (user_id, token, expires_at) VALUES (?, ?, datetime(\'now\', \'+48 hours\'))'
  ).run(chatteur.uid, token);

  await sendEmail(chatteur.user_email, 'Imperium — Définissez votre mot de passe', buildInvitationEmail(chatteur.prenom, token));

  res.json({ message: 'Invitation renvoyée' });
}));

// PUT /api/chatteurs/:id
router.put('/:id', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { id } = req.params;

  // Directeur protection — cannot change role or deactivate a directeur
  const targetChatteur = db.prepare('SELECT role FROM chatteurs WHERE id = ?').get(id);
  if (targetChatteur && targetChatteur.role === 'directeur') {
    if (req.body.role && req.body.role !== 'directeur') {
      throw new ApiError(403, 'Le rôle du directeur ne peut pas être modifié');
    }
    if (req.body.actif === false || req.body.actif === 0) {
      throw new ApiError(403, 'Le compte directeur ne peut pas être désactivé');
    }
  }

  // Manager restrictions
  if (req.user.role === 'manager') {
    // Cannot change own commission rates
    if (req.user.chatteur_id === parseInt(id, 10)) {
      delete req.body.taux_commission;
      delete req.body.taux_net_equipe;
    }
    // Cannot change roles or deactivate chatteurs
    delete req.body.role;
    delete req.body.actif;
  }

  const {
    prenom, email, adresse, code_postal, ville, pays,
    taux_commission, is_nouveau, actif, role, taux_net_equipe, taux_horaire, couleur, photo, telegram_user_id
  } = req.body;

  // Validate commission rate
  if (taux_commission !== undefined && taux_commission !== null) {
    if (typeof taux_commission !== 'number' || taux_commission < 0 || taux_commission > 1) {
      throw new ApiError(400, 'Le taux de commission doit être entre 0 et 1 (ex: 0.15 pour 15%)');
    }
  }

  const existing = db.prepare('SELECT id FROM chatteurs WHERE id = ?').get(id);
  if (!existing) throw new ApiError(404, 'Chatteur introuvable');

  const effectiveActif = actif !== undefined ? (actif ? 1 : 0) : null;

  db.prepare(`
    UPDATE chatteurs SET
      prenom = COALESCE(?, prenom),
      email = COALESCE(?, email),
      adresse = COALESCE(?, adresse),
      code_postal = COALESCE(?, code_postal),
      ville = COALESCE(?, ville),
      pays = COALESCE(?, pays),
      taux_commission = COALESCE(?, taux_commission),
      is_nouveau = COALESCE(?, is_nouveau),
      actif = COALESCE(?, actif),
      role = COALESCE(?, role),
      taux_net_equipe = COALESCE(?, taux_net_equipe),
      taux_horaire = COALESCE(?, taux_horaire),
      couleur = COALESCE(?, couleur),
      photo = COALESCE(?, photo),
      telegram_user_id = COALESCE(?, telegram_user_id)
    WHERE id = ?
  `).run(
    prenom ?? null, email ?? null, adresse ?? null,
    code_postal ?? null, ville ?? null, pays ?? null,
    taux_commission ?? null,
    is_nouveau !== undefined ? (is_nouveau ? 1 : 0) : null,
    effectiveActif,
    role ?? null, taux_net_equipe ?? null, taux_horaire ?? null,
    couleur ?? null, photo ?? null,
    telegram_user_id ? String(telegram_user_id) : null,
    id
  );

  res.json({ message: 'Chatteur mis à jour' });
}));

// PUT /api/chatteurs/:id/account — admin manages chatteur's user account (email-based)
router.put('/:id/account', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { email, new_password, confirm_password } = req.body;

  if (!email || !email.trim()) {
    throw new ApiError(400, 'Email requis');
  }
  if (new_password && new_password !== confirm_password) {
    throw new ApiError(400, 'Les mots de passe ne correspondent pas');
  }
  if (new_password && new_password.length < 8) {
    throw new ApiError(400, 'Le mot de passe doit contenir au moins 8 caractères');
  }

  const chatteur = db.prepare('SELECT id, user_id, email, role FROM chatteurs WHERE id = ?').get(id);
  if (!chatteur) throw new ApiError(404, 'Chatteur introuvable');

  if (chatteur.user_id) {
    // Update existing user account
    const conflict = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.trim(), chatteur.user_id);
    if (conflict) throw new ApiError(409, 'Cet email est déjà utilisé');

    // Sync role from chatteur profile to user account
    const userRole = (chatteur.role === 'manager' || chatteur.role === 'directeur') ? 'manager' : 'chatteur';
    db.prepare('UPDATE users SET email = ?, username = ?, role = ? WHERE id = ?').run(email.trim(), email.trim(), userRole, chatteur.user_id);
    // Also sync email on the chatteur profile
    db.prepare('UPDATE chatteurs SET email = ? WHERE id = ?').run(email.trim(), id);

    if (new_password) {
      const hash = bcrypt.hashSync(new_password, 10);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, chatteur.user_id);
    }

    res.json({ message: new_password ? 'Compte et mot de passe mis à jour' : 'Email mis à jour' });
  } else {
    // Create new user account for this chatteur
    const conflict = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim());
    if (conflict) throw new ApiError(409, 'Cet email est déjà utilisé');

    const chatteurData = db.prepare('SELECT role, prenom FROM chatteurs WHERE id = ?').get(id);
    const userRole = (chatteurData?.role === 'manager' || chatteurData?.role === 'directeur') ? 'manager' : 'chatteur';

    if (new_password) {
      // Admin provides password directly
      if (new_password.length < 8) throw new ApiError(400, 'Le mot de passe doit contenir au moins 8 caractères');
      const hash = bcrypt.hashSync(new_password, 10);
      const userResult = db.prepare(
        'INSERT INTO users (username, password_hash, role, email) VALUES (?, ?, ?, ?)'
      ).run(email.trim(), hash, userRole, email.trim());
      db.prepare('UPDATE chatteurs SET user_id = ?, email = ? WHERE id = ?').run(userResult.lastInsertRowid, email.trim(), id);
      res.status(201).json({ message: 'Compte utilisateur créé et lié', user_id: userResult.lastInsertRowid });
    } else {
      // Invitation-based: create with pending hash, send email
      const userResult = db.prepare(
        'INSERT INTO users (username, password_hash, role, email) VALUES (?, ?, ?, ?)'
      ).run(email.trim(), PENDING_HASH, userRole, email.trim());
      db.prepare('UPDATE chatteurs SET user_id = ?, email = ? WHERE id = ?').run(userResult.lastInsertRowid, email.trim(), id);

      let invitation_sent = false;
      try {
        const token = crypto.randomBytes(32).toString('hex');
        db.prepare(
          'INSERT INTO invitation_tokens (user_id, token, expires_at) VALUES (?, ?, datetime(\'now\', \'+48 hours\'))'
        ).run(userResult.lastInsertRowid, token);
        await sendEmail(email.trim(), 'Bienvenue sur Imperium — Définissez votre mot de passe', buildInvitationEmail(chatteurData?.prenom || 'Chatteur', token));
        invitation_sent = true;
      } catch (err) {
        logger.error('Failed to send invitation email', { email: email.trim(), error: err.message });
      }

      res.status(201).json({ message: invitation_sent ? 'Compte créé et invitation envoyée' : 'Compte créé (email non envoyé)', user_id: userResult.lastInsertRowid, invitation_sent });
    }
  }
}));

// DELETE /api/chatteurs/:id (soft delete)
router.delete('/:id', authMiddleware, adminOrManager, asyncHandler((req, res) => {
  const { id } = req.params;

  // Directeur is protected — nobody can deactivate a directeur
  const target = db.prepare('SELECT role FROM chatteurs WHERE id = ?').get(id);
  if (target && target.role === 'directeur') {
    throw new ApiError(403, 'Le compte directeur ne peut pas être désactivé');
  }

  if (req.user.role === 'manager') {
    // Manager cannot deactivate themselves
    if (req.user.chatteur_id === parseInt(id)) {
      throw new ApiError(403, 'Vous ne pouvez pas vous désactiver vous-même');
    }
    // Manager cannot deactivate other managers (admin only)
    if (target && target.role === 'manager') {
      throw new ApiError(403, 'Seul un admin peut désactiver un manager');
    }
  }

  db.prepare("UPDATE chatteurs SET actif = 0 WHERE id = ?").run(id);
  res.json({ message: 'Chatteur désactivé' });
}));

// GET /api/chatteurs/:id/kpis
router.get('/:id/kpis', authMiddleware, asyncHandler((req, res) => {
  const { id } = req.params;
  if (req.user.role === 'chatteur' && req.user.chatteur_id !== parseInt(id, 10)) {
    throw new ApiError(403, 'Accès refusé');
  }

  const { periode_debut, periode_fin } = req.query;

  let dateFilter = '';
  const params = [id];
  if (periode_debut && periode_fin) {
    dateFilter = 'AND v.periode_debut >= ? AND v.periode_fin <= ?';
    params.push(periode_debut, periode_fin);
  }

  // Total ventes — convert everything to EUR
  const ventes = db.prepare(`
    SELECT
      SUM(v.montant_brut) as total_brut_raw,
      SUM(CASE WHEN p.devise != 'EUR' THEN v.montant_brut * COALESCE(tc.taux, 0.92) ELSE v.montant_brut END) as total_brut,
      COUNT(*) as nb_ventes,
      p.devise
    FROM ventes v
    JOIN plateformes p ON p.id = v.plateforme_id
    LEFT JOIN taux_change tc ON tc.devise_base = p.devise AND tc.devise_cible = 'EUR'
      AND tc.date_maj = (SELECT MAX(t2.date_maj) FROM taux_change t2 WHERE t2.devise_base = p.devise AND t2.devise_cible = 'EUR')
    WHERE v.chatteur_id = ? AND v.statut != 'rejetée' ${dateFilter}
    GROUP BY p.devise
  `).all(...params);

  // Paies récentes
  const paies = db.prepare(`
    SELECT * FROM paies
    WHERE chatteur_id = ?
    ORDER BY periode_debut DESC
    LIMIT 6
  `).all(id);

  // Rang par ventes brutes converties en EUR (dans la période ou tous temps)
  let rangQuery = `
    SELECT v.chatteur_id,
      SUM(CASE WHEN p.devise != 'EUR' THEN v.montant_brut * COALESCE(tc.taux, 0.92) ELSE v.montant_brut END) as total
    FROM ventes v
    JOIN plateformes p ON p.id = v.plateforme_id
    LEFT JOIN taux_change tc ON tc.devise_base = p.devise AND tc.devise_cible = 'EUR'
      AND tc.date_maj = (SELECT MAX(t2.date_maj) FROM taux_change t2 WHERE t2.devise_base = p.devise AND t2.devise_cible = 'EUR')
    WHERE v.statut != 'rejetée'
    ${periode_debut && periode_fin ? 'AND v.periode_debut >= ? AND v.periode_fin <= ?' : ''}
    GROUP BY v.chatteur_id
    ORDER BY total DESC
  `;
  const rangParams = periode_debut && periode_fin ? [periode_debut, periode_fin] : [];
  const classement = db.prepare(rangQuery).all(...rangParams);
  const rang = classement.findIndex(r => r.chatteur_id == id) + 1;

  // Malus (only active ones)
  const malusTotal = db.prepare(`
    SELECT COALESCE(SUM(montant), 0) as total FROM malus WHERE chatteur_id = ? AND actif != 0
    ${periode_debut && periode_fin ? 'AND periode >= ? AND periode <= ?' : ''}
  `).get(id, ...(periode_debut && periode_fin ? [periode_debut, periode_fin] : []));

  // Primes manuelles
  let primesTotal = 0;
  try {
    const primesRow = db.prepare(`
      SELECT COALESCE(SUM(montant), 0) as total FROM primes_manuelles
      WHERE chatteur_id = ? AND actif = 1
      ${periode_debut && periode_fin ? 'AND periode_debut >= ? AND periode_fin <= ?' : ''}
    `).get(id, ...(periode_debut && periode_fin ? [periode_debut, periode_fin] : []));
    primesTotal = primesRow?.total || 0;
  } catch { /* table may not exist yet */ }

  // Net HT total + prime totale depuis paies (inclut prime palier + collectif distribué)
  let netHtTotal = 0;
  let primeFromPaies = 0;
  if (periode_debut && periode_fin) {
    const paieAgg = db.prepare(`
      SELECT COALESCE(SUM(net_ht_eur), 0) as net_ht, COALESCE(SUM(prime), 0) as prime
      FROM paies WHERE chatteur_id = ? AND plateforme_id IS NOT NULL
        AND periode_debut >= ? AND periode_fin <= ?
    `).get(id, periode_debut, periode_fin);
    netHtTotal = paieAgg?.net_ht || 0;
    primeFromPaies = paieAgg?.prime || 0;
  }

  // Paliers primes pour la période
  let paliersPrimes = [];
  let palierAtteint = null;
  paliersPrimes = db.prepare(
    'SELECT * FROM paliers_primes WHERE actif = 1 ORDER BY seuil_net_ht ASC'
  ).all();
  // Find highest palier reached
  palierAtteint = [...paliersPrimes].reverse().find(p => netHtTotal >= p.seuil_net_ht) || null;

  // Moyenne par période (from paies)
  const moyenneRow = db.prepare(`
    SELECT AVG(sub.total) as moyenne FROM (
      SELECT SUM(total_chatteur) as total
      FROM paies WHERE chatteur_id = ? AND plateforme_id IS NOT NULL
      GROUP BY periode_debut, periode_fin
    ) sub
  `).get(id);
  const moyenne_par_periode = moyenneRow?.moyenne || 0;

  // Meilleure période
  const bestRow = db.prepare(`
    SELECT periode_debut, periode_fin, SUM(total_chatteur) as total
    FROM paies WHERE chatteur_id = ? AND plateforme_id IS NOT NULL
    GROUP BY periode_debut, periode_fin
    ORDER BY total DESC LIMIT 1
  `).get(id);

  // Nombre de shifts
  const shiftsRow = db.prepare(`
    SELECT COUNT(*) as nb FROM shifts WHERE chatteur_id = ?
    ${periode_debut && periode_fin ? 'AND date >= ? AND date <= ?' : ''}
  `).get(id, ...(periode_debut && periode_fin ? [periode_debut, periode_fin] : []));

  // Ventes par plateforme (for PieChart) — converted to EUR
  const ventesParPlateforme = db.prepare(`
    SELECT p.nom as plateforme,
      SUM(CASE WHEN p.devise != 'EUR' THEN v.montant_brut * COALESCE(tc.taux, 0.92) ELSE v.montant_brut END) as total_brut,
      COUNT(*) as nb_ventes
    FROM ventes v
    JOIN plateformes p ON p.id = v.plateforme_id
    LEFT JOIN taux_change tc ON tc.devise_base = p.devise AND tc.devise_cible = 'EUR'
      AND tc.date_maj = (SELECT MAX(t2.date_maj) FROM taux_change t2 WHERE t2.devise_base = p.devise AND t2.devise_cible = 'EUR')
    WHERE v.chatteur_id = ? AND v.statut != 'rejetée' ${dateFilter}
    GROUP BY v.plateforme_id
    ORDER BY total_brut DESC
  `).all(...params);

  // Commission totale
  const commissionRow = db.prepare(`
    SELECT COALESCE(SUM(commission_chatteur), 0) as total
    FROM paies WHERE chatteur_id = ?
    ${periode_debut && periode_fin ? 'AND periode_debut >= ? AND periode_fin <= ?' : ''}
  `).get(id, ...(periode_debut && periode_fin ? [periode_debut, periode_fin] : []));

  // Count only active chatteurs (exclude manager/directeur/va)
  const totalChatteurs = db.prepare("SELECT COUNT(*) as cnt FROM chatteurs WHERE actif = 1 AND role = 'chatteur'").get();

  res.json({
    ventes, paies, rang, nb_chatteurs: totalChatteurs.cnt,
    malus_total: malusTotal.total,
    primes_total: primesTotal,
    prime_from_paies: primeFromPaies,
    net_ht_total: netHtTotal,
    paliers_primes: paliersPrimes,
    palier_atteint: palierAtteint,
    moyenne_par_periode,
    meilleure_periode: bestRow || null,
    nb_shifts: shiftsRow?.nb || 0,
    ventes_par_plateforme: ventesParPlateforme,
    commission_totale: commissionRow?.total || 0,
  });
}));

// GET /api/chatteurs/:id/historique — performance history over last N periods
router.get('/:id/historique', authMiddleware, asyncHandler((req, res) => {
  const { id } = req.params;
  // Chatteur can only see their own
  if (req.user.role === 'chatteur' && req.user.chatteur_id !== parseInt(id, 10)) {
    throw new ApiError(403, 'Accès refusé');
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
      SUM(p.prime) as total_prime,
      'paie' as source
    FROM paies p
    WHERE p.chatteur_id = ?
    GROUP BY p.periode_debut, p.periode_fin
    ORDER BY p.periode_debut DESC
    LIMIT 12
  `).all(id);

  // Fallback: estimate from ventes for periods without paies
  const existingPeriods = new Set(historique.map(h => `${h.periode_debut}|${h.periode_fin}`));
  const tauxChange = getExchangeRate();
  const chatteur = db.prepare('SELECT taux_commission FROM chatteurs WHERE id = ?').get(id);
  const tauxComm = chatteur?.taux_commission ?? 0.10;

  const ventePeriods = db.prepare(`
    SELECT
      v.periode_debut, v.periode_fin,
      SUM(v.montant_brut) as total_brut,
      pl.devise, pl.tva_rate, pl.commission_rate
    FROM ventes v
    JOIN plateformes pl ON pl.id = v.plateforme_id
    WHERE v.chatteur_id = ? AND v.statut != 'rejetée'
    GROUP BY v.periode_debut, v.periode_fin, pl.id
    ORDER BY v.periode_debut DESC
  `).all(id);

  // Group by period
  const periodEstimates = {};
  for (const vp of ventePeriods) {
    const key = `${vp.periode_debut}|${vp.periode_fin}`;
    if (existingPeriods.has(key)) continue;
    if (!periodEstimates[key]) {
      periodEstimates[key] = {
        periode_debut: vp.periode_debut, periode_fin: vp.periode_fin,
        total_brut: 0, total_ttc_eur: 0, total_net_ht: 0,
        total_commission: 0, total_paie: 0, total_malus: 0, total_prime: 0,
        source: 'estimation',
      };
    }
    const pe = periodEstimates[key];
    const brut = vp.total_brut || 0;
    const tva = vp.tva_rate ?? 0.2;
    const comm = vp.commission_rate ?? 0.2;
    const ttcEur = vp.devise === 'USD' ? brut * tauxChange : brut;
    const htEur = ttcEur / (1 + tva);
    const netHT = htEur * (1 - comm);
    const commission = netHT * tauxComm;
    pe.total_brut += brut;
    pe.total_ttc_eur += ttcEur;
    pe.total_net_ht += netHT;
    pe.total_commission += commission;
    pe.total_paie += commission;
  }

  const result = [...historique, ...Object.values(periodEstimates)]
    .sort((a, b) => a.periode_debut.localeCompare(b.periode_debut))
    .slice(-12);

  // Round values
  for (const r of result) {
    r.total_brut = Math.round((r.total_brut || 0) * 100) / 100;
    r.total_ttc_eur = Math.round((r.total_ttc_eur || 0) * 100) / 100;
    r.total_net_ht = Math.round((r.total_net_ht || 0) * 100) / 100;
    r.total_commission = Math.round((r.total_commission || 0) * 100) / 100;
    r.total_paie = Math.round((r.total_paie || 0) * 100) / 100;
  }

  res.json(result);
}));

module.exports = router;
