const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiants requis' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
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
      username: user.username,
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
      username: user.username,
      role: user.role,
      email: user.email,
      chatteur_id: chatteur?.id || null
    }
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, role, email, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  let chatteur = null;
  if (user.role === 'chatteur') {
    chatteur = db.prepare('SELECT * FROM chatteurs WHERE user_id = ?').get(user.id);
  }

  res.json({ ...user, chatteur });
});

// POST /api/auth/register (admin only — create chatteur user)
router.post('/register', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès refusé' });

  const { username, password, email, role = 'chatteur' } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username et password requis' });
  if (password.length < 8) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères' });

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'Nom d\'utilisateur déjà pris' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password_hash, role, email) VALUES (?, ?, ?, ?)').run(
    username, hash, role, email || null
  );

  res.status(201).json({ id: result.lastInsertRowid, username, role, email });
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

module.exports = router;
