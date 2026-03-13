import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, mockUser } from '../../helpers/renderWithProviders.jsx';
import { mockApiGet, makeKpis, makeEmptyKpis, makeVentesParModele, makeShift } from '../../helpers/mockApi.js';
import ChatteurDashboard from '../../../pages/chatteur/Dashboard.jsx';

vi.mock('../../../api/index.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../../../api/index.js';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function periodDebut() {
  const now = new Date();
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0');
  return now.getDate() < 15 ? `${y}-${m}-01` : `${y}-${m}-15`;
}

function periodFin() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  if (now.getDate() < 15) return `${y}-${String(m + 1).padStart(2, '0')}-15`;
  const next = new Date(y, m + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
}

function setupDefaultMocks(kpiOverrides = {}) {
  const kpis = makeKpis({
    paies: [
      { id: 1, periode_debut: periodDebut(), periode_fin: periodFin(), total_chatteur: 48.08, plateforme_nom: 'OnlyFans', statut: 'calculé' },
      { id: 2, periode_debut: periodDebut(), periode_fin: periodFin(), total_chatteur: 20.03, plateforme_nom: 'Reveal', statut: 'calculé' },
    ],
    ...kpiOverrides,
  });

  mockApiGet(api, {
    '/api/chatteurs/1/kpis': kpis,
    '/api/ventes': { ventes: [] },
    '/api/ventes/par-modele': [],
    '/api/objectifs/progress': [],
    '/api/objectifs/mon-objectif': null,
    '/api/objectifs/suggestions': null,
    '/api/shifts/semaine': { shifts: [] },
  });
}

describe('ChatteurDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('shows error message on API failure', async () => {
    api.get.mockImplementation(() => Promise.reject(new Error('Network error')));
    renderWithProviders(<ChatteurDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Impossible de charger les données.')).toBeInTheDocument();
    });
  });

  test('shows greeting with user prenom', async () => {
    setupDefaultMocks();
    renderWithProviders(<ChatteurDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Bonjour AXEL/)).toBeInTheDocument();
    });
  });

  test('shows period label with arrow format', async () => {
    setupDefaultMocks();
    renderWithProviders(<ChatteurDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/\u2192/)).toBeInTheDocument();
    });
  });

  test('DeltaBadge shows "Nouveau !" when previous period is 0 and current > 0', async () => {
    const kpis = makeKpis({
      paies: [{ id: 1, periode_debut: periodDebut(), periode_fin: periodFin(), total_chatteur: 48.08 }],
    });
    const prevKpis = makeEmptyKpis();

    api.get.mockImplementation((url) => {
      const params = url.split('?')[1] || '';
      if (url.startsWith('/api/chatteurs/1/kpis')) {
        if (params.includes(periodDebut())) return Promise.resolve({ data: kpis });
        return Promise.resolve({ data: prevKpis });
      }
      if (url.startsWith('/api/objectifs/mon-objectif')) return Promise.resolve({ data: null });
      if (url.startsWith('/api/objectifs/suggestions')) return Promise.resolve({ data: null });
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(<ChatteurDashboard />);
    await waitFor(() => {
      expect(screen.getAllByText('Nouveau !').length).toBeGreaterThanOrEqual(1);
    });
  });

  test('DeltaBadge shows up arrow when current > previous', async () => {
    const kpis = makeKpis({
      paies: [{ id: 1, periode_debut: periodDebut(), periode_fin: periodFin(), total_chatteur: 100 }],
      ventes: [{ total_brut: 800, devise: 'USD' }],
      rang: 2,
    });
    const prevKpis = makeKpis({
      paies: [{ id: 10, periode_debut: '2026-02-15', periode_fin: '2026-03-01', total_chatteur: 50 }],
      ventes: [{ total_brut: 400, devise: 'USD' }],
      rang: 5,
    });

    let callCount = 0;
    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/chatteurs/1/kpis')) {
        callCount++;
        return Promise.resolve({ data: callCount === 1 ? kpis : prevKpis });
      }
      if (url.startsWith('/api/objectifs/mon-objectif')) return Promise.resolve({ data: null });
      if (url.startsWith('/api/objectifs/suggestions')) return Promise.resolve({ data: null });
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(<ChatteurDashboard />);
    await waitFor(() => {
      const upArrows = screen.getAllByText(/\u2191/);
      expect(upArrows.length).toBeGreaterThanOrEqual(1);
    });
  });

  test('DeltaBadge shows down arrow when current < previous', async () => {
    const kpis = makeKpis({
      paies: [{ id: 1, periode_debut: periodDebut(), periode_fin: periodFin(), total_chatteur: 30 }],
      ventes: [{ total_brut: 200, devise: 'USD' }],
    });
    const prevKpis = makeKpis({
      paies: [{ id: 10, periode_debut: '2026-02-15', periode_fin: '2026-03-01', total_chatteur: 100 }],
      ventes: [{ total_brut: 600, devise: 'USD' }],
    });

    let callCount = 0;
    api.get.mockImplementation((url) => {
      if (url.startsWith('/api/chatteurs/1/kpis')) {
        callCount++;
        return Promise.resolve({ data: callCount === 1 ? kpis : prevKpis });
      }
      if (url.startsWith('/api/objectifs/mon-objectif')) return Promise.resolve({ data: null });
      if (url.startsWith('/api/objectifs/suggestions')) return Promise.resolve({ data: null });
      return Promise.resolve({ data: [] });
    });

    renderWithProviders(<ChatteurDashboard />);
    await waitFor(() => {
      const downArrows = screen.getAllByText(/\u2193/);
      expect(downArrows.length).toBeGreaterThanOrEqual(1);
    });
  });

  test('ProchainShift renders nothing when no shifts available', async () => {
    setupDefaultMocks();
    renderWithProviders(<ChatteurDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Bonjour AXEL/)).toBeInTheDocument();
    });
    expect(screen.queryByText("TON SHIFT AUJOURD'HUI")).not.toBeInTheDocument();
    expect(screen.queryByText('TON PROCHAIN SHIFT')).not.toBeInTheDocument();
  });

  test('ProchainShift shows "TON SHIFT AUJOURD\'HUI" for today shift', async () => {
    mockApiGet(api, {
      '/api/chatteurs/1/kpis': makeKpis({
        paies: [{ id: 1, periode_debut: periodDebut(), periode_fin: periodFin(), total_chatteur: 48.08 }],
      }),
      '/api/ventes': { ventes: [] },
      '/api/ventes/par-modele': [],
      '/api/objectifs/progress': [],
      '/api/objectifs/mon-objectif': null,
      '/api/objectifs/suggestions': null,
      '/api/shifts/semaine': { shifts: [makeShift({ date: todayStr(), creneau: 2 })] },
    });

    renderWithProviders(<ChatteurDashboard />);
    await waitFor(() => {
      expect(screen.getByText("TON SHIFT AUJOURD'HUI")).toBeInTheDocument();
    });
  });

  test('ProchainShift shows "TON PROCHAIN SHIFT" for tomorrow shift', async () => {
    mockApiGet(api, {
      '/api/chatteurs/1/kpis': makeKpis({
        paies: [{ id: 1, periode_debut: periodDebut(), periode_fin: periodFin(), total_chatteur: 48.08 }],
      }),
      '/api/ventes': { ventes: [] },
      '/api/ventes/par-modele': [],
      '/api/objectifs/progress': [],
      '/api/objectifs/mon-objectif': null,
      '/api/objectifs/suggestions': null,
      '/api/shifts/semaine': { shifts: [makeShift({ date: tomorrowStr(), creneau: 1 })] },
    });

    renderWithProviders(<ChatteurDashboard />);
    await waitFor(() => {
      expect(screen.getByText('TON PROCHAIN SHIFT')).toBeInTheDocument();
    });
  });

  test('DonutChart shows empty state when no ventes par modele', async () => {
    setupDefaultMocks();
    renderWithProviders(<ChatteurDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Tes ventes par mod.le appara.tront ici/)).toBeInTheDocument();
    });
  });

  test('DonutChart renders SVG donut when ventes par modele exist', async () => {
    mockApiGet(api, {
      '/api/chatteurs/1/kpis': makeKpis({
        paies: [{ id: 1, periode_debut: periodDebut(), periode_fin: periodFin(), total_chatteur: 48.08 }],
      }),
      '/api/ventes': { ventes: [] },
      '/api/ventes/par-modele': makeVentesParModele(),
      '/api/objectifs/progress': [],
      '/api/objectifs/mon-objectif': null,
      '/api/objectifs/suggestions': null,
      '/api/shifts/semaine': { shifts: [] },
    });

    renderWithProviders(<ChatteurDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Ventes par modèle')).toBeInTheDocument();
    });
    expect(document.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText('ANGEL')).toBeInTheDocument();
    expect(screen.getByText('LUNA')).toBeInTheDocument();
  });

  test('stat cards display paie estimée, rang, and ventes', async () => {
    setupDefaultMocks();
    renderWithProviders(<ChatteurDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Ma paie estimée')).toBeInTheDocument();
      expect(screen.getByText('Mon rang')).toBeInTheDocument();
      expect(screen.getByText('Ventes (période)')).toBeInTheDocument();
    });
    // Paie: 48.08 + 20.03 = 68.11 → displayed as "68 €" (no decimals)
    await waitFor(() => {
      expect(screen.getByText(/68/)).toBeInTheDocument();
    });
  });

  test('encouragement message for rang 1', async () => {
    mockApiGet(api, {
      '/api/chatteurs/1/kpis': makeKpis({
        paies: [{ id: 1, periode_debut: periodDebut(), periode_fin: periodFin(), total_chatteur: 100 }],
        rang: 1, nb_chatteurs: 10,
      }),
      '/api/ventes': { ventes: [] },
      '/api/ventes/par-modele': [],
      '/api/objectifs/progress': [],
      '/api/objectifs/mon-objectif': null,
      '/api/objectifs/suggestions': null,
      '/api/shifts/semaine': { shifts: [] },
    });

    renderWithProviders(<ChatteurDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Tu es en t.te/)).toBeInTheDocument();
    });
  });

  test('empty ventes shows "Aucune vente enregistrée"', async () => {
    setupDefaultMocks();
    renderWithProviders(<ChatteurDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Aucune vente enregistr.e/)).toBeInTheDocument();
    });
  });
});
