import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, mockUser } from '../../helpers/renderWithProviders.jsx';
import { mockApiGet, makeClassement, makeHistorique } from '../../helpers/mockApi.js';
import MaPerformance from '../../../pages/chatteur/MaPerformance.jsx';

vi.mock('../../../api/index.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../../../api/index.js';

function setupMocks({ historique = [], classement = null, cagnotteHist = null, paliersIndiv = null } = {}) {
  mockApiGet(api, {
    '/api/chatteurs/1/historique': historique,
    '/api/chatteurs/classement': classement || makeClassement(),
    '/api/chatteurs/classement/historique-cagnotte': cagnotteHist || { moyenne_prime_pool: 10 },
    '/api/objectifs/paliers-primes': paliersIndiv || [
      { id: 1, seuil_net_ht: 500, bonus: 15, label: 'Bronze', emoji: '🥉' },
      { id: 2, seuil_net_ht: 1000, bonus: 30, label: 'Argent', emoji: '🥈' },
      { id: 3, seuil_net_ht: 1500, bonus: 50, label: 'Or', emoji: '🥇' },
    ],
  });
}

describe('MaPerformance', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  test('shows error message on API failure', async () => {
    api.get.mockImplementation(() => Promise.reject(new Error('fail')));
    renderWithProviders(<MaPerformance />);
    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger les donn.es/)).toBeInTheDocument();
    });
  });

  test('shows "Ma Performance" heading', async () => {
    setupMocks({ historique: makeHistorique() });
    renderWithProviders(<MaPerformance />);
    await waitFor(() => {
      expect(screen.getByText('Ma Performance')).toBeInTheDocument();
    });
  });

  test('shows subtitle', async () => {
    setupMocks({ historique: makeHistorique() });
    renderWithProviders(<MaPerformance />);
    await waitFor(() => {
      expect(screen.getByText(/volution et challenge prime/)).toBeInTheDocument();
    });
  });

  test('Thermomètre shows paliers when data available', async () => {
    setupMocks({
      historique: makeHistorique(),
    });
    renderWithProviders(<MaPerformance />);
    await waitFor(() => {
      expect(screen.getByText('Mes Primes Individuelles')).toBeInTheDocument();
    });
    // Should show palier labels
    await waitFor(() => {
      expect(screen.getAllByText(/Bronze/).length).toBeGreaterThanOrEqual(1);
    });
  });

  test('Thermomètre shows empty state when no paliers configured', async () => {
    setupMocks({
      historique: makeHistorique(),
      paliersIndiv: [],
    });
    renderWithProviders(<MaPerformance />);
    await waitFor(() => {
      expect(screen.getByText(/Les paliers seront d.finis/)).toBeInTheDocument();
    });
  });

  test('bar chart shows "Aucun historique" when empty', async () => {
    setupMocks({ historique: [] });
    renderWithProviders(<MaPerformance />);
    await waitFor(() => {
      expect(screen.getByText('Aucun historique disponible')).toBeInTheDocument();
    });
  });

  test('bar chart renders bars when historique present', async () => {
    setupMocks({ historique: makeHistorique(4) });
    renderWithProviders(<MaPerformance />);
    await waitFor(() => {
      expect(screen.getByText(/Mon .volution/)).toBeInTheDocument();
    });
    // Should show TOTAL GAGNÉ and MOYENNE
    await waitFor(() => {
      expect(screen.getByText(/TOTAL GAGN/)).toBeInTheDocument();
      expect(screen.getByText('MOYENNE')).toBeInTheDocument();
    });
  });

  test('classement shows ranking list', async () => {
    setupMocks({
      historique: makeHistorique(),
      classement: makeClassement(),
    });
    renderWithProviders(<MaPerformance />);
    await waitFor(() => {
      expect(screen.getByText('Classement')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('CHARBEL')).toBeInTheDocument();
      expect(screen.getByText('JAMES')).toBeInTheDocument();
    });
  });

  test('user position highlighted with TOI badge', async () => {
    setupMocks({
      historique: makeHistorique(),
      classement: makeClassement(),
    });
    renderWithProviders(<MaPerformance />);
    await waitFor(() => {
      expect(screen.getByText('TOI')).toBeInTheDocument();
    });
  });

  test('shows motivation message', async () => {
    setupMocks({
      historique: makeHistorique(),
      classement: makeClassement(),
    });
    renderWithProviders(<MaPerformance />);
    await waitFor(() => {
      // AXEL is rank 3 in the mock classement → motivation message for rank 3
      expect(screen.getByText(/Troisi.me place/)).toBeInTheDocument();
    });
  });

  test('shows Mes Records & Streaks section', async () => {
    setupMocks({
      historique: makeHistorique(),
      classement: makeClassement(),
    });
    renderWithProviders(<MaPerformance />);
    await waitFor(() => {
      expect(screen.getByText(/Mes Records/)).toBeInTheDocument();
    });
  });
});
