import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LogOut, User, Menu } from 'lucide-react';

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header
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
        className="mobile-menu-btn"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: '#1b2e4b',
          padding: '0.4rem',
          borderRadius: '8px',
          display: 'none',
          alignItems: 'center',
        }}
      >
        <Menu size={22} />
      </button>

      {/* Spacer for desktop */}
      <div className="desktop-spacer" />

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {user && (
          <button
            onClick={() => navigate(user.role === 'admin' ? '/admin/settings' : '/chatteur/dashboard')}
            title="Paramètres"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem',
              borderRadius: '24px',
              transition: 'background 200ms',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,183,49,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            {user.photo ? (
              <img src={user.photo} alt="" style={{
                width: 36, height: 36, borderRadius: '50%', objectFit: 'cover',
                border: '2px solid rgba(245, 183, 49, 0.3)',
              }} />
            ) : (
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'rgba(245, 183, 49, 0.12)',
                  border: '2px solid rgba(245, 183, 49, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <User size={16} color="#f5b731" />
              </div>
            )}
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
              <p
                style={{
                  fontSize: '0.65rem',
                  color: '#64748b',
                  textTransform: 'capitalize',
                }}
              >
                {user.role}
              </p>
            </div>
          </button>
        )}

        <button
          onClick={logout}
          className="btn-ghost"
          title="Se déconnecter"
          style={{ padding: '0.4rem 0.6rem' }}
        >
          <LogOut size={16} />
          <span className="logout-text" style={{ fontSize: '0.8rem' }}>Déconnexion</span>
        </button>
      </div>

      <style>{`
        .desktop-spacer { display: block; }
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
