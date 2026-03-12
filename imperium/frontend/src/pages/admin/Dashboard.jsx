import { useState, useEffect, useCallback } from 'react';
import { Euro, Building2, Users, Trophy, TrendingUp, TrendingDown, Calendar, ChevronDown, ArrowRight, AlertTriangle, RefreshCw, Gift, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/index.js';
import StatCard from '../../components/StatCard.jsx';
import { CardSkeleton } from '../../components/Skeleton.jsx';
import usePolling from '../../hooks/usePolling.js';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { CHATTEUR_COLORS } from '../../constants/colors';

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
  const chartData = data.map((d, i) => ({
    ...d,
    pseudo: d.pseudo || 'Non assign\u00e9',
    percentage: total > 0 ? (d.total_brut / total) * 100 : 0,
    color: d.couleur_fond || DONUT_COLORS[i % DONUT_COLORS.length],
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
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomDonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {chartData.map((d, i) => (
            <div key={d.pseudo + i} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flexShrink: 0 }} />
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
  const [chartMode, setChartMode] = useState('bar');

  if (!historiqueData?.periodes || historiqueData.periodes.length < 2) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
        <TrendingUp size={28} color="#cbd5e1" style={{ margin: '0 auto' }} />
        <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '0.75rem' }}>{"Pas assez de donn\u00e9es pour afficher l'\u00e9volution"}</p>
      </div>
    );
  }

  const chartData = historiqueData.periodes.map(p => {
    const deb = new Date(p.periode_debut + 'T00:00:00');
    const fin = new Date(p.periode_fin + 'T00:00:00');
    const moisDeb = MOIS_COURTS[deb.getMonth()];
    const dayDeb = deb.getDate();
    const dayFin = fin.getDate();
    const shortLabel = `${dayDeb}-${dayFin} ${moisDeb}`;
    const fullLabel = `${dayDeb} - ${dayFin} ${moisDeb} ${fin.getFullYear()}`;
    return {
      label: shortLabel,
      fullLabel,
      net_ht: parseFloat((p.total_net_ht_equipe || 0).toFixed(2)),
    };
  });

  const last = chartData[chartData.length - 1]?.net_ht || 0;
  const prev = chartData[chartData.length - 2]?.net_ht || 0;
  const deltaPct = prev > 0 ? parseFloat((((last - prev) / prev) * 100).toFixed(1)) : null;

  const commonAxes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={50}
        tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`} domain={[0, 'auto']} />
      <Tooltip content={<CustomBarTooltip />} cursor={chartMode === 'bar' ? { fill: 'rgba(245,183,49,0.06)' } : false} />
    </>
  );

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {deltaPct !== null && <TrendBadge value={deltaPct} />}
          <div style={{
            display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '2px',
          }}>
            {['bar', 'line'].map(mode => (
              <button key={mode} onClick={() => setChartMode(mode)} style={{
                padding: '0.25rem 0.55rem', border: 'none', borderRadius: '6px', cursor: 'pointer',
                fontSize: '0.68rem', fontWeight: 600, transition: 'all 150ms',
                background: chartMode === mode ? '#fff' : 'transparent',
                color: chartMode === mode ? '#f5b731' : '#94a3b8',
                boxShadow: chartMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}>{mode === 'bar' ? 'Barres' : 'Courbe'}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ padding: '1rem 0.5rem 0.5rem 0' }}>
        <ResponsiveContainer width="100%" height={220}>
          {chartMode === 'bar' ? (
            <BarChart data={chartData} barCategoryGap="20%">
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f5b731" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#e6a914" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              {commonAxes}
              <Bar dataKey="net_ht" fill="url(#barGradient)" radius={[4, 4, 0, 0]} maxBarSize={50} />
            </BarChart>
          ) : (
            <LineChart data={chartData}>
              <defs>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f5b731" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#f5b731" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              {commonAxes}
              <Line type="monotone" dataKey="net_ht" stroke="#f5b731" strokeWidth={2.5}
                dot={{ r: 4, fill: '#f5b731', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#f5b731', stroke: '#fff', strokeWidth: 2 }} />
            </LineChart>
          )}
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
  const [expandedCreneau, setExpandedCreneau] = useState(null);
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

      // Get current week + next week for conflict detection
      const now = new Date();
      const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      // Monday of current week
      const weekStart = new Date(now);
      const dow = now.getDay();
      weekStart.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
      // Sunday of next week
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 13);

      const [modeleRes, classementRes, histRes, enLigneRes, prevRes, conflitsRes] = await Promise.all([
        api.get(`/api/ventes/par-modele?periode_debut=${pd}&periode_fin=${pf}`).catch(() => ({ data: [] })),
        api.get(`/api/chatteurs/classement?periode_debut=${pd}&periode_fin=${pf}`).catch(() => ({ data: null })),
        api.get('/api/chatteurs/classement/historique-cagnotte?nb_periodes=6').catch(() => ({ data: null })),
        api.get('/api/shifts/en-ligne').catch(() => ({ data: null })),
        api.get(`/api/paies/previsionnel?debut=${pd}&fin=${pf}`).catch(() => ({ data: null })),
        api.get(`/api/shifts/conflits?date_debut=${fmtDate(weekStart)}&date_fin=${fmtDate(weekEnd)}`).catch(() => ({ data: null })),
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

  // Lightweight polling: refresh en-ligne + conflits every 30s
  const refreshLiveData = useCallback(async () => {
    try {
      const now = new Date();
      const fmtDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const weekStart = new Date(now);
      const dow = now.getDay();
      weekStart.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 13);

      const [enLigneRes, conflitsRes] = await Promise.all([
        api.get('/api/shifts/en-ligne').catch(() => ({ data: null })),
        api.get(`/api/shifts/conflits?date_debut=${fmtDate(weekStart)}&date_fin=${fmtDate(weekEnd)}`).catch(() => ({ data: null })),
      ]);
      setEnLigne(enLigneRes.data || null);
      setConflits(conflitsRes.data || null);
    } catch { /* silent */ }
  }, []);

  usePolling(refreshLiveData, 30000);

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
            <strong>Conflits planning (2 semaines) :</strong>{' '}
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

      {/* ── En ligne + Prévisionnel ── */}
      {!loading && (enLigne || previsionnel) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          {/* Shifts en cours */}
          {enLigne && (() => {
            const CRENEAU_LABELS = { 1: '08h-14h', 2: '14h-20h', 3: '20h-02h', 4: '02h-08h' };
            const currentCreneau = enLigne.creneau_actuel;
            const allShifts = enLigne.all_shifts || [];
            const grouped = { 1: [], 2: [], 3: [], 4: [] };
            allShifts.forEach(s => {
              if (grouped[s.creneau]) grouped[s.creneau].push(s);
            });
            if (allShifts.length === 0 && enLigne.en_ligne?.length > 0) {
              grouped[currentCreneau] = enLigne.en_ligne;
            }

            // Group shifts by chatteur within a créneau
            const groupByChatteur = (shifts) => {
              const byChatteur = {};
              shifts.forEach(s => {
                if (!byChatteur[s.chatteur_prenom]) byChatteur[s.chatteur_prenom] = [];
                const entry = [s.modele_pseudo, s.plateforme_nom].filter(Boolean).join(' · ');
                if (entry && !byChatteur[s.chatteur_prenom].includes(entry)) {
                  byChatteur[s.chatteur_prenom].push(entry);
                }
              });
              return byChatteur;
            };

            return (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={16} color="#f5b731" />
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>Shifts en cours</h3>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                    {enLigne.total_shifts_today || 0} shifts aujourd'hui
                  </span>
                </div>
                <div style={{ padding: '0.25rem 0' }}>
                  {[1, 2, 3, 4].map(creneau => {
                    const isCurrent = creneau === currentCreneau;
                    const isPast = creneau < currentCreneau;
                    const shifts = grouped[creneau] || [];
                    const isExpanded = expandedCreneau === creneau;
                    const byChatteur = groupByChatteur(shifts);
                    const chatteurCount = Object.keys(byChatteur).length;

                    return (
                      <div key={creneau} style={{ opacity: isPast ? 0.5 : 1 }}>
                        {/* Créneau header - clickable to expand/collapse */}
                        <button
                          onClick={() => setExpandedCreneau(isExpanded ? null : creneau)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.5rem 1rem', border: 'none', cursor: 'pointer',
                            background: isCurrent ? 'rgba(16,185,129,0.04)' : 'transparent',
                            borderLeft: isCurrent ? '3px solid #10b981' : '3px solid transparent',
                            transition: 'background 200ms',
                          }}
                        >
                          {isCurrent && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', flexShrink: 0, animation: 'pulse 2s infinite' }} />}
                          <span style={{ fontSize: '0.75rem', fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#10b981' : '#64748b', minWidth: '55px', textAlign: 'left' }}>
                            {CRENEAU_LABELS[creneau]}
                          </span>
                          {isCurrent && <span style={{ fontSize: '0.6rem', background: '#10b981', color: '#fff', borderRadius: '10px', padding: '0.05rem 0.4rem', fontWeight: 600 }}>EN COURS</span>}
                          {shifts.length === 0 && <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontStyle: 'italic', flex: 1, textAlign: 'left' }}>Aucun shift</span>}
                          {shifts.length > 0 && !isExpanded && (
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', flex: 1, textAlign: 'left' }}>
                              {chatteurCount} chatteur{chatteurCount > 1 ? 's' : ''}
                            </span>
                          )}
                          {shifts.length > 0 && (
                            <ChevronDown size={14} color="#94a3b8" style={{ transition: 'transform 200ms', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', flexShrink: 0 }} />
                          )}
                        </button>

                        {/* Expanded content */}
                        {isExpanded && shifts.length > 0 && (
                          <div style={{
                            padding: '0.25rem 1rem 0.6rem',
                            borderLeft: isCurrent ? '3px solid #10b981' : '3px solid transparent',
                            background: isCurrent ? 'rgba(16,185,129,0.02)' : 'rgba(0,0,0,0.01)',
                          }}>
                            {Object.entries(byChatteur).map(([prenom, models]) => (
                              <div
                                key={prenom}
                                onClick={() => navigate('/admin/shifts')}
                                style={{
                                  display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                                  padding: '0.35rem 0.5rem', marginBottom: '0.2rem', borderRadius: '8px',
                                  cursor: 'pointer', transition: 'background 150ms',
                                }}
                                className="hover-row"
                              >
                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy)', minWidth: '70px', flexShrink: 0 }}>
                                  {prenom}
                                </span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                  {models.map((model, i) => (
                                    <span key={i} style={{
                                      fontSize: '0.68rem', padding: '0.1rem 0.45rem', borderRadius: '6px',
                                      background: isCurrent ? 'rgba(16,185,129,0.1)' : '#f1f5f9',
                                      border: `1px solid ${isCurrent ? '#bbf7d0' : '#e2e8f0'}`,
                                      color: '#475569', whiteSpace: 'nowrap',
                                    }}>
                                      {model}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Prévisionnel — basé sur données historiques */}
          {previsionnel && previsionnel.elapsed_days > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>Prévisionnel période</h3>
                {previsionnel.historique?.tendance != null && previsionnel.historique.tendance !== 0 && (
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 600,
                    color: previsionnel.historique.tendance > 0 ? '#10b981' : '#ef4444',
                    background: previsionnel.historique.tendance > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    padding: '0.1rem 0.4rem', borderRadius: '10px',
                  }}>
                    {previsionnel.historique.tendance > 0 ? '↗' : '↘'} {Math.abs(previsionnel.historique.tendance).toFixed(0)}%
                  </span>
                )}
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
                    transition: 'width 500ms ease',
                  }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <div>
                    <p style={{ color: '#64748b', fontSize: '0.68rem' }}>Actuel</p>
                    <p style={{ fontWeight: 700, color: '#1a1f2e', fontSize: '0.85rem' }}>{(previsionnel.actuals?.total_net_ht || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
                  </div>
                  <div>
                    <p style={{ color: '#64748b', fontSize: '0.68rem' }}>Prévu</p>
                    <p style={{ fontWeight: 700, color: '#f5b731', fontSize: '0.85rem' }}>{(previsionnel.forecasts?.total_net_ht || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
                  </div>
                  <div>
                    <p style={{ color: '#64748b', fontSize: '0.68rem' }}>Moy. historique</p>
                    <p style={{ fontWeight: 700, color: '#6366f1', fontSize: '0.85rem' }}>{(previsionnel.historique?.moyennes?.total_net_ht || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
                  </div>
                </div>
                {/* Mini sparkline des périodes historiques */}
                {previsionnel.historique?.periodes?.length > 0 && (
                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.04)', paddingTop: '0.6rem' }}>
                    <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                      Historique ({previsionnel.historique.nb_periodes} dernières périodes)
                    </p>
                    <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '32px' }}>
                      {(() => {
                        const periodes = [...previsionnel.historique.periodes].reverse();
                        const maxVal = Math.max(...periodes.map(p => p.net_ht), 1);
                        return periodes.map((p, i) => {
                          const h = Math.max((p.net_ht / maxVal) * 28, 2);
                          return (
                            <div key={p.debut} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              <div style={{
                                width: '100%', height: `${h}px`, borderRadius: '3px 3px 0 0',
                                background: i === periodes.length - 1 ? '#f5b731' : '#e2e8f0',
                                transition: 'height 400ms ease',
                              }} />
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Répartition : Donut Plateforme + Donut Modèles ── */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          {/* Platform breakdown — Donut */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>{"R\u00e9partition par plateforme"}</h3>
            </div>
            <div style={{ padding: '1.25rem' }}>
              {(() => {
                const vpData = data?.ventesParPlateforme || [];
                if (vpData.length === 0) return <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0' }}>{"Aucune donn\u00e9e"}</p>;
                const totalAll = vpData.reduce((s, vp) => s + vp.total, 0);
                const chartData = vpData.map((vp, i) => ({
                  ...vp,
                  percentage: totalAll > 0 ? (vp.total / totalAll) * 100 : 0,
                  color: vp.couleur_fond || DONUT_COLORS[i % DONUT_COLORS.length],
                }));
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <div style={{ width: 150, height: 150, flexShrink: 0 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={chartData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="total" stroke="none">
                            {chartData.map((d, i) => (
                              <Cell key={i} fill={d.color} />
                            ))}
                          </Pie>
                          <Tooltip content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload;
                            return (
                              <div style={{
                                background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
                                borderRadius: '8px', padding: '0.6rem 0.85rem',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '0.8rem',
                              }}>
                                <p style={{ fontWeight: 600, color: '#1b2e4b', marginBottom: '0.25rem' }}>{d.plateforme}</p>
                                <p style={{ color: '#f5b731', fontWeight: 700 }}>
                                  {d.total.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {"\u20ac"}
                                </p>
                                <p style={{ color: '#64748b', fontSize: '0.72rem' }}>
                                  {d.nb} vente{d.nb > 1 ? 's' : ''} {"\u00b7"} {d.percentage.toFixed(1)}%
                                </p>
                              </div>
                            );
                          }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ flex: 1, minWidth: 130, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {chartData.map((d, i) => (
                        <div key={d.plateforme + i} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span className="badge" style={{
                            background: d.color, color: d.couleur_texte || '#ffffff',
                            fontSize: '0.75rem', fontWeight: 600,
                          }}>{d.plateforme}</span>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1b2e4b', marginLeft: 'auto' }}>
                            {d.total.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {"\u20ac"}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#94a3b8', minWidth: 36, textAlign: 'right' }}>{d.percentage.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
          <DonutChartModeles data={ventesParModele} />
        </div>
      )}

      {/* ── Dernières ventes + Cagnotte Prime ── */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
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
                    <th>Chatteur</th>
                    <th>{"Mod\u00e8le"}</th>
                    <th>Plateforme</th>
                    <th style={{ textAlign: 'right' }}>Montant</th>
                  </tr>
                </thead>
                <tbody className="stagger-rows">
                  {(data?.dernieresVentes || []).map((v) => (
                    <tr key={v.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                            background: `${CHATTEUR_COLORS[v.chatteur_couleur]?.bg || '#94a3b8'}20`,
                            border: `1.5px solid ${CHATTEUR_COLORS[v.chatteur_couleur]?.bg || '#94a3b8'}50`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.6rem', fontWeight: 700,
                            color: CHATTEUR_COLORS[v.chatteur_couleur]?.bg || '#94a3b8',
                          }}>
                            {v.chatteur_prenom?.[0]?.toUpperCase() || '?'}
                          </div>
                          <span style={{ fontWeight: 500, fontSize: '0.8rem' }}>{v.chatteur_prenom}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{
                          background: v.modele_couleur_fond || '#f1f5f9',
                          color: v.modele_couleur_texte || '#475569',
                          fontSize: '0.72rem',
                        }}>{v.modele_pseudo || '\u2014'}</span>
                      </td>
                      <td>
                        <span className="badge" style={{
                          background: v.plateforme_couleur_fond || '#1b2e4b',
                          color: v.plateforme_couleur_texte || '#ffffff',
                          fontSize: '0.72rem',
                        }}>{v.plateforme}</span>
                      </td>
                      <td style={{ textAlign: 'right', color: '#f5b731', fontWeight: 700, fontSize: '0.85rem' }}>
                        {v.montant_brut?.toLocaleString('fr-FR')} {v.devise === 'USD' ? '$' : '\u20ac'}
                      </td>
                    </tr>
                  ))}
                  {(!data?.dernieresVentes || data.dernieresVentes.length === 0) && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                        {"Aucune vente r\u00e9cente"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <CagnotteWidget classementData={cagnotteData} historiqueData={cagnotteHistorique} />
        </div>
      )}

      {/* ── Évolution Net HT ── */}
      {!loading && (
        <div style={{ marginBottom: '1rem' }}>
          <SalesEvolutionChart historiqueData={cagnotteHistorique} />
        </div>
      )}
    </div>
  );
}
