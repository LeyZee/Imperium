const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET non défini dans les variables d\'environnement');
  console.error('   Créez un fichier backend/.env avec : JWT_SECRET=votre-secret-ici');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Token manquant' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
}

module.exports = { authMiddleware, adminOnly, JWT_SECRET };
