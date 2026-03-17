import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Euro, Trophy, AlertCircle, Calendar, Minus, Plus, MessageSquare, Trash2, Send, TrendingUp, TrendingDown, Bot, Shield } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import api from '../../api/index.js';
import { CHATTEUR_COLORS } from '../../constants/colors';
import StatCard from '../../components/StatCard.jsx';
import DonutChart from '../../components/DonutChart.jsx';
import { CardSkeleton } from '../../components/Skeleton.jsx';

const PAYS_ISO = { 'France': 'fr', 'Benin': 'bj', 'Bénin': 'bj', 'Madagascar': 'mg' };
const SOURCE_CONFIG = {
  telegram: { label: 'Telegram', icon: Bot, color: '#059669', bg: 'rgba(16,185,129,0.1)' },
  chatteur: { label: 'Chatteur', icon: User, color: '#1e40af', bg: '#dbeafe' },
  manager:  { label: 'Manager', icon: Shield, color: '#b45309', bg: '#fef3c7' },
  admin:    { label: 'Directeur', icon: Shield, color: '#6366f1', bg: '#ede9fe' },
};
const DONUT_COLORS = ['#f5b731', '#1b2e4b', '#6366f1', '#10b981', '#ef4444', '#8b5cf6', '#f97316', '#06b6d4'];
const MOIS_COURTS = ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

function TrendBadge({ value }) {
  if (value === 0 || value === undefined || value === null) return null;
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

export default function ChatteurDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [chatteur, setChatteur] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [historique, setHistorique] = useState([]);
  const [ventesParModele, setVentesParModele] = useState([]);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ventesRecentes, setVentesRecentes] = useState([]);
  const [plateformes, setPlateformes] = useState([]);
  const [chartMode, setChartMode] = useState('bar');

  useEffect(() => { fetchAll(); }, [id]);

  async function fetchAll() {
    setLoading(true);
    try {
      // Compute current period for palier data
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      let pd, pf;
      if (now.getDate() < 15) {
        pd = `${y}-${m}-01`; pf = `${y}-${m}-15`;
      } else {
        const next = new Date(y, now.getMonth() + 1, 1);
        pd = `${y}-${m}-15`; pf = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
      }
      const [cRes, kRes, hRes, mRes, nRes, vRes, pRes] = await Promise.all([
        api.get(`/api/chatteurs/${id}`),
        api.get(`/api/chatteurs/${id}/kpis?periode_debut=${pd}&periode_fin=${pf}`),
        api.get(`/api/chatteurs/${id}/historique`),
        api.get(`/api/ventes/par-modele?chatteur_id=${id}`),
        api.get(`/api/notes?chatteur_id=${id}`).catch(() => ({ data: [] })),
        api.get(`/api/ventes?chatteur_id=${id}&limit=10`).catch(() => ({ data: [] })),
        api.get('/api/plateformes').catch(() => ({ data: [] })),
      ]);
      setChatteur(cRes.data);
      setKpis(kRes.data);
      setHistorique(hRes.data || []);
      setVentesParModele(mRes.data || []);
      setNotes(nRes.data || []);
      setVentesRecentes(Array.isArray(vRes.data) ? vRes.data.slice(0, 10) : []);
      setPlateformes(Array.isArray(pRes.data) ? pRes.data : []);
    } catch {
      setError('Impossible de charger les données du chatteur.');
    } finally {
      setLoading(false);
    }
  }

  async function addNote() {
    if (!noteText.trim()) return;
    try {
      await api.post('/api/notes', { chatteur_id: id, content: noteText });
      setNoteText('');
      const { data } = await api.get(`/api/notes?chatteur_id=${id}`);
      setNotes(data || []);
    } catch { /* empty */ }
  }

  async function deleteNote(noteId) {
    try {
      await api.delete(`/api/notes/${noteId}`);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch { /* empty */ }
  }

  if (loading) {
    return (
      <div className="page-enter">
        <button onClick={() => navigate(-1)} className="btn-ghost" style={{ marginBottom: '1rem' }}>
          <ArrowLeft size={16} /> Retour
        </button>
        <CardSkeleton count={4} />
      </div>
    );
  }

  if (error || !chatteur) {
    return (
      <div className="page-enter">
        <button onClick={() => navigate(-1)} className="btn-ghost" style={{ marginBottom: '1rem' }}>
          <ArrowLeft size={16} /> Retour
        </button>
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <AlertCircle size={40} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: '#64748b' }}>{error || 'Chatteur introuvable'}</p>
          {error && <button onClick={fetchAll} className="btn-ghost" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>Réessayer</button>}
        </div>
      </div>
    );
  }

  const colorInfo = CHATTEUR_COLORS[chatteur.couleur] || CHATTEUR_COLORS[0];
  const countryCode = PAYS_ISO[chatteur.pays] || 'fr';

  // Compute total brut EUR from kpis
  const totalBrut = kpis?.ventes?.reduce((s, v) => s + (v.total_brut || 0), 0) || 0;

  const primeTotal = kpis?.prime_from_paies || kpis?.primes_total || 0;
  const palierAtteint = kpis?.palier_atteint;
  const paliers = kpis?.paliers_primes || [];
  const netHtTotal = kpis?.net_ht_total || 0;

  const stats = [
    { title: 'Total Ventes', value: `${totalBrut.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`, icon: Euro, color: '#f5b731' },
    { title: 'Commission', value: `${(kpis?.commission_totale || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`, icon: Euro, color: '#10b981' },
    { title: 'Net HT', value: `${netHtTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`, icon: TrendingUp, color: '#f59e0b' },
    { title: 'Malus', value: `${(kpis?.malus_total || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`, icon: Minus, color: '#ef4444' },
    { title: 'Primes', value: `${primeTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`, icon: Plus, color: '#8b5cf6', subtitle: palierAtteint ? `${palierAtteint.emoji} ${palierAtteint.label}` : null },
    { title: 'Shifts', value: kpis?.nb_shifts || 0, icon: Calendar, color: '#1b2e4b' },
  ];

  // Chart data for evolution
  const chartData = historique.map(p => {
    const deb = new Date(p.periode_debut + 'T00:00:00');
    const fin = new Date(p.periode_fin + 'T00:00:00');
    const moisDeb = MOIS_COURTS[deb.getMonth()];
    const moisFin = MOIS_COURTS[fin.getMonth()];
    const dayDeb = deb.getDate();
    const dayFin = fin.getDate();
    const crossMonth = deb.getMonth() !== fin.getMonth();
    const shortLabel = crossMonth ? `${dayDeb} ${moisDeb}-${dayFin} ${moisFin}` : `${dayDeb}-${dayFin} ${moisDeb}`;
    const fullLabel = crossMonth ? `${dayDeb} ${moisDeb} - ${dayFin} ${moisFin} ${fin.getFullYear()}` : `${dayDeb} - ${dayFin} ${moisDeb} ${fin.getFullYear()}`;
    return {
      label: shortLabel,
      fullLabel,
      net_ht: parseFloat((p.total_net_ht || 0).toFixed(2)),
      commission: parseFloat((p.total_commission || 0).toFixed(2)),
    };
  });

  const lastVal = chartData[chartData.length - 1]?.net_ht || 0;
  const prevVal = chartData[chartData.length - 2]?.net_ht || 0;
  const deltaPct = prevVal > 0 ? parseFloat((((lastVal - prevVal) / prevVal) * 100).toFixed(1)) : null;

  // Pie data for modeles (now with DB colors)
  const totalModeles = ventesParModele.reduce((s, d) => s + d.total_brut, 0);
  const modelesPie = ventesParModele.map((d, i) => ({
    ...d,
    pseudo: d.pseudo || 'Non assigné',
    percentage: totalModeles > 0 ? (d.total_brut / totalModeles) * 100 : 0,
    color: d.couleur_fond || DONUT_COLORS[i % DONUT_COLORS.length],
  }));

  // Build plateforme color map from fetched data
  const platColorMap = {};
  plateformes.forEach(p => {
    platColorMap[p.nom] = { bg: p.couleur_fond || '#1b2e4b', text: p.couleur_texte || '#ffffff' };
  });

  // Pie data for plateformes
  const totalPlat = kpis?.ventes_par_plateforme?.reduce((s, d) => s + d.total_brut, 0) || 0;
  const platPie = (kpis?.ventes_par_plateforme || []).map(d => ({
    ...d,
    name: d.plateforme,
    percentage: totalPlat > 0 ? (d.total_brut / totalPlat) * 100 : 0,
    color: platColorMap[d.plateforme]?.bg || DONUT_COLORS[0],
  }));

  return (
    <div className="page-enter chatteur-detail">
      <style>{`
        .chatteur-detail .detail-header { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
        .chatteur-detail .detail-identity { display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 0; }
        .chatteur-detail .detail-highlights { display: flex; gap: 0.75rem; flex-wrap: wrap; }
        .chatteur-detail .detail-charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
        @media (max-width: 640px) {
          .chatteur-detail .detail-header { gap: 0.75rem; }
          .chatteur-detail .detail-identity { gap: 0.75rem; }
          .chatteur-detail .detail-highlights > div { flex: 1 1 100% !important; }
          .chatteur-detail .detail-charts-grid { grid-template-columns: 1fr; }
          .chatteur-detail .detail-avatar { width: 44px !important; height: 44px !important; }
          .chatteur-detail .detail-avatar-icon { width: 44px !important; height: 44px !important; }
          .chatteur-detail .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .chatteur-detail .stats-grid .card p[class] { font-size: 1.35rem !important; }
        }
      `}</style>

      {/* Header */}
      <div className="detail-header">
        <button onClick={() => navigate(-1)} className="btn-ghost" style={{ padding: '0.4rem' }}>
          <ArrowLeft size={18} />
        </button>

        <div className="detail-identity">
          {/* Avatar */}
          {chatteur.photo ? (
            <img src={chatteur.photo} alt="" className="detail-avatar" style={{
              width: 56, height: 56, borderRadius: '50%', objectFit: 'cover',
              border: `3px solid ${colorInfo.bg}`,
            }} />
          ) : (
            <div className="detail-avatar-icon" style={{
              width: 56, height: 56, borderRadius: '50%',
              background: colorInfo.bg, border: `3px solid ${colorInfo.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <User size={24} color={colorInfo.text} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontWeight: 700, color: '#1a1f2e', marginBottom: '0.15rem' }}>{chatteur.prenom}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b', flexWrap: 'wrap' }}>
              <span style={{
                padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600,
                background: chatteur.role === 'manager' ? '#fef3c7' : chatteur.role === 'va' ? '#f3e8ff' : '#dbeafe',
                color: chatteur.role === 'manager' ? '#b45309' : chatteur.role === 'va' ? '#7c3aed' : '#1e40af',
              }}>
                {chatteur.role?.toUpperCase()}
              </span>
              <img src={`https://flagcdn.com/w40/${countryCode}.png`} alt={chatteur.pays}
                style={{ width: 18, height: 13, borderRadius: 2, objectFit: 'cover' }} />
              <span>{chatteur.pays}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Meta highlight cards */}
      {(kpis?.moyenne_par_periode > 0 || kpis?.meilleure_periode) && (
        <div className="detail-highlights" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {kpis?.moyenne_par_periode > 0 && (
            <div style={{
              flex: '1 1 160px', padding: '0.75rem 1rem', borderRadius: '12px',
              background: 'linear-gradient(135deg, #f0f4ff 0%, #e8efff 100%)',
              border: '1px solid #dbeafe',
            }}>
              <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 600, color: '#6366f1', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                {'Moy. / période'}
              </p>
              <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1a1f2e', lineHeight: 1.1 }}>
                {kpis.moyenne_par_periode.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {'€'}
              </p>
            </div>
          )}
          {kpis?.meilleure_periode && (
            <div style={{
              flex: '1 1 200px', padding: '0.75rem 1rem', borderRadius: '12px',
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: '1px solid #fde68a',
            }}>
              <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 600, color: '#d97706', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                {'🏆 Meilleure période'}
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b', lineHeight: 1.1 }}>
                  {kpis.meilleure_periode.total?.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {'€'}
                </p>
                <span style={{ fontSize: '0.7rem', color: '#92400e', fontWeight: 500 }}>
                  {new Date(kpis.meilleure_periode.periode_debut + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  {' → '}
                  {new Date(kpis.meilleure_periode.periode_fin + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid stagger-children">
        {stats.map(s => <StatCard key={s.title} {...s} />)}
      </div>

      {/* Palier Progress Widget */}
      {paliers.length > 0 && (
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>Progression Paliers</h3>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569' }}>
              Net HT : {netHtTotal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {'\u20ac'}
            </span>
          </div>
          {/* Progress bar with palier markers */}
          <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
            <div style={{ height: '8px', borderRadius: '4px', background: '#f1f5f9', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '4px',
                width: `${Math.min(100, (netHtTotal / (paliers[paliers.length - 1]?.seuil_net_ht || 1)) * 100)}%`,
                background: palierAtteint
                  ? ({'Bronze': '#cd7f32', 'Argent': '#a0a0a0', 'Or': '#ffc107', 'Diamant': '#64b5f6'}[palierAtteint.label] || '#3b82f6')
                  : '#cbd5e1',
                transition: 'width 0.5s ease',
              }} />
            </div>
            {/* Markers */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
              {paliers.map((p, i) => {
                const reached = netHtTotal >= p.seuil_net_ht;
                const pct = (p.seuil_net_ht / (paliers[paliers.length - 1]?.seuil_net_ht || 1)) * 100;
                const colors = {
                  'Bronze': { bg: '#fef3e2', border: '#cd7f32', text: '#92540a' },
                  'Argent': { bg: '#f0f0f0', border: '#a0a0a0', text: '#555' },
                  'Or': { bg: '#fff8e1', border: '#ffc107', text: '#b8860b' },
                  'Diamant': { bg: '#e8f4fd', border: '#64b5f6', text: '#1565c0' },
                }[p.label] || { bg: '#f0f4ff', border: '#3b82f6', text: '#3b82f6' };
                return (
                  <div key={i} style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: '28px', height: '28px', borderRadius: '50%',
                      border: `2px solid ${reached ? colors.border : '#e2e8f0'}`,
                      background: reached ? colors.bg : '#fff',
                      fontSize: '0.75rem', opacity: reached ? 1 : 0.5,
                    }}>
                      {p.emoji}
                    </div>
                    <div style={{ fontSize: '0.6rem', fontWeight: 600, color: reached ? colors.text : '#94a3b8', marginTop: '0.2rem' }}>
                      {p.label}
                    </div>
                    <div style={{ fontSize: '0.55rem', color: reached ? colors.text : '#cbd5e1' }}>
                      {p.seuil_net_ht}{'\u20ac'} {'\u2192'} +{p.bonus}{'\u20ac'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="detail-charts-grid">
        {/* Evolution BarChart */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>{'Évolution Net HT'}</h3>
              <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.15rem' }}>{chartData.length} {'dernières périodes'}</p>
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
            {chartData.length >= 1 ? (
              <ResponsiveContainer width="100%" height={200}>
                {chartMode === 'bar' ? (
                  <BarChart data={chartData} barCategoryGap="20%">
                    <defs>
                      <linearGradient id="detailBarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f5b731" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#e6a914" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={45}
                      tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`} domain={[0, 'auto']} />
                    <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(245,183,49,0.06)' }} />
                    <Bar dataKey="net_ht" fill="url(#detailBarGradient)" radius={[4,4,0,0]} maxBarSize={40} />
                  </BarChart>
                ) : (
                  <LineChart data={chartData}>
                    <defs>
                      <linearGradient id="detailLineGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f5b731" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#f5b731" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={45}
                      tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`} domain={[0, 'auto']} />
                    <Tooltip content={<CustomBarTooltip />} cursor={false} />
                    <Line type="monotone" dataKey="net_ht" stroke="#f5b731" strokeWidth={2.5}
                      dot={{ r: 4, fill: '#f5b731', stroke: '#fff', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#f5b731', stroke: '#fff', strokeWidth: 2 }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <TrendingUp size={28} color="#cbd5e1" style={{ margin: '0 auto' }} />
                <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '0.75rem' }}>
                  {'Pas assez de données pour afficher l\'évolution'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Pie: Modeles */}
        <DonutChart
          data={modelesPie.map(d => ({ label: d.pseudo, value: d.total_brut, color: d.color }))}
          title="Ventes par modèle"
          valueLabel="€"
          emptyText="Aucune vente"
        />
      </div>

      {/* Plateforme Pie + Notes */}
      <div className="detail-charts-grid">
        {/* Pie: Plateformes */}
        <DonutChart
          data={platPie.map(d => ({ label: d.name, value: d.total_brut, color: d.color }))}
          title="Ventes par plateforme"
          valueLabel="€"
          emptyText="Aucune donnée"
        />

        {/* Notes */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageSquare size={16} color="#6366f1" />
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>Notes</h3>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>({notes.length})</span>
          </div>
          <div style={{ padding: '1rem 1.25rem', maxHeight: '280px', overflowY: 'auto' }}>
            {/* Add note */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Ajouter une note..."
                rows={2}
                style={{
                  flex: 1, resize: 'vertical', borderRadius: '8px', padding: '0.5rem 0.75rem',
                  border: '1px solid #e2e8f0', fontSize: '0.8rem', fontFamily: 'inherit',
                }}
              />
              <button onClick={addNote} className="btn-primary" disabled={!noteText.trim()}
                style={{ padding: '0.4rem 0.7rem', alignSelf: 'flex-end' }}>
                <Send size={14} />
              </button>
            </div>
            {notes.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>
                Aucune note
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {notes.map(n => (
                  <div key={n.id} style={{
                    padding: '0.6rem 0.75rem', borderRadius: '8px',
                    background: '#f8fafc', border: '1px solid #f1f5f9',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6366f1' }}>{n.author_name || 'Admin'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                          {new Date(n.created_at).toLocaleDateString('fr-FR')}
                        </span>
                        <button onClick={() => deleteNote(n.id)} style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: '0.1rem',
                        }}>
                          <Trash2 size={12} color="#94a3b8" />
                        </button>
                      </div>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: '#1a1f2e', whiteSpace: 'pre-wrap' }}>{n.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent sales */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>{'Dernières ventes'}</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>{'Modèle'}</th>
                <th>Plateforme</th>
                <th>Source</th>
                <th style={{ textAlign: 'right' }}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {ventesRecentes.length > 0 ? ventesRecentes.map(v => (
                <tr key={v.id}>
                  <td style={{ color: '#64748b', fontSize: '0.8rem' }}>
                    {v.created_at ? new Date(v.created_at).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: v.modele_couleur_fond || '#f1f5f9',
                      color: v.modele_couleur_texte || '#475569',
                    }}>{v.modele_pseudo || '—'}</span>
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: platColorMap[v.plateforme_nom]?.bg || '#1b2e4b',
                      color: platColorMap[v.plateforme_nom]?.text || '#ffffff',
                    }}>{v.plateforme_nom || '—'}</span>
                  </td>
                  <td>
                    {(() => {
                      const cfg = SOURCE_CONFIG[v.source] || SOURCE_CONFIG.admin;
                      const Icon = cfg.icon;
                      return (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                          padding: '0.15rem 0.5rem', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600,
                          background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
                        }}>
                          <Icon size={11} /> {cfg.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#f5b731' }}>
                    {v.montant_brut?.toLocaleString('fr-FR')} {v.devise === 'USD' ? '$' : '€'}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                    {'Aucune vente récente'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
