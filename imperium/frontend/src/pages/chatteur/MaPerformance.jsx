import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { CardSkeleton } from '../../components/Skeleton.jsx';
import { Trophy, TrendingUp, BarChart2, AlertTriangle, Zap, Target, Users, Flame, Star, Plus, ShoppingBag } from 'lucide-react';
import { computeMilestones, computeStreaksAndRecords, computeMicroMilestones } from '../../utils/gamification.js';

const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

/* ─── Fallback milestones when no history yet ─── */
const FALLBACK_MILESTONES = [
  { seuil: 5, label: 'D\u00e9marrage', emoji: '\uD83C\uDF31', pct: 0.5 },
  { seuil: 15, label: 'En route', emoji: '\uD83D\uDD25', pct: 0.875 },
  { seuil: 30, label: 'Objectif', emoji: '\uD83D\uDE80', pct: 1.25 },
  { seuil: 50, label: 'Record', emoji: '\uD83D\uDC51', pct: 1.625 },
];

/* ─── Badge descriptions for unlock conditions ─── */
const BADGE_DESCRIPTIONS = {
  rising: 'Prime en hausse vs la p\u00e9riode pr\u00e9c\u00e9dente',
  regulier: '3 podiums cons\u00e9cutifs minimum',
  newcomer: 'Premier podium atteint !',
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

function fmt(n) {
  return (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDec(n) {
  return (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getMotivation(rang, distanceToPodium) {
  if (rang === 0) return { emoji: '\uD83C\uDFAF', text: `Pas encore de ventes cette p\u00e9riode. C'est le moment de tout donner !`, color: '#6366f1' };
  if (rang === 1) return { emoji: '\uD83D\uDC51', text: 'Tu domines le classement ! Continue \u00e0 tout donner !', color: '#f5b731' };
  if (rang === 2) return { emoji: '\uD83D\uDD25', text: 'Deuxi\u00e8me place ! Le tr\u00f4ne est \u00e0 port\u00e9e de main !', color: '#f59e0b' };
  if (rang === 3) return { emoji: '\uD83D\uDCAA', text: 'Sur le podium ! Ne l\u00e2che rien !', color: '#d97706' };
  if (rang === 4) return { emoji: '\uD83C\uDFAF', text: `Juste derri\u00e8re le podium ! Plus que ${fmt(Math.ceil(distanceToPodium))} \u20AC pour y acc\u00e9der !`, color: '#6366f1' };
  if (rang <= 6) return { emoji: '\uD83D\uDCC8', text: `Tu montes en puissance ! ${fmt(Math.ceil(distanceToPodium))} \u20AC te s\u00e9parent du podium`, color: '#3b82f6' };
  return { emoji: '\uD83D\uDE80', text: 'Chaque vente compte. Le podium est accessible \u00e0 tous !', color: '#3b82f6' };
}


/* ─── Static styles & constants ─── */
const TRACK_STYLE = { height: '14px', borderRadius: '7px', background: '#f1f5f9', position: 'relative', overflow: 'hidden' };
const FALLBACK_BANNER_STYLE = {
  fontSize: '0.7rem', color: '#64748b', background: 'rgba(99,102,241,0.06)',
  padding: '0.5rem 0.75rem', borderRadius: '8px', marginBottom: '0.75rem',
  textAlign: 'center', lineHeight: 1.4,
};
const EMPTY_STATE_STYLE = { textAlign: 'center', padding: '1.5rem 0' };
const CELEBRATION_MESSAGES = {
  'D\u00e9marrage': 'La cagnotte d\u00e9marre bien ! \uD83C\uDF89',
  'En route': "L'\u00e9quipe est en feu ! \uD83D\uDD25",
  'Objectif': 'Objectif atteint, bravo \u00e0 tous ! \uD83C\uDF8A',
  'Record': 'Record battu ! L\u00e9gendaire ! \uD83D\uDC51',
};

/* ─── Thermometre Component ─── */
const Thermometre = memo(function Thermometre({ paliers, currentPrimePool, moyennePrimePool, isFallback }) {
  const [ref, inView] = useInView();
  const [showTooltip, setShowTooltip] = useState(null);

  if (!paliers) {
    return (
      <div style={EMPTY_STATE_STYLE}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{'\uD83C\uDF21\uFE0F'}</div>
        <p style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.5 }}>
          {"Les paliers appara\u00eetront apr\u00e8s quelques p\u00e9riodes."}
        </p>
        <p style={{ color: '#cbd5e1', fontSize: '0.72rem', marginTop: '0.3rem' }}>
          {"Continue \u00e0 vendre pour d\u00e9bloquer le thermom\u00e8tre !"}
        </p>
      </div>
    );
  }

  const maxSeuil = paliers[paliers.length - 1].seuil;
  const progressPct = maxSeuil > 0 ? Math.min(100, (currentPrimePool / maxSeuil) * 100) : 0;
  const highestReached = [...paliers].reverse().find(p => p.atteint);

  return (
    <div ref={ref}>
      {isFallback && (
        <div style={FALLBACK_BANNER_STYLE}>
          {"Paliers de d\u00e9marrage \u2014 ils s'adapteront automatiquement \u00e0 l'historique de l'\u00e9quipe."}
        </div>
      )}

      <div style={{ position: 'relative', marginBottom: '2.5rem', marginTop: '0.5rem' }}>
        <div style={TRACK_STYLE}>
          <div style={{
            height: '100%', borderRadius: '7px',
            background: 'linear-gradient(90deg, #f5b731, #f59e0b, #ef8c00)',
            width: inView ? `${progressPct}%` : '0%',
            transition: 'width 1200ms cubic-bezier(0.4, 0, 0.2, 1) 300ms',
          }} />
        </div>

        {/* Milestone markers */}
        {paliers.map((p, i) => {
          const pct = maxSeuil > 0 ? (p.seuil / maxSeuil) * 100 : 0;
          const isTooltipVisible = showTooltip === i;
          return (
            <div
              key={i}
              onMouseEnter={() => setShowTooltip(i)}
              onMouseLeave={() => setShowTooltip(null)}
              onClick={() => setShowTooltip(isTooltipVisible ? null : i)}
              style={{
                position: 'absolute',
                left: `${pct}%`,
                top: '-5px',
                transform: 'translateX(-50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                cursor: 'pointer',
                zIndex: isTooltipVisible ? 10 : 1,
              }}
            >
              {/* Tooltip */}
              {isTooltipVisible && (
                <div style={{
                  position: 'absolute', bottom: '100%', marginBottom: '4px',
                  background: '#1b2e4b', color: '#fff', padding: '0.35rem 0.6rem',
                  borderRadius: '6px', fontSize: '0.65rem', fontWeight: 500,
                  whiteSpace: 'nowrap', pointerEvents: 'none',
                  animation: 'fadeIn 150ms ease',
                }}>
                  {p.emoji} {p.label}
                  <div style={{
                    position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                    borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
                    borderTop: '4px solid #1b2e4b',
                  }} />
                </div>
              )}

              {/* Marker dot */}
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: p.atteint ? '#f5b731' : '#e2e8f0',
                border: p.atteint ? '3px solid #d97706' : '2px solid #cbd5e1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.65rem',
                transition: 'all 400ms ease',
                boxShadow: p.atteint ? '0 2px 8px rgba(245,183,49,0.4)' : 'none',
                animation: p.atteint && inView ? `pulseGold 2s ease-in-out ${i * 200}ms` : 'none',
              }}>
                {p.atteint ? '\u2713' : p.emoji}
              </div>
              {/* Label below */}
              <div style={{
                marginTop: '0.3rem',
                fontSize: '0.6rem', fontWeight: 600,
                color: p.atteint ? '#b8860b' : '#94a3b8',
                whiteSpace: 'nowrap', textAlign: 'center',
              }}>
                {`${fmt(Math.round(p.seuil))} \u20AC`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Celebration message */}
      {highestReached && (
        <div style={{
          textAlign: 'center', fontSize: '0.8rem', color: '#92400e',
          background: 'rgba(245,183,49,0.1)', padding: '0.5rem 1rem',
          borderRadius: '10px', marginBottom: '0.5rem',
          border: '1px solid rgba(245,183,49,0.15)',
          animation: 'fadeIn 400ms ease',
        }}>
          {CELEBRATION_MESSAGES[highestReached.label] || `${highestReached.emoji} ${highestReached.label} atteint !`}
        </div>
      )}

      {/* Footer text */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
        fontSize: '0.7rem', color: '#64748b',
      }}>
        <Users size={12} />
        {"Chaque vente fait grandir la cagnotte !"}
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
          {"Monte sur le podium pour d\u00e9bloquer tes badges !"}
        </p>
      </div>
    );
  }

  const stats = [
    { icon: <Flame size={16} color="#ef4444" />, label: 'Streak podium', value: `${streak} p\u00e9riode${streak !== 1 ? 's' : ''}`, highlight: streak >= 3 },
    { icon: <Trophy size={16} color="#f5b731" />, label: 'Meilleure prime', value: `${fmtDec(bestPrime)} \u20AC`, highlight: bestPrime > 0 },
    { icon: <span style={{ fontSize: '1rem' }}>{'\uD83D\uDCB0'}</span>, label: 'Meilleure paie', value: `${fmt(bestPaie)} \u20AC`, highlight: bestPaie > 0 },
    { icon: <Star size={16} color="#6366f1" />, label: 'Total podiums', value: `${totalPodiums}`, highlight: totalPodiums > 0 },
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


/* ─── MicroJalonsTrack Component ─── */
const MicroJalonsTrack = memo(function MicroJalonsTrack({ jalons, nextJalonAmount, progressPct }) {
  if (!jalons) return null;

  return (
    <div style={{ marginTop: '0.75rem' }}>
      {/* Track with checkpoints */}
      <div style={{ position: 'relative', padding: '0 0.5rem' }}>
        {/* Background line */}
        <div style={{
          position: 'absolute', top: '12px', left: '0.5rem', right: '0.5rem',
          height: '3px', background: '#e2e8f0', borderRadius: '2px',
        }} />
        {/* Progress line */}
        <div style={{
          position: 'absolute', top: '12px', left: '0.5rem',
          height: '3px', borderRadius: '2px',
          background: 'linear-gradient(90deg, #10b981, #34d399)',
          width: `${Math.min(progressPct, 100)}%`,
          transition: 'width 800ms cubic-bezier(0.4, 0, 0.2, 1)',
        }} />

        {/* Checkpoint circles */}
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
          {jalons.map((j, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem',
            }}>
              <div style={{
                width: '26px', height: '26px', borderRadius: '50%',
                background: j.passed ? '#10b981' : '#f1f5f9',
                border: j.passed ? '2px solid #059669' : '2px solid #cbd5e1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.65rem', fontWeight: 700,
                color: j.passed ? '#ffffff' : '#94a3b8',
                transition: 'all 300ms ease',
                boxShadow: j.passed ? '0 2px 6px rgba(16,185,129,0.3)' : 'none',
              }}>
                {j.passed ? '\u2713' : j.label}
              </div>
              <div style={{
                fontSize: '0.55rem', fontWeight: 600,
                color: j.passed ? '#059669' : '#94a3b8',
                whiteSpace: 'nowrap',
              }}>
                {`${fmt(Math.round(j.targetAmount))} \u20AC`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Next milestone message */}
      {nextJalonAmount > 0 && (
        <div style={{
          textAlign: 'center', marginTop: '0.6rem',
          fontSize: '0.72rem', color: '#059669', fontWeight: 600,
        }}>
          {`\uD83C\uDFAF Plus que ${fmt(Math.ceil(nextJalonAmount))} \u20AC pour le prochain jalon !`}
        </div>
      )}
    </div>
  );
});


/* ─── Animated Podium ─── */
const PodiumAnimated = memo(function PodiumAnimated({ top3Primes, userId }) {
  const [ref, inView] = useInView();
  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {[0, 1, 2].map(i => {
        const entry = top3Primes[i];
        const hasChatteur = entry?.id;
        const isMe = hasChatteur && entry.id === userId;
        return (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.65rem 0.85rem',
              borderRadius: '10px',
              background: isMe ? 'rgba(245,183,49,0.1)' : hasChatteur ? 'rgba(0,0,0,0.02)' : 'rgba(0,0,0,0.015)',
              border: isMe ? '2px solid #f5b731' : '1px solid rgba(0,0,0,0.06)',
              opacity: inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(12px)',
              transition: `all 400ms cubic-bezier(0.4, 0, 0.2, 1) ${i * 150}ms`,
            }}
          >
            <span style={{ fontSize: '1.3rem', flexShrink: 0, width: '28px', textAlign: 'center' }}>
              {medals[i]}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '0.85rem', fontWeight: isMe ? 700 : hasChatteur ? 600 : 400,
                color: isMe ? '#1b2e4b' : hasChatteur ? '#334155' : '#cbd5e1',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                fontStyle: hasChatteur ? 'normal' : 'italic',
              }}>
                {hasChatteur ? entry.prenom : 'En attente...'}
                {isMe && (
                  <span style={{
                    marginLeft: '0.4rem', fontSize: '0.6rem', fontWeight: 700,
                    background: 'rgba(245,183,49,0.2)', color: '#b8860b',
                    padding: '0.1rem 0.4rem', borderRadius: '10px',
                  }}>
                    TOI
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: hasChatteur ? '#f5b731' : '#e2e8f0' }}>
                {hasChatteur ? `${fmtDec(entry.calculatedPrime)} \u20AC` : '\u2014 \u20AC'}
              </span>
              <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>
                {`${(entry.rate * 100).toFixed(1)}% de la cagnotte`}
              </span>
            </div>
          </div>
        );
      })}
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
              {`${fmt(h.total_paie)}\u20AC`}
            </span>
            <div
              style={{
                width: '100%', maxWidth: '40px',
                height: inView ? `${heightPct}%` : '4px',
                minHeight: '4px',
                borderRadius: '4px 4px 0 0',
                background: isCurrent
                  ? 'linear-gradient(180deg, #f5b731, #f59e0b)'
                  : 'linear-gradient(180deg, #cbd5e1, #94a3b8)',
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const periode = useMemo(() => getPeriodeCourante(), []);

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
    ]).then(([h, c, ch]) => {
      setHistorique(h.data || []);
      setClassementData(c.data || {});
      setCagnotteHistorique(ch.data || {});
    })
    .catch(() => {
      if (!controller.signal.aborted) setError('Impossible de charger les donn\u00e9es.');
    })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [user?.chatteur_id, periode.debut, periode.fin]);

  // Memoize all derived computations
  const {
    maxPaie, classement, nbChatteursTotal, totalNetHTEquipe, primeRates, totalPrimePool,
    top3Primes, myRang, myData, thirdPlaceNetHT, distanceToPodium,
    motivation, paliers, isFallbackPaliers, streaksData, microJalons, totalGagne, moyennePrimePool,
  } = useMemo(() => {
    const classement = classementData?.classement || [];
    const nbChatteursTotal = classementData?.nb_chatteurs || classement.length;
    const totalNetHTEquipe = classementData?.total_net_ht_equipe || 0;
    const primeRates = classementData?.prime_rates || [0.005, 0.0025, 0.0012];
    const maxPaie = Math.max(...historique.map(h => h.total_paie || 0), 1);

    const totalPrimePool = totalNetHTEquipe * primeRates.reduce((s, r) => s + r, 0);
    const top3 = classement.slice(0, 3);
    const top3Primes = primeRates.map((rate, i) => ({
      ...(top3[i] || {}),
      calculatedPrime: totalNetHTEquipe * rate,
      rate,
      rang: i + 1,
    }));

    const myRang = classement.findIndex(c => c.id === user?.chatteur_id) + 1;
    const myData = classement.find(c => c.id === user?.chatteur_id);
    const thirdPlaceNetHT = top3[2]?.total_net_ht || 0;
    const distanceToPodium = myData ? Math.max(0, thirdPlaceNetHT - myData.total_net_ht) : 0;
    const motivation = getMotivation(myRang, distanceToPodium);

    const moyennePrimePool = cagnotteHistorique?.moyenne_prime_pool || 0;
    let paliers = computeMilestones(moyennePrimePool, totalPrimePool);
    let isFallbackPaliers = false;

    // Smart fallback: use fixed milestones when no history or seuils are meaninglessly small
    const paliersAreTiny = paliers && paliers[paliers.length - 1].seuil < 1;
    if ((!paliers || paliersAreTiny) && totalPrimePool > 0) {
      paliers = FALLBACK_MILESTONES.map(p => ({
        ...p,
        atteint: totalPrimePool >= p.seuil,
      }));
      isFallbackPaliers = true;
    }

    const streaksData = computeStreaksAndRecords(historique);
    const microJalons = computeMicroMilestones(myData?.total_net_ht || 0, thirdPlaceNetHT, myRang);
    const totalGagne = historique.reduce((s, h) => s + (h.total_paie || 0), 0);

    return {
      maxPaie, classement, totalNetHTEquipe, primeRates, totalPrimePool,
      top3Primes, myRang, myData, thirdPlaceNetHT, distanceToPodium,
      motivation, paliers, isFallbackPaliers, streaksData, microJalons, totalGagne, moyennePrimePool, nbChatteursTotal,
    };
  }, [historique, classementData, cagnotteHistorique, user?.chatteur_id]);

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h1 className="text-navy" style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Ma Performance</h1>
        <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
          {"\u00C9volution et challenge prime"}
        </p>
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
          {/* ─── 1. Paliers Cagnotte (Thermometre) ─── */}
          <AnimatedCard delay={0}>
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'linear-gradient(135deg, rgba(245,183,49,0.06), rgba(245,183,49,0.02))',
            }}>
              <span style={{ fontSize: '1rem' }}>{'\uD83C\uDF21\uFE0F'}</span>
              <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)', margin: 0 }}>
                Paliers Cagnotte
              </h2>
              {totalPrimePool > 0 && (
                <span style={{
                  marginLeft: 'auto', fontSize: '0.85rem', fontWeight: 700, color: '#f5b731',
                }}>
                  {`${fmtDec(totalPrimePool)} \u20AC`}
                </span>
              )}
            </div>
            <div style={{ padding: '1.25rem' }}>
              <Thermometre
                paliers={paliers}
                currentPrimePool={totalPrimePool}
                moyennePrimePool={moyennePrimePool}
                isFallback={isFallbackPaliers}
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
                    onClick={() => navigate('/mes-ventes')}
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
                      <div style={{ fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.05em' }}>{"TOTAL GAGN\u00C9"}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f5b731' }}>
                        {`${fmt(totalGagne)} \u20AC`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.05em' }}>MOYENNE</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1b2e4b' }}>
                        {`${fmt(totalGagne / (historique.length || 1))} \u20AC`}
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

          {/* ─── 4. Podium & Classement ─── */}
          <AnimatedCard delay={300}>
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'linear-gradient(135deg, rgba(245,183,49,0.05), rgba(245,183,49,0.02))',
            }}>
              <Zap size={16} color="#f5b731" />
              <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)', margin: 0 }}>
                {"Podium & Classement"}
              </h2>
            </div>

            <div style={{ padding: '1.25rem' }}>
              {totalNetHTEquipe === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{'\uD83C\uDFC1'}</div>
                  <p style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>
                    {"La course commence avec les premi\u00e8res ventes !"}
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem', lineHeight: 1.5 }}>
                    {"Chaque vente de l'\u00e9quipe alimente la cagnotte."}
                    <br />
                    {"Les 3 meilleurs se partagent les primes."}
                  </p>
                  <button
                    onClick={() => navigate('/mes-ventes')}
                    className="btn-primary"
                    style={{ marginTop: '1rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <ShoppingBag size={14} /> Voir mes ventes
                  </button>
                </div>
              ) : (
                <>
                  {/* Prime pool total */}
                  <div style={{
                    textAlign: 'center', marginBottom: '1.25rem',
                    padding: '1rem',
                    background: 'linear-gradient(135deg, rgba(245,183,49,0.08), rgba(245,183,49,0.03))',
                    borderRadius: '12px',
                    border: '1px solid rgba(245,183,49,0.15)',
                  }}>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                      CAGNOTTE TOTALE
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f5b731', letterSpacing: '-0.02em' }}>
                      {`${fmtDec(totalPrimePool)} \u20AC`}
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                      marginTop: '0.5rem', fontSize: '0.7rem', color: '#64748b',
                    }}>
                      <Users size={12} />
                      {"Les 3 premiers se partagent la cagnotte"}
                    </div>
                  </div>

                  {/* Top 3 Podium */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{
                      fontSize: '0.7rem', fontWeight: 700, color: '#1b2e4b',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                      marginBottom: '0.6rem',
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                    }}>
                      <Trophy size={14} color="#f5b731" />
                      Podium
                    </div>

                    <PodiumAnimated top3Primes={top3Primes} userId={user?.chatteur_id} />
                  </div>

                  {/* User's position */}
                  <div style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '10px',
                    background: `linear-gradient(135deg, ${motivation.color}08, ${motivation.color}03)`,
                    border: `1px solid ${motivation.color}20`,
                    marginBottom: '1rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      {/* Rank badge */}
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

                      {/* Message */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1b2e4b', marginBottom: '0.15rem' }}>
                          {myRang > 0 ? `${myRang <= 3 ? `${medals[myRang - 1]} Sur le podium` : `${myRang}${myRang === 1 ? 'er' : '\u00e8me'}`} sur ${nbChatteursTotal} chatteurs` : 'Pas encore class\u00e9'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.4 }}>
                          {motivation.emoji} {motivation.text}
                        </div>
                      </div>
                    </div>

                    {/* Mini-jalons (replaces simple progress bar) */}
                    {microJalons ? (
                      <MicroJalonsTrack
                        jalons={microJalons.jalons}
                        nextJalonAmount={microJalons.nextJalonAmount}
                        progressPct={microJalons.progressPct}
                      />
                    ) : (
                      /* Fallback: simple progress bar for non-ranked users */
                      myRang > 3 && myData && thirdPlaceNetHT > 0 && (
                        <div style={{ marginTop: '0.75rem' }}>
                          <div style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            fontSize: '0.65rem', color: '#64748b', marginBottom: '0.3rem',
                          }}>
                            <span>Progression vers le podium</span>
                            <span style={{ fontWeight: 600 }}>
                              {Math.round((myData.total_net_ht / thirdPlaceNetHT) * 100)}%
                            </span>
                          </div>
                          <div style={{
                            height: '8px', borderRadius: '4px',
                            background: '#f1f5f9', overflow: 'hidden',
                          }}>
                            <div style={{
                              height: '100%', borderRadius: '4px',
                              background: `linear-gradient(90deg, ${motivation.color}, ${motivation.color}cc)`,
                              width: `${Math.min(100, (myData.total_net_ht / thirdPlaceNetHT) * 100)}%`,
                              transition: 'width 800ms cubic-bezier(0.4, 0, 0.2, 1)',
                            }} />
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  {/* Team spirit banner */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.65rem 0.85rem', borderRadius: '8px',
                    background: 'rgba(16,185,129,0.06)',
                    border: '1px solid rgba(16,185,129,0.15)',
                  }}>
                    <TrendingUp size={14} color="#10b981" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '0.72rem', color: '#065f46', lineHeight: 1.4 }}>
                      {"Plus l'\u00e9quipe vend, plus la cagnotte grossit. Ensemble, on est plus forts ! \uD83D\uDE80"}
                    </span>
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
