import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../components/Toast.jsx';
import AuthContext from '../../context/AuthContext.jsx';

/** Default mock user (chatteur AXEL) */
export const mockUser = {
  id: 1,
  username: 'axel',
  role: 'chatteur',
  chatteur_id: 1,
  prenom: 'AXEL',
  email: 'axel@impera-agency.com',
  photo: null,
};

/**
 * Render a component wrapped in all required providers.
 * @param {ReactElement} ui - Component to render
 * @param {object} opts
 * @param {object|null} opts.user - Override user (null = no user)
 * @param {string} opts.route - Initial route (default '/')
 * @param {object} opts.renderOpts - Extra render options
 */
export function renderWithProviders(ui, { user = mockUser, route = '/', ...renderOpts } = {}) {
  const authValue = {
    user,
    loading: false,
    login: async () => user,
    logout: async () => {},
    refreshUser: () => {},
  };

  function Wrapper({ children }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <AuthContext.Provider value={authValue}>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOpts });
}
