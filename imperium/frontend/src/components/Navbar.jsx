import { useAuth } from '../context/AuthContext.jsx';
import { LogOut, User } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header
      style={{
        height: '64px',
        background: '#1a2744',
        borderBottom: '1px solid rgba(201, 168, 76, 0.15)',
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
      {/* Logo */}
      <span
        style={{
          fontFamily: 'Cinzel, serif',
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#c9a84c',
          letterSpacing: '0.15em',
          textDecoration: 'none',
        }}
      >
        IMPERIUM
      </span>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {user && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(201, 168, 76, 0.15)',
                border: '1px solid rgba(201, 168, 76, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <User size={15} color="#c9a84c" />
            </div>
            <div>
              <p
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#f5f0eb',
                  lineHeight: 1.2,
                }}
              >
                {user.prenom || user.username}
              </p>
              <p
                style={{
                  fontSize: '0.65rem',
                  color: '#9aa5b4',
                  textTransform: 'capitalize',
                }}
              >
                {user.role}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={logout}
          className="btn-ghost"
          title="Se déconnecter"
          style={{ padding: '0.4rem 0.6rem' }}
        >
          <LogOut size={16} />
          <span style={{ fontSize: '0.8rem' }}>Déconnexion</span>
        </button>
      </div>
    </header>
  );
}
