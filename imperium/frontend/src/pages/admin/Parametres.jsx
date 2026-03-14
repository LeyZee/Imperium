import { lazy, Suspense, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Users, Star, Globe, Activity, MessageSquare, Settings } from 'lucide-react';
import PageLoader from '../../components/PageLoader.jsx';

const Chatteurs = lazy(() => import('./Chatteurs.jsx'));
const Modeles = lazy(() => import('./Modeles.jsx'));
const Plateformes = lazy(() => import('./Plateformes.jsx'));
const ActivityLog = lazy(() => import('./ActivityLog.jsx'));
const TelegramBot = lazy(() => import('./TelegramBot.jsx'));

const TABS = [
  { key: 'equipe', label: 'Équipe', icon: Users, adminOnly: false, component: Chatteurs },
  { key: 'modeles', label: 'Modèles', icon: Star, adminOnly: true, component: Modeles },
  { key: 'plateformes', label: 'Plateformes', icon: Globe, adminOnly: true, component: Plateformes },
  { key: 'journal', label: 'Journal', icon: Activity, adminOnly: false, component: ActivityLog },
  { key: 'telegram', label: 'Telegram', icon: MessageSquare, adminOnly: true, component: TelegramBot },
];

export default function Parametres() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = user?.role === 'admin';

  const visibleTabs = TABS.filter(t => isAdmin || !t.adminOnly);
  const activeKey = searchParams.get('tab') || 'equipe';
  const activeTab = visibleTabs.find(t => t.key === activeKey) || visibleTabs[0];
  const ActiveComponent = activeTab.component;
  const tabsRef = useRef(null);

  // Scroll active tab into view on mobile
  useEffect(() => {
    if (!tabsRef.current) return;
    const activeBtn = tabsRef.current.querySelector('[data-active="true"]');
    if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeKey]);

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <Settings size={22} color="#f5b731" />
        <h1 className="text-navy" style={{ fontWeight: 700, margin: 0 }}>Paramètres</h1>
      </div>

      {/* Tabs */}
      <div ref={tabsRef} className="parametres-tabs" style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', borderBottom: '2px solid #e2e8f0', overflowX: 'auto' }}>
        {visibleTabs.map(tab => {
          const isActive = activeTab.key === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              data-active={isActive}
              onClick={() => setSearchParams({ tab: tab.key }, { replace: true })}
              style={{
                padding: '0.6rem 1.1rem', border: 'none', cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: isActive ? 600 : 400,
                color: isActive ? '#f5b731' : '#64748b',
                background: isActive ? 'rgba(245,183,49,0.08)' : 'transparent',
                borderBottom: isActive ? '2px solid #f5b731' : '2px solid transparent',
                marginBottom: '-2px', transition: 'all 200ms',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                whiteSpace: 'nowrap', borderRadius: '6px 6px 0 0',
              }}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <Suspense fallback={<PageLoader />}>
        <ActiveComponent embedded />
      </Suspense>
    </div>
  );
}
