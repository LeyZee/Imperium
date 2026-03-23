import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../helpers/renderWithProviders.jsx';
import { mockApiGet, makeVente } from '../../helpers/mockApi.js';
import MesVentes from '../../../pages/chatteur/MesVentes.jsx';

vi.mock('../../../api/index.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../../../api/index.js';

function setupMocks({ ventes = [], locked = false, modeles = [], plateformes = [] } = {}) {
  mockApiGet(api, {
    '/api/ventes': ventes,
    '/api/ventes/periode-status': { locked },
    '/api/ventes/summary': { periodes: [] },
    '/api/shifts/chatteur-modeles': modeles,
    '/api/plateformes': plateformes,
    '/api/shifts/for-vente': [],
  });
}

describe('MesVentes', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  test('shows empty state when no ventes', async () => {
    setupMocks({ ventes: [] });
    renderWithProviders(<MesVentes />);
    await waitFor(() => {
      expect(screen.getByText('Aucune vente pour cette période')).toBeInTheDocument();
    });
  });

  test('shows stat cards with correct total', async () => {
    setupMocks({
      ventes: [
        makeVente({ id: 1, montant_brut: 200 }),
        makeVente({ id: 2, montant_brut: 300 }),
      ],
    });
    renderWithProviders(<MesVentes />);
    await waitFor(() => {
      expect(screen.getByText('500 $')).toBeInTheDocument();
      expect(screen.getByText('250 $')).toBeInTheDocument();
    });
    // "Nombre de ventes" stat card should show count
    expect(screen.getByText('Nombre de ventes')).toBeInTheDocument();
  });

  test('shows vente with model and platform badges', async () => {
    setupMocks({
      ventes: [makeVente({ id: 1, modele_pseudo: 'ANGEL', plateforme_nom: 'OnlyFans' })],
    });
    renderWithProviders(<MesVentes />);
    await waitFor(() => {
      expect(screen.getByText('ANGEL')).toBeInTheDocument();
      expect(screen.getByText('OnlyFans')).toBeInTheDocument();
    });
  });

  test('shows source badges for each vente type', async () => {
    setupMocks({
      ventes: [
        makeVente({ id: 1, notes: null, modele_pseudo: 'M1' }), // admin
        makeVente({ id: 2, notes: 'Import Telegram: test', modele_pseudo: 'M2' }), // telegram
        makeVente({ id: 3, notes: 'Ajout manuel par chatteur', modele_pseudo: 'M3' }), // manual
      ],
    });
    renderWithProviders(<MesVentes />);
    await waitFor(() => {
      // All three source types should appear as badge text
      expect(screen.getAllByText('Telegram').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Manuel').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Admin').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Source filter tests ───
  test('shows source filter buttons when multiple sources exist', async () => {
    setupMocks({
      ventes: [
        makeVente({ id: 1, notes: null }), // admin
        makeVente({ id: 2, notes: 'Import Telegram: msg' }), // telegram
      ],
    });
    renderWithProviders(<MesVentes />);
    await waitFor(() => {
      expect(screen.getByText('Toutes')).toBeInTheDocument();
    });
  });

  test('does not show source filter when only manual ventes', async () => {
    setupMocks({
      ventes: [
        makeVente({ id: 1, notes: 'Ajout manuel par chatteur' }),
        makeVente({ id: 2, notes: 'Ajout manuel par chatteur' }),
      ],
    });
    renderWithProviders(<MesVentes />);
    await waitFor(() => {
      expect(screen.getAllByText('ANGEL').length).toBe(2);
    });
    // Filter should not appear: only manual sources, no telegram/admin
    expect(screen.queryByText('Toutes')).not.toBeInTheDocument();
  });

  test('clicking Telegram filter hides non-telegram ventes', async () => {
    setupMocks({
      ventes: [
        makeVente({ id: 1, montant_brut: 100, notes: null, modele_pseudo: 'ANGEL' }), // admin
        makeVente({ id: 2, montant_brut: 250, notes: 'Import Telegram: sale', modele_pseudo: 'LUNA' }), // telegram
      ],
    });
    renderWithProviders(<MesVentes />);
    await waitFor(() => {
      expect(screen.getByText('Toutes')).toBeInTheDocument();
    });

    // Click Telegram filter button (the one in the filter bar, not the source badge)
    const filterButtons = screen.getByText('Toutes').parentElement.querySelectorAll('button');
    const telegramBtn = Array.from(filterButtons).find(b => b.textContent.includes('Telegram'));
    fireEvent.click(telegramBtn);

    // Admin vente should be hidden, telegram vente visible
    await waitFor(() => {
      expect(screen.queryByText('ANGEL')).not.toBeInTheDocument();
    });
    expect(screen.getByText('LUNA')).toBeInTheDocument();
    // Total brut should be 250 (only telegram vente)
    expect(screen.getAllByText('250 $').length).toBeGreaterThanOrEqual(1);
  });

  test('clicking filter then Toutes shows all ventes again', async () => {
    setupMocks({
      ventes: [
        makeVente({ id: 1, montant_brut: 150, notes: null, modele_pseudo: 'ANGEL' }),
        makeVente({ id: 2, montant_brut: 200, notes: 'Import Telegram: x', modele_pseudo: 'LUNA' }),
      ],
    });
    renderWithProviders(<MesVentes />);
    await waitFor(() => {
      expect(screen.getByText('Toutes')).toBeInTheDocument();
    });

    // Filter to telegram only
    const filterBar2 = screen.getByText('Toutes').parentElement;
    const telegramBtn2 = Array.from(filterBar2.querySelectorAll('button')).find(b => b.textContent.includes('Telegram'));
    fireEvent.click(telegramBtn2);

    await waitFor(() => {
      expect(screen.queryByText('ANGEL')).not.toBeInTheDocument();
    });

    // Click Toutes to show all again
    fireEvent.click(screen.getByText('Toutes'));

    await waitFor(() => {
      expect(screen.getByText('ANGEL')).toBeInTheDocument();
      expect(screen.getByText('LUNA')).toBeInTheDocument();
    });
  });

  // ─── Locked period ───
  test('shows lock warning when period is locked', async () => {
    setupMocks({ ventes: [makeVente()], locked: true });
    renderWithProviders(<MesVentes />);
    await waitFor(() => {
      expect(screen.getByText(/période est validée/)).toBeInTheDocument();
    });
    expect(screen.queryByText('Ajouter')).not.toBeInTheDocument();
  });

  test('shows edit/delete buttons when period is not locked', async () => {
    setupMocks({ ventes: [makeVente()], locked: false });
    renderWithProviders(<MesVentes />);
    await waitFor(() => {
      expect(screen.getByTitle('Modifier')).toBeInTheDocument();
      expect(screen.getByTitle('Supprimer')).toBeInTheDocument();
    });
  });

  test('hides edit/delete buttons when period is locked', async () => {
    setupMocks({ ventes: [makeVente()], locked: true });
    renderWithProviders(<MesVentes />);
    await waitFor(() => {
      expect(screen.getByText('ANGEL')).toBeInTheDocument();
    });
    expect(screen.queryByTitle('Modifier')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Supprimer')).not.toBeInTheDocument();
  });

  // ─── Status badges ───
  test('shows en_attente badge for pending ventes', async () => {
    setupMocks({ ventes: [makeVente({ statut: 'en_attente' })] });
    renderWithProviders(<MesVentes />);
    await waitFor(() => {
      expect(screen.getByText('En attente')).toBeInTheDocument();
    });
  });

  test('shows Rejetée badge for rejected ventes', async () => {
    setupMocks({ ventes: [makeVente({ statut: 'rejetée' })] });
    renderWithProviders(<MesVentes />);
    await waitFor(() => {
      expect(screen.getByText('Rejetée')).toBeInTheDocument();
    });
  });

  test('does not show status badge for validée ventes', async () => {
    setupMocks({ ventes: [makeVente({ statut: 'validée' })] });
    renderWithProviders(<MesVentes />);
    await waitFor(() => {
      expect(screen.getByText('ANGEL')).toBeInTheDocument();
    });
    expect(screen.queryByText('En attente')).not.toBeInTheDocument();
    expect(screen.queryByText('Rejetée')).not.toBeInTheDocument();
  });

  // ─── Error state ───
  test('shows fetch error with retry button', async () => {
    api.get.mockRejectedValue(new Error('Network error'));
    renderWithProviders(<MesVentes />);
    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger/)).toBeInTheDocument();
      expect(screen.getByText('Réessayer')).toBeInTheDocument();
    });
  });
});
