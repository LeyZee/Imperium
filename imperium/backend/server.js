require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('./database'); // init DB on startup

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

// Body parsing
app.use((req, res, next) => {
  express.json()(req, res, (err) => {
    if (err) return res.status(400).json({ error: 'JSON invalide' });
    next();
  });
});

// Rate limit on login
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives, réessayez dans 1 minute.' }
});
app.use('/api/auth/login', loginLimiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/chatteurs', require('./routes/chatteurs'));
app.use('/api/modeles', require('./routes/modeles'));
app.use('/api/plateformes', require('./routes/plateformes'));
app.use('/api/ventes', require('./routes/ventes'));
app.use('/api/paies', require('./routes/paies'));
app.use('/api/shifts', require('./routes/planning'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/taux', require('./routes/taux'));
app.use('/api/malus', require('./routes/malus'));
app.use('/api/telegram', require('./routes/telegram'));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

app.listen(PORT, () => {
  console.log(`🏛️  Imperium API démarrée sur http://localhost:${PORT}`);
});
