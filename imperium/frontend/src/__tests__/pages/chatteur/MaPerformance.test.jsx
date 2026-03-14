import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, mockUser } from '../../helpers/renderWithProviders.jsx';
import { mockApiGet, makeClassement, makeHistorique } from '../../helpers/mockApi.js';
import MaPerformance from '../../../pages/chatteur/MaPerformance.jsx';

vi.mock('../../../api/index.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../../../api/index.js';

function setupMocks({ historique = [], classement = null, cagnotteHist = null } = {}) {
  mockApiGet(api, {
    '/api/chatteurs/1/historique': historique,
    '/api/chatteurs/classement': classement || makeClassement(),
    '/api/chatteurs/classement/historique-cagnotte': cagnotteHist || { moyenne_prime_pool: 10 },
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

  test('Thermomètre shows milestones when data available', async () => {
    setupMocks({
      historique: makeHistorique(),
      cagnotteHist: { moyenne_prime_pool: 10 },
    });
    renderWithProviders(<MaPerformance />);
    await waitFor(() => {
      expect(screen.getByText('Paliers Cagnotte')).toBeInTheDocument();
    });
    // Milestones should show celebration messages or milestone markers
    await waitFor(() => {
      expect(screen.getByText(/Chaque vente fait grandir la cagnotte/)).toBeInTheDocument();
    });
  });

  test('Thermomètre shows empty state when no milestone data', async () => {
    setupMocks({
      historique: makeHistorique(),
      classement: makeClassement({ total_net_ht_equipe: 0 }),
      cagnotteHist: { moyenne_prime_pool: 0 },
    });
    renderWithProviders(<MaPerformance />);
    await waitFor(() => {
      expect(screen.getByText(/Les paliers appara.tront/)).toBeInTheDocument();
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

  test('classement shows podium with medals', async () => {
    setupMocks({
      historique: makeHistorique(),
      classement: makeClassement(),
    });
    renderWithProviders(<MaPerformance />);
    await waitFor(() => {
      expect(screen.getAllByText(/Podium/).length).toBeGreaterThanOrEqual(1);
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
      // AXEL is rank 3 in the mock classement → motivation message includes "podium"
      expect(screen.getAllByText(/podium/i).length).toBeGreaterThanOrEqual(1);
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
