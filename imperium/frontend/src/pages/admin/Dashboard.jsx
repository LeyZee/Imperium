import { useState, useEffect } from 'react';
import { Euro, Building2, Users, Trophy, TrendingUp, TrendingDown, Calendar, ClipboardList, CreditCard, ChevronDown, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/index.js';
import StatCard from '../../components/StatCard.jsx';

function formatPeriodLabel(debut, fin) {
  const d = new Date(debut + 'T00:00:00');
  const f = new Date(fin + 'T00:00:00');
  const mois = d.toLocaleDateString('fr-FR', { month: 'short' });
  const moisFin = f.toLocaleDateString('fr-FR', { month: 'short' });
  const day = d.getDate();
  const dayFin = f.getDate();

  if (d.getMonth() === f.getMonth() || dayFin === 1) {
    return `${day} - ${dayFin === 1 ? '1' : dayFin} ${dayFin === 1 ? moisFin : mois} ${f.getFullYear()}`;
  }
  return `${day} ${mois} - ${dayFin} ${moisFin} ${f.getFullYear()}`;
}

function TrendBadge({ value }) {
  if (value === 0 || value === undefined) return null;
  const isUp = value > 0;
  const Icon = isUp ? TrendingUp : TrendingDown;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
      fontSize: '0.7rem', fontWeight: 600,
      color: isUp ? '#10b981' : '#ef4444',
      background: isUp ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
      padding: '0.15rem 0.45rem', borderRadius: '20px',
    }}>
      <Icon size={12} />
      {isUp ? '+' : ''}{value}%
    </span>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const navigate = useNavigate();

  async function fetchDashboard(debut, fin) {
    setLoading(true);
    try {
      const params = debut && fin ? `?debut=${debut}&fin=${fin}` : '';
      const res = await api.get(`/api/dashboard${params}`);
      setData(res.data);
      if (!selectedPeriod) {
        setSelectedPeriod(res.data.periode);
      }
    } catch {
      setError('Impossible de charger les données du dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchDashboard(); }, []);

  function selectPeriod(p) {
    setSelectedPeriod(p);
    setShowPeriodDropdown(false);
    fetchDashboard(p.debut, p.fin);
  }

  const stats = data
    ? [
        {
          title: 'Total Ventes',
          value: `${(data.totalBrutEur || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`,
          subtitle: <TrendBadge value={data.tendances?.ventes} />,
          icon: Euro,
          color: '#f5b731',
        },
        {
          title: 'Net Agence',
          value: `${(data.totalNetHt || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`,
          subtitle: <TrendBadge value={data.tendances?.netAgence} />,
          icon: Building2,
          color: '#10b981',
        },
        {
          title: 'Chatteurs actifs',
          value: data.nbChatteurs ?? '—',
          subtitle: 'En activité',
          icon: Users,
          color: '#1b2e4b',
        },
        {
          title: 'Top Chatteur',
          value: data.topChatteur ? data.topChatteur.prenom : '—',
          subtitle: data.topChatteur?.total
            ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {data.topChatteur.total.toLocaleString('fr-FR')} € <TrendBadge value={data.tendances?.topChatteur} />
              </span>
            : '',
          icon: Trophy,
          color: '#f59e0b',
        },
      ]
    : null;

  const quickActions = [
    { label: 'Planning', icon: Calendar, path: '/admin/shifts', color: '#6366f1' },
    { label: 'Ventes', icon: ClipboardList, path: '/admin/ventes', color: '#f5b731' },
    { label: 'Paies', icon: CreditCard, path: '/admin/paies', color: '#10b981' },
  ];

  return (
    <div className="fade-in">
      {/* Header with period selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="text-navy" style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Dashboard</h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Vue d'ensemble de l'agence</p>
        </div>

        {/* Period selector */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
          >
            <Calendar size={14} />
            {selectedPeriod ? formatPeriodLabel(selectedPeriod.debut, selectedPeriod.fin) : 'Période...'}
            <ChevronDown size={14} style={{ transition: 'transform 200ms', transform: showPeriodDropdown ? 'rotate(180deg)' : 'none' }} />
          </button>

          {showPeriodDropdown && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowPeriodDropdown(false)} />
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: '0.35rem',
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                zIndex: 50, minWidth: '220px', overflow: 'hidden',
                animation: 'modalCardIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}>
                {(data?.periodes || []).map((p, i) => {
                  const isActive = selectedPeriod?.debut === p.debut && selectedPeriod?.fin === p.fin;
                  return (
                    <button key={i} onClick={() => selectPeriod(p)} style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '0.6rem 1rem', border: 'none', cursor: 'pointer',
                      background: isActive ? 'rgba(245,183,49,0.1)' : 'transparent',
                      color: isActive ? '#f5b731' : 'var(--text-primary)',
                      fontWeight: isActive ? 600 : 400, fontSize: '0.8rem',
                      transition: 'background 150ms',
                    }}
                    onMouseEnter={e => { if (!isActive) e.target.style.background = 'rgba(0,0,0,0.03)'; }}
                    onMouseLeave={e => { if (!isActive) e.target.style.background = 'transparent'; }}
                    >
                      {formatPeriodLabel(p.debut, p.fin)}
                      {i === 0 && <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginLeft: '0.5rem' }}>(en cours)</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && <div className="toast-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Stats */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card" style={{ height: '100px', animation: 'pulse 1.5s ease infinite', opacity: 0.5 }} />
          ))}
        </div>
      ) : stats ? (
        <div className="stats-grid stagger-children">
          {stats.map((s) => (
            <StatCard key={s.title} {...s} />
          ))}
        </div>
      ) : null}

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {quickActions.map(a => (
          <button
            key={a.label}
            onClick={() => navigate(a.path)}
            className="card hover-lift"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              cursor: 'pointer', border: '1px solid var(--border-subtle)',
              textAlign: 'left', width: '100%',
            }}
          >
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: `${a.color}12`, border: `1px solid ${a.color}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <a.icon size={18} color={a.color} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{a.label}</span>
            </div>
            <ArrowRight size={14} color="#94a3b8" />
          </button>
        ))}
      </div>

      {/* Bottom row: Recent sales + Platform breakdown */}
      <div className="dashboard-bottom" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        {/* Recent sales */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>Dernières ventes</h3>
            <button onClick={() => navigate('/admin/ventes')} style={{
              fontSize: '0.7rem', color: '#f5b731', fontWeight: 600,
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.25rem',
            }}>
              Voir tout <ArrowRight size={12} />
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Chatteur</th>
                  <th>Modèle</th>
                  <th>Plateforme</th>
                  <th style={{ textAlign: 'right' }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {(data?.dernieresVentes || []).map((v) => (
                  <tr key={v.id}>
                    <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                      {v.created_at ? new Date(v.created_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={{ fontWeight: 500 }}>{v.chatteur_prenom}</td>
                    <td style={{ color: '#64748b' }}>{v.modele_pseudo || '—'}</td>
                    <td><span className="badge badge-navy">{v.plateforme}</span></td>
                    <td style={{ textAlign: 'right', color: '#f5b731', fontWeight: 700 }}>
                      {v.montant_brut?.toLocaleString('fr-FR')} {v.devise === 'USD' ? '$' : '€'}
                    </td>
                  </tr>
                ))}
                {(!data?.dernieresVentes || data.dernieresVentes.length === 0) && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                      Aucune vente récente
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Platform breakdown */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>Répartition par plateforme</h3>
          </div>
          <div style={{ padding: '1.25rem' }}>
            {(data?.ventesParPlateforme || []).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {data.ventesParPlateforme.map(vp => {
                  const maxTotal = Math.max(...data.ventesParPlateforme.map(x => x.total));
                  const pct = maxTotal > 0 ? (vp.total / maxTotal) * 100 : 0;
                  return (
                    <div key={vp.plateforme}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{vp.plateforme}</span>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f5b731' }}>
                          {vp.total.toLocaleString('fr-FR')} €
                        </span>
                      </div>
                      <div style={{ height: '6px', borderRadius: '3px', background: '#f1f5f9', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: '3px',
                          background: 'linear-gradient(90deg, #f5b731, #f59e0b)',
                          width: `${pct}%`,
                          transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)',
                        }} />
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{vp.nb} vente{vp.nb > 1 ? 's' : ''}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0' }}>Aucune donnée</p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @media (max-width: 768px) {
          .dashboard-bottom-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
