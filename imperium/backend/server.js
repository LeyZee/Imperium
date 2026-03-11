const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('./database'); // init DB on startup

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers
app.use(helmet());

// CORS (configurable via env for production)
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Body parsing with size limit (base64 photos up to 3MB)
app.use((req, res, next) => {
  express.json({ limit: '3mb' })(req, res, (err) => {
    if (err) return res.status(400).json({ error: 'JSON invalide ou payload trop volumineux' });
    next();
  });
});

// Global rate limiter (100 req/min per IP)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Trop de requêtes, réessayez dans 1 minute.' }
});
app.use('/api', globalLimiter);

// Stricter rate limit on login
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
app.use('/api/facturation-modeles', require('./routes/facturation-modeles'));

// Global error handler (catches errors passed via next(err))
app.use((err, req, res, next) => {
  console.error('Route error:', err.message);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// Safety net for uncaught sync exceptions in route handlers (node-sqlite3-wasm)
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
  // Don't exit — keep serving. Log for monitoring.
});

app.listen(PORT, () => {
  console.log(`🏛️  Imperium API démarrée sur http://localhost:${PORT}`);

  // Start Telegram polling bot
  const telegramPoller = require('./services/telegram-poller');
  telegramPoller.start().catch(err => {
    console.error('❌ Telegram bot failed to start:', err.message);
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  try { require('./services/telegram-poller').stop(); } catch {}
  process.exit(0);
});
