import { useState, useEffect, useCallback } from 'react';
import api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ChevronLeft, ChevronRight, Clock, Coffee, ClipboardList } from 'lucide-react';

const CRENEAU_LABELS = { 1: '08h–14h', 2: '14h–20h', 3: '20h–02h', 4: '02h–08h' };

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
  const totalShifts = shifts.length;

  return (
    <div className="page-enter">
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
                          {CRENEAU_LABELS[s.creneau] || `Créneau ${s.creneau}`}
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
                        {s.chatteur_prenom && (
                          <span style={{
                            fontSize: '0.75rem', fontWeight: 500, color: '#64748b',
                          }}>
                            {s.chatteur_prenom}
                          </span>
                        )}
                      </div>
                    ))}
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
