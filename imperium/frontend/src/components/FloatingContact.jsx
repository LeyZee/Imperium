import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const C = {
  gold: '#d4a04a',
  goldDark: '#b8862e',
  navyDark: '#162a47',
};

function haptic(intensity = 'light') {
  if (!navigator.vibrate) return;
  const patterns = { light: [8], medium: [15], heavy: [30] };
  navigator.vibrate(patterns[intensity] || [8]);
}

// Only show on public pages
const PUBLIC_PATHS = ['/', '/equipe', '/imperium', '/contact'];

export default function FloatingContact() {
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const location = useLocation();

  const isPublicPage = PUBLIC_PATHS.includes(location.pathname);

  // Show after a short scroll delay
  useEffect(() => {
    if (!isPublicPage) return;
    setDismissed(false);

    const onScroll = () => {
      setVisible(window.scrollY > 300);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isPublicPage, location.pathname]);

  if (!isPublicPage || dismissed || !visible) return null;

  // Don't show on contact page itself
  if (location.pathname === '/contact') return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '2rem',
      right: '2rem',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      animation: 'floatingContactIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both',
    }}>
      <style>{`
        @keyframes floatingContactIn {
          from { opacity: 0; transform: translateY(20px) scale(0.8); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes floatingContactPulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(212, 160, 74, 0.3); }
          50% { box-shadow: 0 4px 30px rgba(212, 160, 74, 0.5); }
        }
      `}</style>

      {/* Main button */}
      <a
        href="/contact"
        onClick={() => haptic('medium')}
        onMouseEnter={e => {
          setHovered(true);
          haptic('light');
          e.currentTarget.style.transform = 'translateY(-3px)';
          e.currentTarget.style.boxShadow = '0 8px 30px rgba(212, 160, 74, 0.45)';
        }}
        onMouseLeave={e => {
          setHovered(false);
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(212, 160, 74, 0.3)';
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.85rem 1.4rem',
          background: `linear-gradient(135deg, ${C.gold}, ${C.goldDark})`,
          color: C.navyDark,
          textDecoration: 'none',
          borderRadius: '50px',
          fontSize: '0.78rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
          boxShadow: '0 4px 20px rgba(212, 160, 74, 0.3)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          animation: 'floatingContactPulse 3s ease-in-out infinite',
          cursor: 'pointer',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.navyDark} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M22 4L12 13 2 4" />
        </svg>
        Nous contacter
      </a>

      {/* Close button */}
      <button
        onClick={e => {
          e.stopPropagation();
          haptic('light');
          setDismissed(true);
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
        }}
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '0.75rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          padding: 0,
          lineHeight: 1,
        }}
        aria-label="Fermer"
      >
        ✕
      </button>
    </div>
  );
}
