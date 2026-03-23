import { vi } from 'vitest';

/**
 * Mock data factories for chatteur page tests.
 * Import from tests and pass to vi.mocked api responses.
 */

// ─── KPIs ───
export function makeKpis(overrides = {}) {
  return {
    paies: [
      { id: 1, periode_debut: '2026-03-15', periode_fin: '2026-04-01', total_chatteur: 48.08, plateforme_nom: 'OnlyFans', statut: 'calculé' },
      { id: 2, periode_debut: '2026-03-15', periode_fin: '2026-04-01', total_chatteur: 20.03, plateforme_nom: 'Reveal', statut: 'calculé' },
    ],
    ventes: [
      { total_brut: 655, devise: 'USD' },
    ],
    rang: 3,
    nb_chatteurs: 10,
    ...overrides,
  };
}

export function makeEmptyKpis() {
  return { paies: [], ventes: [], rang: 0, nb_chatteurs: 0 };
}

// ─── Paies ───
export function makePaie(overrides = {}) {
  return {
    id: 1,
    plateforme_nom: 'OnlyFans',
    couleur_fond: '#008ccf',
    couleur_texte: '#ffffff',
    devise: 'USD',
    ventes_brutes: 380,
    ventes_ttc_eur: 329.08,
    ventes_ht_eur: 274.23,
    net_ht_eur: 219.39,
    tva_rate: 0.2,
    commission_rate: 0.2,
    taux_change: 0.866,
    commission_chatteur: 28.06,
    prime: 0,
    malus_total: 0,
    total_chatteur: 28.06,
    statut: 'calculé',
    periode_debut: '2026-03-15',
    periode_fin: '2026-04-01',
    ...overrides,
  };
}

export function makeMalus(overrides = {}) {
  return {
    id: 1,
    chatteur_id: 1,
    raison: 'Retard',
    montant: 5,
    type_malus: 'pourcentage',
    periode: '2026-03-15',
    ...overrides,
  };
}

// ─── Shifts ───
export function makeShift(overrides = {}) {
  return {
    id: 1,
    chatteur_id: 1,
    chatteur_prenom: 'AXEL',
    modele_id: 1,
    modele_pseudo: 'ANGEL',
    modele_couleur_fond: '#ffcc80',
    modele_couleur_texte: '#4e342e',
    plateforme_id: 1,
    plateforme_nom: 'OnlyFans',
    plateforme_couleur_fond: '#008ccf',
    plateforme_couleur_texte: '#ffffff',
    date: '2026-03-13',
    creneau: 1,
    fuseau_horaire: 'Africa/Porto-Novo',
    is_template: 0,
    ...overrides,
  };
}

// ─── Classement ───
export function makeClassement(overrides = {}) {
  return {
    classement: [
      { id: 3, prenom: 'CHARBEL', total_net_ht: 500 },
      { id: 5, prenom: 'JAMES', total_net_ht: 400 },
      { id: 1, prenom: 'AXEL', total_net_ht: 350 },
      { id: 7, prenom: 'NANCIA', total_net_ht: 200 },
    ],
    nb_chatteurs: 10,
    total_net_ht_equipe: 2500,
    paliers_primes: [
      { id: 1, seuil_net_ht: 500, bonus: 15, label: 'Bronze', emoji: '🥉' },
      { id: 2, seuil_net_ht: 1000, bonus: 30, label: 'Argent', emoji: '🥈' },
      { id: 3, seuil_net_ht: 1500, bonus: 50, label: 'Or', emoji: '🥇' },
    ],
    ...overrides,
  };
}

// ─── Historique ───
export function makeHistorique(count = 4) {
  return Array.from({ length: count }, (_, i) => ({
    periode_debut: `2026-0${i + 1}-01`,
    periode_fin: `2026-0${i + 1}-15`,
    total_paie: (i + 1) * 30,
    rang: i < 3 ? i + 1 : 5,
    prime: i < 3 ? 5 - i : 0,
  }));
}

// ─── Chatteur profile ───
export function makeChatteur(overrides = {}) {
  return {
    id: 1,
    prenom: 'AXEL',
    email: 'axel@impera-agency.com',
    user_email: 'axel@impera-agency.com',
    pays: 'Benin',
    taux_commission: 0.15,
    role: 'chatteur',
    photo: null,
    couleur: 8,
    actif: 1,
    ...overrides,
  };
}

// ─── Ventes ───
export function makeVente(overrides = {}) {
  return {
    id: 1,
    chatteur_id: 1,
    modele_id: 1,
    modele_pseudo: 'ANGEL',
    modele_couleur_fond: '#ffcc80',
    modele_couleur_texte: '#4e342e',
    plateforme_id: 1,
    plateforme_nom: 'OnlyFans',
    plateforme_couleur_fond: '#008ccf',
    plateforme_couleur_texte: '#ffffff',
    montant_brut: 100,
    devise: 'USD',
    statut: 'validée',
    notes: null,
    shift_id: 1,
    periode_debut: '2026-03-01',
    periode_fin: '2026-03-15',
    created_at: '2026-03-10T14:00:00',
    ...overrides,
  };
}

// ─── Ventes par modèle ───
export function makeVentesParModele() {
  return [
    { pseudo: 'ANGEL', total_brut: 400, couleur_fond: '#ffcc80' },
    { pseudo: 'LUNA', total_brut: 255, couleur_fond: '#e91e63' },
  ];
}

// ─── API mock setup ───
/**
 * Create a mock for the api module.
 * Usage in test file:
 *   vi.mock('../../api/index.js', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
 *   import api from '../../api/index.js';
 *   // then use mockApiGet(api, { '/api/some/endpoint': someData });
 */
export function mockApiGet(api, responses = {}) {
  // Sort patterns by length (longest first) so more specific paths match before less specific ones
  // e.g. "/api/ventes/par-modele" matches before "/api/ventes"
  const sortedEntries = Object.entries(responses).sort((a, b) => b[0].length - a[0].length);
  api.get.mockImplementation((url) => {
    const baseUrl = url.split('?')[0];
    for (const [pattern, data] of sortedEntries) {
      if (url.startsWith(pattern) || baseUrl === pattern) {
        return Promise.resolve({ data });
      }
    }
    return Promise.resolve({ data: [] });
  });
}

export function mockApiReject(api, pattern, error = { response: { data: { error: 'Server error' } } }) {
  const original = api.get.getMockImplementation?.();
  api.get.mockImplementation((url) => {
    if (url.startsWith(pattern)) return Promise.reject(error);
    if (original) return original(url);
    return Promise.resolve({ data: [] });
  });
}
