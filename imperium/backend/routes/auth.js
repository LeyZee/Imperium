const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { authMiddleware, adminOrManager, signToken } = require('../middleware/auth');
const { validatePassword, validateEmail, validatePhoto } = require('../utils/validation');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { sendEmail, buildInvitationEmail, buildEmailVerificationEmail } = require('../utils/email');

const PENDING_HASH = '!PENDING_INVITATION!';

const router = express.Router();

// --- Brute force protection: account lockout after 5 failed attempts (DB-persisted) ---
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

function checkLockout(email) {
  const entry = db.prepare('SELECT attempts, locked_until FROM login_lockouts WHERE username = ?').get(email);
  if (!entry) return;
  if (entry.locked_until && new Date(entry.locked_until).getTime() > Date.now()) {
    const minutes = Math.ceil((new Date(entry.locked_until).getTime() - Date.now()) / 60000);
    throw new ApiError(429, `Compte verrouillé. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`);
  }
  if (entry.locked_until && new Date(entry.locked_until).getTime() <= Date.now()) {
    db.prepare('DELETE FROM login_lockouts WHERE username = ?').run(email);
  }
}

function recordFailedAttempt(email) {
  const entry = db.prepare('SELECT attempts FROM login_lockouts WHERE username = ?').get(email);
  const newCount = (entry?.attempts ?? 0) + 1;
  const lockedUntil = newCount >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_DURATION).toISOString() : null;
  db.prepare('INSERT OR REPLACE INTO login_lockouts (username, attempts, locked_until) VALUES (?, ?, ?)').run(email, newCount, lockedUntil ?? null);
  if (newCount >= MAX_ATTEMPTS) {
    logger.warn('Account locked due to failed attempts', { email, attempts: newCount });
  }
}

function resetAttempts(email) {
  db.prepare('DELETE FROM login_lockouts WHERE username = ?').run(email);
}

// POST /api/auth/login — login by email
router.post('/login', asyncHandler((req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, 'Email et mot de passe requis');
  }

  // Check lockout before any DB query
  checkLockout(email);

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    recordFailedAttempt(email);
    throw new ApiError(401, 'Identifiants incorrects');
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    recordFailedAttempt(email);
    throw new ApiError(401, 'Identifiants incorrects');
  }

  // Success — reset attempts
  resetAttempts(email);

  // Get chatteur profile if linked
  const chatteur = db.prepare('SELECT * FROM chatteurs WHERE user_id = ?').get(user.id);

  // Get modele profile if linked
  const modele = db.prepare('SELECT * FROM modeles WHERE user_id = ?').get(user.id);

  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    chatteur_id: chatteur?.id || null,
    chatteur_role: chatteur?.role || null,
    modele_id: modele?.id || null,
  });

  // Set httpOnly cookie
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24h
  });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      prenom: user.prenom || chatteur?.prenom || modele?.pseudo || null,
      chatteur_id: chatteur?.id || null,
      photo: user.photo || modele?.photo || null,
      couleur: chatteur?.couleur ?? null,
      chatteur_role: chatteur?.role || null,
      modele_id: modele?.id || null,
    }
  });
}));

// POST /api/auth/logout — clear auth cookie
router.post('/logout', asyncHandler((req, res) => {
  res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict' });
  res.json({ message: 'Déconnexion réussie' });
}));

// GET /api/auth/me
router.get('/me', authMiddleware, asyncHandler((req, res) => {
  const user = db.prepare('SELECT id, username, role, email, prenom, photo, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) throw new ApiError(404, 'Utilisateur introuvable');

  const chatteur = db.prepare('SELECT * FROM chatteurs WHERE user_id = ?').get(user.id) || null;
  const modele = db.prepare('SELECT * FROM modeles WHERE user_id = ?').get(user.id) || null;

  // Refresh JWT cookie if modele_id or chatteur_role is missing (token issued before migration)
  if ((chatteur && !req.user.chatteur_role) || (modele && !req.user.modele_id)) {
    const freshToken = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      chatteur_id: chatteur?.id || null,
      chatteur_role: chatteur?.role || null,
      modele_id: modele?.id || null,
    });
    res.cookie('token', freshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      prenom: user.prenom || chatteur?.prenom || modele?.pseudo || null,
      chatteur_id: chatteur?.id || null,
      photo: user.photo || modele?.photo || null,
      couleur: chatteur?.couleur ?? null,
      chatteur_role: chatteur?.role || null,
      modele_id: modele?.id || null,
    }
  });
}));

// POST /api/auth/register (admin only — create user)
router.post('/register', authMiddleware, asyncHandler((req, res) => {
  if (req.user.role !== 'admin') throw new ApiError(403, 'Accès refusé');

  const { email, password, role = 'chatteur' } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email et mot de passe requis');
  if (!['admin', 'chatteur', 'manager'].includes(role)) throw new ApiError(400, 'Rôle invalide');

  const emailErr = validateEmail(email);
  if (emailErr) throw new ApiError(400, emailErr);

  const pwdErr = validatePassword(password);
  if (pwdErr) throw new ApiError(400, pwdErr);

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) throw new ApiError(409, 'Cet email est déjà utilisé');

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password_hash, role, email) VALUES (?, ?, ?, ?)').run(
    email, hash, role, email
  );

  res.status(201).json({ id: result.lastInsertRowid, email, role });
}));

// PUT /api/auth/password — change password
router.put('/password', authMiddleware, asyncHandler((req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) throw new ApiError(400, 'Champs requis');

  const pwdErr = validatePassword(new_password);
  if (pwdErr) throw new ApiError(400, pwdErr);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const valid = bcrypt.compareSync(current_password, user.password_hash);
  if (!valid) throw new ApiError(401, 'Mot de passe actuel incorrect');

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ message: 'Mot de passe mis à jour' });
}));

// PUT /api/auth/profile — update admin profile (email, prenom, photo, password)
router.put('/profile', authMiddleware, asyncHandler((req, res) => {
  const { email, prenom, photo, current_password, new_password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) throw new ApiError(404, 'Utilisateur introuvable');

  // Validate photo if provided
  if (photo !== undefined && photo !== null) {
    const photoErr = validatePhoto(photo);
    if (photoErr) throw new ApiError(400, photoErr);
  }

  // Update email (also update username for backward compat)
  if (email && email !== user.email) {
    // Non-admin users must use the verified email change flow
    if (user.role !== 'admin') {
      throw new ApiError(400, 'Utilise le formulaire de changement d\'email depuis ton profil');
    }
    const emailErr = validateEmail(email);
    if (emailErr) throw new ApiError(400, emailErr);
    const conflict = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user.id);
    if (conflict) throw new ApiError(409, 'Cet email est déjà utilisé');
    db.prepare('UPDATE users SET email = ?, username = ? WHERE id = ?').run(email, email, req.user.id);
  }

  if (prenom !== undefined) {
    db.prepare('UPDATE users SET prenom = ? WHERE id = ?').run(prenom ?? null, req.user.id);
  }

  if (photo !== undefined) {
    db.prepare('UPDATE users SET photo = ? WHERE id = ?').run(photo ?? null, req.user.id);
  }

  if (new_password) {
    if (!current_password) throw new ApiError(400, 'Mot de passe actuel requis');
    const valid = bcrypt.compareSync(current_password, user.password_hash);
    if (!valid) throw new ApiError(401, 'Mot de passe actuel incorrect');
    const pwdErr = validatePassword(new_password);
    if (pwdErr) throw new ApiError(400, pwdErr);
    const hash = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  }

  const updated = db.prepare('SELECT id, email, role, prenom, photo FROM users WHERE id = ?').get(req.user.id);
  res.json(updated);
}));

// ─── Invitation system ───

// POST /api/auth/invite — send/resend invitation email (admin/manager only)
router.post('/invite', authMiddleware, adminOrManager, asyncHandler(async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) throw new ApiError(400, 'user_id requis');

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
  if (!user) throw new ApiError(404, 'Utilisateur introuvable');

  const chatteur = db.prepare('SELECT prenom FROM chatteurs WHERE user_id = ?').get(user_id);
  if (!chatteur) throw new ApiError(404, 'Chatteur introuvable');

  if (user.password_hash !== PENDING_HASH) {
    throw new ApiError(400, 'Ce compte a déjà un mot de passe défini');
  }

  // Invalidate previous tokens
  db.prepare('UPDATE invitation_tokens SET used_at = datetime(\'now\') WHERE user_id = ? AND used_at IS NULL').run(user_id);

  // Generate new token
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(
    'INSERT INTO invitation_tokens (user_id, token, expires_at) VALUES (?, ?, datetime(\'now\', \'+48 hours\'))'
  ).run(user_id, token);

  await sendEmail(user.email, 'Bienvenue sur Imperium — Définissez votre mot de passe', buildInvitationEmail(chatteur.prenom, token));

  res.json({ message: 'Invitation envoyée' });
}));

// GET /api/auth/setup-password/:token — validate invitation token
router.get('/setup-password/:token', asyncHandler((req, res) => {
  const { token } = req.params;

  const row = db.prepare(`
    SELECT it.*, u.email, c.prenom
    FROM invitation_tokens it
    JOIN users u ON u.id = it.user_id
    LEFT JOIN chatteurs c ON c.user_id = it.user_id
    WHERE it.token = ?
  `).get(token);

  if (!row) return res.json({ valid: false, reason: 'invalid' });
  if (row.used_at) return res.json({ valid: false, reason: 'used' });
  if (new Date(row.expires_at + 'Z') < new Date()) return res.json({ valid: false, reason: 'expired' });

  res.json({ valid: true, email: row.email, prenom: row.prenom });
}));

// POST /api/auth/setup-password/:token — set password and auto-login
router.post('/setup-password/:token', asyncHandler((req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  if (!password) throw new ApiError(400, 'Mot de passe requis');

  const pwdErr = validatePassword(password);
  if (pwdErr) throw new ApiError(400, pwdErr);

  const row = db.prepare(`
    SELECT it.*, u.email, u.role as user_role, c.id as chatteur_id, c.prenom
    FROM invitation_tokens it
    JOIN users u ON u.id = it.user_id
    LEFT JOIN chatteurs c ON c.user_id = it.user_id
    WHERE it.token = ?
  `).get(token);

  if (!row) throw new ApiError(400, 'Lien invalide');
  if (row.used_at) throw new ApiError(400, 'Ce lien a déjà été utilisé');
  if (new Date(row.expires_at + 'Z') < new Date()) throw new ApiError(400, 'Ce lien a expiré. Demandez un nouveau lien à votre administrateur.');

  // Set password
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, row.user_id);

  // Mark token as used
  db.prepare('UPDATE invitation_tokens SET used_at = datetime(\'now\') WHERE id = ?').run(row.id);

  // Get chatteur role for JWT
  const chatteur = row.chatteur_id ? db.prepare('SELECT role FROM chatteurs WHERE id = ?').get(row.chatteur_id) : null;

  // Auto-login
  const jwtToken = signToken({
    id: row.user_id,
    email: row.email,
    role: row.user_role,
    chatteur_id: row.chatteur_id || null,
    chatteur_role: chatteur?.role || null,
  });

  res.cookie('token', jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.json({
    user: {
      id: row.user_id,
      email: row.email,
      role: row.user_role,
      prenom: row.prenom || null,
      chatteur_id: row.chatteur_id || null,
      photo: null,
      chatteur_role: chatteur?.role || null,
    },
  });
}));

// ─── Email change verification ───

// POST /api/auth/change-email — request email change (sends verification)
router.post('/change-email', authMiddleware, asyncHandler(async (req, res) => {
  const { new_email } = req.body;
  if (!new_email) throw new ApiError(400, 'Nouvel email requis');

  const emailErr = validateEmail(new_email);
  if (emailErr) throw new ApiError(400, emailErr);

  // Check uniqueness
  const conflictUser = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(new_email, req.user.id);
  if (conflictUser) throw new ApiError(409, 'Cet email est déjà utilisé');
  const conflictChatteur = db.prepare('SELECT id FROM chatteurs WHERE email = ? AND user_id != ?').get(new_email, req.user.id);
  if (conflictChatteur) throw new ApiError(409, 'Cet email est déjà utilisé');

  // Invalidate previous verifications
  db.prepare('UPDATE email_verifications SET used_at = datetime(\'now\') WHERE user_id = ? AND used_at IS NULL').run(req.user.id);

  // Generate token
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(
    'INSERT INTO email_verifications (user_id, new_email, token, expires_at) VALUES (?, ?, ?, datetime(\'now\', \'+24 hours\'))'
  ).run(req.user.id, new_email, token);

  const chatteur = db.prepare('SELECT prenom FROM chatteurs WHERE user_id = ?').get(req.user.id);
  await sendEmail(new_email, 'Imperium — Confirme ton nouvel email', buildEmailVerificationEmail(chatteur?.prenom || 'Utilisateur', token));

  res.json({ message: 'Email de vérification envoyé' });
}));

// GET /api/auth/verify-email/:token — confirm email change
router.get('/verify-email/:token', asyncHandler((req, res) => {
  const { token } = req.params;

  const row = db.prepare(`
    SELECT ev.*, u.email as current_email
    FROM email_verifications ev
    JOIN users u ON u.id = ev.user_id
    WHERE ev.token = ?
  `).get(token);

  if (!row) return res.json({ success: false, reason: 'invalid' });
  if (row.used_at) return res.json({ success: false, reason: 'used' });
  if (new Date(row.expires_at + 'Z') < new Date()) return res.json({ success: false, reason: 'expired' });

  // Re-check uniqueness (race condition)
  const conflict = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(row.new_email, row.user_id);
  if (conflict) return res.json({ success: false, reason: 'conflict' });

  // Update email everywhere
  db.prepare('UPDATE users SET email = ?, username = ? WHERE id = ?').run(row.new_email, row.new_email, row.user_id);
  db.prepare('UPDATE chatteurs SET email = ? WHERE user_id = ?').run(row.new_email, row.user_id);

  // Mark token used
  db.prepare('UPDATE email_verifications SET used_at = datetime(\'now\') WHERE id = ?').run(row.id);

  res.json({ success: true, new_email: row.new_email });
}));

module.exports = router;
