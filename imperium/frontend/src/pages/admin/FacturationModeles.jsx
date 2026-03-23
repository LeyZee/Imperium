import { useState, useEffect, useRef } from 'react';
import api from '../../api/index.js';
import StatCard from '../../components/StatCard.jsx';
import { TableSkeleton } from '../../components/Skeleton.jsx';
import { useToast } from '../../components/Toast.jsx';
import {
  Euro, Building2, Users, ChevronDown, User, ChevronRight, Calendar, FileText,
  ArrowDown, TrendingDown, Percent,
} from 'lucide-react';

/* ─── Period generator (no periods before March 2026 — app launch) ─── */
const APP_START_DATE = '2026-03-01';

function generatePeriods() {
  const periods = [];
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  let isFirstHalf = now.getDate() < 15;

  for (let i = 0; i < 24; i++) {
    const m = String(month + 1).padStart(2, '0');
    const monthName = new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long' });
    const cap = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    let debut, fin, label;
    if (isFirstHalf) {
      debut = `${year}-${m}-01`;
      fin = `${year}-${m}-15`;
      label = `1 – 15 ${cap} ${year}`;
      isFirstHalf = false;
      month--;
      if (month < 0) { month = 11; year--; }
    } else {
      const next = new Date(year, month + 1, 1);
      const ny = next.getFullYear();
      const nm = String(next.getMonth() + 1).padStart(2, '0');
      const nextMonth = next.toLocaleDateString('fr-FR', { month: 'long' });
      const capNext = nextMonth.charAt(0).toUpperCase() + nextMonth.slice(1);
      debut = `${year}-${m}-15`;
      fin = `${ny}-${nm}-01`;
      label = `15 ${cap} – 1 ${capNext} ${ny}`;
      isFirstHalf = true;
    }

    if (debut < APP_START_DATE) break;
    periods.push({ debut, fin, label });
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

function fmtDevise(n, devise) {
  if (n == null) return '—';
  if (devise === 'USD') return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return fmtEur(n);
}

/* ─── Calculation step component ─── */
function CalcStep({ label, operation, result, icon, highlight, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.45rem 0',
      borderBottom: last ? 'none' : '1px dashed rgba(148,163,184,0.2)',
    }}>
      <div style={{
        width: '24px', height: '24px', borderRadius: '50%',
        background: highlight ? 'rgba(245,183,49,0.12)' : 'rgba(100,116,139,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon || <ArrowDown size={11} color={highlight ? '#f5b731' : '#94a3b8'} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{label}</span>
        {operation && (
          <span style={{
            fontSize: '0.68rem', color: '#cbd5e1', marginLeft: '0.4rem',
            fontFamily: 'monospace', fontStyle: 'italic',
          }}>{operation}</span>
        )}
      </div>
      <span style={{
        fontWeight: highlight ? 800 : 600,
        fontSize: highlight ? '0.9rem' : '0.82rem',
        color: highlight ? '#f5b731' : '#1b2e4b',
        fontFamily: 'monospace', whiteSpace: 'nowrap',
      }}>{result}</span>
    </div>
  );
}


export default function FacturationModeles() {
  const toast = useToast();
  const periods = generatePeriods();
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
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
    setFetchError(null);
    try {
      const { data: result } = await api.get(
        `/api/facturation-modeles?debut=${selectedPeriod.debut}&fin=${selectedPeriod.fin}`
      );
      setData(result);
    } catch (err) {
      const msg = err.response?.data?.error || 'Erreur chargement';
      setFetchError(msg);
      toast.error(msg);
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
          <h1 className="text-navy" style={{ fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileText size={22} color="#f5b731" /> Facturation Modèles</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>Part agence par modèle sur la période</p>
        </div>
        {/* Period selector */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
          >
            <Calendar size={14} />
            {selectedPeriod.label}
            <ChevronDown size={14} style={{ transition: 'transform 200ms', transform: dropdownOpen ? 'rotate(180deg)' : 'none' }} />
          </button>
          {dropdownOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setDropdownOpen(false)} />
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: '0.35rem',
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                zIndex: 50, minWidth: '240px', maxHeight: '320px', overflowY: 'auto',
                animation: 'modalCardIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)', overflow: 'hidden',
              }}>
                {periods.map((p, i) => {
                  const isActive = p.debut === selectedPeriod.debut;
                  return (
                    <button
                      key={i}
                      onClick={() => { setSelectedPeriod(p); setDropdownOpen(false); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '0.6rem 1rem', border: 'none', cursor: 'pointer',
                        background: isActive ? 'rgba(245,183,49,0.1)' : 'transparent',
                        color: isActive ? '#f5b731' : 'var(--text-primary)',
                        fontWeight: isActive ? 600 : 400, fontSize: '0.82rem',
                        borderLeft: isActive ? '3px solid #f5b731' : '3px solid transparent',
                        transition: 'background 150ms',
                      }}
                      className={!isActive ? 'hover-row' : ''}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* StatCards */}
      <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard title="CA Net HT" value={fmtEur(resume.total_net_ht || 0)} icon={Euro} color="#f5b731" />
        <StatCard title="Part Agence" value={fmtEur(resume.total_part_agence || 0)} icon={Building2} color="#1b2e4b" subtitle="Ce qu'on facture" />
      </div>

      {/* Table */}
      {fetchError ? (
        <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          {fetchError}
          <button onClick={fetchData} className="btn-ghost" style={{ marginLeft: '1rem', fontSize: '0.8rem' }}>Réessayer</button>
        </div>
      ) : loading ? (
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
                  const hasDetail = m.plateformes.length >= 1;

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
                      <td style={{ width: '36px', padding: '0.5rem 0 0.5rem 0.5rem' }}>
                        {hasDetail && (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); setExpandedRow(isExpanded ? null : m.modele_id); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedRow(isExpanded ? null : m.modele_id); } }}
                            style={{
                              width: '28px', height: '28px', borderRadius: '6px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', transition: 'all 200ms ease',
                              background: isExpanded ? 'rgba(245,183,49,0.1)' : 'transparent',
                            }}
                            className="hover-scale"
                          >
                            <ChevronRight
                              size={14}
                              color={isExpanded ? '#f5b731' : '#94a3b8'}
                              style={{
                                transition: 'all 200ms ease',
                                transform: isExpanded ? 'rotate(90deg)' : 'none',
                              }}
                            />
                          </div>
                        )}
                      </td>

                      {/* Modèle */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden',
                            background: m.modele_couleur_fond || '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: isHovered ? `2px solid ${m.modele_couleur_fond || '#f5b731'}` : `2px solid ${m.modele_couleur_fond || '#e2e8f0'}`,
                            flexShrink: 0, transition: 'all 200ms ease',
                            transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                          }}>
                            {m.photo ? (
                              <img src={m.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <User size={15} color={m.modele_couleur_texte || '#94a3b8'} style={{ transition: 'color 200ms' }} />
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
                            className="hover-scale"
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

                  /* Expanded detail — platform cards with calculation cascade */
                  if (isExpanded && hasDetail) {
                    const tauxChange = data?.taux_change || 0.92;
                    rows.push(
                      <tr key={`${m.modele_id}-detail`} className="expand-enter" style={{ background: 'rgba(245,183,49,0.02)', borderLeft: '3px solid rgba(245,183,49,0.3)' }}>
                        <td colSpan={7} style={{ padding: '0.75rem 1.25rem 1rem', minWidth: 0 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(260px, 1fr))`, gap: '1rem' }}>
                            {m.plateformes.map(p => {
                              const isUSD = p.devise === 'USD';
                              const hasTVA = p.tva_rate > 0;
                              return (
                                <div key={p.plateforme_id} style={{
                                  background: 'var(--bg-card)', borderRadius: '12px',
                                  border: `1px solid ${(p.couleur_fond || '#e2e8f0') + '40'}`,
                                  overflow: 'hidden',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                                }}>
                                  {/* Platform header */}
                                  <div style={{
                                    padding: '0.6rem 0.85rem',
                                    background: (p.couleur_fond || '#f1f5f9') + '15',
                                    borderBottom: `2px solid ${p.couleur_fond || '#e2e8f0'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <span style={{
                                        fontSize: '0.7rem', fontWeight: 700,
                                        padding: '0.18rem 0.55rem', borderRadius: '20px',
                                        background: p.couleur_fond || '#f1f5f9',
                                        color: p.couleur_texte || '#475569',
                                      }}>{p.plateforme_nom}</span>
                                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500 }}>
                                        {p.devise} · {p.nb_ventes} vente{p.nb_ventes > 1 ? 's' : ''}
                                      </span>
                                    </div>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f5b731' }}>
                                      {fmtEur(p.part_agence)}
                                    </span>
                                  </div>

                                  {/* Calculation cascade */}
                                  <div style={{ padding: '0.5rem 0.85rem' }}>
                                    <CalcStep
                                      label="CA Brut"
                                      result={fmtDevise(p.total_brut, p.devise)}
                                      icon={<Euro size={11} color="#64748b" />}
                                    />
                                    {isUSD && (
                                      <CalcStep
                                        label="Conversion EUR"
                                        operation={`× ${parseFloat(tauxChange.toFixed(4))}`}
                                        result={fmtEur(p.ttc_eur)}
                                        icon={<TrendingDown size={11} color="#3b82f6" />}
                                      />
                                    )}
                                    {hasTVA && (
                                      <CalcStep
                                        label="Hors Taxe"
                                        operation={`÷ ${(1 + p.tva_rate).toFixed(2)} (TVA ${fmtPercent(p.tva_rate)})`}
                                        result={fmtEur(p.ht_eur)}
                                        icon={<Percent size={11} color="#8b5cf6" />}
                                      />
                                    )}
                                    <CalcStep
                                      label="Net HT"
                                      operation={`× ${(1 - p.commission_rate).toFixed(2)} (comm. ${fmtPercent(p.commission_rate)})`}
                                      result={fmtEur(p.net_ht_eur)}
                                    />
                                    <CalcStep
                                      label="Part Agence"
                                      operation={`× ${fmtPercent(m.part_percent)}`}
                                      result={fmtEur(p.part_agence)}
                                      highlight
                                      last
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return rows;
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}

    </div>
  );
}
