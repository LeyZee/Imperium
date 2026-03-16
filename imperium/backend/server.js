const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
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

// Auto-backup DB on startup (keep last 3 backups)
const fs = require('fs');
try {
  const dbPath = path.join(__dirname, 'imperium.db');
  if (fs.existsSync(dbPath)) {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = path.join(backupDir, `imperium-${timestamp}.db`);
    fs.copyFileSync(dbPath, backupPath);
    logger.info(`DB backup created: ${backupPath}`);
    // Keep only last 3 backups
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('imperium-') && f.endsWith('.db'))
      .sort()
      .reverse();
    for (const old of backups.slice(3)) {
      fs.unlinkSync(path.join(backupDir, old));
      logger.info(`Old backup removed: ${old}`);
    }
  }
} catch (e) {
  logger.warn('DB backup failed', { error: e.message });
}

const app = express();

// Trust proxy (Nginx) for correct IP in rate limiters
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
const PORT = process.env.PORT || 3001;

// Security headers with CSP + HSTS
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://flagcdn.com"],
      connectSrc: ["'self'", process.env.CORS_ORIGIN].filter(Boolean),
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));

// Gzip/Brotli compression for all responses
app.use(compression());

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

// Rate limit on invitation/setup-password endpoints
const inviteLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: 'Trop de requêtes, réessayez dans 1 minute.' } });
app.use('/api/auth/invite', inviteLimiter);
app.use('/api/auth/setup-password', inviteLimiter);
app.use('/api/auth/change-email', inviteLimiter);

// Stricter rate limits on CPU-intensive endpoints
const pdfLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: 'Trop de requêtes PDF, réessayez dans 1 minute.' } });
app.use('/api/paies/facture', pdfLimiter);
const zipLimiter = rateLimit({ windowMs: 60 * 1000, max: 3, message: { error: 'Trop de requêtes ZIP, réessayez dans 1 minute.' } });
app.use('/api/paies/factures-zip', zipLimiter);
const exportLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: 'Trop de requêtes export, réessayez dans 1 minute.' } });
app.use('/api/ventes/export', exportLimiter);

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

// Health check with exchange rate and DB status
app.get('/health', (req, res) => {
  const warnings = [];
  try {
    const db = require('./database');
    db.prepare('SELECT 1').get();

    // Check exchange rate
    const { getExchangeRate } = require('./utils/rateCache');
    const rate = getExchangeRate();
    if (!rate || rate <= 0 || rate === 0.92) {
      warnings.push(`Exchange rate fallback active (${rate}) — vérifier frankfurter.app`);
    }

    // Check for negative paies
    const negPaies = db.prepare("SELECT COUNT(*) as c FROM paies WHERE total_chatteur < 0").get();
    if (negPaies?.c > 0) {
      warnings.push(`${negPaies.c} paie(s) avec total négatif détectée(s)`);
    }

    res.json({
      status: warnings.length > 0 ? 'degraded' : 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      exchange_rate: rate,
      warnings,
    });
  } catch (err) {
    res.status(503).json({ status: 'error', error: 'Database unavailable', message: err.message });
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
app.use('/api/contact', require('./routes/contact'));

// 404 handler for unknown API routes (must be AFTER all route registrations)
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

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

// Safety net for uncaught exceptions — log and let PM2 restart
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception — shutting down', { message: err.message, stack: err.stack });
  process.exit(1);
});

const server = app.listen(PORT, () => {
  logger.info(`Imperium API démarrée sur http://localhost:${PORT}`);

  // Auto-refresh exchange rate on startup + every 6 hours
  const { refreshExchangeRate } = require('./utils/rateCache');
  refreshExchangeRate().catch(err => {
    logger.warn('Exchange rate refresh on startup failed', { error: err.message });
  });
  setInterval(() => {
    refreshExchangeRate().catch(err => {
      logger.warn('Exchange rate periodic refresh failed', { error: err.message });
    });
  }, 6 * 60 * 60 * 1000); // 6 hours

  // Start Telegram polling bot after a short delay (let HTTP server be ready first)
  setTimeout(() => {
    const telegramPoller = require('./services/telegram-poller');
    telegramPoller.start().catch(err => {
      logger.error('Telegram bot failed to start', { error: err.message });
    });
  }, 2000);

  // Post-shift notifications + pay day reminders + shift reminders
  const { checkPostShiftNotifications, checkPayDayReminder, checkShiftReminders } = require('./services/post-shift-checker');
  setInterval(() => {
    checkPostShiftNotifications();
    checkPayDayReminder();
    checkShiftReminders();
  }, 30 * 60 * 1000); // 30 min
  // Run once on startup after a short delay
  setTimeout(() => {
    checkPostShiftNotifications();
    checkPayDayReminder();
    checkShiftReminders();
  }, 10000);
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
