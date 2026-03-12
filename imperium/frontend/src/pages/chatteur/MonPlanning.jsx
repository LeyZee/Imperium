import { useState, useEffect } from 'react';
import api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ChevronLeft, ChevronRight, Clock, Coffee, Globe } from 'lucide-react';

// Creneau start/end hours (in the shift's timezone)
const CRENEAU_HOURS = {
  1: [8, 14], 2: [14, 20], 3: [20, 2], 4: [2, 8],
};

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const PAYS_TZ = {
  'France': 'Europe/Paris',
  'Benin': 'Africa/Porto-Novo',
  'Madagascar': 'Indian/Antananarivo',
};

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

/** Get the UTC offset in hours for a timezone at a given date */
function getTzOffset(tz, date) {
  try {
    const str = date.toLocaleString('en-US', { timeZone: tz, timeZoneName: 'shortOffset' });
    const match = str.match(/GMT([+-]\d+)/);
    return match ? parseInt(match[1]) : 0;
  } catch { return 0; }
}

/** Convert a creneau label from shiftTz to chatteurTz */
function getCreneauLabel(creneau, shiftTz, chatteurTz, shiftDate) {
  const [start, end] = CRENEAU_HOURS[creneau] || [0, 0];
  if (!shiftTz || !chatteurTz || shiftTz === chatteurTz) {
    return `${String(start).padStart(2, '0')}h–${String(end).padStart(2, '0')}h`;
  }

  const refDate = shiftDate ? new Date(shiftDate + 'T12:00:00') : new Date();
  const shiftOffset = getTzOffset(shiftTz, refDate);
  const chatteurOffset = getTzOffset(chatteurTz, refDate);
  const diff = chatteurOffset - shiftOffset;

  if (diff === 0) {
    return `${String(start).padStart(2, '0')}h–${String(end).padStart(2, '0')}h`;
  }

  const adjStart = ((start + diff) % 24 + 24) % 24;
  const adjEnd = ((end + diff) % 24 + 24) % 24;
  return `${String(adjStart).padStart(2, '0')}h–${String(adjEnd).padStart(2, '0')}h`;
}

export default function MonPlanning() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatteurPays, setChatteurPays] = useState(null);

  useEffect(() => {
    if (!user?.chatteur_id) return;
    const controller = new AbortController();
    api.get(`/api/chatteurs/${user.chatteur_id}`, { signal: controller.signal }).then(({ data }) => {
      setChatteurPays(data.pays || 'France');
    }).catch(() => {});
    return () => controller.abort();
  }, [user]);

  const chatteurTz = PAYS_TZ[chatteurPays] || 'Europe/Paris';

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api.get(`/api/shifts/semaine?date=${toISO(weekStart)}`, { signal: controller.signal }).then(({ data }) => {
      const all = data.shifts || data;
      setShifts(Array.isArray(all) ? all.filter(s => s.chatteur_id === user?.chatteur_id) : []);
    }).catch(() => {}).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [weekStart, user]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const totalShifts = shifts.length;

  // Check if any shifts have a different TZ than the chatteur's
  const hasTzDiff = shifts.some(s => s.fuseau_horaire && s.fuseau_horaire !== chatteurTz);

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <div>
          <h1 className="text-navy" style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Mon Planning</h1>
          <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {totalShifts} shift{totalShifts !== 1 ? 's' : ''} cette semaine
          </p>
        </div>
      </div>

      {/* Timezone banner */}
      {chatteurPays && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.5rem 0.85rem', borderRadius: '8px', marginBottom: '1rem',
          background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
          fontSize: '0.78rem', color: '#4338ca',
        }}>
          <Globe size={14} style={{ flexShrink: 0 }} />
          Horaires affichés en heure locale ({chatteurPays})
          {hasTzDiff && <span style={{ color: '#6366f1' }}> — convertis depuis le fuseau du shift</span>}
        </div>
      )}

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

      {/* Days */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
          Chargement...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} className="stagger-children">
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
                    {dayShifts.map(s => {
                      const shiftTz = s.fuseau_horaire || 'Europe/Paris';
                      const label = getCreneauLabel(s.creneau, shiftTz, chatteurTz, s.date);
                      return (
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
                            {label}
                          </span>
                          {s.plateforme_nom && (
                            <span style={{
                              background: 'rgba(27,46,75,0.08)', color: '#1b2e4b',
                              padding: '0.25rem 0.6rem', borderRadius: '6px',
                              fontSize: '0.75rem', fontWeight: 600,
                            }}>
                              {s.plateforme_nom}
                            </span>
                          )}
                          {s.modele_pseudo && (
                            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                              · {s.modele_pseudo}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
