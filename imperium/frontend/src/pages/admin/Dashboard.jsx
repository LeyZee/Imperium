import { useState, useEffect, useCallback } from 'react';
import { Euro, Building2, Users, Trophy, TrendingUp, TrendingDown, Calendar, ChevronDown, ArrowRight, AlertTriangle, RefreshCw, Gift, Clock, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/index.js';
import StatCard from '../../components/StatCard.jsx';
import DonutChart from '../../components/DonutChart.jsx';
import { CardSkeleton } from '../../components/Skeleton.jsx';
import usePolling from '../../hooks/usePolling.js';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { CHATTEUR_COLORS } from '../../constants/colors';
import { buildPalierColorsMap } from '../../utils/palierColors.js';

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

  const { classement, total_net_ht_equipe, paliers_primes } = classementData;
  const top5 = (classement || []).slice(0, 5);
  const paliers = paliers_primes || [];
  const PALIER_COLORS = buildPalierColorsMap(paliers);
  const maxSeuil = paliers.length > 0 ? paliers[paliers.length - 1].seuil_net_ht : 0;

  const RANK_BADGES = [
    { rank: '1er', color: '#f5b731', bg: 'rgba(245,183,49,0.12)', badgeBg: 'linear-gradient(135deg, #f5b731, #e6a817)' },
    { rank: '2e', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', badgeBg: 'linear-gradient(135deg, #94a3b8, #64748b)' },
    { rank: '3e', color: '#cd7f32', bg: 'rgba(205,127,50,0.12)', badgeBg: 'linear-gradient(135deg, #cd7f32, #a0522d)' },
    { rank: '4e', color: '#6366f1', bg: 'rgba(99,102,241,0.08)', badgeBg: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
    { rank: '5e', color: '#14b8a6', bg: 'rgba(20,184,166,0.08)', badgeBg: 'linear-gradient(135deg, #14b8a6, #0d9488)' },
  ];

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Gift size={16} color="#3b82f6" />
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>Classement & Primes</h3>
        </div>
      </div>
      <div style={{ padding: '1.25rem' }}>
        {/* Net HT \u00e9quipe */}
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 500, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
            {"Net HT \u00e9quipe (p\u00e9riode)"}
          </p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1b2e4b' }}>
            {(total_net_ht_equipe || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {"\u20ac"}
          </p>
        </div>

        {/* Paliers bar */}
        {paliers.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {paliers.map((p, i) => {
                const colors = PALIER_COLORS[p.label] || { bg: '#f0f4ff', border: '#3b82f6', text: '#3b82f6' };
                return (
                  <div key={i} style={{
                    flex: 1, textAlign: 'center', padding: '0.4rem 0.2rem',
                    borderRadius: '6px', border: `1.5px solid ${colors.border}`,
                    background: colors.bg,
                  }}>
                    <div style={{ fontSize: '0.9rem', lineHeight: 1 }}>{p.emoji || ''}</div>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: colors.text, marginTop: '0.15rem' }}>
                      {p.seuil_net_ht}{"\u20ac"}
                    </div>
                    <div style={{ fontSize: '0.58rem', color: colors.text, opacity: 0.8 }}>
                      +{p.bonus}{"\u20ac"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Classement */}
        {top5.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {top5.map((c, i) => {
              const palierAtteint = paliers.length > 0
                ? [...paliers].reverse().find(p => c.total_net_ht >= p.seuil_net_ht)
                : null;
              const nextPalier = paliers.find(p => c.total_net_ht < p.seuil_net_ht);
              const progressMax = nextPalier ? nextPalier.seuil_net_ht : maxSeuil;
              const progressMin = palierAtteint ? palierAtteint.seuil_net_ht : 0;
              const progressPct = progressMax > progressMin
                ? Math.min(100, ((c.total_net_ht - progressMin) / (progressMax - progressMin)) * 100)
                : 100;
              const palierColors = palierAtteint ? (PALIER_COLORS[palierAtteint.label] || PALIER_COLORS['Bronze']) : null;
              const badge = RANK_BADGES[i] || { rank: `${i+1}e`, color: '#94a3b8', bg: 'rgba(0,0,0,0.03)', badgeBg: 'linear-gradient(135deg, #94a3b8, #64748b)' };

              return (
                <div key={c.id} style={{
                  padding: '0.6rem 0.75rem', borderRadius: '10px',
                  background: badge.bg,
                  border: `1px solid ${badge.color}20`,
                  transition: 'transform 200ms ease, box-shadow 200ms ease',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: '1.6rem', height: '1.6rem', borderRadius: '50%',
                      background: badge.badgeBg,
                      color: '#fff', fontSize: '0.65rem', fontWeight: 800,
                      flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                      letterSpacing: '-0.02em',
                    }}>{badge.rank}</span>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: '0.82rem', color: '#1b2e4b' }}>{c.prenom}</span>
                    {palierAtteint && (
                      <span style={{
                        fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem',
                        borderRadius: '10px', border: `1px solid ${palierColors?.border || '#ccc'}`,
                        background: palierColors?.bg || '#f5f5f5', color: palierColors?.text || '#666',
                      }}>
                        {palierAtteint.emoji} {palierAtteint.label}
                      </span>
                    )}
                    <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#1b2e4b' }}>
                      {(c.total_net_ht || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {"\u20ac"}
                    </span>
                  </div>
                  {/* Mini progress bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', paddingLeft: '2.1rem' }}>
                    <div style={{
                      flex: 1, height: '4px', borderRadius: '2px',
                      background: 'rgba(0,0,0,0.06)', overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', borderRadius: '2px',
                        width: `${progressPct}%`,
                        background: palierColors?.border || badge.color,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    {nextPalier && (
                      <span style={{ fontSize: '0.55rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {nextPalier.emoji} {nextPalier.seuil_net_ht}{"\u20ac"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem', padding: '0.5rem 0' }}>
            {"Aucun classement pour cette p\u00e9riode"}
          </p>
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

  if (!historiqueData?.periodes || historiqueData.periodes.length < 1) {
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
    const moisFin = MOIS_COURTS[fin.getMonth()];
    const dayDeb = deb.getDate();
    const dayFin = fin.getDate();
    const crossMonth = deb.getMonth() !== fin.getMonth();
    const shortLabel = crossMonth ? `${dayDeb} ${moisDeb}-${dayFin} ${moisFin}` : `${dayDeb}-${dayFin} ${moisDeb}`;
    const fullLabel = crossMonth ? `${dayDeb} ${moisDeb} - ${dayFin} ${moisFin} ${fin.getFullYear()}` : `${dayDeb} - ${dayFin} ${moisDeb} ${fin.getFullYear()}`;
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

/* ── Objectif Collectif Widget (admin version) ── */
function ObjectifCollectifWidget({ data, navigate }) {
  if (!data || !data.montant_cible) return null;

  const { actual_net_ht = 0, montant_cible = 1, progress_pct = 0, palier_atteint, description } = data;
  const reached = progress_pct >= 100;
  const barPct = Math.min(100, progress_pct);
  const remaining = Math.max(0, montant_cible - actual_net_ht);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', border: reached ? '2px solid rgba(16,185,129,0.2)' : '2px solid rgba(245,183,49,0.12)' }}>
      <div style={{
        padding: '0.75rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: reached ? 'rgba(16,185,129,0.04)' : 'rgba(245,183,49,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={16} color={reached ? '#10b981' : '#1b2e4b'} />
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)' }}>Objectif Collectif</h3>
        </div>
        <span style={{
          fontSize: '0.68rem', fontWeight: 700,
          color: reached ? '#059669' : '#f5b731',
          background: reached ? 'rgba(16,185,129,0.1)' : 'rgba(245,183,49,0.1)',
          padding: '0.15rem 0.45rem', borderRadius: '12px',
        }}>
          {reached ? '✅ Atteint' : `${progress_pct.toFixed(0)}%`}
        </span>
      </div>
      <div style={{ padding: '1rem 1.25rem' }}>
        {description && <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.5rem' }}>{description}</p>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1b2e4b' }}>
            {actual_net_ht.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
          </span>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8' }}>
            / {montant_cible.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
          </span>
        </div>
        {/* Progress bar */}
        <div style={{
          height: '10px', borderRadius: '5px',
          background: '#f1f5f9', overflow: 'hidden', marginBottom: '0.6rem',
        }}>
          <div style={{
            height: '100%', borderRadius: '5px',
            background: reached ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #f5b731, #fbbf24)',
            width: `${barPct}%`, transition: 'width 600ms ease',
          }} />
        </div>
        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
          {reached
            ? '🎉 L\'équipe a atteint l\'objectif !'
            : `🚀 Encore ${remaining.toLocaleString('fr-FR')} € pour atteindre l'objectif`}
        </div>
      </div>
      <button
        onClick={() => navigate('/admin/objectifs')}
        style={{
          width: '100%', padding: '0.55rem', borderTop: '1px solid rgba(0,0,0,0.04)',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '0.72rem', fontWeight: 600, color: '#f5b731',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
          transition: 'background 150ms',
        }}
        className="hover-row"
      >
        Gérer les objectifs <ArrowRight size={12} />
      </button>
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
  const [objectifCollectif, setObjectifCollectif] = useState(null);
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

      const [modeleRes, classementRes, histRes, enLigneRes, prevRes, conflitsRes, objCollRes] = await Promise.all([
        api.get(`/api/ventes/par-modele?periode_debut=${pd}&periode_fin=${pf}`).catch(() => ({ data: [] })),
        api.get(`/api/chatteurs/classement?periode_debut=${pd}&periode_fin=${pf}`).catch(() => ({ data: null })),
        api.get('/api/chatteurs/classement/historique-cagnotte?nb_periodes=6').catch(() => ({ data: null })),
        api.get('/api/shifts/en-ligne').catch(() => ({ data: null })),
        api.get(`/api/paies/previsionnel?debut=${pd}&fin=${pf}`).catch(() => ({ data: null })),
        api.get(`/api/shifts/conflits?date_debut=${fmtDate(weekStart)}&date_fin=${fmtDate(weekEnd)}`).catch(() => ({ data: null })),
        api.get(`/api/objectifs/collectif?periode_debut=${pd}&periode_fin=${pf}`).catch(() => ({ data: null })),
      ]);

      setVentesParModele(Array.isArray(modeleRes.data) ? modeleRes.data : []);
      setCagnotteData(classementRes.data || null);
      setCagnotteHistorique(histRes.data || null);
      setEnLigne(enLigneRes.data || null);
      setPrevisionnel(prevRes.data || null);
      setConflits(conflitsRes.data || null);
      setObjectifCollectif(objCollRes.data || null);
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
          title: 'Net HT Équipe',
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
          <h1 className="text-navy" style={{ fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><LayoutDashboard size={22} color="#f5b731" /> Dashboard</h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>{"Vue d'ensemble de l'agence"}</p>
        </div>

        {/* Period selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={() => fetchDashboard(selectedPeriod?.debut, selectedPeriod?.fin)} className="btn-ghost" title="Rafraîchir" aria-label="Rafraîchir le dashboard" style={{ padding: '0.5rem' }}>
            <RefreshCw size={16} />
          </button>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
            className="btn-secondary"
            aria-label="Sélectionner la période" aria-haspopup="true" aria-expanded={showPeriodDropdown}
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

      {/* ── Objectif Collectif + Prévisionnel ── */}
      {!loading && (objectifCollectif || previsionnel) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <ObjectifCollectifWidget data={objectifCollectif} navigate={navigate} />
          {/* Prévisionnel */}
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

      {/* ── Shifts en cours + Classement ── */}
      {!loading && (enLigne || cagnotteData) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
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

          <CagnotteWidget classementData={cagnotteData} historiqueData={cagnotteHistorique} />
        </div>
      )}

      {/* ── Évolution Net HT ── */}
      {!loading && (
        <div style={{ marginBottom: '1rem' }}>
          <SalesEvolutionChart historiqueData={cagnotteHistorique} />
        </div>
      )}

      {/* ── Répartition + Dernières ventes ── */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <DonutChart
            data={(data?.ventesParPlateforme || []).map(d => ({ label: d.plateforme, value: d.total, color: d.couleur_fond }))}
            title="Répartition par plateforme"
            valueLabel="€"
            emptyText="Aucune donnée"
          />
          <DonutChart
            data={(ventesParModele || []).map(d => ({ label: d.pseudo || 'Non assigné', value: d.total_brut, color: d.couleur_fond, extra: { nb_ventes: d.nb_ventes } }))}
            title="Ventes par modèle"
            valueLabel="€"
            emptyText="Aucune vente par modèle pour cette période"
          />
        </div>
      )}

      {/* ── Dernières ventes ── */}
      {!loading && (
        <div style={{ marginBottom: '1rem' }}>
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
        </div>
      )}
    </div>
  );
}
