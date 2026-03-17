import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import StatCard from '../../components/StatCard.jsx';
import { CardSkeleton } from '../../components/Skeleton.jsx';
import { Trophy, TrendingUp, Euro, AlertTriangle, Calendar, ChevronRight, ChevronDown, ChevronUp, Award, BookOpen, Users, LayoutDashboard } from 'lucide-react';
import DonutChart from '../../components/DonutChart.jsx';
import { useNavigate } from 'react-router-dom';
import { getTierColorFromPalier } from '../../utils/palierColors.js';

const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

function getMessage(rang, nbChatteurs) {
  if (!rang || rang <= 0) return { text: 'Pas encore de classement pour cette période.', color: '#64748b' };
  if (rang === 1) return { text: "Tu es en tête de l'équipe, continue comme ça !", color: '#f59e0b' };
  if (rang <= 3) return { text: 'Tu es dans le top 3, encore un effort !', color: '#10b981' };
  if (rang <= Math.ceil((nbChatteurs || 10) / 2)) return { text: 'Tu es dans la première moitié, pousse encore !', color: '#3b82f6' };
  return { text: 'Continue à donner le meilleur de toi-même !', color: '#6366f1' };
}

function getPeriodeCourante() {
  const now = new Date();
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0');
  const day = now.getDate();
  if (day < 15) return { debut: `${y}-${m}-01`, fin: `${y}-${m}-15` };
  const next = new Date(y, now.getMonth() + 1, 1);
  const ny = next.getFullYear(), nm = String(next.getMonth() + 1).padStart(2, '0');
  return { debut: `${y}-${m}-15`, fin: `${ny}-${nm}-01` };
}

function getPeriodePrecedente(periode) {
  const d = new Date(periode.debut + 'T00:00:00');
  if (d.getDate() === 15) {
    // Current is 2nd half (15→next-01), previous is 1st half (01→15)
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0');
    return { debut: `${y}-${m}-01`, fin: `${y}-${m}-15` };
  }
  // Current is 1st half (01→15), previous is 2nd half of prior month (15→01)
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 15);
  const py = prev.getFullYear(), pm = String(prev.getMonth() + 1).padStart(2, '0');
  return { debut: `${py}-${pm}-15`, fin: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` };
}

function formatPeriod(debut, fin) {
  const d = new Date(debut + 'T00:00:00');
  const f = new Date(fin + 'T00:00:00');
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} \u2192 ${f.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

/* ── Delta Badge ── */
function DeltaBadge({ current, previous, inverse = false }) {
  if (previous == null || previous === 0) {
    if (current > 0) return <span style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: 600 }}>Nouveau !</span>;
    return null;
  }
  if (current === previous) return null;
  const delta = ((current - previous) / Math.abs(previous)) * 100;
  const isPositive = inverse ? delta < 0 : delta > 0;
  const arrow = isPositive ? '\u2191' : '\u2193';
  const color = isPositive ? '#10b981' : '#ef4444';
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 600, color,
      display: 'inline-flex', alignItems: 'center', gap: '0.15rem',
      background: `${color}12`, padding: '0.1rem 0.4rem', borderRadius: '8px',
    }}>
      {arrow} {Math.abs(delta).toFixed(0)}%
    </span>
  );
}



/* ── Prochain Shift Widget ── */
function ProchainShift({ chatteurId }) {
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!chatteurId) return;
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    api.get(`/api/shifts/semaine?date=${dateStr}`).then(({ data }) => {
      const all = data.shifts || data;
      if (!Array.isArray(all)) { setLoading(false); return; }
      const myShifts = all.filter(s => s.chatteur_id === chatteurId && s.date >= dateStr);
      myShifts.sort((a, b) => a.date.localeCompare(b.date) || a.creneau - b.creneau);
      setShift(myShifts[0] || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [chatteurId]);

  if (loading || !shift) return null;

  const CRENEAU_LABELS = { 1: '08h-14h', 2: '14h-20h', 3: '20h-02h', 4: '02h-08h' };
  const shiftDate = new Date(shift.date + 'T00:00:00');
  const isToday = shiftDate.toDateString() === new Date().toDateString();

  return (
    <div
      className="card card-clickable haptic"
      onClick={() => navigate('/chatteur/planning')}
      style={{
        padding: 0, overflow: 'hidden',
        borderLeft: '3px solid #f5b731',
        transition: 'transform 150ms ease',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '0.6rem 1rem',
        background: isToday ? 'rgba(245,183,49,0.08)' : '#fafaf8',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={14} color="#f5b731" />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>
            {isToday ? "TON SHIFT AUJOURD'HUI" : 'TON PROCHAIN SHIFT'}
          </span>
        </div>
        <ChevronRight size={14} color="#94a3b8" />
      </div>
      {/* Content */}
      <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Date block */}
        <div style={{
          width: 44, height: 44, borderRadius: '10px', flexShrink: 0,
          background: isToday ? '#f5b731' : '#1b2e4b',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>
            {shiftDate.getDate()}
          </span>
          <span style={{ fontSize: '0.55rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' }}>
            {shiftDate.toLocaleDateString('fr-FR', { month: 'short' })}
          </span>
        </div>
        {/* Details */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1b2e4b', marginBottom: '0.3rem' }}>
            {shiftDate.toLocaleDateString('fr-FR', { weekday: 'long' })}
            <span style={{ fontWeight: 400, color: '#64748b', marginLeft: '0.35rem' }}>
              {CRENEAU_LABELS[shift.creneau] || '?'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            {shift.plateforme_nom && (
              <span style={{
                fontSize: '0.68rem', fontWeight: 600, padding: '0.15rem 0.45rem', borderRadius: '6px',
                background: shift.plateforme_couleur_fond || '#1b2e4b',
                color: shift.plateforme_couleur_texte || '#fff',
              }}>
                {shift.plateforme_nom}
              </span>
            )}
            {shift.modele_pseudo && (
              <span style={{
                fontSize: '0.68rem', fontWeight: 600, padding: '0.15rem 0.45rem', borderRadius: '99px',
                background: shift.modele_couleur_fond || '#f1f5f9',
                color: shift.modele_couleur_texte || '#475569',
              }}>
                {shift.modele_pseudo}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Tier colors now come from DB via shared utility ── */
function fmt(n) {
  return (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/* ── useCountUp hook ── */
function useCountUp(target, duration = 1200, active = true) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    if (!active || target <= 0) { setValue(target); return; }
    const start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration, active]);
  return value;
}

/* ── useInView hook ── */
function useInView() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); obs.disconnect(); }
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, inView];
}

/* ── Paliers Progress Widget (compact thermometer for Dashboard) ── */
function PaliersProgressWidget({ paliers, myNetHT, navigate }) {
  const [showExplain, setShowExplain] = useState(false);
  const [viewRef, inView] = useInView();
  const animatedNetHT = useCountUp(Math.round(myNetHT), 1400, inView);
  if (!paliers || paliers.length === 0) return null;

  const n = paliers.length;
  const maxSeuil = paliers[n - 1].seuil_net_ht * 1.15;
  const progressPct = maxSeuil > 0 ? Math.min(100, (myNetHT / maxSeuil) * 100) : 0;
  const highestReachedIdx = (() => { for (let j = n - 1; j >= 0; j--) if (myNetHT >= paliers[j].seuil_net_ht) return j; return -1; })();
  const highestReached = highestReachedIdx >= 0 ? paliers[highestReachedIdx] : null;
  const nextPalierIdx = paliers.findIndex(p => myNetHT < p.seuil_net_ht);
  const nextPalier = nextPalierIdx >= 0 ? paliers[nextPalierIdx] : null;
  const allReached = !nextPalier && highestReached;
  const closeToNext = nextPalier && myNetHT > 0 ? (myNetHT / nextPalier.seuil_net_ht) > 0.85 : false;
  const nextPct = nextPalier ? Math.round((myNetHT / nextPalier.seuil_net_ht) * 100) : 100;
  const tcHighest = highestReachedIdx >= 0 ? getTierColorFromPalier(paliers[highestReachedIdx], highestReachedIdx) : null;
  const tcNext = nextPalierIdx >= 0 ? getTierColorFromPalier(paliers[nextPalierIdx], nextPalierIdx) : null;

  // Progressive gradient: warm colors that evolve with progress
  const barGradient = allReached
    ? `linear-gradient(90deg, ${getTierColorFromPalier(paliers[0], 0).bg}, ${getTierColorFromPalier(paliers[Math.floor(n/2)], Math.floor(n/2)).bg}, ${getTierColorFromPalier(paliers[n-1], n-1).bg})`
    : tcHighest
      ? `linear-gradient(90deg, ${tcHighest.bg}90, ${tcHighest.bg})`
      : 'linear-gradient(90deg, #f5b731aa, #f5b731)';

  return (
    <div
      ref={viewRef}
      className="card card-clickable haptic"
      onClick={() => navigate('/chatteur/performance')}
      style={{
        padding: 0, overflow: 'hidden',
        border: '2px solid rgba(245,183,49,0.2)',
        transition: 'transform 150ms ease',
        background: 'linear-gradient(180deg, #fffdf7 0%, #ffffff 100%)',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '0.85rem 1.25rem', borderBottom: '1px solid rgba(245,183,49,0.1)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'linear-gradient(135deg, rgba(245,183,49,0.06), rgba(245,183,49,0.02))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '8px',
            background: 'linear-gradient(135deg, #f5b731, #e6a515)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(245,183,49,0.3)',
          }}>
            <Award size={15} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1b2e4b', letterSpacing: '0.02em', margin: 0 }}>
              MES PRIMES
            </h2>
            <span style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 500 }}>Paliers individuels</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{
            fontSize: '0.68rem', fontWeight: 700, color: '#f5b731',
            background: 'rgba(245,183,49,0.1)', padding: '0.2rem 0.5rem', borderRadius: '12px',
          }}>
            {nextPct}%
          </span>
          <ChevronRight size={14} color="#94a3b8" />
        </div>
      </div>

      <div style={{ padding: '1.1rem 1.25rem 0.8rem' }}>
        {/* Current amount line */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div>
            <span style={{
              fontSize: '1.4rem', fontWeight: 800, color: '#1b2e4b', letterSpacing: '-0.02em',
              animation: inView ? 'countUp 600ms ease-out' : 'none',
            }}>
              {fmt(animatedNetHT)}
            </span>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#1b2e4b', marginLeft: '0.15rem' }}>{'\u20ac'}</span>
            <div style={{ fontSize: '0.65rem', fontWeight: 500, color: '#94a3b8', marginTop: '0.1rem' }}>
              Net HT {myNetHT > 0 ? '(estimation)' : ''}
            </div>
          </div>
          {nextPalier ? (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 500 }}>Prochain palier</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '0.9rem' }}>{nextPalier.emoji}</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: tcNext.text }}>
                  {fmt(nextPalier.seuil_net_ht)} {'\u20ac'}
                </span>
              </div>
            </div>
          ) : highestReached ? (
            <div style={{
              padding: '0.3rem 0.65rem', borderRadius: '20px',
              background: tcHighest.light,
              border: `1px solid ${tcHighest.border}`,
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: tcHighest.text }}>
                {'\u2728'} Max atteint !
              </span>
            </div>
          ) : null}
        </div>

        {/* Track with rounded ends */}
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          {/* Background track */}
          <div style={{
            height: '16px', borderRadius: '8px',
            background: 'linear-gradient(180deg, #e8edf2, #f1f5f9)',
            position: 'relative', overflow: 'hidden',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.08)',
          }}>
            {/* Progress fill */}
            <div style={{
              height: '100%', borderRadius: '8px',
              background: barGradient,
              width: inView ? `${progressPct}%` : '0%',
              transition: 'width 1400ms cubic-bezier(0.4, 0, 0.2, 1) 300ms',
              animation: closeToNext && inView ? 'glowPulse 2s ease-in-out infinite' : 'none',
              boxShadow: allReached && tcHighest
                ? `0 0 16px ${tcHighest.bg}50`
                : progressPct > 5 ? '0 2px 8px rgba(245,183,49,0.3)' : 'none',
            }} />
            {/* Shimmer on all reached */}
            {allReached && inView && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                borderRadius: '8px',
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s linear infinite',
                pointerEvents: 'none',
              }} />
            )}
            {/* Tick marks on bar at marker positions */}
            {paliers.map((p, i) => {
              const mPct = maxSeuil > 0 ? (p.seuil_net_ht / maxSeuil) * 100 : 0;
              const reached = myNetHT >= p.seuil_net_ht;
              return (
                <div key={`tick-${i}`} style={{
                  position: 'absolute', left: `${mPct}%`, top: 0, bottom: 0,
                  width: '2px', transform: 'translateX(-1px)',
                  background: reached ? `${getTierColorFromPalier(p, i).bg}60` : 'rgba(0,0,0,0.08)',
                  pointerEvents: 'none',
                }} />
              );
            })}
          </div>

          {/* Connector lines + markers — proportionally positioned below the bar */}
          <div style={{ position: 'relative', height: '68px', marginTop: '6px' }}>
            {paliers.map((p, i) => {
              const reached = myNetHT >= p.seuil_net_ht;
              const isNext = nextPalier && p.seuil_net_ht === nextPalier.seuil_net_ht;
              const tc = getTierColorFromPalier(p, i);
              const markerPct = maxSeuil > 0 ? (p.seuil_net_ht / maxSeuil) * 100 : 0;
              return (
                <div key={p.id || i} style={{
                  position: 'absolute', left: `${markerPct}%`, transform: 'translateX(-50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}>
                  {/* Connector line from bar to marker */}
                  <div style={{
                    width: '2px', height: '14px',
                    background: reached ? tc.bg : isNext ? '#cbd5e1' : '#e2e8f0',
                    opacity: reached ? 0.6 : 0.4,
                  }} />
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%',
                    background: reached
                      ? `linear-gradient(135deg, ${tc.bg}, ${tc.bg}dd)`
                      : '#f1f5f9',
                    border: reached ? `2.5px solid ${tc.bg}` : isNext ? '2px dashed #cbd5e1' : '2px solid #e2e8f0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem',
                    boxShadow: reached ? `0 3px 8px ${tc.bg}30` : 'none',
                    opacity: reached ? 1 : isNext ? 0.8 : 0.5,
                    animation: reached && inView ? `tierReached 600ms cubic-bezier(0.34, 1.56, 0.64, 1) ${400 + i * 200}ms both` : 'none',
                    transition: 'all 400ms ease',
                  }}>
                    {reached ? <span style={{ color: '#fff', fontSize: '0.65rem', fontWeight: 800 }}>{'\u2713'}</span> : <span style={{ opacity: 0.6 }}>{p.emoji}</span>}
                  </div>
                  <span style={{
                    fontSize: '0.6rem', fontWeight: 700, marginTop: '0.15rem',
                    color: reached ? tc.text : '#94a3b8', whiteSpace: 'nowrap',
                  }}>
                    {p.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status message */}
        {highestReached ? (
          <div style={{
            textAlign: 'center', fontSize: '0.8rem', fontWeight: 600,
            color: tcHighest.text,
            background: `linear-gradient(135deg, ${tcHighest.light}, rgba(255,255,255,0.5))`,
            padding: '0.6rem 0.85rem', borderRadius: '12px',
            border: `1.5px solid ${tcHighest.border}`,
            animation: allReached ? 'shimmer 3s linear infinite' : 'none',
            backgroundSize: allReached ? '200% 100%' : 'auto',
          }}>
            <span style={{ display: 'inline-block', animation: allReached ? 'trophyBounce 1.5s ease-in-out infinite' : 'none' }}>
              {highestReached.emoji}
            </span>
            {' '}Palier {highestReached.label} atteint ! <strong>+{highestReached.bonus}{'\u20ac'}</strong> de prime
          </div>
        ) : nextPalier && myNetHT > 0 ? (
          <div style={{
            textAlign: 'center', padding: '0.55rem 0.75rem', borderRadius: '10px',
            background: 'rgba(245,183,49,0.06)', border: '1px solid rgba(245,183,49,0.1)',
          }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Encore <strong style={{ color: tcNext.text, fontSize: '0.85rem' }}>
                {fmt(Math.ceil(nextPalier.seuil_net_ht - myNetHT))} {'\u20ac'}
              </strong> pour le palier {nextPalier.emoji} <strong>{nextPalier.label}</strong>
            </span>
          </div>
        ) : (
          <div style={{
            textAlign: 'center', padding: '0.55rem 0.75rem', borderRadius: '10px',
            background: 'rgba(245,183,49,0.06)', border: '1px solid rgba(245,183,49,0.1)',
          }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              {'\uD83D\uDE80'} Fais des ventes pour débloquer ton premier palier de prime !
            </span>
          </div>
        )}

        {/* Bonus cards row */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          {paliers.map((p, i) => {
            const reached = myNetHT >= p.seuil_net_ht;
            const isNext = nextPalier && p.seuil_net_ht === nextPalier.seuil_net_ht;
            const tc = getTierColorFromPalier(p, i);
            return (
              <div key={p.id || i} style={{
                flex: '1 1 0', padding: '0.55rem 0.4rem', borderRadius: '12px',
                background: reached ? `linear-gradient(135deg, ${tc.light}, rgba(255,255,255,0.8))` : isNext ? 'rgba(245,183,49,0.04)' : '#fafbfc',
                border: reached ? `1.5px solid ${tc.border}` : isNext ? '1.5px dashed rgba(245,183,49,0.3)' : '1px solid #edf0f4',
                textAlign: 'center',
                opacity: reached ? 1 : isNext ? 0.85 : 0.45,
                transition: 'all 400ms ease',
              }}>
                <div style={{
                  fontSize: '1.1rem', fontWeight: 800,
                  color: reached ? '#10b981' : isNext ? tc.bg : '#cbd5e1',
                  letterSpacing: '-0.02em',
                }}>
                  +{p.bonus}{'\u20ac'}
                </div>
                <div style={{ fontSize: '0.58rem', fontWeight: 600, color: reached ? tc.text : '#94a3b8', marginTop: '0.1rem' }}>
                  {reached ? '\u2705 Débloqué' : isNext ? '\uD83C\uDFAF Prochain' : p.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Explanation section */}
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
        <button
          className="haptic"
          onClick={(e) => { e.stopPropagation(); setShowExplain(!showExplain); }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.65rem 1.25rem', background: 'none', border: 'none',
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <BookOpen size={13} color="#6366f1" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8' }}>
            Comment ça marche ?
          </span>
          {showExplain ? <ChevronUp size={13} color="#bcc5d1" /> : <ChevronDown size={13} color="#bcc5d1" />}
        </button>
        {showExplain && (
          <div onClick={(e) => e.stopPropagation()} style={{
            padding: '0 1.25rem 1rem', borderTop: '1px solid rgba(99,102,241,0.06)',
            display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.6rem',
          }}>
            {[
              { num: '1', text: 'Tes ventes génèrent un montant brut sur la plateforme.' },
              { num: '2', text: 'Après déduction de la TVA et de la commission plateforme (variable selon la plateforme), on obtient ton Net HT.' },
              { num: '3', text: 'Plus ton Net HT est élevé, plus tu débloques de paliers de prime !' },
              { num: '4', text: 'Seul le palier le plus haut atteint compte — le bonus correspondant est ajouté à ta paie.' },
            ].map(step => (
              <div key={step.num} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(99,102,241,0.08)', color: '#6366f1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.6rem', fontWeight: 700, marginTop: '0.05rem',
                }}>{step.num}</span>
                <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>{step.text}</p>
              </div>
            ))}
            <div style={{
              marginTop: '0.15rem', padding: '0.4rem 0.65rem', borderRadius: '8px',
              background: 'rgba(245,183,49,0.05)', border: '1px solid rgba(245,183,49,0.1)',
            }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#1b2e4b', margin: 0 }}>
                {'\uD83D\uDCA1'} Seul le palier le plus haut atteint compte. Les primes ne se cumulent pas.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Objectif Collectif Widget (compact for Dashboard) ── */
function ObjectifCollectifWidget({ data, navigate }) {
  const [viewRef, inView] = useInView();
  const [showInfo, setShowInfo] = useState(false);
  if (!data) return null;

  const { paliers = [], actual_net_ht = 0, montant_cible = 1, progress_pct = 0, palier_atteint, description } = data;
  const reached = progress_pct >= 100;
  const bonus = paliers.length > 0 ? paliers[paliers.length - 1].bonus_par_chatteur : 0;
  const barPct = Math.min(100, progress_pct);
  const animatedAmount = useCountUp(Math.round(actual_net_ht), 1400, inView);
  const remaining = Math.max(0, montant_cible - actual_net_ht);

  return (
    <div
      ref={viewRef}
      className="card"
      style={{
        padding: 0, overflow: 'hidden',
        border: '2px solid rgba(245,183,49,0.15)',
        background: 'linear-gradient(180deg, #fffdf7 0%, #ffffff 100%)',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '0.85rem 1.25rem', borderBottom: '1px solid rgba(245,183,49,0.1)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'linear-gradient(135deg, rgba(245,183,49,0.06), rgba(245,183,49,0.02))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 28, height: 28, borderRadius: '8px',
            background: 'linear-gradient(135deg, #1b2e4b, #2a4365)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(27,46,75,0.3)',
          }}>
            <Users size={15} color="#fff" />
          </div>
          <div>
            <h2 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1b2e4b', letterSpacing: '0.02em', margin: 0 }}>
              OBJECTIF COLLECTIF
            </h2>
            {description && <span style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 500 }}>{description}</span>}
          </div>
        </div>
        <span style={{
          fontSize: '0.68rem', fontWeight: 700,
          color: reached ? '#059669' : '#f5b731',
          background: reached ? 'rgba(16,185,129,0.1)' : 'rgba(245,183,49,0.1)',
          padding: '0.2rem 0.5rem', borderRadius: '12px',
        }}>
          {reached ? '\u2705 Atteint' : `${progress_pct.toFixed(0)}%`}
        </span>
      </div>

      <div style={{ padding: '1.1rem 1.25rem 0.8rem' }}>
        {/* Current amount */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div>
            <span style={{
              fontSize: '1.4rem', fontWeight: 800, color: '#1b2e4b', letterSpacing: '-0.02em',
              animation: inView ? 'countUp 600ms ease-out' : 'none',
            }}>
              {fmt(animatedAmount)}
            </span>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#1b2e4b', marginLeft: '0.15rem' }}>{'\u20ac'}</span>
            <div style={{ fontSize: '0.65rem', fontWeight: 500, color: '#94a3b8', marginTop: '0.1rem' }}>
              CA Net HT {'\u00e9'}quipe
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 500 }}>Objectif</div>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1b2e4b' }}>
              {montant_cible.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {'\u20ac'}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
          <div style={{
            height: '16px', borderRadius: '8px',
            background: 'linear-gradient(180deg, #e8edf2, #f1f5f9)',
            position: 'relative', overflow: 'hidden',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.08)',
          }}>
            <div style={{
              height: '100%', borderRadius: '8px',
              background: reached
                ? 'linear-gradient(90deg, #f5b731cc, #f5b731)'
                : 'linear-gradient(90deg, #94a3b8, #cbd5e1)',
              width: inView ? `${barPct}%` : '0%',
              transition: 'width 1400ms cubic-bezier(0.4, 0, 0.2, 1) 300ms',
              animation: reached && inView ? 'glowPulseGold 2s ease-in-out infinite' : 'none',
              boxShadow: barPct > 5 ? '0 2px 8px rgba(27,46,75,0.2)' : 'none',
            }} />
            {reached && inView && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: '8px',
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
                backgroundSize: '200% 100%', animation: 'shimmer 2s linear infinite', pointerEvents: 'none',
              }} />
            )}
          </div>
          {/* Target marker */}
          <div style={{
            position: 'absolute', right: 0, top: '-5px', transform: 'translateX(50%)',
          }}>
            <div style={{
              width: '26px', height: '26px', borderRadius: '50%',
              background: reached ? '#f5b731' : '#cbd5e1',
              border: `2.5px solid ${reached ? '#f5b731' : '#fff'}`,
              boxShadow: reached ? '0 3px 10px rgba(245,183,49,0.4)' : '0 1px 3px rgba(0,0,0,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.7rem',
              animation: reached && inView ? 'trophyBounce 1.5s ease-in-out infinite' : 'none',
            }}>
              {reached ? '\uD83C\uDFC6' : '\uD83C\uDFAF'}
            </div>
          </div>
        </div>

        {/* Status + bonus */}
        <div style={{
          padding: '0.65rem 0.85rem', borderRadius: '12px',
          background: reached ? 'rgba(16,185,129,0.08)' : 'rgba(27,46,75,0.04)',
          border: `1px solid ${reached ? 'rgba(16,185,129,0.2)' : 'rgba(27,46,75,0.08)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: reached ? '#059669' : '#1b2e4b' }}>
              {reached ? '\uD83C\uDF89 Objectif atteint !' : `\uD83D\uDE80 Encore ${remaining.toLocaleString('fr-FR')} \u20ac`}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.1rem' }}>
              {reached ? 'Chaque chatteur re\u00e7oit le bonus' : `${progress_pct.toFixed(0)}% de l'objectif \u00e9quipe`}
            </div>
          </div>
          <div style={{
            padding: '0.35rem 0.7rem', borderRadius: '20px',
            background: reached ? 'rgba(16,185,129,0.15)' : 'rgba(245,183,49,0.1)',
            fontSize: '0.95rem', fontWeight: 800,
            color: reached ? '#059669' : '#f5b731',
          }}>
            +{bonus}{'\u20ac'}
          </div>
        </div>

      </div>

      {/* Explanation section — same design as PaliersProgressWidget */}
      <div style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
        <button
          className="haptic"
          onClick={() => setShowInfo(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.65rem 1.25rem', background: 'none', border: 'none',
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <BookOpen size={13} color="#6366f1" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8' }}>
            Comment {'\u00e7'}a marche ?
          </span>
          {showInfo ? <ChevronUp size={13} color="#bcc5d1" /> : <ChevronDown size={13} color="#bcc5d1" />}
        </button>
        {showInfo && (
          <div style={{
            padding: '0 1.25rem 1rem', borderTop: '1px solid rgba(99,102,241,0.06)',
            display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.6rem',
          }}>
            {[
              { num: '1', text: `L'agence fixe un objectif de chiffre d'affaires Net HT pour toute l'\u00e9quipe sur la p\u00e9riode en cours.` },
              { num: '2', text: `Le montant affich\u00e9 repr\u00e9sente la somme des ventes Net HT de tous les chatteurs combin\u00e9s.` },
              { num: '3', text: `Si l'\u00e9quipe atteint l'objectif, chaque chatteur actif re\u00e7oit un bonus de +${bonus}\u20ac ajout\u00e9 \u00e0 sa paie.` },
            ].map(step => (
              <div key={step.num} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(99,102,241,0.08)', color: '#6366f1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.6rem', fontWeight: 700, marginTop: '0.05rem',
                }}>{step.num}</span>
                <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>{step.text}</p>
              </div>
            ))}
            <div style={{
              marginTop: '0.15rem', padding: '0.4rem 0.65rem', borderRadius: '8px',
              background: 'rgba(245,183,49,0.05)', border: '1px solid rgba(245,183,49,0.1)',
            }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#1b2e4b', margin: 0 }}>
                {'\uD83D\uDCA1'} C'est un effort collectif : plus vous vendez ensemble, plus vite l'objectif est atteint !
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Generate available periods ── */
function generatePeriods() {
  const APP_START_DATE = '2026-03-01';
  const ps = [];
  const now = new Date();
  const curDay = now.getDate();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    d.setMonth(d.getMonth() - Math.floor(i / 2));
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0');
    if (i % 2 === 0) {
      // 2nd half (15→next-01)
      const isCurrentMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (isCurrentMonth && curDay < 15) continue;
      const next = new Date(y, d.getMonth() + 1, 1);
      const debut = `${y}-${m}-15`;
      const fin = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
      if (debut < APP_START_DATE) break;
      ps.push({ debut, fin });
    } else {
      // 1st half (01→15)
      const debut = `${y}-${m}-01`;
      const fin = `${y}-${m}-15`;
      if (debut < APP_START_DATE) break;
      ps.push({ debut, fin });
    }
  }
  return ps;
}

function formatPeriodShort(debut, fin) {
  const d = new Date(debut + 'T00:00:00');
  const f = new Date(fin + 'T00:00:00');
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} \u2192 ${f.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}

/* ── Main Dashboard ── */
export default function ChatteurDashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState(null);
  const [prevKpis, setPrevKpis] = useState(null);
  const [ventes, setVentes] = useState([]);
  const [allVentes, setAllVentes] = useState([]);
  const [ventesParModele, setVentesParModele] = useState([]);
  const [paliers, setPaliers] = useState([]);
  const [objectifCollectif, setObjectifCollectif] = useState(null);
  const [mesPaies, setMesPaies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [periode, setPeriode] = useState(getPeriodeCourante);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const periods = useMemo(() => generatePeriods(), []);
  const prevPeriode = useMemo(() => getPeriodePrecedente(periode), [periode.debut, periode.fin]);

  const fetchData = useCallback(() => {
    if (!user?.chatteur_id) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    Promise.all([
      api.get(`/api/chatteurs/${user.chatteur_id}/kpis?periode_debut=${periode.debut}&periode_fin=${periode.fin}`, { signal: controller.signal }),
      api.get(`/api/ventes?chatteur_id=${user.chatteur_id}&periode_debut=${periode.debut}&periode_fin=${periode.fin}`, { signal: controller.signal })
        .catch(() => ({ data: [] })),
      api.get(`/api/chatteurs/${user.chatteur_id}/kpis?periode_debut=${prevPeriode.debut}&periode_fin=${prevPeriode.fin}`, { signal: controller.signal })
        .catch(() => ({ data: null })),
      api.get(`/api/ventes/par-modele?periode_debut=${periode.debut}&periode_fin=${periode.fin}`, { signal: controller.signal })
        .catch(() => ({ data: [] })),
      api.get(`/api/objectifs/paliers-primes?periode_debut=${periode.debut}&periode_fin=${periode.fin}`, { signal: controller.signal })
        .catch(() => ({ data: [] })),
      api.get(`/api/objectifs/collectif?periode_debut=${periode.debut}&periode_fin=${periode.fin}`, { signal: controller.signal })
        .catch(() => ({ data: null })),
      api.get('/api/paies/mes-paies', { signal: controller.signal })
        .catch(() => ({ data: { paies: [] } })),
    ]).then(([k, v, pk, vm, pal, oc, mp]) => {
      setKpis(k.data);
      setPrevKpis(pk.data);
      const ventesData = v.data?.ventes || v.data || [];
      const allV = Array.isArray(ventesData) ? ventesData : [];
      setAllVentes(allV);
      setVentes(allV.slice(0, 5));
      setVentesParModele(Array.isArray(vm.data) ? vm.data : []);
      setPaliers(Array.isArray(pal.data) ? pal.data : []);
      setObjectifCollectif(oc.data || null);
      setMesPaies(Array.isArray(mp.data?.paies) ? mp.data.paies : []);
    })
    .catch(() => { if (!controller.signal.aborted) setError('Impossible de charger les données.'); })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user?.chatteur_id, periode.debut, periode.fin, prevPeriode.debut, prevPeriode.fin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sum ALL paies (real or estimated) for the current period
  const currentPaies = mesPaies.filter(p => p.periode_debut === periode.debut);
  const paieBase = currentPaies.reduce((s, p) => s + (p.total_chatteur || 0), 0);
  const rang = kpis?.rang || 0;
  const nbChatteurs = kpis?.nb_chatteurs || 0;
  const totalBrut = (kpis?.ventes || []).reduce((s, v) => s + (v.total_brut || 0), 0);
  const devise = kpis?.ventes?.[0]?.devise || 'USD';

  const prevCurrentPaies = (prevKpis?.paies || []).filter(p => p.periode_debut === prevPeriode.debut);
  const prevPaie = prevCurrentPaies.reduce((s, p) => s + (p.total_chatteur || 0), 0);
  const prevRang = prevKpis?.rang || 0;
  const prevBrut = (prevKpis?.ventes || []).reduce((s, v) => s + (v.total_brut || 0), 0);
  const prevNetHT = prevKpis?.net_ht_total || 0;

  // Estimate Net HT from ventes (before paies are generated)
  // Formula: brut / (1 + tva_rate) * (1 - commission_rate), with USD→EUR conversion
  const myNetHT = useMemo(() => {
    const paieNetHT = currentPaies.reduce((s, p) => s + (p.net_ht_eur || 0), 0);
    if (paieNetHT > 0) return paieNetHT; // Use actual paies if available
    // Estimate from raw ventes
    return allVentes.reduce((sum, v) => {
      const brut = v.montant_brut || 0;
      const tva = v.tva_rate ?? 0.2;
      const comm = v.commission_rate ?? 0.2;
      const isUSD = v.devise === 'USD';
      const brutEur = isUSD ? brut * 0.92 : brut; // approximate USD→EUR
      const ht = brutEur / (1 + tva);
      const netHT = ht * (1 - comm);
      return sum + netHT;
    }, 0);
  }, [currentPaies, allVentes]);

  // paieBase from mes-paies already includes primes and malus (real or estimated)
  const paieEstimee = paieBase;
  const msg = getMessage(rang, nbChatteurs);
  const navigateTo = useNavigate();

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 className="text-navy" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><LayoutDashboard size={22} color="#f5b731" /> Bonjour {user?.prenom || 'toi'} {"\uD83D\uDC4B"}</h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
            {formatPeriod(periode.debut, periode.fin)}
          </p>
        </div>
        {/* Period selector */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
          >
            <Calendar size={14} />
            {formatPeriodShort(periode.debut, periode.fin)}
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
                maxHeight: 300, overflowY: 'auto',
              }}>
                {periods.map((p, i) => {
                  const isActive = p.debut === periode.debut && p.fin === periode.fin;
                  return (
                    <button
                      key={i}
                      onClick={() => { setPeriode(p); setShowPeriodDropdown(false); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '0.6rem 1rem', border: 'none', cursor: 'pointer',
                        background: isActive ? 'rgba(245,183,49,0.1)' : 'transparent',
                        color: isActive ? '#f5b731' : 'var(--text-primary)',
                        fontWeight: isActive ? 600 : 400, fontSize: '0.8rem',
                        borderLeft: isActive ? '3px solid #f5b731' : '3px solid transparent',
                        transition: 'background 150ms',
                      }}
                      className={!isActive ? 'hover-row' : ''}
                    >
                      {formatPeriodShort(p.debut, p.fin)}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.75rem 1rem', borderRadius: '10px',
          background: '#fef2f2', border: '1px solid #fecaca',
        }}>
          <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', color: '#991b1b' }}>{error}</span>
          <button onClick={fetchData} className="btn-ghost" style={{ marginLeft: '1rem', fontSize: '0.8rem' }}>Réessayer</button>
        </div>
      )}

      {/* Stats with deltas */}
      {loading ? (
        <CardSkeleton count={3} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }} className="stagger-children">
          <StatCard
            title="Ma paie estimée"
            value={`${paieEstimee.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} \u20ac`}
            subtitle={<span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>Période en cours <DeltaBadge current={paieEstimee} previous={prevPaie} /></span>}
            icon={Euro}
            color="#f5b731"
          />
          <StatCard
            title="Net HT"
            value={`${myNetHT.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} \u20ac`}
            subtitle={<span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>{"D\u00e9termine ton palier"} <DeltaBadge current={myNetHT} previous={prevNetHT} /></span>}
            icon={TrendingUp}
            color="#1b2e4b"
          />
          <StatCard
            title="Ventes (période)"
            value={`${totalBrut.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${devise === 'USD' ? '$' : '\u20ac'}`}
            subtitle={<span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>Montant brut <DeltaBadge current={totalBrut} previous={prevBrut} /></span>}
            icon={TrendingUp}
            color="#10b981"
          />
        </div>
      )}

      {/* Message d'encouragement */}
      {!loading && (
        <div className="card" style={{ borderLeft: `3px solid ${msg.color}`, padding: '0.85rem 1.25rem' }}>
          <p style={{ fontWeight: 500, color: msg.color, fontSize: '0.9rem', margin: 0 }}>
            {rang > 0 && <span style={{ marginRight: '0.4rem' }}>{medals[rang - 1] || `#${rang}`}</span>}
            {msg.text}
          </p>
        </div>
      )}

      {/* Prochain shift */}
      {!loading && <ProchainShift chatteurId={user?.chatteur_id} />}

      {/* Paliers de prime — progression */}
      {!loading && paliers.length > 0 && (
        <PaliersProgressWidget paliers={paliers} myNetHT={myNetHT} navigate={navigateTo} />
      )}

      {/* Objectif collectif */}
      {!loading && objectifCollectif && (
        <ObjectifCollectifWidget data={objectifCollectif} navigate={navigateTo} />
      )}


      {/* Donut Chart — Ventes par modèle */}
      {!loading && <DonutChart
        data={ventesParModele.map(d => ({ label: d.pseudo || 'N/A', value: d.total_brut || 0, color: d.couleur_fond }))}
        title="Ventes par modèle"
        valueLabel="$"
        emptyText="Tes ventes par modèle apparaîtront ici."
        maxLegend={5}
      />}

      {/* Dernières ventes */}
      {!loading && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', letterSpacing: '0.05em', margin: 0 }}>
              MES DERNIÈRES VENTES
            </h2>
          </div>
          <div style={{ padding: '0 1.25rem' }}>
            {ventes.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '2rem 0', textAlign: 'center' }}>
                Aucune vente enregistrée pour cette période
              </p>
            ) : (
              <div>
                {ventes.map(v => (
                  <div key={v.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem' }}>
                        {v.created_at ? new Date(v.created_at).toLocaleDateString('fr-FR') : '\u2014'}
                      </span>
                      {v.modele_pseudo && (
                        <span className="badge" style={{
                          fontSize: '0.68rem', padding: '1px 7px', borderRadius: '99px', fontWeight: 600,
                          background: v.modele_couleur_fond || '#f1f5f9',
                          color: v.modele_couleur_texte || '#475569',
                        }}>{v.modele_pseudo}</span>
                      )}
                    </div>
                    <span style={{ fontWeight: 700, color: '#f5b731' }}>
                      {(v.montant_brut || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} $
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
