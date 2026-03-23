/**
 * Centralized validation utilities for Imperium backend.
 */

function validatePassword(password) {
  if (!password || password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères';
  if (!/[A-Z]/.test(password)) return 'Le mot de passe doit contenir au moins une majuscule';
  if (!/[0-9]/.test(password)) return 'Le mot de passe doit contenir au moins un chiffre';
  if (!/[^a-zA-Z0-9]/.test(password)) return 'Le mot de passe doit contenir au moins un caractère spécial';
  return null;
}

function validateEmail(email) {
  if (!email || typeof email !== 'string') return 'Email requis';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Format email invalide';
  return null;
}

function validatePhoto(photo) {
  if (!photo) return null;
  if (typeof photo !== 'string') return 'Format photo invalide';
  const match = photo.match(/^data:image\/(jpeg|png|gif|webp);base64,/);
  if (!match) return 'Format photo invalide (JPEG, PNG, GIF, WebP uniquement)';
  const sizeBytes = (photo.length * 3) / 4;
  if (sizeBytes > 2 * 1024 * 1024) return 'Photo trop lourde (max 2 Mo)';
  return null;
}

function validateDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return 'Date requise';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'Format date invalide (YYYY-MM-DD attendu)';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return 'Date invalide';
  return null;
}

function validatePositiveNumber(value, fieldName) {
  const n = parseFloat(value);
  if (isNaN(n) || n < 0) return `${fieldName} doit être un nombre positif`;
  return null;
}

module.exports = { validatePassword, validateEmail, validatePhoto, validateDate, validatePositiveNumber };
