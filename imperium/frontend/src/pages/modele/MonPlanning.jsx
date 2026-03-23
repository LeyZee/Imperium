import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ChevronLeft, ChevronRight, CalendarDays, Coffee, Clock } from 'lucide-react';
import { CHATTEUR_COLORS } from '../../constants/colors.js';

const CRENEAUX = [
  { id: 1, label: '08h–14h', short: '08-14' },
  { id: 2, label: '14h–20h', short: '14-20' },
  { id: 3, label: '20h–02h', short: '20-02' },
  { id: 4, label: '02h–08h', short: '02-08' },
];

const JOURS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const JOURS_FULL = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function toISO(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

function getCurrentCreneau() {
  const h = new Date().getHours();
  return h >= 8 && h < 14 ? 1 : h >= 14 && h < 20 ? 2 : h >= 20 || h < 2 ? 3 : 4;
}

/* ─── Responsive hook ─── */
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mql.matches);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

export default function ModeleMonPlanning() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchShifts = useCallback(() => {
    const controller = new AbortController();
    setLoading(prev => !shifts.length ? true : prev);
    api.get(`/api/modele/shifts?date=${toISO(weekStart)}`, { signal: controller.signal }).then(({ data }) => {
      setShifts(Array.isArray(data) ? data : data.shifts || []);
    }).catch(() => {}).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [weekStart]);

  useEffect(() => {
    const cleanup = fetchShifts();
    return cleanup;
  }, [fetchShifts]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayISO = useMemo(() => toISO(new Date()), []);
  const totalShifts = shifts.length;
  const isMobile = useIsMobile(768);

  // Group shifts by platform
  const platformGroups = useMemo(() => {
    const map = new Map();
    for (const s of shifts) {
      const key = s.plateforme_nom || 'Inconnue';
      if (!map.has(key)) {
        map.set(key, {
          nom: s.plateforme_nom,
          couleur_fond: s.plateforme_couleur_fond,
          couleur_texte: s.plateforme_couleur_texte,
          shifts: [],
        });
      }
      map.get(key).shifts.push(s);
    }
    return Array.from(map.values());
  }, [shifts]);

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div>
          <h1 className="text-navy" style={{ fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarDays size={22} color="#f5b731" /> Mon Planning
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {totalShifts} shift{totalShifts !== 1 ? 's' : ''} cette semaine
          </p>
        </div>
      </div>

      {/* Week navigator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
        marginBottom: '1rem',
      }}>
        <NavButton onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <ChevronLeft size={18} />
        </NavButton>
        <span style={{
          fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap',
        }}>
          Sem. du {weekStart.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}
        </span>
        <NavButton onClick={() => setWeekStart(addDays(weekStart, 7))}>
          <ChevronRight size={18} />
        </NavButton>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
          Chargement...
        </div>
      ) : platformGroups.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', color: '#94a3b8' }}>
          <Coffee size={28} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.5 }} />
          <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>Aucun shift cette semaine</p>
          <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Naviguez vers une autre semaine pour voir vos shifts</p>
        </div>
      ) : (
        <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {platformGroups.map(group => (
            <PlatformCard
              key={group.nom}
              platform={group}
              days={days}
              todayISO={todayISO}
              isMobile={isMobile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Nav button (same as admin) ─── */
function NavButton({ onClick, children }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      className="card"
      style={{
        padding: '0.5rem', lineHeight: 1, cursor: 'pointer',
        transform: pressed ? 'scale(0.9)' : 'scale(1)',
        transition: 'transform 120ms ease, box-shadow 200ms ease',
      }}
    >
      {children}
    </button>
  );
}

/* ─── Platform Card (equivalent to admin ModelCard) ─── */
function PlatformCard({ platform, days, todayISO, isMobile }) {
  const [hovered, setHovered] = useState(false);
  const count = platform.shifts.length;
  const bg = platform.couleur_fond || '#1b2e4b';
  const txt = platform.couleur_texte || '#ffffff';
  const currentCreneau = getCurrentCreneau();

  // Build shift lookup: "date|creneau" → array of shifts
  const shiftMap = useMemo(() => {
    const m = new Map();
    for (const s of platform.shifts) {
      const key = `${s.date}|${s.creneau}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(s);
    }
    return m;
  }, [platform.shifts]);

  return (
    <div
      className="card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '0.75rem',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? '0 8px 25px rgba(0,0,0,0.08)' : undefined,
        transition: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 250ms ease',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {/* Platform badge (colored dot + name, like admin model avatar) */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: bg,
          border: `2px solid ${bg}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.65rem', fontWeight: 700,
          color: txt,
          flexShrink: 0,
          transition: 'transform 300ms ease, background 300ms ease',
          transform: hovered ? 'scale(1.1) rotate(5deg)' : 'scale(1)',
        }}>
          {platform.nom.charAt(0)}
        </div>
        <span style={{ fontWeight: 600, color: '#1b2e4b', fontSize: '0.85rem' }}>{platform.nom}</span>
        <span style={{
          marginLeft: 'auto', fontSize: '0.55rem', fontWeight: 600,
          background: count > 0 ? 'rgba(245,183,49,0.12)' : 'rgba(0,0,0,0.04)',
          color: count > 0 ? '#b8860b' : '#94a3b8',
          padding: '0.15rem 0.45rem', borderRadius: '20px',
          transition: 'all 200ms ease',
        }}>
          {count} shift{count !== 1 ? 's' : ''}
        </span>
      </div>

      {isMobile ? (
        /* ─── Mobile: vertical day-by-day layout ─── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {days.map((d, di) => {
            const iso = toISO(d);
            const isToday = iso === todayISO;
            return (
              <div key={di} style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.35rem 0.5rem',
                borderRadius: '8px',
                background: isToday ? 'rgba(245,183,49,0.06)' : 'transparent',
                borderLeft: isToday ? '3px solid #f5b731' : '3px solid transparent',
                transition: 'all 200ms ease',
              }}>
                {/* Day label */}
                <div style={{ minWidth: '42px', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: isToday ? '#b8860b' : '#1b2e4b' }}>
                    {JOURS_FULL[di]}
                  </div>
                  <div style={{ fontSize: '0.55rem', color: '#94a3b8' }}>
                    {d.getDate()}/{String(d.getMonth() + 1).padStart(2, '0')}
                  </div>
                </div>
                {/* Creneau pills */}
                <div style={{ display: 'flex', gap: '3px', flex: 1, flexWrap: 'wrap' }}>
                  {CRENEAUX.map(cr => {
                    const cellShifts = shiftMap.get(`${iso}|${cr.id}`) || [];
                    const isCurrent = cr.id === currentCreneau && isToday;
                    return (
                      <MobileShiftPill
                        key={cr.id}
                        shifts={cellShifts}
                        creneauShort={cr.short}
                        isCurrent={isCurrent}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ─── Desktop: compact week grid (identical to admin) ─── */
        <div style={{ display: 'grid', gridTemplateColumns: '38px repeat(7, 1fr)', gap: '2px' }}>
          {/* Day headers */}
          <div />
          {days.map((d, i) => {
            const isToday = toISO(d) === todayISO;
            return (
              <div key={i} style={{
                textAlign: 'center', padding: '2px 0', borderRadius: '4px',
                background: isToday ? 'rgba(245,183,49,0.12)' : 'transparent',
                transition: 'background 200ms ease',
              }}>
                <div style={{ fontSize: '0.5rem', color: isToday ? '#b8860b' : '#94a3b8', fontWeight: isToday ? 700 : 500 }}>{JOURS_SHORT[i]}</div>
                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: isToday ? '#b8860b' : '#1a1f2e' }}>
                  {d.getDate()}
                </div>
              </div>
            );
          })}

          {/* Creneau rows */}
          {CRENEAUX.map(cr => {
            const isCurrent = cr.id === currentCreneau;
            return (
              <ShiftRow
                key={cr.id}
                creneau={cr}
                isCurrent={isCurrent}
                days={days}
                shiftMap={shiftMap}
                todayISO={todayISO}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Mobile shift pill (read-only) ─── */
function MobileShiftPill({ shifts, creneauShort, isCurrent }) {
  const [hovered, setHovered] = useState(false);
  const empty = shifts.length === 0;
  const firstShift = shifts[0];
  const color = !empty && firstShift.chatteur_couleur != null
    ? CHATTEUR_COLORS[firstShift.chatteur_couleur % CHATTEUR_COLORS.length]
    : null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={!empty ? shifts.map(s => `${s.chatteur_prenom} — ${creneauShort}`).join(', ') : creneauShort}
      style={{
        flex: '1 1 0',
        minWidth: '52px',
        padding: '0.3rem 0.25rem',
        borderRadius: '8px',
        border: !empty
          ? `1.5px solid ${hovered ? color?.text || '#94a3b8' : color?.border || '#e8ecf1'}`
          : `1.5px dashed ${hovered ? '#f5b731' : '#e2e8f0'}`,
        background: !empty
          ? (hovered ? (color?.border || 'rgba(0,0,0,0.1)') + '40' : color?.bg || '#f1f5f9')
          : (hovered ? 'rgba(245,183,49,0.06)' : '#fafafa'),
        color: !empty ? (color?.text || '#475569') : (hovered ? '#f5b731' : '#cbd5e1'),
        fontSize: '0.55rem',
        fontWeight: 600,
        transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hovered && !empty ? 'scale(1.05)' : 'scale(1)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
        lineHeight: 1.2,
      }}
    >
      <span style={{ fontSize: '0.45rem', opacity: 0.7 }}>{creneauShort}</span>
      {empty ? (
        <span style={{
          fontSize: '0.7rem',
          transition: 'transform 200ms ease',
          transform: hovered ? 'scale(1.3)' : 'scale(1)',
          color: hovered ? '#f5b731' : '#d1d5db',
        }}>+</span>
      ) : (
        shifts.map(s => {
          const sClr = s.chatteur_couleur != null
            ? CHATTEUR_COLORS[s.chatteur_couleur % CHATTEUR_COLORS.length]
            : null;
          return (
            <span key={s.id} style={{ color: sClr?.text || '#475569' }}>
              {s.chatteur_prenom}
            </span>
          );
        })
      )}
    </div>
  );
}

/* ─── Single creneau row in the grid ─── */
function ShiftRow({ creneau, isCurrent, days, shiftMap, todayISO }) {
  return (
    <>
      {/* Creneau label */}
      <div style={{
        fontSize: '0.5rem', color: isCurrent ? '#16a34a' : '#94a3b8', fontWeight: isCurrent ? 700 : 500,
        display: 'flex', alignItems: 'center', padding: '0 2px', whiteSpace: 'nowrap',
        borderLeft: isCurrent ? '2px solid #16a34a' : '2px solid transparent',
      }}>
        {creneau.short}
      </div>

      {/* 7 day cells */}
      {days.map((d, i) => {
        const iso = toISO(d);
        const isToday = iso === todayISO;
        const cellShifts = shiftMap.get(`${iso}|${creneau.id}`) || [];
        return (
          <ShiftCell
            key={i}
            shifts={cellShifts}
            isToday={isToday}
          />
        );
      })}
    </>
  );
}

/* ─── Individual shift cell (read-only) with hover animation ─── */
function ShiftCell({ shifts, isToday }) {
  const [hovered, setHovered] = useState(false);
  const empty = shifts.length === 0;

  const emptyBg = isToday
    ? (hovered ? 'rgba(245,183,49,0.1)' : 'rgba(245,183,49,0.04)')
    : (hovered ? 'rgba(245,183,49,0.06)' : '#fafafa');

  if (empty) {
    return (
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          minHeight: '30px',
          borderRadius: '5px',
          border: `1.5px dashed ${hovered ? '#f5b731' : (isToday ? '#f5b73180' : '#e2e8f0')}`,
          background: emptyBg,
          padding: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          lineHeight: 1.1,
          transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          zIndex: hovered ? 2 : 1,
        }}
      >
        <span style={{
          fontSize: '0.7rem',
          color: hovered ? '#f5b731' : (isToday ? '#d4a017' : '#d1d5db'),
          transition: 'transform 200ms ease, color 180ms ease',
          transform: hovered ? 'scale(1.3)' : 'scale(1)',
        }}>+</span>
      </div>
    );
  }

  // Filled cell — get color from first shift's chatteur
  const firstShift = shifts[0];
  const clr = firstShift.chatteur_couleur != null
    ? CHATTEUR_COLORS[firstShift.chatteur_couleur % CHATTEUR_COLORS.length]
    : null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minHeight: '30px',
        borderRadius: '5px',
        border: `1.5px solid ${hovered ? (clr?.text || '#94a3b8') : (isToday ? 'rgba(245,183,49,0.35)' : (clr?.border || '#e8ecf1'))}`,
        background: hovered ? (clr?.border || 'rgba(0,0,0,0.1)') + '40' : (isToday ? 'rgba(245,183,49,0.06)' : '#fff'),
        padding: '3px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        gap: '2px',
        overflow: 'hidden',
        lineHeight: 1.1,
        transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hovered ? 'scale(1.08)' : 'scale(1)',
        boxShadow: hovered ? `0 3px 10px ${clr?.border || 'rgba(0,0,0,0.1)'}60` : 'none',
        position: 'relative',
        zIndex: hovered ? 2 : 1,
      }}
    >
      {shifts.map(s => {
        const sClr = s.chatteur_couleur != null
          ? CHATTEUR_COLORS[s.chatteur_couleur % CHATTEUR_COLORS.length]
          : null;
        return (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', gap: '2px',
            flexWrap: 'wrap',
          }}>
            {/* Chatteur badge */}
            {s.chatteur_prenom && (
              <span style={{
                fontSize: '0.55rem', fontWeight: 600,
                padding: '1px 4px', borderRadius: '99px',
                background: sClr?.bg || '#f1f5f9',
                color: sClr?.text || '#475569',
                lineHeight: 1.3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}>
                {s.chatteur_prenom}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
