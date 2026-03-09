import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CreditCard,
  Users,
  Star,
  Globe,
  Calendar,
  TrendingUp,
  BarChart2,
  ClipboardList,
  FileText,
  Menu,
  X,
  MessageSquare,
} from 'lucide-react';

const adminItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/paies', icon: CreditCard, label: 'Paies' },
  { to: '/admin/chatteurs', icon: Users, label: 'Chatteurs' },
  { to: '/admin/modeles', icon: Star, label: 'Modèles' },
  { to: '/admin/plateformes', icon: Globe, label: 'Plateformes' },
  { to: '/admin/shifts', icon: Calendar, label: 'Shifts' },
  { to: '/admin/ventes', icon: TrendingUp, label: 'Ventes' },
  { to: '/admin/kpis', icon: BarChart2, label: 'KPIs' },
  { to: '/admin/telegram', icon: MessageSquare, label: 'Telegram Bot' },
];

const chatteurItems = [
  { to: '/chatteur/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/chatteur/planning', icon: ClipboardList, label: 'Mon Planning' },
  { to: '/chatteur/factures', icon: FileText, label: 'Mes Factures' },
];

export default function Sidebar({ role, mobileOpen, onMobileClose }) {
  const [collapsed, setCollapsed] = useState(false);
  const items = role === 'admin' ? adminItems : chatteurItems;
  const location = useLocation();

  // Close mobile sidebar on navigation
  useEffect(() => {
    if (mobileOpen) onMobileClose?.();
  }, [location.pathname]);

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={onMobileClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 199,
          }}
        />
      )}

      <aside
        className="sidebar"
        style={{
          '--sidebar-w': collapsed ? '64px' : '256px',
          width: 'var(--sidebar-w)',
          minWidth: 'var(--sidebar-w)',
          background: '#1b2e4b',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 200ms ease, min-width 200ms ease, transform 250ms ease',
          overflow: 'hidden',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 200,
        }}
      >
        {/* Header */}
        <div
          style={{
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            padding: collapsed ? '0' : '0 1rem 0 1.25rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        >
          {!collapsed && (
            <span
              style={{
                fontFamily: 'Cinzel, serif',
                fontSize: '1rem',
                fontWeight: 700,
                color: '#f5b731',
                letterSpacing: '0.12em',
                whiteSpace: 'nowrap',
              }}
            >
              IMPERIUM
            </span>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="sidebar-collapse-btn"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.5)',
              padding: '0.4rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 200ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f5b731')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
          >
            {collapsed ? <Menu size={18} /> : <X size={18} />}
          </button>
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: '0.75rem 0', overflowY: 'auto', overflowX: 'hidden' }}>
          {items.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.625rem 1.25rem',
                margin: '2px 0.5rem',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#f5b731' : 'rgba(255,255,255,0.6)',
                background: isActive ? 'rgba(245, 183, 49, 0.12)' : 'transparent',
                borderLeft: isActive ? '2px solid #f5b731' : '2px solid transparent',
                transition: 'all 200ms ease',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              })}
              onMouseEnter={(e) => {
                const link = e.currentTarget;
                if (!link.classList.contains('active')) {
                  link.style.color = '#f5b731';
                  link.style.background = 'rgba(245, 183, 49, 0.06)';
                }
              }}
              onMouseLeave={(e) => {
                const link = e.currentTarget;
                if (!link.classList.contains('active')) {
                  link.style.color = 'rgba(255,255,255,0.6)';
                  link.style.background = 'transparent';
                }
              }}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={18}
                    color={isActive ? '#f5b731' : 'rgba(255,255,255,0.5)'}
                    strokeWidth={isActive ? 2 : 1.5}
                    style={{ flexShrink: 0 }}
                  />
                  {!collapsed && <span>{label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div
            style={{
              padding: '1rem 1.25rem',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              fontSize: '0.7rem',
              color: 'rgba(255,255,255,0.3)',
              textAlign: 'center',
            }}
          >
            IMPERIUM &copy; 2026
          </div>
        )}
      </aside>

      <style>{`
        @media (max-width: 768px) {
          .sidebar {
            position: fixed !important;
            left: 0;
            top: 0;
            width: 280px !important;
            min-width: 280px !important;
            transform: translateX(${mobileOpen ? '0' : '-100%'});
          }
          .sidebar-collapse-btn {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
