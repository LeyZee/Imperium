import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { CardSkeleton } from '../../components/Skeleton.jsx';
import { Trophy, TrendingUp, BarChart2, AlertTriangle, Zap, Target, Flame, Star, Plus, ShoppingBag, Award, BookOpen, ChevronDown, ChevronUp, Calendar, Activity } from 'lucide-react';
import { computeStreaksAndRecords } from '../../utils/gamification.js';
import { getTierColorFromPalier } from '../../utils/palierColors.js';

const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

/* ─── Badge descriptions for unlock conditions ─── */
const BADGE_DESCRIPTIONS = {
  rising: 'Prime en hausse vs la p\u00e9riode pr\u00e9c\u00e9dente',
  regulier: '3 p\u00e9riodes cons\u00e9cutives avec prime',
  newcomer: 'Premi\u00e8re prime d\u00e9bloqu\u00e9e !',
};

/* ─── Shared IntersectionObserver (one observer for all elements) ─── */
const observerCallbacks = new Map();
let sharedObserver = null;
function getSharedObserver() {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const cb = observerCallbacks.get(entry.target);
          if (cb) { cb(); observerCallbacks.delete(entry.target); sharedObserver.unobserve(entry.target); }
        }
      });
    }, { threshold: 0.15 });
  }
  return sharedObserver;
}

function useInView() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = getSharedObserver();
    observerCallbacks.set(el, () => setInView(true));
    obs.observe(el);
    return () => { observerCallbacks.delete(el); obs.unobserve(el); };
  }, []);
  return [ref, inView];
}

/* ─── AnimatedCard wrapper ─── */
const AnimatedCard = memo(function AnimatedCard({ children, delay = 0, style = {}, ...props }) {
  const [ref, inView] = useInView();
  return (
    <div
      ref={ref}
      className="card"
      style={{
        padding: 0, overflow: 'hidden',
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 500ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms, transform 500ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
});

function getPeriodeCourante() {
  const now = new Date();
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0');
  const day = now.getDate();
  if (day < 15) return { debut: `${y}-${m}-01`, fin: `${y}-${m}-15` };
  const next = new Date(y, now.getMonth() + 1, 1);
  const ny = next.getFullYear(), nm = String(next.getMonth() + 1).padStart(2, '0');
  return { debut: `${y}-${m}-15`, fin: `${ny}-${nm}-01` };
}

function formatPeriodShort(debut) {
  const d = new Date(debut + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatPeriodRange(debut, fin) {
  const d = new Date(debut + 'T00:00:00');
  const f = new Date(fin + 'T00:00:00');
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} \u2192 ${f.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}

function generatePeriods() {
  const APP_START_DATE = '2026-03-01';
  const ps = [];
  const now = new Date();
  const curDay = now.getDate();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    d.setMonth(d.getMonth() - Math.floor(i / 2));
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
    if (i % 2 === 0) {
      const isCurrentMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (isCurrentMonth && curDay < 15) continue;
      const next = new Date(y, d.getMonth() + 1, 1);
      const debut = `${y}-${m}-15`;
      const fin = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
      if (debut < APP_START_DATE) break;
      ps.push({ debut, fin });
    } else {
      const debut = `${y}-${m}-01`;
      const fin = `${y}-${m}-15`;
      if (debut < APP_START_DATE) break;
      ps.push({ debut, fin });
    }
  }
  return ps;
}

function fmt(n) {
  return (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDec(n) {
  return (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getMotivation(rang) {
  if (rang === 0) return { emoji: '\uD83C\uDFAF', text: `Pas encore de ventes cette p\u00e9riode. C'est le moment de tout donner !`, color: '#6366f1' };
  if (rang === 1) return { emoji: '\uD83D\uDC51', text: 'Tu domines le classement ! Continue \u00e0 tout donner !', color: '#f5b731' };
  if (rang === 2) return { emoji: '\uD83D\uDD25', text: 'Deuxi\u00e8me place ! Le tr\u00f4ne est \u00e0 port\u00e9e de main !', color: '#f59e0b' };
  if (rang === 3) return { emoji: '\uD83D\uDCAA', text: 'Troisi\u00e8me place ! Ne l\u00e2che rien !', color: '#d97706' };
  if (rang <= 5) return { emoji: '\uD83D\uDCC8', text: 'Tu montes en puissance ! Continue \u00e0 vendre !', color: '#3b82f6' };
  return { emoji: '\uD83D\uDE80', text: 'Chaque vente compte. D\u00e9bloque le prochain palier !', color: '#3b82f6' };
}



/* ─── useCountUp hook ─── */
function useCountUp(target, duration = 1200, inView = true) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    if (!inView || target <= 0) { setValue(target); return; }
    const start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration, inView]);
  return value;
}

/* ─── Static styles & constants ─── */
const EMPTY_STATE_STYLE = { textAlign: 'center', padding: '1.5rem 0' };

/* ─── Individual Paliers Thermometre ─── */
const PaliersIndividuelsThermometre = memo(function PaliersIndividuelsThermometre({ paliers, myNetHT }) {
  const [ref, inView] = useInView();
  const animatedNetHT = useCountUp(Math.round(myNetHT), 1400, inView);

  if (!paliers || paliers.length === 0) {
    return (
      <div style={EMPTY_STATE_STYLE}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem', animation: 'floatSoft 3s ease-in-out infinite' }}>{'\uD83C\uDFC6'}</div>
        <p style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.5 }}>
          {"Aucun palier de prime configur\u00e9 pour cette p\u00e9riode."}
        </p>
        <p style={{ color: '#cbd5e1', fontSize: '0.72rem', marginTop: '0.3rem' }}>
          {"Les paliers seront d\u00e9finis par l'agence."}
        </p>
      </div>
    );
  }

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

  const barGradient = allReached
    ? `linear-gradient(90deg, ${getTierColorFromPalier(paliers[0], 0).bg}, ${getTierColorFromPalier(paliers[Math.floor(n/2)], Math.floor(n/2)).bg}, ${getTierColorFromPalier(paliers[n - 1], n - 1).bg})`
    : tcHighest
      ? `linear-gradient(90deg, ${tcHighest.bg}90, ${tcHighest.bg})`
      : 'linear-gradient(90deg, #f5b731aa, #f5b731)';

  return (
    <div ref={ref}>
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
        <div style={{
          height: '16px', borderRadius: '8px',
          background: 'linear-gradient(180deg, #e8edf2, #f1f5f9)',
          position: 'relative', overflow: 'hidden',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.08)',
        }}>
          <div style={{
            height: '100%', borderRadius: '8px',
            background: barGradient,
            width: inView ? `${progressPct}%` : '0%',
            transition: 'width 1400ms cubic-bezier(0.4, 0, 0.2, 1) 300ms',
            animation: closeToNext && inView ? 'glowPulse 2s ease-in-out infinite' : 'none',
            boxShadow: allReached
              ? `0 0 16px ${tcHighest.bg}50`
              : progressPct > 5 ? '0 2px 8px rgba(245,183,49,0.3)' : 'none',
          }} />
          {allReached && inView && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: '8px',
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
              backgroundSize: '200% 100%', animation: 'shimmer 2s linear infinite', pointerEvents: 'none',
            }} />
          )}
          {/* Tick marks on bar */}
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

        {/* Connector lines + markers — proportionally positioned below bar */}
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
                <div style={{
                  width: '2px', height: '14px',
                  background: reached ? tc.bg : isNext ? '#cbd5e1' : '#e2e8f0',
                  opacity: reached ? 0.6 : 0.4,
                }} />
                <div style={{
                  width: '26px', height: '26px', borderRadius: '50%',
                  background: reached ? `linear-gradient(135deg, ${tc.bg}, ${tc.bg}dd)` : '#f1f5f9',
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
                <span style={{ fontSize: '0.6rem', fontWeight: 700, marginTop: '0.15rem', color: reached ? tc.text : '#94a3b8', whiteSpace: 'nowrap' }}>
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
          animation: allReached && inView ? 'shimmer 3s linear infinite' : 'none',
          backgroundSize: allReached ? '200% 100%' : 'auto',
        }}>
          <span style={{ display: 'inline-block', animation: allReached && inView ? 'trophyBounce 1.5s ease-in-out infinite' : 'none' }}>
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
  );
});


/* ─── StreaksRecords Component ─── */
const StreaksRecords = memo(function StreaksRecords({ streak, bestPrime, bestPaie, totalPodiums, badges }) {
  const [ref, inView] = useInView();

  if (bestPrime === 0 && bestPaie === 0 && totalPodiums === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{'\uD83C\uDFC6'}</div>
        <p style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.5 }}>
          {"Tes records appara\u00eetront d\u00e8s ta premi\u00e8re prime."}
        </p>
        <p style={{ color: '#cbd5e1', fontSize: '0.72rem', marginTop: '0.3rem' }}>
          {"D\u00e9bloque un palier pour commencer tes badges !"}
        </p>
      </div>
    );
  }

  const stats = [
    { icon: <Flame size={16} color="#ef4444" />, label: 'Streak prime', value: `${streak} p\u00e9riode${streak !== 1 ? 's' : ''}`, highlight: streak >= 3 },
    { icon: <Trophy size={16} color="#f5b731" />, label: 'Meilleure prime', value: `${fmtDec(bestPrime)} \u20AC`, highlight: bestPrime > 0 },
    { icon: <span style={{ fontSize: '1rem' }}>{'\uD83D\uDCB0'}</span>, label: 'Meilleure paie', value: `${fmt(bestPaie)} \u20AC`, highlight: bestPaie > 0 },
    { icon: <Star size={16} color="#6366f1" />, label: 'P\u00e9riodes avec prime', value: `${totalPodiums}`, highlight: totalPodiums > 0 },
  ];

  return (
    <div ref={ref}>
      {/* 2x2 stats grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem',
        marginBottom: badges.length > 0 ? '0.75rem' : 0,
      }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            padding: '0.65rem 0.75rem', borderRadius: '10px',
            background: s.highlight ? 'rgba(245,183,49,0.05)' : 'rgba(0,0,0,0.02)',
            border: s.highlight ? '1px solid rgba(245,183,49,0.15)' : '1px solid rgba(0,0,0,0.06)',
            display: 'flex', flexDirection: 'column', gap: '0.3rem',
            opacity: inView ? 1 : 0,
            transform: inView ? 'translateY(0)' : 'translateY(10px)',
            transition: `all 400ms cubic-bezier(0.4, 0, 0.2, 1) ${i * 100}ms`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {s.icon}
              <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }}>{s.label}</span>
            </div>
            <div style={{
              fontSize: '1rem', fontWeight: 700,
              color: s.highlight ? '#1b2e4b' : '#94a3b8',
            }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Badges row with descriptions */}
      {badges.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {badges.map((b, i) => (
            <div key={b.id} title={BADGE_DESCRIPTIONS[b.id] || ''} style={{
              display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem',
              padding: '0.4rem 0.7rem', borderRadius: '12px',
              fontSize: '0.7rem', fontWeight: 600,
              background: b.earned ? 'rgba(245,183,49,0.12)' : 'rgba(0,0,0,0.04)',
              color: b.earned ? '#92400e' : '#94a3b8',
              border: b.earned ? '1px solid rgba(245,183,49,0.25)' : '1px solid rgba(0,0,0,0.06)',
              opacity: inView ? (b.earned ? 1 : 0.5) : 0,
              transform: inView ? 'scale(1)' : 'scale(0.8)',
              transition: `all 400ms cubic-bezier(0.34, 1.56, 0.64, 1) ${400 + i * 120}ms`,
              cursor: 'default',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.9rem' }}>{b.emoji}</span>
                {b.label}
              </div>
              <div style={{
                fontSize: '0.55rem', fontWeight: 400,
                color: b.earned ? '#b8860b' : '#b0b8c4',
                maxWidth: '100px', textAlign: 'center', lineHeight: 1.2,
              }}>
                {BADGE_DESCRIPTIONS[b.id] || ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});


/* ─── Animated Bar Chart ─── */
const BarChartAnimated = memo(function BarChartAnimated({ historique, maxPaie, periodeDebut }) {
  const [ref, inView] = useInView();
  return (
    <div ref={ref} style={{ display: 'flex', alignItems: 'flex-end', gap: '0.35rem', height: '140px', marginBottom: '0.5rem' }}>
      {historique.map((h, i) => {
        const heightPct = Math.max((h.total_paie / maxPaie) * 100, 4);
        const isCurrent = h.periode_debut === periodeDebut;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', minWidth: 0 }}>
            <span style={{
              fontSize: '0.6rem', color: '#64748b', whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
              opacity: inView ? 1 : 0, transition: `opacity 400ms ease ${300 + i * 100}ms`,
            }}>
              {h.source === 'estimation' ? `~${fmt(h.total_paie)}\u20AC` : `${fmt(h.total_paie)}\u20AC`}
            </span>
            <div
              style={{
                width: '100%', maxWidth: '40px',
                height: inView ? `${heightPct}%` : '4px',
                minHeight: '4px',
                borderRadius: '4px 4px 0 0',
                background: isCurrent
                  ? (h.source === 'estimation'
                    ? 'repeating-linear-gradient(135deg, #f5b731, #f5b731 4px, #f5c94d 4px, #f5c94d 8px)'
                    : 'linear-gradient(180deg, #f5b731, #f59e0b)')
                  : (h.source === 'estimation'
                    ? 'repeating-linear-gradient(135deg, #cbd5e1, #cbd5e1 4px, #e2e8f0 4px, #e2e8f0 8px)'
                    : 'linear-gradient(180deg, #cbd5e1, #94a3b8)'),
                transition: `height 700ms cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 120}ms`,
              }}
              title={`${formatPeriodShort(h.periode_debut)}: ${fmt(h.total_paie)} \u20AC`}
            />
          </div>
        );
      })}
    </div>
  );
});

/* ─── Main Component ─── */
export default function MaPerformance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [historique, setHistorique] = useState([]);
  const [classementData, setClassementData] = useState(null);
  const [cagnotteHistorique, setCagnotteHistorique] = useState(null);

  const [paliersIndiv, setPaliersIndiv] = useState([]);
  const [ventesRaw, setVentesRaw] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [periode, setPeriode] = useState(getPeriodeCourante);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const periods = useMemo(() => generatePeriods(), []);

  useEffect(() => {
    if (!user?.chatteur_id) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    Promise.all([
      api.get(`/api/chatteurs/${user.chatteur_id}/historique`, { signal: controller.signal }),
      api.get(`/api/chatteurs/classement?periode_debut=${periode.debut}&periode_fin=${periode.fin}`, { signal: controller.signal }),
      api.get('/api/chatteurs/classement/historique-cagnotte?nb_periodes=6', { signal: controller.signal }),
      api.get(`/api/objectifs/paliers-primes?periode_debut=${periode.debut}&periode_fin=${periode.fin}`, { signal: controller.signal }).catch(() => ({ data: [] })),
      api.get(`/api/ventes?chatteur_id=${user.chatteur_id}&periode_debut=${periode.debut}&periode_fin=${periode.fin}`, { signal: controller.signal }).catch(() => ({ data: [] })),
    ]).then(([h, c, ch, pp, vr]) => {
      setHistorique(h.data || []);
      setClassementData(c.data || {});
      setCagnotteHistorique(ch.data || {});
      setPaliersIndiv(pp.data || []);
      const vData = vr.data?.ventes || vr.data || [];
      setVentesRaw(Array.isArray(vData) ? vData : []);
    })
    .catch(() => {
      if (!controller.signal.aborted) setError('Impossible de charger les donn\u00e9es.');
    })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user?.chatteur_id, periode.debut, periode.fin]);

  // Memoize all derived computations
  const {
    maxPaie, classement, nbChatteursTotal, totalNetHTEquipe,
    myRang, myData, myNetHT, myPalierAtteint, myPalierAtteintIdx,
    motivation, streaksData, totalGagne,
  } = useMemo(() => {
    const classement = classementData?.classement || [];
    const nbChatteursTotal = classementData?.nb_chatteurs || classement.length;
    const totalNetHTEquipe = classementData?.total_net_ht_equipe || 0;
    const maxPaie = Math.max(...historique.map(h => h.total_paie || 0), 1);

    const myRang = classement.findIndex(c => c.id === user?.chatteur_id) + 1;
    const myData = classement.find(c => c.id === user?.chatteur_id);
    // Use paie-based net_ht if available, otherwise estimate from ventes
    let myNetHT = myData?.total_net_ht || 0;
    if (myNetHT === 0 && ventesRaw.length > 0) {
      myNetHT = ventesRaw.reduce((sum, v) => {
        const brut = v.montant_brut || 0;
        const tva = v.tva_rate ?? 0.2;
        const comm = v.commission_rate ?? 0.2;
        const isUSD = v.devise === 'USD';
        const brutEur = isUSD ? brut * 0.92 : brut;
        return sum + (brutEur / (1 + tva)) * (1 - comm);
      }, 0);
    }
    const motivation = getMotivation(myRang);

    // Find highest individual palier reached (with index for color)
    const myPalierAtteintIdx = (() => { for (let j = paliersIndiv.length - 1; j >= 0; j--) if (myNetHT >= paliersIndiv[j].seuil_net_ht) return j; return -1; })();
    const myPalierAtteint = myPalierAtteintIdx >= 0 ? paliersIndiv[myPalierAtteintIdx] : null;

    const streaksData = computeStreaksAndRecords(historique);
    const totalGagne = historique.reduce((s, h) => s + (h.total_paie || 0), 0);

    return {
      maxPaie, classement, totalNetHTEquipe,
      myRang, myData, myNetHT, myPalierAtteint, myPalierAtteintIdx,
      motivation, streaksData, totalGagne, nbChatteursTotal,
    };
  }, [historique, classementData, paliersIndiv, ventesRaw, user?.chatteur_id]);

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 className="text-navy" style={{ fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Activity size={22} color="#f5b731" /> Mes Performances</h1>
          <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {"\u00C9volution et challenge prime"}
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
            {formatPeriodRange(periode.debut, periode.fin)}
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
                      {formatPeriodRange(p.debut, p.fin)}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.75rem 1rem', borderRadius: '10px',
          background: '#fef2f2', border: '1px solid #fecaca',
        }}>
          <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', color: '#991b1b' }}>{error}</span>
        </div>
      )}

      {loading ? (
        <CardSkeleton count={4} />
      ) : (
        <>
          {/* ─── 1. Mes Primes Individuelles (Paliers) ─── */}
          <AnimatedCard delay={0} style={{
            border: '2px solid rgba(245,183,49,0.2)',
            background: 'linear-gradient(180deg, #fffdf7 0%, #ffffff 100%)',
          }}>
            <div style={{
              padding: '0.85rem 1.25rem',
              borderBottom: '1px solid rgba(245,183,49,0.1)',
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
              {myPalierAtteint && myPalierAtteintIdx >= 0 && (() => {
                const tcMy = getTierColorFromPalier(paliersIndiv[myPalierAtteintIdx], myPalierAtteintIdx);
                return (
                <span style={{
                  fontSize: '0.72rem', fontWeight: 700,
                  background: tcMy.light,
                  color: tcMy.text,
                  padding: '0.2rem 0.5rem', borderRadius: '12px',
                  border: `1px solid ${tcMy.border}`,
                }}>
                  {myPalierAtteint.emoji} {myPalierAtteint.label} +{myPalierAtteint.bonus}{'\u20ac'}
                </span>
                );
              })()}
            </div>
            <div style={{ padding: '1.1rem 1.25rem 0.8rem' }}>
              <PaliersIndividuelsThermometre
                paliers={paliersIndiv}
                myNetHT={myNetHT}
              />
            </div>
          </AnimatedCard>

          {/* ─── 2. Mon Evolution (bar chart) ─── */}
          <AnimatedCard delay={100}>
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <BarChart2 size={16} color="#6366f1" />
              <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)', margin: 0 }}>
                {"Mon \u00e9volution"}
              </h2>
            </div>
            <div style={{ padding: '1.25rem' }}>
              {historique.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{'\uD83D\uDCC8'}</div>
                  <p style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.5 }}>
                    Aucun historique disponible
                  </p>
                  <p style={{ color: '#cbd5e1', fontSize: '0.72rem', marginTop: '0.3rem' }}>
                    {"Ton \u00e9volution appara\u00eetra d\u00e8s la prochaine p\u00e9riode."}
                  </p>
                  <button
                    onClick={() => navigate('/chatteur/mes-ventes')}
                    className="btn-primary"
                    style={{ marginTop: '1rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Plus size={14} /> Ajouter une vente
                  </button>
                </div>
              ) : (
                <>
                  {/* Single period context message */}
                  {historique.length === 1 && (
                    <div style={{
                      fontSize: '0.7rem', color: '#64748b', background: 'rgba(99,102,241,0.06)',
                      padding: '0.5rem 0.75rem', borderRadius: '8px', marginBottom: '0.75rem',
                      textAlign: 'center', lineHeight: 1.4,
                    }}>
                      {"Premi\u00e8re p\u00e9riode ! Le graphique se remplira au fil du temps."}
                    </div>
                  )}
                  {/* Bar chart */}
                  <BarChartAnimated historique={historique} maxPaie={maxPaie} periodeDebut={periode.debut} />
                  {/* X-axis labels */}
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    {historique.map((h, i) => (
                      <div key={i} style={{
                        flex: 1, textAlign: 'center',
                        fontSize: '0.6rem', color: '#94a3b8',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {formatPeriodShort(h.periode_debut)}
                      </div>
                    ))}
                  </div>
                  {/* Summary */}
                  <div style={{
                    display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1rem',
                    borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '0.75rem',
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.05em' }}>
                        {historique.some(h => h.source === 'estimation') ? 'TOTAL ESTIMÉ' : "TOTAL GAGN\u00C9"}
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f5b731' }}>
                        {historique.some(h => h.source === 'estimation') ? `~${fmt(totalGagne)} \u20AC` : `${fmt(totalGagne)} \u20AC`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.05em' }}>MOYENNE</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1b2e4b' }}>
                        {historique.some(h => h.source === 'estimation') ? `~${fmt(totalGagne / (historique.length || 1))} \u20AC` : `${fmt(totalGagne / (historique.length || 1))} \u20AC`}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </AnimatedCard>

          {/* ─── 3. Mes Records & Streaks ─── */}
          <AnimatedCard delay={200}>
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <Flame size={16} color="#ef4444" />
              <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)', margin: 0 }}>
                {"Mes Records & Streaks"}
              </h2>
              {streaksData.streak > 0 && (
                <span style={{
                  marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 700,
                  background: streaksData.streak >= 3 ? 'rgba(239,68,68,0.1)' : 'rgba(245,183,49,0.1)',
                  color: streaksData.streak >= 3 ? '#dc2626' : '#b8860b',
                  padding: '0.15rem 0.5rem', borderRadius: '20px',
                }}>
                  {`\uD83D\uDD25 ${streaksData.streak} streak`}
                </span>
              )}
            </div>
            <div style={{ padding: '1.25rem' }}>
              <StreaksRecords {...streaksData} />
            </div>
          </AnimatedCard>

          {/* ─── 4. Classement ─── */}
          <AnimatedCard delay={300}>
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'linear-gradient(135deg, rgba(245,183,49,0.05), rgba(245,183,49,0.02))',
            }}>
              <Zap size={16} color="#f5b731" />
              <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)', margin: 0 }}>
                Classement
              </h2>
            </div>

            <div style={{ padding: '1.25rem' }}>
              {classement.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{ventesRaw.length > 0 ? '\u23F3' : '\uD83C\uDFC1'}</div>
                  <p style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>
                    {ventesRaw.length > 0
                      ? 'Tes ventes sont en attente de validation par un admin.'
                      : "Pas encore de ventes cette p\u00e9riode !"}
                  </p>
                  {ventesRaw.length > 0 && (
                    <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.3rem' }}>
                      Le classement sera mis {'\u00e0'} jour une fois les ventes valid{'\u00e9'}es.
                    </p>
                  )}
                  <button
                    onClick={() => navigate('/chatteur/mes-ventes')}
                    className="btn-primary"
                    style={{ marginTop: '1rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <ShoppingBag size={14} /> Voir mes ventes
                  </button>
                </div>
              ) : (
                <>
                  {/* My position */}
                  <div style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '10px',
                    background: `linear-gradient(135deg, ${motivation.color}08, ${motivation.color}03)`,
                    border: `1px solid ${motivation.color}20`,
                    marginBottom: '1rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{
                        width: '42px', height: '42px', borderRadius: '50%',
                        background: myRang > 0 && myRang <= 3
                          ? 'linear-gradient(135deg, #f5b731, #f59e0b)'
                          : `linear-gradient(135deg, ${motivation.color}20, ${motivation.color}10)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        border: myRang > 0 && myRang <= 3 ? '2px solid #f5b731' : `2px solid ${motivation.color}30`,
                      }}>
                        {myRang > 0 ? (
                          <span style={{
                            fontSize: myRang <= 3 ? '1.1rem' : '0.85rem',
                            fontWeight: 800,
                            color: myRang <= 3 ? '#ffffff' : motivation.color,
                          }}>
                            {myRang <= 3 ? medals[myRang - 1] : `#${myRang}`}
                          </span>
                        ) : (
                          <Target size={18} color={motivation.color} />
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1b2e4b', marginBottom: '0.15rem' }}>
                          {myRang > 0 ? `${myRang}${myRang === 1 ? 'er' : '\u00e8me'} sur ${nbChatteursTotal} chatteurs` : 'Pas encore class\u00e9'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.4 }}>
                          {motivation.emoji} {motivation.text}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Classement list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {classement.slice(0, 10).map((c, i) => {
                      const isMe = c.id === user?.chatteur_id;
                      const palier = paliersIndiv.length > 0
                        ? [...paliersIndiv].reverse().find(p => c.total_net_ht >= p.seuil_net_ht)
                        : null;
                      return (
                        <div key={c.id} style={{
                          display: 'flex', alignItems: 'center', gap: '0.6rem',
                          padding: '0.5rem 0.75rem', borderRadius: '8px',
                          background: isMe ? 'rgba(59,130,246,0.06)' : 'transparent',
                          border: isMe ? '1px solid rgba(59,130,246,0.15)' : '1px solid transparent',
                        }}>
                          <span style={{ fontSize: '0.85rem', width: '24px', textAlign: 'center', flexShrink: 0 }}>
                            {i < 3 ? medals[i] : `#${i + 1}`}
                          </span>
                          <span style={{
                            flex: 1, fontSize: '0.82rem',
                            fontWeight: isMe ? 700 : 500,
                            color: isMe ? '#1b2e4b' : '#475569',
                          }}>
                            {c.prenom}
                            {isMe && (
                              <span style={{
                                marginLeft: '0.3rem', fontSize: '0.55rem', fontWeight: 700,
                                background: 'rgba(59,130,246,0.15)', color: '#2563eb',
                                padding: '0.1rem 0.35rem', borderRadius: '10px',
                              }}>TOI</span>
                            )}
                          </span>
                          {palier && (
                            <span style={{ fontSize: '0.65rem', color: '#3b82f6' }}>
                              {palier.emoji}
                            </span>
                          )}
                          <span style={{
                            fontSize: '0.78rem', fontWeight: 600, color: '#1b2e4b',
                          }}>
                            {fmt(Math.round(c.total_net_ht))} {'\u20ac'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </AnimatedCard>
        </>
      )}
    </div>
  );
}

