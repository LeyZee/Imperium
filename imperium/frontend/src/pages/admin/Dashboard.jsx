import { useState, useEffect } from 'react';
import { Euro, Building2, Users, Trophy, TrendingUp, TrendingDown, Calendar, ClipboardList, CreditCard, ChevronDown, ArrowRight, AlertTriangle, RefreshCw, Gift, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/index.js';
import StatCard from '../../components/StatCard.jsx';
import { CardSkeleton } from '../../components/Skeleton.jsx';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

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

/* ── Feature A: Donut Chart Modèles ── */
const DONUT_COLORS = ['#f5b731', '#1b2e4b', '#6366f1', '#10b981', '#ef4444', '#8b5cf6', '#f97316', '#06b6d4'];

function CustomDonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: '8px', padding: '0.6rem 0.85rem',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '0.8rem',
    }}>
      <p style={{ fontWeight: 600, color: '#1b2e4b', marginBottom: '0.25rem' }}>{d.pseudo}</p>
      <p style={{ color: '#f5b731', fontWeight: 700 }}>
        {d.total_brut.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {"\u20ac"}
      </p>
      <p style={{ color: '#64748b', fontSize: '0.72rem' }}>
        {d.nb_ventes} vente{d.nb_ventes > 1 ? 's' : ''} {"\u00b7"} {d.percentage.toFixed(1)}%
      </p>
    </div>
  );
}

function DonutChartModeles({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
        <div style={{ width: 60, height: 60, margin: '0 auto 0.75rem', borderRadius: '50%', border: '6px solid #e2e8f0', borderTopColor: '#f5b731' }} />
        <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{"Aucune vente par mod\u00e8le pour cette p\u00e9riode"}</p>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.total_brut, 0);
  const chartData = data.map(d => ({
    ...d,
    pseudo: d.pseudo || 'Non assign\u00e9',
    percentage: total > 0 ? (d.total_brut / total) * 100 : 0,
  }));

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>{"Ventes par mod\u00e8le"}</h3>
      </div>
      <div style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ width: 180, height: 180, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="total_brut" stroke="none">
                {chartData.map((_, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomDonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {chartData.map((d, i) => (
            <div key={d.pseudo + i} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#1b2e4b', flex: 1 }}>{d.pseudo}</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1b2e4b' }}>
                {d.total_brut.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {"\u20ac"}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8', minWidth: 36, textAlign: 'right' }}>{d.percentage.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Feature B: Widget Cagnotte Prime ── */
function CagnotteWidget({ classementData, historiqueData }) {
  if (!classementData) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
        <Gift size={28} color="#cbd5e1" style={{ margin: '0 auto' }} />
        <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '0.75rem' }}>{"Donn\u00e9es de la cagnotte non disponibles"}</p>
      </div>
    );
  }

  const { classement, total_net_ht_equipe, prime_rates } = classementData;
  const top3 = (classement || []).slice(0, 3);
  const totalPrimePool = top3.reduce((s, _, i) => s + (total_net_ht_equipe * (prime_rates[i] || 0)), 0);

  const moyennePrime = historiqueData?.moyenne_prime_pool || 0;
  const trendPct = moyennePrime > 0
    ? parseFloat((((totalPrimePool - moyennePrime) / moyennePrime) * 100).toFixed(1))
    : null;

  const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Gift size={16} color="#f5b731" />
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>Cagnotte Prime</h3>
        </div>
        {trendPct !== null && <TrendBadge value={trendPct} />}
      </div>
      <div style={{ padding: '1.25rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 500, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
            {"Pool total (p\u00e9riode)"}
          </p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f5b731' }}>
            {totalPrimePool.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {"\u20ac"}
          </p>
          <p style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            Sur {total_net_ht_equipe.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {"\u20ac"} net HT {"\u00e9quipe"}
          </p>
        </div>

        {top3.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {top3.map((c, i) => {
              const primeAmount = total_net_ht_equipe * (prime_rates[i] || 0);
              return (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.5rem 0.75rem', borderRadius: '8px',
                  background: i === 0 ? 'rgba(245,183,49,0.08)' : 'transparent',
                }}>
                  <span style={{ fontSize: '1rem' }}>{medals[i]}</span>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: '0.82rem', color: '#1b2e4b' }}>{c.prenom}</span>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{(prime_rates[i] * 100).toFixed(2)}%</span>
                  <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#10b981' }}>
                    +{primeAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {"\u20ac"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem', padding: '0.5rem 0' }}>
            {"Aucun classement pour cette p\u00e9riode"}
          </p>
        )}

        {moyennePrime > 0 && (
          <div style={{
            marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '8px',
            background: '#f8fafc', fontSize: '0.72rem', color: '#64748b',
          }}>
            {"Moyenne historique : "}{moyennePrime.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} {"\u20ac"} / {"p\u00e9riode"}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Feature C: Barres Évolution Net HT ── */
const MOIS_COURTS = ['Jan', 'F\u00e9v', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Ao\u00fbt', 'Sep', 'Oct', 'Nov', 'D\u00e9c'];

function CustomBarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: '8px', padding: '0.6rem 0.85rem',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '0.8rem',
    }}>
      <p style={{ color: '#64748b', fontSize: '0.72rem', marginBottom: '0.2rem', fontWeight: 500 }}>{d.fullLabel}</p>
      <p style={{ fontWeight: 700, color: '#f5b731', fontSize: '0.95rem' }}>
        {d.net_ht.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {"\u20ac"}
      </p>
    </div>
  );
}

function SalesEvolutionChart({ historiqueData }) {
  if (!historiqueData?.periodes || historiqueData.periodes.length < 2) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
        <TrendingUp size={28} color="#cbd5e1" style={{ margin: '0 auto' }} />
        <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '0.75rem' }}>{"Pas assez de donn\u00e9es pour afficher l'\u00e9volution"}</p>
      </div>
    );
  }

  // API returns ASC order — oldest first, newest last (left → right)
  const chartData = historiqueData.periodes.map(p => {
    const deb = new Date(p.periode_debut + 'T00:00:00');
    const fin = new Date(p.periode_fin + 'T00:00:00');
    const moisDeb = MOIS_COURTS[deb.getMonth()];
    const dayDeb = deb.getDate();
    const dayFin = fin.getDate();
    // Short label for X axis: "1-14 Jan" or "15-28 Fév"
    const shortLabel = `${dayDeb}-${dayFin} ${moisDeb}`;
    // Full label for tooltip
    const fullLabel = `${dayDeb} - ${dayFin} ${moisDeb} ${fin.getFullYear()}`;
    return {
      label: shortLabel,
      fullLabel,
      net_ht: parseFloat((p.total_net_ht_equipe || 0).toFixed(2)),
    };
  });

  // Compute delta between last two periods
  const last = chartData[chartData.length - 1]?.net_ht || 0;
  const prev = chartData[chartData.length - 2]?.net_ht || 0;
  const deltaPct = prev > 0 ? parseFloat((((last - prev) / prev) * 100).toFixed(1)) : null;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>
            {"\u00c9volution Net HT \u00c9quipe"}
          </h3>
          <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.15rem' }}>
            {chartData.length} {"derni\u00e8res p\u00e9riodes bimensuelles"}
          </p>
        </div>
        {deltaPct !== null && <TrendBadge value={deltaPct} />}
      </div>
      <div style={{ padding: '1rem 0.5rem 0.5rem 0' }}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barCategoryGap="20%">
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f5b731" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#e6a914" stopOpacity={0.6} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={50}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`}
              domain={[0, 'auto']}
            />
            <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(245,183,49,0.06)' }} />
            <Bar
              dataKey="net_ht"
              fill="url(#barGradient)"
              radius={[4, 4, 0, 0]}
              maxBarSize={50}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Main Dashboard ── */
export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [ventesParModele, setVentesParModele] = useState([]);
  const [cagnotteData, setCagnotteData] = useState(null);
  const [cagnotteHistorique, setCagnotteHistorique] = useState(null);
  const [enLigne, setEnLigne] = useState(null);
  const [previsionnel, setPrevisionnel] = useState(null);
  const [conflits, setConflits] = useState(null);
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

      // Fetch additional data for new widgets
      const pd = debut || res.data.periode?.debut;
      const pf = fin || res.data.periode?.fin;

      // Get next 14 days for conflict detection
      const now = new Date();
      const in13 = new Date(now); in13.setDate(now.getDate() + 13);
      const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

      const [modeleRes, classementRes, histRes, enLigneRes, prevRes, conflitsRes] = await Promise.all([
        api.get(`/api/ventes/par-modele?periode_debut=${pd}&periode_fin=${pf}`).catch(() => ({ data: [] })),
        api.get(`/api/chatteurs/classement?periode_debut=${pd}&periode_fin=${pf}`).catch(() => ({ data: null })),
        api.get('/api/chatteurs/classement/historique-cagnotte?nb_periodes=6').catch(() => ({ data: null })),
        api.get('/api/shifts/en-ligne').catch(() => ({ data: null })),
        api.get(`/api/paies/previsionnel?debut=${pd}&fin=${pf}`).catch(() => ({ data: null })),
        api.get(`/api/shifts/conflits?date_debut=${fmtDate(now)}&date_fin=${fmtDate(in13)}`).catch(() => ({ data: null })),
      ]);

      setVentesParModele(Array.isArray(modeleRes.data) ? modeleRes.data : []);
      setCagnotteData(classementRes.data || null);
      setCagnotteHistorique(histRes.data || null);
      setEnLigne(enLigneRes.data || null);
      setPrevisionnel(prevRes.data || null);
      setConflits(conflitsRes.data || null);
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
          value: `${(data.totalBrutEur || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} \u20ac`,
          subtitle: <TrendBadge value={data.tendances?.ventes} />,
          icon: Euro,
          color: '#f5b731',
        },
        {
          title: 'Net Agence',
          value: `${(data.totalNetHt || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} \u20ac`,
          subtitle: <TrendBadge value={data.tendances?.netAgence} />,
          icon: Building2,
          color: '#10b981',
        },
        {
          title: 'Chatteurs actifs',
          value: data.nbChatteurs ?? '\u2014',
          subtitle: 'En activit\u00e9',
          icon: Users,
          color: '#1b2e4b',
        },
        {
          title: 'Top Chatteur',
          value: data.topChatteur ? data.topChatteur.prenom : '\u2014',
          subtitle: data.topChatteur?.total
            ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {data.topChatteur.total.toLocaleString('fr-FR')} {"\u20ac"} <TrendBadge value={data.tendances?.topChatteur} />
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
    <div className="page-enter">
      {/* Header with period selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="text-navy" style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Dashboard</h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>{"Vue d'ensemble de l'agence"}</p>
        </div>

        {/* Period selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={() => fetchDashboard(selectedPeriod?.debut, selectedPeriod?.fin)} className="btn-ghost" title="Rafra\u00eechir" style={{ padding: '0.5rem' }}>
            <RefreshCw size={16} />
          </button>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
          >
            <Calendar size={14} />
            {selectedPeriod ? formatPeriodLabel(selectedPeriod.debut, selectedPeriod.fin) : 'P\u00e9riode...'}
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
                    className={!isActive ? 'hover-row' : ''}
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
      </div>

      {/* Error */}
      {error && <div className="toast-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Alerts */}
      {!loading && data && (data.totalBrutEur === 0 || data.nbChatteurs === 0) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1rem',
          background: '#fffbeb', border: '1px solid #fde68a',
        }}>
          <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', color: '#92400e' }}>
            {data.totalBrutEur === 0 ? 'Aucune vente pour cette p\u00e9riode.' : ''}
            {data.totalBrutEur === 0 && data.nbChatteurs === 0 ? ' ' : ''}
            {data.nbChatteurs === 0 ? 'Aucun chatteur actif.' : ''}
          </span>
        </div>
      )}

      {/* Conflict alert banner */}
      {!loading && conflits && (conflits.doublons?.length > 0 || conflits.non_couverts?.length > 0) && (
        <div
          onClick={() => navigate('/admin/shifts')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1rem',
            background: '#fef2f2', border: '1px solid #fecaca', cursor: 'pointer',
            transition: 'background 200ms',
          }}
        >
          <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', color: '#991b1b', flex: 1 }}>
            <strong>Conflits planning (14 prochains jours) :</strong>{' '}
            {conflits.doublons?.length > 0 && `${conflits.doublons.length} doublon${conflits.doublons.length > 1 ? 's' : ''}`}
            {conflits.doublons?.length > 0 && conflits.non_couverts?.length > 0 && ', '}
            {conflits.non_couverts?.length > 0 && `${conflits.non_couverts.length} cr\u00e9neau${conflits.non_couverts.length > 1 ? 'x' : ''} non couvert${conflits.non_couverts.length > 1 ? 's' : ''}`}
          </span>
          <ArrowRight size={14} color="#991b1b" />
        </div>
      )}

      {/* Stats */}
      {loading ? (
        <CardSkeleton count={4} />
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
            className="card hover-lift haptic"
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

      {/* ── En ligne + Prévisionnel ── */}
      {!loading && (enLigne || previsionnel) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          {/* Shifts en cours */}
          {enLigne && (() => {
            const CRENEAU_LABELS = { 1: '08h-14h', 2: '14h-20h', 3: '20h-02h', 4: '02h-08h' };
            const currentCreneau = enLigne.creneau_actuel;
            // Group all today's shifts by creneau (backend returns all shifts for today via en_ligne + we reconstruct)
            const allShifts = enLigne.all_shifts || [];
            const grouped = { 1: [], 2: [], 3: [], 4: [] };
            allShifts.forEach(s => {
              if (grouped[s.creneau]) grouped[s.creneau].push(s);
            });
            // Fallback: if backend doesn't return all_shifts, put en_ligne in current creneau
            if (allShifts.length === 0 && enLigne.en_ligne?.length > 0) {
              grouped[currentCreneau] = enLigne.en_ligne;
            }

            return (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={16} color="#f5b731" />
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>
                      Shifts en cours
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    {enLigne.total_shifts_today || 0} shifts aujourd'hui
                  </span>
                </div>
                <div style={{ padding: '0.5rem 0' }}>
                  {[1, 2, 3, 4].map(creneau => {
                    const isCurrent = creneau === currentCreneau;
                    const isPast = creneau < currentCreneau;
                    const shifts = grouped[creneau] || [];
                    return (
                      <div
                        key={creneau}
                        onClick={() => navigate('/admin/shifts')}
                        style={{
                          padding: '0.5rem 1.25rem',
                          borderLeft: isCurrent ? '3px solid #10b981' : '3px solid transparent',
                          background: isCurrent ? 'rgba(16,185,129,0.04)' : 'transparent',
                          opacity: isPast ? 0.5 : 1,
                          cursor: 'pointer',
                          transition: 'background 200ms',
                        }}
                        className="hover-row"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: shifts.length > 0 ? '0.35rem' : 0 }}>
                          {isCurrent && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />}
                          <span style={{ fontSize: '0.75rem', fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#10b981' : '#64748b', minWidth: '60px' }}>
                            {CRENEAU_LABELS[creneau]}
                          </span>
                          {isCurrent && <span style={{ fontSize: '0.6rem', background: '#10b981', color: '#fff', borderRadius: '10px', padding: '0.05rem 0.4rem', fontWeight: 600 }}>EN COURS</span>}
                          {shifts.length === 0 && <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontStyle: 'italic' }}>Aucun shift</span>}
                        </div>
                        {shifts.length > 0 && (() => {
                          // Group by chatteur: { prenom: [modele1, modele2, ...] }
                          const byChatteur = {};
                          shifts.forEach(s => {
                            if (!byChatteur[s.chatteur_prenom]) byChatteur[s.chatteur_prenom] = [];
                            if (s.modele_pseudo && !byChatteur[s.chatteur_prenom].includes(s.modele_pseudo)) {
                              byChatteur[s.chatteur_prenom].push(s.modele_pseudo);
                            }
                          });
                          return (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', paddingLeft: isCurrent ? '14px' : '0' }}>
                              {Object.entries(byChatteur).map(([prenom, models]) => (
                                <span key={prenom} style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                                  fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '12px',
                                  background: isCurrent ? 'rgba(16,185,129,0.1)' : '#f8fafc',
                                  border: `1px solid ${isCurrent ? '#bbf7d0' : '#e2e8f0'}`,
                                  color: '#1b2e4b',
                                }}>
                                  <strong>{prenom}</strong>
                                  <span style={{ color: '#94a3b8' }}>{models.join(', ')}</span>
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Prévisionnel */}
          {previsionnel && previsionnel.elapsed_days > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>Prévisionnel période</h3>
              </div>
              <div style={{ padding: '0.75rem 1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                  <span style={{ color: '#64748b' }}>Progression</span>
                  <span style={{ fontWeight: 600 }}>{previsionnel.elapsed_days}/{previsionnel.total_days} jours</span>
                </div>
                <div style={{ background: '#f1f5f9', borderRadius: '999px', height: '8px', marginBottom: '0.75rem' }}>
                  <div style={{
                    width: `${Math.round((previsionnel.elapsed_days / previsionnel.total_days) * 100)}%`,
                    height: '100%', background: '#f5b731', borderRadius: '999px',
                  }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <div>
                    <p style={{ color: '#64748b', fontSize: '0.7rem' }}>Actuel Net HT</p>
                    <p style={{ fontWeight: 700, color: '#1a1f2e' }}>{previsionnel.actuals?.total_net_ht?.toFixed(0) || 0} €</p>
                  </div>
                  <div>
                    <p style={{ color: '#64748b', fontSize: '0.7rem' }}>Prévu Net HT</p>
                    <p style={{ fontWeight: 700, color: '#f5b731' }}>{previsionnel.forecasts?.total_net_ht?.toFixed(0) || 0} €</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── NEW: Donut Modèles + Cagnotte Prime ── */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <DonutChartModeles data={ventesParModele} />
          <CagnotteWidget classementData={cagnotteData} historiqueData={cagnotteHistorique} />
        </div>
      )}

      {/* ── NEW: Sales Evolution ── */}
      {!loading && (
        <div style={{ marginBottom: '1rem' }}>
          <SalesEvolutionChart historiqueData={cagnotteHistorique} />
        </div>
      )}

      {/* Bottom row: Recent sales + Platform breakdown */}
      <div className="dashboard-bottom" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        {/* Recent sales */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>{"Derni\u00e8res ventes"}</h3>
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
                  <th>{"Mod\u00e8le"}</th>
                  <th>Plateforme</th>
                  <th style={{ textAlign: 'right' }}>Montant</th>
                </tr>
              </thead>
              <tbody className="stagger-rows">
                {(data?.dernieresVentes || []).map((v) => (
                  <tr key={v.id}>
                    <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                      {v.created_at ? new Date(v.created_at).toLocaleDateString('fr-FR') : '\u2014'}
                    </td>
                    <td style={{ fontWeight: 500 }}>{v.chatteur_prenom}</td>
                    <td style={{ color: '#64748b' }}>{v.modele_pseudo || '\u2014'}</td>
                    <td><span className="badge badge-navy">{v.plateforme}</span></td>
                    <td style={{ textAlign: 'right', color: '#f5b731', fontWeight: 700 }}>
                      {v.montant_brut?.toLocaleString('fr-FR')} {v.devise === 'USD' ? '$' : '\u20ac'}
                    </td>
                  </tr>
                ))}
                {(!data?.dernieresVentes || data.dernieresVentes.length === 0) && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                      {"Aucune vente r\u00e9cente"}
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
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>{"R\u00e9partition par plateforme"}</h3>
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
                          {vp.total.toLocaleString('fr-FR')} {"\u20ac"}
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
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0' }}>{"Aucune donn\u00e9e"}</p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .dashboard-bottom-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
