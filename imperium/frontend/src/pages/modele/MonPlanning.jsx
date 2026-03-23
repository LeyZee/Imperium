import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ChevronLeft, ChevronRight, Clock, Coffee, ClipboardList } from 'lucide-react';
import { CHATTEUR_COLORS } from '../../constants/colors.js';

const CRENEAUX = [
  { id: 1, label: '08h–14h', short: '08–14' },
  { id: 2, label: '14h–20h', short: '14–20' },
  { id: 3, label: '20h–02h', short: '20–02' },
  { id: 4, label: '02h–08h', short: '02–08' },
];

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

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

function isToday(date) {
  const now = new Date();
  return date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function getCurrentCreneau() {
  const h = new Date().getHours();
  return h >= 8 && h < 14 ? 1 : h >= 14 && h < 20 ? 2 : h >= 20 || h < 2 ? 3 : 4;
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
  const todayISO = toISO(new Date());
  const currentCreneau = getCurrentCreneau();
  const totalShifts = shifts.length;

  // Group shifts by "date|creneau" key
  const shiftMap = useMemo(() => {
    const map = new Map();
    for (const s of shifts) {
      const key = `${s.date}|${s.creneau}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    return map;
  }, [shifts]);

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <div>
          <h1 className="text-navy" style={{ fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList size={22} color="#f5b731" /> Mon Planning
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {totalShifts} shift{totalShifts !== 1 ? 's' : ''} cette semaine
          </p>
        </div>
      </div>

      {/* Week navigator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
        marginBottom: '1.25rem',
      }}>
        <button
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="btn-ghost haptic"
          style={{ padding: '0.5rem', borderRadius: '8px' }}
        >
          <ChevronLeft size={18} />
        </button>
        <span style={{
          fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap',
          color: 'var(--navy)', letterSpacing: '0.01em',
        }}>
          Sem. du {weekStart.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}
        </span>
        <button
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="btn-ghost haptic"
          style={{ padding: '0.5rem', borderRadius: '8px' }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
          Chargement...
        </div>
      ) : (
        <>
          {/* Desktop grid (>640px) */}
          <div className="planning-desktop-grid" style={{ display: 'grid', gridTemplateColumns: '38px repeat(7, 1fr)', gap: '2px' }}>
            {/* Day headers */}
            <div />
            {days.map((d, i) => {
              const today = toISO(d) === todayISO;
              return (
                <div key={i} style={{
                  textAlign: 'center', padding: '4px 0', borderRadius: '4px',
                  background: today ? 'rgba(245,183,49,0.12)' : 'transparent',
                }}>
                  <div style={{ fontSize: '0.55rem', color: today ? '#b8860b' : '#94a3b8', fontWeight: today ? 700 : 500 }}>
                    {JOURS[i]}
                  </div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, color: today ? '#b8860b' : '#1a1f2e' }}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}

            {/* Creneau rows */}
            {CRENEAUX.map(cr => {
              const isCurrent = cr.id === currentCreneau;
              return (
                <GridRow
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

          {/* Mobile card list (<640px) */}
          <div className="planning-mobile-cards" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {days.map((day, i) => {
              const dayShifts = shifts.filter(s => s.date === toISO(day));
              const today = isToday(day);
              return (
                <div
                  key={i}
                  className="card"
                  style={{
                    borderLeft: today ? '3px solid #f5b731' : dayShifts.length > 0 ? '3px solid rgba(245,183,49,0.4)' : '3px solid transparent',
                    background: today ? 'rgba(245,183,49,0.04)' : undefined,
                    padding: '0.85rem 1.1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--navy)' }}>
                        {JOURS[i]} {day.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </span>
                      {today && (
                        <span style={{
                          fontSize: '0.6rem', fontWeight: 700, color: '#f5b731',
                          background: 'rgba(245,183,49,0.15)', padding: '0.15rem 0.5rem',
                          borderRadius: '20px', letterSpacing: '0.05em',
                        }}>
                          AUJOURD'HUI
                        </span>
                      )}
                    </div>
                    {dayShifts.length === 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                        <Coffee size={14} /> Repos
                      </span>
                    )}
                  </div>

                  {dayShifts.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.6rem' }}>
                      {dayShifts.map(s => (
                        <div key={s.id} style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
                        }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                            background: 'rgba(245,183,49,0.12)', color: '#b8860b',
                            padding: '0.25rem 0.6rem', borderRadius: '6px',
                            fontSize: '0.75rem', fontWeight: 600,
                          }}>
                            <Clock size={12} />
                            {CRENEAUX.find(c => c.id === s.creneau)?.label || `Créneau ${s.creneau}`}
                          </span>
                          {s.plateforme_nom && (
                            <span style={{
                              background: s.plateforme_couleur_fond || 'rgba(27,46,75,0.08)',
                              color: s.plateforme_couleur_texte || '#1b2e4b',
                              padding: '0.25rem 0.6rem', borderRadius: '6px',
                              fontSize: '0.75rem', fontWeight: 600,
                            }}>
                              {s.plateforme_nom}
                            </span>
                          )}
                          {s.chatteur_prenom && (() => {
                            const clr = s.chatteur_couleur != null ? CHATTEUR_COLORS[s.chatteur_couleur % CHATTEUR_COLORS.length] : null;
                            return (
                              <span className="badge" style={{
                                fontSize: '0.72rem', fontWeight: 600,
                                padding: '0.2rem 0.55rem', borderRadius: '99px',
                                background: clr?.bg || '#f1f5f9',
                                color: clr?.text || '#475569',
                              }}>
                                {s.chatteur_prenom}
                              </span>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Responsive CSS */}
      <style>{`
        @media (min-width: 641px) {
          .planning-mobile-cards { display: none !important; }
          .planning-desktop-grid { display: grid !important; }
        }
        @media (max-width: 640px) {
          .planning-desktop-grid { display: none !important; }
          .planning-mobile-cards { display: flex !important; }
        }
      `}</style>
    </div>
  );
}

/* ─── Single creneau row in the grid ─── */
function GridRow({ creneau, isCurrent, days, shiftMap, todayISO }) {
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
        const today = iso === todayISO;
        const cellShifts = shiftMap.get(`${iso}|${creneau.id}`) || [];
        return (
          <GridCell
            key={i}
            shifts={cellShifts}
            isToday={today}
            isCurrent={isCurrent}
          />
        );
      })}
    </>
  );
}

/* ─── Individual grid cell (read-only) ─── */
function GridCell({ shifts, isToday, isCurrent }) {
  const empty = shifts.length === 0;

  const bgColor = empty
    ? (isToday ? 'rgba(245,183,49,0.04)' : '#fafafa')
    : (isToday ? 'rgba(245,183,49,0.06)' : '#fff');

  return (
    <div style={{
      minHeight: '50px',
      borderRadius: '5px',
      border: isToday ? '1.5px solid rgba(245,183,49,0.35)' : '1.5px solid #e8ecf1',
      background: bgColor,
      padding: empty ? '2px' : '3px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: empty ? 'center' : 'stretch',
      justifyContent: empty ? 'center' : 'flex-start',
      gap: '2px',
      overflow: 'hidden',
    }}>
      {empty ? (
        <span style={{ fontSize: '0.65rem', color: '#d1d5db' }}>—</span>
      ) : (
        shifts.map(s => {
          const clr = s.chatteur_couleur != null
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
                  fontSize: '0.5rem', fontWeight: 600,
                  padding: '1px 4px', borderRadius: '99px',
                  background: clr?.bg || '#f1f5f9',
                  color: clr?.text || '#475569',
                  lineHeight: 1.3,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}>
                  {s.chatteur_prenom}
                </span>
              )}
              {/* Platform mini-badge */}
              {s.plateforme_nom && (
                <span style={{
                  fontSize: '0.4rem', fontWeight: 600,
                  padding: '1px 3px', borderRadius: '3px',
                  background: s.plateforme_couleur_fond || 'rgba(27,46,75,0.08)',
                  color: s.plateforme_couleur_texte || '#1b2e4b',
                  lineHeight: 1.3,
                  whiteSpace: 'nowrap',
                }}>
                  {s.plateforme_nom}
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
