const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login — login by email
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'Identifiants incorrects' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' });

  // If chatteur, get their chatteur profile
  let chatteur = null;
  if (user.role === 'chatteur') {
    chatteur = db.prepare('SELECT * FROM chatteurs WHERE user_id = ?').get(user.id);
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      chatteur_id: chatteur?.id || null
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      prenom: user.prenom || chatteur?.prenom || null,
      chatteur_id: chatteur?.id || null,
      photo: user.photo || null
    }
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, role, email, prenom, photo, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  let chatteur = null;
  if (user.role === 'chatteur') {
    chatteur = db.prepare('SELECT * FROM chatteurs WHERE user_id = ?').get(user.id);
  }

  res.json({ ...user, chatteur });
});

// POST /api/auth/register (admin only — create user)
router.post('/register', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });

  const { email, password, role = 'chatteur' } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
  if (!['admin', 'chatteur'].includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
  if (password.length < 8) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password_hash, role, email) VALUES (?, ?, ?, ?)').run(
    email, hash, role, email
  );

  res.status(201).json({ id: result.lastInsertRowid, email, role });
});

// PUT /api/auth/password — change password
router.put('/password', authMiddleware, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Champs requis' });
  if (new_password.length < 8) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const valid = bcrypt.compareSync(current_password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ message: 'Mot de passe mis à jour' });
});

// PUT /api/auth/profile — update admin profile (email, prenom, photo, password)
router.put('/profile', authMiddleware, (req, res) => {
  const { email, prenom, photo, current_password, new_password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  // Update email (also update username for backward compat)
  if (email && email !== user.email) {
    const conflict = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user.id);
    if (conflict) return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    db.prepare('UPDATE users SET email = ?, username = ? WHERE id = ?').run(email, email, req.user.id);
  }

  if (prenom !== undefined) {
    db.prepare('UPDATE users SET prenom = ? WHERE id = ?').run(prenom ?? null, req.user.id);
  }

  if (photo !== undefined) {
    db.prepare('UPDATE users SET photo = ? WHERE id = ?').run(photo ?? null, req.user.id);
  }

  if (new_password) {
    if (!current_password) return res.status(400).json({ error: 'Mot de passe actuel requis' });
    const valid = bcrypt.compareSync(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    if (new_password.length < 8) return res.status(400).json({ error: 'Minimum 8 caractères' });
    const hash = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  }

  const updated = db.prepare('SELECT id, email, role, prenom, photo FROM users WHERE id = ?').get(req.user.id);
  res.json(updated);
});

module.exports = router;
