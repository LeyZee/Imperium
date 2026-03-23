import { useState, useEffect, useRef } from 'react';
import api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import StatCard from '../../components/StatCard.jsx';
import { TableSkeleton } from '../../components/Skeleton.jsx';
import { useToast } from '../../components/Toast.jsx';
import {
  Euro, FileText, Calendar, ChevronDown, Wallet,
  ArrowDown, TrendingDown, Percent, Building2,
} from 'lucide-react';

/* ─── Period generator ─── */
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

/* ─── Calculation step component (same pattern as FacturationModeles) ─── */
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

export default function ModeleFacturation() {
  const { user } = useAuth();
  const toast = useToast();
  const periods = generatePeriods();
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

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
        `/api/modele/facturation?debut=${selectedPeriod.debut}&fin=${selectedPeriod.fin}`
      );
      setData(result);
    } catch (err) {
      const msg = err.response?.data?.error || 'Erreur chargement';
      setFetchError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  const resume = data?.resume || {};
  const plateformes = data?.plateformes || [];
  const tauxChange = data?.taux_change || 0.92;
  const partPercent = data?.part_percent || 0;

  return (
    <div className="page-enter">
      <style>{`
        @media (max-width: 640px) {
          .modele-fact-cards { grid-template-columns: 1fr !important; }
          .modele-fact-platform-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="text-navy" style={{ fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={22} color="#f5b731" /> Facturation
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
            Détail de votre facturation par plateforme
            {data?.pseudo && <span style={{ fontWeight: 600, color: '#1b2e4b', marginLeft: '0.35rem' }}>— {data.pseudo}</span>}
          </p>
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

      {/* Summary StatCards */}
      <div className="stagger-children modele-fact-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard title="Net HT Total" value={fmtEur(resume.total_net_ht || 0)} icon={Euro} color="#1b2e4b" />
        <StatCard title="Part Agence" value={fmtEur(resume.total_part_agence || 0)} icon={Building2} color="#64748b" />
        <StatCard title="Part Modèle" value={fmtEur(resume.total_part_modele || 0)} icon={Wallet} color="#f5b731" subtitle={`${fmtPercent(partPercent)} de part`} />
      </div>

      {/* Platform cards */}
      {fetchError ? (
        <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          {fetchError}
          <button onClick={fetchData} className="btn-ghost" style={{ marginLeft: '1rem', fontSize: '0.8rem' }}>Réessayer</button>
        </div>
      ) : loading ? (
        <TableSkeleton rows={3} cols={4} />
      ) : plateformes.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(245,183,49,0.08)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
            animation: 'pulse-soft 2s ease-in-out infinite',
          }}>
            <FileText size={28} color="#f5b731" />
          </div>
          <p style={{ color: '#64748b', margin: 0, fontWeight: 500 }}>Aucune vente pour cette période</p>
          <p style={{ color: '#94a3b8', margin: '0.3rem 0 0', fontSize: '0.82rem' }}>Sélectionnez une autre période</p>
        </div>
      ) : (
        <div className="modele-fact-platform-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          {plateformes.map(p => {
            const isUSD = p.devise === 'USD';
            const hasTVA = p.tva_rate > 0;
            return (
              <div key={p.plateforme_id} className="card" style={{
                padding: 0, overflow: 'hidden',
                border: `1px solid ${(p.couleur_fond || '#e2e8f0') + '40'}`,
              }}>
                {/* Platform header */}
                <div style={{
                  padding: '0.75rem 1rem',
                  background: (p.couleur_fond || '#f1f5f9') + '15',
                  borderBottom: `2px solid ${p.couleur_fond || '#e2e8f0'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700,
                      padding: '0.2rem 0.6rem', borderRadius: '20px',
                      background: p.couleur_fond || '#f1f5f9',
                      color: p.couleur_texte || '#475569',
                    }}>{p.plateforme_nom}</span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>
                      {p.devise} · {p.nb_ventes} vente{p.nb_ventes > 1 ? 's' : ''}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f5b731' }}>
                    {fmtEur(p.part_modele)}
                  </span>
                </div>

                {/* Calculation cascade */}
                <div style={{ padding: '0.6rem 1rem' }}>
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
                    operation={`× ${fmtPercent(1 - partPercent)}`}
                    result={fmtEur(p.part_agence)}
                    icon={<Building2 size={11} color="#64748b" />}
                  />
                  <CalcStep
                    label="Part Modèle"
                    operation={`× ${fmtPercent(partPercent)}`}
                    result={fmtEur(p.part_modele)}
                    highlight
                    last
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
