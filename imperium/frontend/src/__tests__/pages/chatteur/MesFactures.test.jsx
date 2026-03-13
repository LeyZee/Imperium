import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../helpers/renderWithProviders.jsx';
import { mockApiGet, makePaie, makeMalus } from '../../helpers/mockApi.js';
import MesFactures from '../../../pages/chatteur/MesFactures.jsx';

vi.mock('../../../api/index.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../../../api/index.js';

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

function setupMocks({ paies = [], taux_commission = 0.15, malus = [], taux = null } = {}) {
  mockApiGet(api, {
    '/api/paies/mes-paies': { paies, taux_commission },
    '/api/malus': malus,
    '/api/taux/current': taux ? { taux } : null,
  });
}

describe('MesFactures', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  test('shows empty state when no paies', async () => {
    setupMocks({ paies: [] });
    renderWithProviders(<MesFactures />);
    await waitFor(() => {
      expect(screen.getByText('Aucune paie')).toBeInTheDocument();
    });
    expect(screen.getByText(/Tes paies appara.tront ici/)).toBeInTheDocument();
  });

  test('shows commission rate when paies loaded', async () => {
    setupMocks({
      paies: [makePaie({ periode_debut: periodDebut(), periode_fin: periodFin() })],
    });
    renderWithProviders(<MesFactures />);
    await waitFor(() => {
      expect(screen.getByText(/Commission/)).toBeInTheDocument();
      expect(screen.getByText(/15,0%/)).toBeInTheDocument();
    });
  });

  test('shows PÉRIODE EN COURS summary card with correct total', async () => {
    const paie1 = makePaie({ id: 1, periode_debut: periodDebut(), periode_fin: periodFin(), total_chatteur: 48.08 });
    const paie2 = makePaie({ id: 2, periode_debut: periodDebut(), periode_fin: periodFin(), total_chatteur: 20.03, plateforme_nom: 'Reveal', devise: 'EUR' });
    setupMocks({ paies: [paie1, paie2] });

    renderWithProviders(<MesFactures />);
    await waitFor(() => {
      expect(screen.getByText('PÉRIODE EN COURS')).toBeInTheDocument();
    });
    // Total: 48.08 + 20.03 = 68.11 (appears in summary card and period header)
    await waitFor(() => {
      expect(screen.getAllByText(/68,11/).length).toBeGreaterThanOrEqual(1);
    });
  });

  test('shows TOTAL PERÇU with only payé paies summed', async () => {
    const paiePaye = makePaie({ id: 1, periode_debut: '2026-02-15', periode_fin: '2026-03-01', total_chatteur: 75.00, statut: 'payé' });
    const paieCalcule = makePaie({ id: 2, periode_debut: periodDebut(), periode_fin: periodFin(), total_chatteur: 48.08, statut: 'calculé' });
    setupMocks({ paies: [paiePaye, paieCalcule] });

    renderWithProviders(<MesFactures />);
    await waitFor(() => {
      expect(screen.getByText('TOTAL PERÇU')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getAllByText(/75,00/).length).toBeGreaterThanOrEqual(1);
    });
  });

  test('groups paies by period with separate tables', async () => {
    const paie1 = makePaie({ id: 1, periode_debut: periodDebut(), periode_fin: periodFin(), total_chatteur: 48.08 });
    const paie2 = makePaie({ id: 2, periode_debut: '2026-02-15', periode_fin: '2026-03-01', total_chatteur: 35.00, statut: 'payé' });
    setupMocks({ paies: [paie1, paie2] });

    renderWithProviders(<MesFactures />);
    await waitFor(() => {
      const tables = document.querySelectorAll('table');
      expect(tables.length).toBe(2);
    });
  });

  test('current period has EN COURS badge', async () => {
    setupMocks({
      paies: [makePaie({ id: 1, periode_debut: periodDebut(), periode_fin: periodFin() })],
    });

    renderWithProviders(<MesFactures />);
    await waitFor(() => {
      expect(screen.getByText('EN COURS')).toBeInTheDocument();
    });
  });

  test('click on a row expands PaieDetail', async () => {
    setupMocks({
      paies: [makePaie({ id: 1, periode_debut: periodDebut(), periode_fin: periodFin(), ventes_brutes: 380 })],
    });

    renderWithProviders(<MesFactures />);
    await waitFor(() => {
      expect(screen.getByText('OnlyFans')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('OnlyFans').closest('tr'));

    await waitFor(() => {
      expect(screen.getByText(/D.TAIL DU CALCUL/)).toBeInTheDocument();
    });
  });

  test('PaieDetail shows calculation steps', async () => {
    setupMocks({
      paies: [makePaie({ id: 1, periode_debut: periodDebut(), periode_fin: periodFin() })],
    });

    renderWithProviders(<MesFactures />);
    await waitFor(() => { expect(screen.getByText('OnlyFans')).toBeInTheDocument(); });

    fireEvent.click(screen.getByText('OnlyFans').closest('tr'));

    await waitFor(() => {
      // "Ventes brutes" appears in both table header and detail step
      expect(screen.getAllByText('Ventes brutes').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText(/TVA/)).toBeInTheDocument();
      expect(screen.getByText(/Commission plateforme/)).toBeInTheDocument();
      expect(screen.getByText(/Ta commission/)).toBeInTheDocument();
    });
  });

  test('malus type pourcentage shows percentage format', async () => {
    const paie = makePaie({ id: 1, periode_debut: periodDebut(), periode_fin: periodFin(), malus_total: 5 });
    const malus = makeMalus({ id: 1, montant: 5, type_malus: 'pourcentage', periode: periodDebut() });
    setupMocks({ paies: [paie], malus: [malus] });

    renderWithProviders(<MesFactures />);
    await waitFor(() => { expect(screen.getByText('OnlyFans')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('OnlyFans').closest('tr'));

    await waitFor(() => {
      expect(screen.getByText(/\u22125,00%/)).toBeInTheDocument();
    });
  });

  test('malus type montant shows euro format', async () => {
    const paie = makePaie({ id: 1, periode_debut: periodDebut(), periode_fin: periodFin(), malus_total: 10 });
    const malus = makeMalus({ id: 2, raison: 'Absence', montant: 10, type_malus: 'montant', periode: periodDebut() });
    setupMocks({ paies: [paie], malus: [malus] });

    renderWithProviders(<MesFactures />);
    await waitFor(() => { expect(screen.getByText('OnlyFans')).toBeInTheDocument(); });
    fireEvent.click(screen.getByText('OnlyFans').closest('tr'));

    await waitFor(() => {
      const malusEls = screen.getAllByText(/\u221210,00/);
      expect(malusEls.length).toBeGreaterThanOrEqual(1);
      // At least one should have the euro sign
      const hasEuro = malusEls.some(el => el.textContent.includes('\u20ac'));
      expect(hasEuro).toBe(true);
    });
  });

  // ─── MalusHistory section tests ───
  test('shows MalusHistory section when malus exist', async () => {
    const malus = makeMalus({ id: 1, raison: 'Retard', montant: 5, type_malus: 'pourcentage' });
    setupMocks({
      paies: [makePaie({ id: 1, periode_debut: periodDebut(), periode_fin: periodFin() })],
      malus: [malus],
    });
    renderWithProviders(<MesFactures />);
    await waitFor(() => {
      expect(screen.getByText('Historique des malus')).toBeInTheDocument();
    });
    // Badge should show count
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  test('does not show MalusHistory when no malus', async () => {
    setupMocks({
      paies: [makePaie({ id: 1, periode_debut: periodDebut(), periode_fin: periodFin() })],
      malus: [],
    });
    renderWithProviders(<MesFactures />);
    await waitFor(() => {
      expect(screen.getByText('EN COURS')).toBeInTheDocument();
    });
    expect(screen.queryByText('Historique des malus')).not.toBeInTheDocument();
  });

  test('MalusHistory expands to show malus details on click', async () => {
    const malus1 = makeMalus({ id: 1, raison: 'Retard', montant: 5, type_malus: 'pourcentage', periode: periodDebut() });
    const malus2 = makeMalus({ id: 2, raison: 'Absence', montant: 10, type_malus: 'montant', periode: periodDebut() });
    setupMocks({
      paies: [makePaie({ id: 1, periode_debut: periodDebut(), periode_fin: periodFin() })],
      malus: [malus1, malus2],
    });
    renderWithProviders(<MesFactures />);
    await waitFor(() => {
      expect(screen.getByText('Historique des malus')).toBeInTheDocument();
    });

    // Badge should show 2
    expect(screen.getByText('2')).toBeInTheDocument();

    // Expand
    fireEvent.click(screen.getByText('Historique des malus'));

    await waitFor(() => {
      expect(screen.getByText('Retard')).toBeInTheDocument();
      expect(screen.getByText('Absence')).toBeInTheDocument();
    });
  });

  test('MalusHistory shows total for montant-type malus', async () => {
    const malus1 = makeMalus({ id: 1, raison: 'Absence', montant: 10, type_malus: 'montant', periode: periodDebut() });
    const malus2 = makeMalus({ id: 2, raison: 'Retard', montant: 15, type_malus: 'montant', periode: periodDebut() });
    setupMocks({
      paies: [makePaie({ id: 1, periode_debut: periodDebut(), periode_fin: periodFin() })],
      malus: [malus1, malus2],
    });
    renderWithProviders(<MesFactures />);
    await waitFor(() => {
      expect(screen.getByText('Historique des malus')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Historique des malus'));

    await waitFor(() => {
      expect(screen.getByText('Total malus fixes')).toBeInTheDocument();
      expect(screen.getByText(/\u221225,00/)).toBeInTheDocument(); // 10 + 15 = 25
    });
  });

  test('taux de change displayed when available', async () => {
    setupMocks({
      paies: [makePaie({ id: 1, periode_debut: periodDebut(), periode_fin: periodFin() })],
      taux: 0.866,
    });

    renderWithProviders(<MesFactures />);
    await waitFor(() => {
      expect(screen.getByText(/Taux de change/)).toBeInTheDocument();
      expect(screen.getByText(/0.8660/)).toBeInTheDocument();
    });
  });
});
