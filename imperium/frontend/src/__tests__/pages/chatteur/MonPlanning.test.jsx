import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../helpers/renderWithProviders.jsx';
import { mockApiGet, makeShift, makeChatteur } from '../../helpers/mockApi.js';
import MonPlanning from '../../../pages/chatteur/MonPlanning.jsx';

vi.mock('../../../api/index.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../../hooks/usePolling.js', () => ({ default: vi.fn() }));

import api from '../../../api/index.js';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function setupMocks({ shifts = [], chatteur = makeChatteur() } = {}) {
  mockApiGet(api, {
    '/api/shifts/semaine': { shifts },
    '/api/chatteurs/1': chatteur,
  });
}

describe('MonPlanning', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  test('shows "Mon Planning" heading', async () => {
    setupMocks();
    renderWithProviders(<MonPlanning />);
    await waitFor(() => {
      expect(screen.getByText('Mon Planning')).toBeInTheDocument();
    });
  });

  test('shows shift count text', async () => {
    setupMocks({ shifts: [makeShift({ date: todayStr() })] });
    renderWithProviders(<MonPlanning />);
    await waitFor(() => {
      expect(screen.getByText(/1 shift cette semaine/)).toBeInTheDocument();
    });
  });

  test('empty day shows "Repos"', async () => {
    setupMocks();
    renderWithProviders(<MonPlanning />);
    await waitFor(() => {
      const reposElements = screen.getAllByText('Repos');
      expect(reposElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  test('today card has AUJOURD\'HUI badge', async () => {
    setupMocks({ shifts: [makeShift({ date: todayStr(), creneau: 3 })] });
    renderWithProviders(<MonPlanning />);
    await waitFor(() => {
      expect(screen.getByText("AUJOURD'HUI")).toBeInTheDocument();
    });
  });

  test('week navigation changes displayed week', async () => {
    setupMocks();
    renderWithProviders(<MonPlanning />);

    await waitFor(() => {
      expect(screen.getByText(/Sem\. du/)).toBeInTheDocument();
    });

    const initialText = screen.getByText(/Sem\. du/).textContent;

    // Click next week button (second chevron button)
    const buttons = document.querySelectorAll('.btn-ghost');
    fireEvent.click(buttons[1]); // next button

    await waitFor(() => {
      expect(screen.getByText(/Sem\. du/).textContent).not.toBe(initialText);
    });
  });

  test('timezone banner shows chatteur country', async () => {
    setupMocks({ chatteur: makeChatteur({ pays: 'Benin' }) });
    renderWithProviders(<MonPlanning />);
    await waitFor(() => {
      expect(screen.getByText(/Horaires affich.s en heure locale/)).toBeInTheDocument();
      expect(screen.getByText(/Benin|Bénin/)).toBeInTheDocument();
    });
  });

  test('shifts display platform and model badges', async () => {
    setupMocks({
      shifts: [makeShift({ date: todayStr(), plateforme_nom: 'OnlyFans', modele_pseudo: 'ANGEL' })],
    });
    renderWithProviders(<MonPlanning />);
    await waitFor(() => {
      expect(screen.getByText('OnlyFans')).toBeInTheDocument();
      expect(screen.getByText('ANGEL')).toBeInTheDocument();
    });
  });

  test('shows 0 shifts when no shifts for current user', async () => {
    // Shifts exist but for a different chatteur_id
    setupMocks({ shifts: [makeShift({ chatteur_id: 999, date: todayStr() })] });
    renderWithProviders(<MonPlanning />);
    await waitFor(() => {
      expect(screen.getByText(/0 shift/)).toBeInTheDocument();
    });
  });
});
