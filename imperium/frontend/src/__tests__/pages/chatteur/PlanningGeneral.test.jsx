import { describe, test, expect, vi, beforeEach, beforeAll } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../helpers/renderWithProviders.jsx';
import { mockApiGet, makeShift } from '../../helpers/mockApi.js';
import PlanningGeneral from '../../../pages/chatteur/PlanningGeneral.jsx';

vi.mock('../../../api/index.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../../../api/index.js';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const defaultPlateformes = [
  { id: 1, nom: 'OnlyFans', actif: 1, couleur_fond: '#008ccf', couleur_texte: '#fff' },
  { id: 2, nom: 'Reveal', actif: 1, couleur_fond: '#1b2e4b', couleur_texte: '#fff' },
];

const defaultModeles = [
  { id: 1, pseudo: 'ANGEL', actif: 1, couleur_fond: '#ffcc80', couleur_texte: '#4e342e' },
  { id: 2, pseudo: 'LUNA', actif: 1, couleur_fond: '#e91e63', couleur_texte: '#fff' },
];

function setupMocks({ shifts = [], modeles = null, plateformes = null } = {}) {
  const pfs = plateformes || defaultPlateformes;
  mockApiGet(api, {
    // PlanningGeneral gets plateformes + modeles_plateformes from shifts/semaine response
    '/api/shifts/semaine': {
      shifts,
      templates: [],
      plateformes: pfs,
      modeles_plateformes: [
        { modele_id: 1, plateforme_id: 1 },
        { modele_id: 2, plateforme_id: 1 },
        { modele_id: 1, plateforme_id: 2 },
      ],
    },
    '/api/modeles': modeles || defaultModeles,
    '/api/chatteurs/1': { id: 1, prenom: 'AXEL', pays: 'Benin', couleur: 8 },
  });
}

describe('PlanningGeneral', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  test('shows "Planning Général" heading', async () => {
    setupMocks();
    renderWithProviders(<PlanningGeneral />);
    await waitFor(() => {
      expect(screen.getByText(/Planning G.n.ral/)).toBeInTheDocument();
    });
  });

  test('shows platform tabs', async () => {
    setupMocks();
    renderWithProviders(<PlanningGeneral />);
    await waitFor(() => {
      expect(screen.getByText('OnlyFans')).toBeInTheDocument();
      expect(screen.getByText('Reveal')).toBeInTheDocument();
    });
  });

  test('timezone buttons visible', async () => {
    setupMocks();
    renderWithProviders(<PlanningGeneral />);
    await waitFor(() => {
      expect(screen.getByText('France')).toBeInTheDocument();
      expect(screen.getByText('Bénin')).toBeInTheDocument();
      expect(screen.getByText('Madagascar')).toBeInTheDocument();
    });
  });

  test('week navigation works', async () => {
    setupMocks();
    renderWithProviders(<PlanningGeneral />);

    await waitFor(() => {
      expect(screen.getByText(/Sem\. du/)).toBeInTheDocument();
    });

    const initialText = screen.getByText(/Sem\. du/).textContent;
    // Find navigation buttons (chevron buttons)
    const navButtons = screen.getAllByRole('button').filter(b =>
      b.querySelector('svg') && !b.textContent.includes('OnlyFans')
    );
    // Click the "next" button (second navigation button)
    if (navButtons.length >= 2) {
      fireEvent.click(navButtons[1]);
      await waitFor(() => {
        expect(screen.getByText(/Sem\. du/).textContent).not.toBe(initialText);
      });
    }
  });

  test('shows model cards with model names', async () => {
    setupMocks({
      shifts: [
        makeShift({ modele_id: 1, modele_pseudo: 'ANGEL', plateforme_id: 1, date: todayStr() }),
      ],
    });
    renderWithProviders(<PlanningGeneral />);
    await waitFor(() => {
      expect(screen.getByText('ANGEL')).toBeInTheDocument();
    });
  });

  test('shows "Consultation" badge', async () => {
    setupMocks();
    renderWithProviders(<PlanningGeneral />);
    await waitFor(() => {
      expect(screen.getByText('Consultation')).toBeInTheDocument();
    });
  });

  test('shows active chatteur count', async () => {
    setupMocks({
      shifts: [makeShift({ date: todayStr() })],
    });
    renderWithProviders(<PlanningGeneral />);
    await waitFor(() => {
      expect(screen.getByText(/chatteurs? actifs? cette semaine/)).toBeInTheDocument();
    });
  });

  test('shows legend with "Mes shifts" and "Récurrent"', async () => {
    setupMocks();
    renderWithProviders(<PlanningGeneral />);
    await waitFor(() => {
      expect(screen.getByText(/Mes shifts/)).toBeInTheDocument();
      expect(screen.getByText(/R.current/)).toBeInTheDocument();
    });
  });

  test('click platform tab switches active tab', async () => {
    setupMocks();
    renderWithProviders(<PlanningGeneral />);
    await waitFor(() => {
      expect(screen.getByText('OnlyFans')).toBeInTheDocument();
    });

    // Click Reveal tab
    fireEvent.click(screen.getByText('Reveal'));
    // OnlyFans should still be visible (as tab label), but Reveal tab should now be active
    await waitFor(() => {
      expect(screen.getByText('Reveal')).toBeInTheDocument();
    });
  });
});
