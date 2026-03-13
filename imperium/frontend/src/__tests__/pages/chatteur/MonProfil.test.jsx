import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders, mockUser } from '../../helpers/renderWithProviders.jsx';
import { mockApiGet, makeChatteur } from '../../helpers/mockApi.js';
import MonProfil from '../../../pages/chatteur/MonProfil.jsx';

vi.mock('../../../api/index.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../../../api/index.js';

function setupMocks(chatteurOverrides = {}) {
  mockApiGet(api, {
    '/api/chatteurs/1': makeChatteur(chatteurOverrides),
  });
}

describe('MonProfil', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  test('shows error state with retry button on API failure', async () => {
    api.get.mockImplementation(() => Promise.reject(new Error('fail')));
    renderWithProviders(<MonProfil />);
    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger ton profil/)).toBeInTheDocument();
    });
    expect(screen.getByText('Réessayer')).toBeInTheDocument();
  });

  test('shows chatteur prenom in header', async () => {
    setupMocks();
    renderWithProviders(<MonProfil />);
    await waitFor(() => {
      expect(screen.getByText('AXEL')).toBeInTheDocument();
    });
  });

  test('shows fallback avatar when no photo', async () => {
    setupMocks({ photo: null });
    renderWithProviders(<MonProfil />);
    await waitFor(() => {
      expect(screen.getByText('AXEL')).toBeInTheDocument();
    });
    // No <img> for avatar, should have the User icon fallback
    const avatarImgs = document.querySelectorAll('img[alt*="Profil"], img[alt*="AXEL"]');
    expect(avatarImgs.length).toBe(0);
  });

  test('shows photo when provided', async () => {
    setupMocks({ photo: 'https://example.com/axel.jpg' });
    renderWithProviders(<MonProfil />, {
      user: { ...mockUser, photo: 'https://example.com/axel.jpg' },
    });
    await waitFor(() => {
      const img = document.querySelector('img[alt*="AXEL"], img[alt*="Profil"]');
      expect(img).toBeInTheDocument();
      expect(img.src).toContain('axel.jpg');
    });
  });

  test('shows email, pays, commission rate, role', async () => {
    setupMocks({ taux_commission: 0.15 });
    renderWithProviders(<MonProfil />);
    await waitFor(() => {
      expect(screen.getByText('axel@impera-agency.com')).toBeInTheDocument();
      expect(screen.getAllByText('Benin').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/15%/)).toBeInTheDocument();
      expect(screen.getAllByText('Chatteur').length).toBeGreaterThanOrEqual(1);
    });
  });

  test('"Changer mon mot de passe" button toggles form', async () => {
    setupMocks();
    renderWithProviders(<MonProfil />);
    await waitFor(() => {
      expect(screen.getByText('Changer mon mot de passe')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Changer mon mot de passe'));

    await waitFor(() => {
      expect(screen.getByText('Changer le mot de passe')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Mot de passe actuel')).toBeInTheDocument();
    });
  });

  test('password mismatch shows inline error', async () => {
    setupMocks();
    renderWithProviders(<MonProfil />);
    await waitFor(() => { expect(screen.getByText('Changer mon mot de passe')).toBeInTheDocument(); });

    fireEvent.click(screen.getByText('Changer mon mot de passe'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Min\. 8/)).toBeInTheDocument();
    });

    // Fill new password and different confirm
    fireEvent.change(screen.getByPlaceholderText(/Min\. 8/), { target: { value: 'Test1234!' } });
    fireEvent.change(screen.getByPlaceholderText('Confirmer le mot de passe'), { target: { value: 'Different1!' } });

    await waitFor(() => {
      expect(screen.getByText('Les mots de passe ne correspondent pas')).toBeInTheDocument();
    });
  });

  test('cancel button hides password form', async () => {
    setupMocks();
    renderWithProviders(<MonProfil />);
    await waitFor(() => { expect(screen.getByText('Changer mon mot de passe')).toBeInTheDocument(); });

    fireEvent.click(screen.getByText('Changer mon mot de passe'));
    await waitFor(() => {
      expect(screen.getByText('Annuler')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Annuler'));
    await waitFor(() => {
      expect(screen.getByText('Changer mon mot de passe')).toBeInTheDocument();
      expect(screen.queryByText('Annuler')).not.toBeInTheDocument();
    });
  });

  test('retry button refetches profile', async () => {
    let callCount = 0;
    api.get.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error('fail'));
      return Promise.resolve({ data: makeChatteur() });
    });

    renderWithProviders(<MonProfil />);
    await waitFor(() => {
      expect(screen.getByText('Réessayer')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Réessayer'));
    await waitFor(() => {
      expect(screen.getByText('AXEL')).toBeInTheDocument();
    });
  });
});
