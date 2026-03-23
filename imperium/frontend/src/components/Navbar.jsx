import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LogOut, Menu } from 'lucide-react';
import NotificationPanel from './NotificationPanel.jsx';
import { CHATTEUR_COLORS } from '../constants/colors.js';

const ROLE_COLORS = {
  chatteur: { bg: '#dbeafe', color: '#1e40af' },
  manager: { bg: '#fef3c7', color: '#b45309' },
  directeur: { bg: '#ede9fe', color: '#6366f1' },
  va: { bg: '#f3e8ff', color: '#7c3aed' },
  admin: { bg: '#fef3c7', color: '#92400e' },
  modele: { bg: '#fce7f3', color: '#be185d' },
};
const ROLE_LABELS = { chatteur: 'Chatteur', manager: 'Manager', directeur: 'Directeur', va: 'VA', admin: 'Admin', modele: 'Modèle' };

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header
      role="banner"
      style={{
        height: '64px',
        background: '#ffffff',
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        flexShrink: 0,
        zIndex: 100,
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Left side - mobile menu button */}
      <button
        onClick={onMenuClick}
        aria-label="Ouvrir le menu"
        className="mobile-menu-btn navbar-icon-btn"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: '#1b2e4b',
          padding: '0.4rem',
          borderRadius: '12px',
          display: 'none',
          alignItems: 'center',
          transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <Menu size={22} />
      </button>

      {/* Spacer for desktop */}
      <div className="desktop-spacer" />

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {user && <NotificationPanel />}
        {user && (
          <button
            onClick={() => navigate(user.role === 'modele' ? '/modele/profil' : user.role === 'admin' ? '/admin/settings' : user.role === 'manager' ? '/manager/settings' : '/chatteur/profil')}
            title="Paramètres"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.35rem 0.5rem',
              borderRadius: '24px',
              transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
            className="hover-profile"
          >
            {(() => {
              const clr = user.couleur != null ? CHATTEUR_COLORS[user.couleur] : null;
              const modelClr = user.couleur_fond ? { bg: user.couleur_fond, text: user.couleur_texte || '#fff', border: user.couleur_fond + '60' } : null;
              const avatarBg = clr?.bg || modelClr?.bg || ROLE_COLORS[user.role]?.bg || '#f1f5f9';
              const avatarText = clr?.text || modelClr?.text || ROLE_COLORS[user.role]?.color || '#475569';
              const avatarBorder = clr?.border || modelClr?.border || `${ROLE_COLORS[user.role]?.color || '#f5b731'}30`;
              return user.photo ? (
                <img src={user.photo} alt="" style={{
                  width: 36, height: 36, borderRadius: '50%', objectFit: 'cover',
                  border: `2px solid ${avatarBorder}`,
                }} />
              ) : (
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: avatarBg, border: `2px solid ${avatarBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.85rem', fontWeight: 700, color: avatarText,
                }}>
                  {(user.prenom || user.email || '?')[0].toUpperCase()}
                </div>
              );
            })()}
            <div className="user-info-text" style={{ textAlign: 'left' }}>
              <p
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#1a1f2e',
                  lineHeight: 1.2,
                }}
              >
                {user.prenom || user.email}</p>
              <span
                style={{
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  padding: '0.1rem 0.4rem',
                  borderRadius: '20px',
                  background: ROLE_COLORS[user.role]?.bg || '#f1f5f9',
                  color: ROLE_COLORS[user.role]?.color || '#475569',
                  textTransform: 'capitalize',
                }}
              >
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </div>
          </button>
        )}

        <button
          onClick={logout}
          className="btn-ghost navbar-icon-btn"
          title="Se déconnecter"
          aria-label="Se déconnecter"
          style={{ padding: '0.4rem 0.6rem', borderRadius: '12px', transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)' }}
        >
          <LogOut size={16} />
          <span className="logout-text" style={{ fontSize: '0.8rem' }}>Déconnexion</span>
        </button>
      </div>

      <style>{`
        .desktop-spacer { display: block; }

        .navbar-icon-btn {
          position: relative;
        }
        .navbar-icon-btn:hover {
          background: rgba(27, 46, 75, 0.06) !important;
          transform: scale(1.08);
        }
        .navbar-icon-btn:active {
          transform: scale(0.92);
          background: rgba(27, 46, 75, 0.1) !important;
        }

        .hover-profile {
          position: relative;
        }
        .hover-profile:hover {
          background: rgba(27, 46, 75, 0.04) !important;
          transform: scale(1.03);
        }
        .hover-profile:active {
          transform: scale(0.96);
          background: rgba(27, 46, 75, 0.08) !important;
        }
        .hover-profile:hover div:first-child {
          box-shadow: 0 0 0 3px rgba(245, 183, 49, 0.25);
        }

        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex !important; }
          .desktop-spacer { display: none; }
          .logout-text { display: none; }
          .user-info-text { display: none; }
        }
      `}</style>
    </header>
  );
}
