/**
 * Statuts partagés pour chatteurs et modèles.
 * Stocké en DB comme TEXT dans la colonne `statut`.
 */

export const STATUTS = [
  { value: 'actif', label: 'Actif', bg: '#dcfce7', color: '#166534', border: '#86efac' },
  { value: 'inactif', label: 'Inactif', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  { value: 'malade', label: 'Malade', bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  { value: 'en_deplacement', label: 'En déplacement', bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  { value: 'en_conge', label: 'En congé', bg: '#e0e7ff', color: '#3730a3', border: '#a5b4fc' },
  { value: 'suspendu', label: 'Suspendu', bg: '#fce7f3', color: '#9d174d', border: '#f9a8d4' },
];

export const STATUT_MAP = Object.fromEntries(STATUTS.map(s => [s.value, s]));

export const STATUTS_ACTIFS = ['actif']; // statuts considérés "en activité"
