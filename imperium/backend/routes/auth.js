const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { authMiddleware, signToken } = require('../middleware/auth');
const { validatePassword, validateEmail, validatePhoto } = require('../utils/validation');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const router = express.Router();

// POST /api/auth/login — login by email
router.post('/login', asyncHandler((req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, 'Email et mot de passe requis');
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) throw new ApiError(401, 'Identifiants incorrects');

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) throw new ApiError(401, 'Identifiants incorrects');

  // If chatteur, get their chatteur profile
  let chatteur = null;
  if (user.role === 'chatteur' || user.role === 'manager') {
    chatteur = db.prepare('SELECT * FROM chatteurs WHERE user_id = ?').get(user.id);
  }

  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    chatteur_id: chatteur?.id || null
  });

  // Set httpOnly cookie
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24h
  });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      prenom: user.prenom || chatteur?.prenom || null,
      chatteur_id: chatteur?.id || null,
      photo: user.photo || null
    }
  });
}));

// POST /api/auth/logout — clear auth cookie
router.post('/logout', asyncHandler((req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'strict' });
  res.json({ message: 'Déconnexion réussie' });
}));

// GET /api/auth/me
router.get('/me', authMiddleware, asyncHandler((req, res) => {
  const user = db.prepare('SELECT id, username, role, email, prenom, photo, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) throw new ApiError(404, 'Utilisateur introuvable');

  let chatteur = null;
  if (user.role === 'chatteur' || user.role === 'manager') {
    chatteur = db.prepare('SELECT * FROM chatteurs WHERE user_id = ?').get(user.id);
  }

  res.json({ ...user, chatteur });
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

module.exports = router;
