import { useState } from 'react';
import { NavLink } from 'react-router-dom';
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
];

const chatteurItems = [
  { to: '/chatteur/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/chatteur/planning', icon: ClipboardList, label: 'Mon Planning' },
  { to: '/chatteur/factures', icon: FileText, label: 'Mes Factures' },
];

export default function Sidebar({ role }) {
  const [collapsed, setCollapsed] = useState(false);
  const items = role === 'admin' ? adminItems : chatteurItems;

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="sidebar-mobile-overlay"
          onClick={() => setCollapsed(true)}
          style={{
            display: 'none',
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 199,
          }}
        />
      )}

      <aside
        style={{
          width: collapsed ? '64px' : '256px',
          minWidth: collapsed ? '64px' : '256px',
          background: '#1a2744',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 200ms ease, min-width 200ms ease',
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
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}
        >
          {!collapsed && (
            <span
              style={{
                fontFamily: 'Cinzel, serif',
                fontSize: '1rem',
                fontWeight: 700,
                color: '#c9a84c',
                letterSpacing: '0.12em',
                whiteSpace: 'nowrap',
              }}
            >
              IMPERIUM
            </span>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#9aa5b4',
              padding: '0.4rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 200ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#c9a84c')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#9aa5b4')}
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
                color: isActive ? '#c9a84c' : '#9aa5b4',
                background: isActive ? 'rgba(201, 168, 76, 0.1)' : 'transparent',
                borderLeft: isActive ? '2px solid #c9a84c' : '2px solid transparent',
                transition: 'all 200ms ease',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              })}
              onMouseEnter={(e) => {
                const link = e.currentTarget;
                if (!link.style.color.includes('201')) {
                  link.style.color = '#c9a84c';
                  link.style.background = 'rgba(201, 168, 76, 0.06)';
                }
              }}
              onMouseLeave={(e) => {
                const link = e.currentTarget;
                // NavLink manages active state via className/style above
                // re-render handles it
              }}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={18}
                    color={isActive ? '#c9a84c' : '#9aa5b4'}
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
              borderTop: '1px solid rgba(255,255,255,0.06)',
              fontSize: '0.7rem',
              color: '#6b7280',
              textAlign: 'center',
            }}
          >
            IMPERIUM © 2026
          </div>
        )}
      </aside>
    </>
  );
}
