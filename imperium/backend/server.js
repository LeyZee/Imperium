const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');

// Validate required environment variables
const REQUIRED_ENV = ['JWT_SECRET'];
const missing = REQUIRED_ENV.filter(key => !process.env[key]);
if (missing.length > 0) {
  logger.error(`Missing required environment variables: ${missing.join(', ')}`);
  logger.error('Create a backend/.env file with the required variables');
  process.exit(1);
}

require('./database'); // init DB on startup

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers with CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://flagcdn.com"],
      connectSrc: ["'self'"],
    }
  }
}));

// Cookie parser
app.use(cookieParser());

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

// CSRF protection — require X-Requested-With header on state-changing requests
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    // Allow Telegram webhook (uses its own auth) and health endpoint
    if (req.path.startsWith('/telegram/report')) return next();
    const xrw = req.headers['x-requested-with'];
    if (!xrw || xrw !== 'XMLHttpRequest') {
      return res.status(403).json({ error: 'Requête non autorisée (en-tête CSRF manquant)' });
    }
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  try {
    const db = require('./database');
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', error: 'Database unavailable' });
  }
});

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
app.use('/api/activity-logs', require('./routes/activity-logs'));
app.use('/api/primes', require('./routes/primes'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/annonces', require('./routes/annonces'));
app.use('/api/demandes', require('./routes/demandes'));
app.use('/api/objectifs', require('./routes/objectifs'));
app.use('/api/notifications', require('./routes/notifications'));

// Global error handler (catches errors passed via next(err))
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const response = {
    error: err.message || 'Erreur interne du serveur',
    ...(err.details && { details: err.details }),
    ...(process.env.NODE_ENV === 'development' && status >= 500 && { stack: err.stack }),
  };
  if (status >= 500) logger.error('Server error', { message: err.message, stack: err.stack?.split('\n')[1]?.trim() });
  if (!res.headersSent) res.status(status).json(response);
});

// Safety net for uncaught sync exceptions in route handlers (node-sqlite3-wasm)
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { message: err.message });
  // Don't exit — keep serving. Log for monitoring.
});

const server = app.listen(PORT, () => {
  logger.info(`Imperium API démarrée sur http://localhost:${PORT}`);

  // Start Telegram polling bot
  const telegramPoller = require('./services/telegram-poller');
  telegramPoller.start().catch(err => {
    logger.error('Telegram bot failed to start', { error: err.message });
  });
});

// Graceful shutdown
function gracefulShutdown(signal) {
  logger.info(`${signal} received. Shutting down gracefully...`);
  try { require('./services/telegram-poller').stop(); } catch {}
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
