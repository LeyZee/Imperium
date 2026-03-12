/**
 * Frontend validation utilities — mirrors backend/utils/validation.js
 */

export function validateEmail(email) {
  if (!email || !email.trim()) return 'Email requis';
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return 'Format email invalide';
  return null;
}

export function validateRequired(value, fieldName) {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
    return `${fieldName} requis`;
  }
  return null;
}

export function validatePassword(password) {
  if (!password) return 'Mot de passe requis';
  if (password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères';
  if (!/[A-Z]/.test(password)) return 'Le mot de passe doit contenir au moins une majuscule';
  if (!/[0-9]/.test(password)) return 'Le mot de passe doit contenir au moins un chiffre';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Le mot de passe doit contenir au moins un caractère spécial';
  return null;
}

export function validatePositiveNumber(value, fieldName) {
  const num = Number(value);
  if (isNaN(num) || num < 0) return `${fieldName} doit être un nombre positif`;
  return null;
}
