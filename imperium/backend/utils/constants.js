/**
 * Centralized constants for Imperium backend.
 */

const TIMEZONES = ['Europe/Paris', 'Africa/Porto-Novo', 'Indian/Antananarivo'];

const CRENEAUX = {
  1: { label: '08h-14h', start: '08:00', end: '14:00' },
  2: { label: '14h-20h', start: '14:00', end: '20:00' },
  3: { label: '20h-02h', start: '20:00', end: '02:00' },
  4: { label: '02h-08h', start: '02:00', end: '08:00' },
};

const ROLES = ['admin', 'chatteur'];
const CHATTEUR_ROLES = ['chatteur', 'manager', 'directeur', 'va'];
const PAIE_STATUTS = ['calculé', 'validé', 'payé'];
const DEFAULT_TAUX_CHANGE = 0.92;

module.exports = { TIMEZONES, CRENEAUX, ROLES, CHATTEUR_ROLES, PAIE_STATUTS, DEFAULT_TAUX_CHANGE };
