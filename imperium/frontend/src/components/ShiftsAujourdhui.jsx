import { useState } from 'react';
import { Clock, ChevronDown } from 'lucide-react';
import { CHATTEUR_COLORS } from '../constants/colors.js';

const CRENEAU_LABELS = { 1: '08h–14h', 2: '14h–20h', 3: '20h–02h', 4: '02h–08h' };

/**
 * Shared "Shifts aujourd'hui" widget used by admin + modele dashboards.
 *
 * @param {Object[]} shifts — array of shift objects with:
 *   creneau, chatteur_prenom, chatteur_couleur, plateforme_nom,
 *   plateforme_couleur_fond, plateforme_couleur_texte,
 *   modele_pseudo (optional, admin only)
 * @param {number} currentCreneau — current time slot (1-4), auto-detected if not provided
 * @param {Function} onClickShift — optional callback when a shift row is clicked (admin nav)
 */
export default function ShiftsAujourdhui({ shifts = [], currentCreneau, onClickShift }) {
  const [expandedCreneau, setExpandedCreneau] = useState(null);

  // Auto-detect current creneau if not provided
  if (currentCreneau == null) {
    const h = new Date().getHours();
    currentCreneau = h >= 8 && h < 14 ? 1 : h >= 14 && h < 20 ? 2 : h >= 20 || h < 2 ? 3 : 4;
  }

  // Group shifts by creneau
  const grouped = { 1: [], 2: [], 3: [], 4: [] };
  shifts.forEach(s => { if (grouped[s.creneau]) grouped[s.creneau].push(s); });

  // Auto-expand current creneau on first render
  if (expandedCreneau == null && shifts.length > 0) {
    const firstWithShifts = [currentCreneau, 1, 2, 3, 4].find(c => grouped[c]?.length > 0);
    if (firstWithShifts) setTimeout(() => setExpandedCreneau(firstWithShifts), 0);
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={16} color="#f5b731" />
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1b2e4b', margin: 0 }}>Shifts aujourd'hui</h3>
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '20px', background: 'rgba(245,183,49,0.1)', color: '#f5b731' }}>
          {shifts.length} shift{shifts.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Creneaux */}
      <div style={{ padding: '0.25rem 0' }}>
        {[1, 2, 3, 4].map(creneau => {
          const isCurrent = creneau === currentCreneau;
          const isPast = creneau < currentCreneau;
          const creneauShifts = grouped[creneau] || [];
          const isExpanded = expandedCreneau === creneau;

          return (
            <div key={creneau} style={{ opacity: isPast ? 0.5 : 1, transition: 'opacity 200ms' }}>
              {/* Creneau header */}
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
                <span style={{ fontSize: '0.75rem', fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#10b981' : '#64748b', minWidth: '60px', textAlign: 'left' }}>
                  {CRENEAU_LABELS[creneau]}
                </span>
                {isCurrent && <span style={{ fontSize: '0.6rem', background: '#10b981', color: '#fff', borderRadius: '10px', padding: '0.05rem 0.4rem', fontWeight: 600 }}>EN COURS</span>}
                {creneauShifts.length === 0 && <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontStyle: 'italic', flex: 1, textAlign: 'left' }}>Aucun shift</span>}
                {creneauShifts.length > 0 && !isExpanded && (
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', flex: 1, textAlign: 'left' }}>
                    {creneauShifts.length} shift{creneauShifts.length > 1 ? 's' : ''}
                  </span>
                )}
                {creneauShifts.length > 0 && (
                  <ChevronDown size={14} color="#94a3b8" style={{ transition: 'transform 200ms', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', flexShrink: 0 }} />
                )}
              </button>

              {/* Expanded: shift badges */}
              {isExpanded && creneauShifts.length > 0 && (
                <div style={{
                  padding: '0.3rem 1rem 0.6rem',
                  borderLeft: isCurrent ? '3px solid #10b981' : '3px solid transparent',
                  background: isCurrent ? 'rgba(16,185,129,0.02)' : 'rgba(0,0,0,0.01)',
                  display: 'flex', flexWrap: 'wrap', gap: '0.35rem',
                }}>
                  {creneauShifts.map((s, i) => {
                    const clr = s.chatteur_couleur != null ? CHATTEUR_COLORS[s.chatteur_couleur % CHATTEUR_COLORS.length] : null;
                    return (
                      <span
                        key={i}
                        onClick={onClickShift ? () => onClickShift(s) : undefined}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                          fontSize: '0.72rem', fontWeight: 600,
                          padding: '0.25rem 0.55rem', borderRadius: '8px',
                          background: clr?.bg || '#f1f5f9',
                          color: clr?.text || '#475569',
                          border: `1px solid ${clr?.border || '#e2e8f0'}`,
                          cursor: onClickShift ? 'pointer' : 'default',
                          transition: 'transform 150ms, box-shadow 150ms',
                        }}
                        className={onClickShift ? 'hover-scale' : ''}
                      >
                        {s.chatteur_prenom}
                        {/* Platform mini-badge */}
                        <span style={{
                          fontSize: '0.58rem', fontWeight: 700,
                          padding: '0.05rem 0.3rem', borderRadius: '4px',
                          background: s.plateforme_couleur_fond || '#1b2e4b',
                          color: s.plateforme_couleur_texte || '#fff',
                        }}>{s.plateforme_nom}</span>
                        {/* Model name if available (admin view) */}
                        {s.modele_pseudo && (
                          <span style={{ fontSize: '0.6rem', color: clr?.text || '#94a3b8', opacity: 0.8, fontWeight: 500 }}>
                            {s.modele_pseudo}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {shifts.length === 0 && (
        <div style={{ padding: '1.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>Aucun shift programmé aujourd'hui</p>
        </div>
      )}
    </div>
  );
}
