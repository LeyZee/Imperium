import { useState, useEffect, useRef } from 'react';
import api from '../../api/index.js';
import StatCard from '../../components/StatCard.jsx';
import { TableSkeleton } from '../../components/Skeleton.jsx';
import { useToast } from '../../components/Toast.jsx';
import {
  Euro, Building2, Users, ChevronDown, User, TrendingUp, ChevronRight,
} from 'lucide-react';

/* ─── Period generator (same as Paies) ─── */
function generatePeriods() {
  const periods = [];
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  let isFirstHalf = now.getDate() < 15;

  for (let i = 0; i < 12; i++) {
    const m = String(month + 1).padStart(2, '0');
    const monthName = new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long' });
    const cap = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    if (isFirstHalf) {
      periods.push({
        debut: `${year}-${m}-01`,
        fin: `${year}-${m}-15`,
        label: `1 – 15 ${cap} ${year}`,
      });
      isFirstHalf = false;
      month--;
      if (month < 0) { month = 11; year--; }
    } else {
      const next = new Date(year, month + 1, 1);
      const ny = next.getFullYear();
      const nm = String(next.getMonth() + 1).padStart(2, '0');
      const nextMonth = next.toLocaleDateString('fr-FR', { month: 'long' });
      const capNext = nextMonth.charAt(0).toUpperCase() + nextMonth.slice(1);
      periods.push({
        debut: `${year}-${m}-15`,
        fin: `${ny}-${nm}-01`,
        label: `15 ${cap} – 1 ${capNext} ${ny}`,
      });
      isFirstHalf = true;
    }
  }
  return periods;
}

function fmtEur(n) {
  if (n == null) return '—';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtPercent(n) {
  return (n * 100).toFixed(0) + '%';
}

const PODIUM = [
  { emoji: '🥇', gradient: 'linear-gradient(135deg, #f5b731 0%, #fcd34d 100%)', shadow: 'rgba(245,183,49,0.3)' },
  { emoji: '🥈', gradient: 'linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%)', shadow: 'rgba(148,163,184,0.3)' },
  { emoji: '🥉', gradient: 'linear-gradient(135deg, #cd7f32 0%, #daa06d 100%)', shadow: 'rgba(205,127,50,0.3)' },
];

export default function FacturationModeles() {
  const toast = useToast();
  const periods = generatePeriods();
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: result } = await api.get(
        `/api/facturation-modeles?debut=${selectedPeriod.debut}&fin=${selectedPeriod.fin}`
      );
      setData(result);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }

  const resume = data?.resume || {};
  const modeles = data?.modeles || [];
  const maxNetHT = modeles.length > 0 ? Math.max(...modeles.map(m => m.net_ht_eur)) : 1;

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="text-navy" style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Facturation Modèles</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>Part agence par modèle sur la période</p>
        </div>
        {/* Period selector */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="haptic"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'linear-gradient(135deg, #f5b731, #e5a520)',
              border: 'none', borderRadius: '10px', padding: '0.55rem 1rem',
              fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', color: '#1b2e4b',
              boxShadow: '0 2px 8px rgba(245,183,49,0.25)',
              transition: 'all 200ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(245,183,49,0.35)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(245,183,49,0.25)'; }}
          >
            {selectedPeriod.label}
            <ChevronDown size={16} style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
          </button>
          {dropdownOpen && (
            <div style={{
              position: 'absolute', right: 0, top: '110%', background: '#fff',
              border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.14)', zIndex: 100,
              minWidth: '240px', maxHeight: '320px', overflowY: 'auto',
              animation: 'fadeIn 150ms ease',
            }}>
              {periods.map((p, i) => {
                const active = p.debut === selectedPeriod.debut;
                return (
                  <button
                    key={i}
                    onClick={() => { setSelectedPeriod(p); setDropdownOpen(false); }}
                    className="haptic"
                    style={{
                      display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left',
                      padding: '0.6rem 1rem', border: 'none',
                      background: active ? 'rgba(245,183,49,0.1)' : 'transparent',
                      color: active ? '#f5b731' : '#1b2e4b',
                      fontWeight: active ? 700 : 400,
                      fontSize: '0.82rem', cursor: 'pointer',
                      borderBottom: i < periods.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                      transition: 'all 150ms ease',
                      borderLeft: active ? '3px solid #f5b731' : '3px solid transparent',
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(245,183,49,0.04)'; e.currentTarget.style.paddingLeft = '1.15rem'; } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.paddingLeft = '1rem'; } }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* StatCards */}
      <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard title="CA Net HT" value={fmtEur(resume.total_net_ht || 0)} icon={Euro} color="#f5b731" />
        <StatCard title="Part Agence" value={fmtEur(resume.total_part_agence || 0)} icon={Building2} color="#1b2e4b" subtitle="Ce qu'on facture" />
      </div>

      {/* Top Modèles podium */}
      {!loading && modeles.length >= 2 && (() => {
        // Podium order: [2nd, 1st, 3rd] for desktop visual
        const top = modeles.slice(0, Math.min(3, modeles.length));
        const podiumOrder = top.length >= 3 ? [top[1], top[0], top[2]] : top;
        const podiumMeta = top.length >= 3
          ? [
              { ...PODIUM[1], rank: 2, scale: 0.92 },
              { ...PODIUM[0], rank: 1, scale: 1 },
              { ...PODIUM[2], rank: 3, scale: 0.88 },
            ]
          : top.map((_, i) => ({ ...PODIUM[i], rank: i + 1, scale: i === 0 ? 1 : 0.92 }));

        return (
          <div className="card stagger-children" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <TrendingUp size={18} color="#f5b731" />
              <span style={{ fontWeight: 600, color: '#1b2e4b', fontSize: '0.95rem' }}>Top Modèles</span>
            </div>
            <div className="podium-container">
              {podiumOrder.map((m, i) => {
                const pod = podiumMeta[i];
                const isFirst = pod.rank === 1;
                return (
                  <div
                    key={m.modele_id}
                    className={`haptic podium-card ${isFirst ? 'podium-first' : 'podium-other'}`}
                    style={{
                      position: 'relative',
                      background: isFirst
                        ? 'linear-gradient(135deg, rgba(245,183,49,0.06) 0%, rgba(245,183,49,0.02) 100%)'
                        : '#fff',
                      border: isFirst ? '1.5px solid rgba(245,183,49,0.25)' : '1px solid rgba(0,0,0,0.06)',
                      borderRadius: '16px',
                      padding: isFirst ? '1.25rem 1.15rem 1rem' : '1rem 0.9rem 0.8rem',
                      cursor: 'pointer',
                      transition: 'all 250ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                      overflow: 'hidden',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                      e.currentTarget.style.boxShadow = `0 12px 32px ${pod.shadow}`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    onClick={() => setExpandedRow(expandedRow === m.modele_id ? null : m.modele_id)}
                  >
                    {/* Accent top bar */}
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0,
                      height: isFirst ? '4px' : '3px',
                      background: pod.gradient, borderRadius: '16px 16px 0 0',
                    }} />

                    {/* Avatar + name centered */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                      <div style={{ position: 'relative' }}>
                        <div style={{
                          width: isFirst ? '48px' : '38px', height: isFirst ? '48px' : '38px',
                          borderRadius: '50%', overflow: 'hidden',
                          background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: isFirst ? '2.5px solid #f5b731' : '2px solid #e2e8f0',
                          transition: 'all 200ms ease',
                        }}>
                          {m.photo ? (
                            <img src={m.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <User size={isFirst ? 20 : 15} color={isFirst ? '#f5b731' : '#94a3b8'} />
                          )}
                        </div>
                        {/* Medal badge */}
                        <span style={{
                          position: 'absolute', bottom: '-4px', right: '-6px',
                          fontSize: isFirst ? '1.15rem' : '0.9rem', lineHeight: 1,
                          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))',
                        }}>{pod.emoji}</span>
                      </div>
                      <span style={{
                        fontWeight: isFirst ? 800 : 700, color: '#1b2e4b',
                        fontSize: isFirst ? '1rem' : '0.88rem',
                        letterSpacing: isFirst ? '0.02em' : 'normal',
                      }}>{m.pseudo}</span>
                    </div>

                    {/* Amount — centered and prominent */}
                    <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                      <div style={{
                        fontWeight: 800, color: '#1b2e4b',
                        fontSize: isFirst ? '1.35rem' : '1.05rem', lineHeight: 1,
                      }}>{fmtEur(m.part_agence)}</div>
                      <div style={{
                        display: 'flex', justifyContent: 'center', gap: '0.4rem', alignItems: 'center',
                        marginTop: '0.35rem',
                      }}>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                          {m.nb_ventes} vente{m.nb_ventes > 1 ? 's' : ''}
                        </span>
                        <span style={{
                          fontSize: '0.62rem', fontWeight: 600, color: '#f5b731',
                          background: 'rgba(245,183,49,0.1)', padding: '0.1rem 0.4rem',
                          borderRadius: '8px',
                        }}>{fmtPercent(m.part_percent)}</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ height: isFirst ? '5px' : '3px', borderRadius: '4px', background: '#f1f5f9', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: '4px',
                        background: pod.gradient,
                        width: `${(m.net_ht_eur / maxNetHT) * 100}%`,
                        transition: 'width 600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>Net HT</span>
                      <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 600 }}>{fmtEur(m.net_ht_eur)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : modeles.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(245,183,49,0.08)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
            animation: 'pulse-soft 2s ease-in-out infinite',
          }}>
            <Users size={28} color="#f5b731" />
          </div>
          <p style={{ color: '#64748b', margin: 0, fontWeight: 500 }}>Aucune vente pour cette période</p>
          <p style={{ color: '#94a3b8', margin: '0.3rem 0 0', fontSize: '0.82rem' }}>Sélectionnez une autre période</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, color: '#1b2e4b', fontSize: '0.95rem' }}>Détail par modèle</span>
            <span style={{
              fontSize: '0.72rem', fontWeight: 600, padding: '0.25rem 0.65rem',
              borderRadius: '20px', background: 'rgba(245,183,49,0.1)', color: '#f5b731',
            }}>
              {modeles.length} modèle{modeles.length > 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '28px' }}></th>
                  <th>Modèle</th>
                  <th>Plateformes</th>
                  <th>Ventes</th>
                  <th>Net HT</th>
                  <th>Part agence</th>
                  <th>Facture agence</th>
                </tr>
              </thead>
              <tbody className="stagger-rows">
                {modeles.map((m, idx) => {
                  const isExpanded = expandedRow === m.modele_id;
                  const isHovered = hoveredRow === m.modele_id;
                  const barPercent = (m.net_ht_eur / maxNetHT) * 100;
                  const hasDetail = m.plateformes.length >= 2;

                  const rows = [(
                    <tr
                      key={m.modele_id}
                      className="haptic"
                      onClick={() => hasDetail && setExpandedRow(isExpanded ? null : m.modele_id)}
                      onMouseEnter={() => setHoveredRow(m.modele_id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{
                        cursor: hasDetail ? 'pointer' : 'default',
                        transition: 'all 200ms ease',
                        borderLeft: isHovered ? '3px solid #f5b731' : '3px solid transparent',
                        background: isExpanded ? 'rgba(245,183,49,0.04)' : isHovered ? 'rgba(245,183,49,0.02)' : 'transparent',
                        transform: isHovered ? 'translateY(-1px)' : 'none',
                        boxShadow: isHovered ? '0 2px 8px rgba(0,0,0,0.04)' : 'none',
                      }}
                    >
                      {/* Expand chevron */}
                      <td style={{ width: '28px', padding: '0.5rem 0 0.5rem 0.75rem' }}>
                        {hasDetail && (
                          <ChevronRight
                            size={14}
                            color={isExpanded ? '#f5b731' : '#94a3b8'}
                            style={{
                              transition: 'all 200ms ease',
                              transform: isExpanded ? 'rotate(90deg)' : 'none',
                            }}
                          />
                        )}
                      </td>

                      {/* Modèle */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden',
                            background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: isHovered ? '2px solid #f5b731' : '2px solid #e2e8f0',
                            flexShrink: 0, transition: 'all 200ms ease',
                            transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                          }}>
                            {m.photo ? (
                              <img src={m.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <User size={15} color={isHovered ? '#f5b731' : '#94a3b8'} style={{ transition: 'color 200ms' }} />
                            )}
                          </div>
                          <div>
                            <span style={{ fontWeight: 600, color: '#1b2e4b', fontSize: '0.9rem' }}>{m.pseudo}</span>
                            {/* Inline progress bar */}
                            <div style={{ height: '3px', width: '60px', borderRadius: '3px', background: '#f1f5f9', marginTop: '0.3rem', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', borderRadius: '3px',
                                background: 'linear-gradient(90deg, #f5b731, #fcd34d)',
                                width: `${barPercent}%`,
                                transition: 'width 500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                              }} />
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Plateformes */}
                      <td>
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {m.plateformes.map(p => (
                            <span key={p.plateforme_id} style={{
                              fontSize: '0.65rem', fontWeight: 600,
                              padding: '0.15rem 0.5rem', borderRadius: '20px',
                              background: p.couleur_fond || '#f1f5f9',
                              color: p.couleur_texte || '#475569',
                              border: `1px solid ${(p.couleur_fond || '#cbd5e1') + '80'}`,
                              transition: 'transform 150ms ease',
                            }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                              {p.plateforme_nom}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Nb ventes */}
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          fontWeight: 600, color: '#64748b',
                          background: 'rgba(100,116,139,0.08)', padding: '0.2rem 0.55rem',
                          borderRadius: '8px', fontSize: '0.82rem',
                        }}>{m.nb_ventes}</span>
                      </td>

                      {/* Net HT */}
                      <td style={{ fontWeight: 700, color: '#1b2e4b' }}>{fmtEur(m.net_ht_eur)}</td>

                      {/* Part agence % */}
                      <td>
                        <span style={{
                          fontWeight: 700, color: '#f5b731',
                          background: 'rgba(245,183,49,0.08)', padding: '0.2rem 0.55rem',
                          borderRadius: '8px', fontSize: '0.82rem',
                        }}>{fmtPercent(m.part_percent)}</span>
                      </td>

                      {/* Facture agence € */}
                      <td>
                        <span style={{
                          fontWeight: 800, color: '#1b2e4b', fontSize: '0.95rem',
                          transition: 'all 200ms ease',
                          ...(isHovered ? { color: '#f5b731' } : {}),
                        }}>{fmtEur(m.part_agence)}</span>
                      </td>
                    </tr>
                  )];

                  /* Expanded detail rows — right after parent */
                  if (isExpanded && hasDetail) {
                    m.plateformes.forEach(p => {
                      rows.push(
                        <tr key={`${m.modele_id}-${p.plateforme_id}`} className="expand-enter" style={{
                          background: 'rgba(245,183,49,0.02)',
                          borderLeft: '3px solid rgba(245,183,49,0.3)',
                        }}>
                          <td></td>
                          <td style={{ paddingLeft: '3.2rem' }}>
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>└ {p.plateforme_nom}</span>
                          </td>
                          <td>
                            <span style={{
                              fontSize: '0.62rem', fontWeight: 600,
                              padding: '0.12rem 0.4rem', borderRadius: '20px',
                              background: p.couleur_fond || '#f1f5f9',
                              color: p.couleur_texte || '#475569',
                              opacity: 0.8,
                            }}>
                              {p.plateforme_nom}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '0.78rem', color: '#94a3b8' }}>{p.nb_ventes}</td>
                          <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{fmtEur(p.net_ht_eur)}</td>
                          <td style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{fmtPercent(m.part_percent)}</td>
                          <td style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>{fmtEur(p.part_agence)}</td>
                        </tr>
                      );
                    });
                  }

                  return rows;
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}

      <style>{`
        @keyframes barGrow {
          from { width: 0; }
        }
        /* ── Podium layout ── */
        .podium-container {
          display: grid;
          grid-template-columns: 1fr 1.25fr 1fr;
          gap: 0.75rem;
          align-items: end;
        }
        .podium-first {
          order: 0;
        }
        .podium-other {
          order: 0;
        }
        /* Tablet */
        @media (max-width: 768px) {
          .podium-container {
            grid-template-columns: 1fr 1fr 1fr;
            gap: 0.5rem;
          }
        }
        /* Mobile — stack vertically, 1st on top */
        @media (max-width: 540px) {
          .podium-container {
            grid-template-columns: 1fr;
            gap: 0.6rem;
          }
          /* Reorder: 1st place on top */
          .podium-container > :nth-child(1) { order: 2; }  /* 2nd → bottom */
          .podium-container > :nth-child(2) { order: 1; }  /* 1st → top */
          .podium-container > :nth-child(3) { order: 3; }  /* 3rd → last */
          .podium-card {
            padding: 0.85rem !important;
          }
          .podium-first {
            padding: 1rem !important;
          }
        }
      `}</style>
    </div>
  );
}
