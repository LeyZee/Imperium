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

export function validateDate(dateStr) {
  if (!dateStr) return 'Date requise';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'Format de date invalide (YYYY-MM-DD)';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return 'Date invalide';
  return null;
}

export function validateDateRange(debut, fin) {
  const errDebut = validateDate(debut);
  if (errDebut) return errDebut;
  const errFin = validateDate(fin);
  if (errFin) return errFin;
  if (new Date(fin) <= new Date(debut)) return 'La date de fin doit être après la date de début';
  return null;
}
