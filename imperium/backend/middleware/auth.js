const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

if (!process.env.JWT_SECRET) {
  logger.error('FATAL: JWT_SECRET non défini dans les variables d\'environnement');
  logger.error('Créez un fichier backend/.env avec : JWT_SECRET=votre-secret-ici');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  // Priority: httpOnly cookie > Authorization header (backward compat)
  let token = req.cookies?.token;

  if (!token) {
    const authHeader = req.headers['authorization'];
    if (authHeader) token = authHeader.split(' ')[1];
  }

  if (!token) throw new ApiError(401, 'Token manquant');

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    throw new ApiError(401, 'Token invalide ou expiré');
  }
}

function isAdminRole(role) {
  return role === 'admin'; // users.role — directeur is tracked in chatteurs.role, admin users always have 'admin' in users table
}

function adminOnly(req, res, next) {
  if (!isAdminRole(req.user.role)) {
    throw new ApiError(403, 'Accès réservé aux administrateurs');
  }
  next();
}

function adminOrManager(req, res, next) {
  if (!isAdminRole(req.user.role) && req.user.role !== 'manager') {
    throw new ApiError(403, 'Accès réservé aux administrateurs et managers');
  }
  next();
}

function directeurOnly(req, res, next) {
  if (req.user.role !== 'admin' || req.user.chatteur_role !== 'directeur') {
    throw new ApiError(403, 'Accès réservé au directeur');
  }
  next();
}

/**
 * Sign a JWT token. Centralizes token creation so JWT_SECRET stays private.
 */
function signToken(payload, options = {}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h', ...options });
}

module.exports = { authMiddleware, adminOnly, adminOrManager, directeurOnly, signToken };
