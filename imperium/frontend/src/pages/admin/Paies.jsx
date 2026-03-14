import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import api from '../../api/index.js';
import StatCard from '../../components/StatCard.jsx';
import { CHATTEUR_COLORS } from '../../constants/colors.js';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Euro, TrendingUp, Building2, Calendar,
  Trophy, RefreshCw, ChevronDown, Crown, Users, Shield,
  CheckCircle, Clock, AlertCircle, Download, FileText,
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

    // Stop before app launch date
    if (debut < APP_START_DATE) break;
    periods.push({ debut, fin, label });
  }
  return periods;
}

function fmtEur(n) {
  if (n == null) return '—';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtUsd(n) {
  if (n == null) return '—';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
}

function fmtPercent(n) {
  return (n * 100).toFixed(0) + '%';
}

function getInitials(prenom) {
  return (prenom?.[0] || '?').toUpperCase();
}

function getChatteurColor(couleurIndex) {
  const c = CHATTEUR_COLORS[couleurIndex ?? 0] || CHATTEUR_COLORS[0];
  return { bg: c.bg, text: c.text };
}

const STATUT_STYLES = {
  'calculé': { bg: 'rgba(100,116,139,0.1)', color: '#64748b', border: '1px solid rgba(100,116,139,0.2)' },
  'validé': { bg: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' },
  'payé': { bg: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' },
};

const PODIUM_ICONS = [
  { emoji: '🥇', color: '#f5b731', bg: 'rgba(245,183,49,0.12)' },
  { emoji: '🥈', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  { emoji: '🥉', color: '#cd7f32', bg: 'rgba(205,127,50,0.12)' },
];

/* ═══════════════════════════════════════════ */
export default function Paies() {
  const { user } = useAuth();
  const isManager = user?.role === 'manager';
  const periods = useMemo(() => generatePeriods(), []);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const period = periods[selectedIdx];

  const fetchPaies = useCallback(async () => {
    if (!period) return;
    setLoading(true);
    setError('');
    try {
      const { data: d } = await api.get(`/api/paies?debut=${period.debut}&fin=${period.fin}`);
      setData(d);
    } catch {
      setError('Impossible de charger les paies.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchPaies();
  }, [fetchPaies]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowPeriodDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleRecalculate() {
    setRecalculating(true);
    setError('');
    try {
      await api.post('/api/paies/recalculer', { debut: period.debut, fin: period.fin });
      setSuccess('Paies recalculées');
      setTimeout(() => setSuccess(''), 3000);
      await fetchPaies();
    } catch {
      setError('Erreur lors du recalcul.');
    } finally {
      setRecalculating(false);
    }
  }

  async function handleStatutChange(paieId, newStatut) {
    try {
      await api.put(`/api/paies/${paieId}/statut`, { statut: newStatut });
      await fetchPaies();
    } catch {
      setError('Erreur changement de statut.');
    }
  }

  const [downloadingId, setDownloadingId] = useState(null);
  const [batchProgress, setBatchProgress] = useState(null); // { current, total }

  async function handleDownloadFacture(chatteurId, prenom) {
    setDownloadingId(chatteurId);
    try {
      const resp = await api.get(`/api/paies/facture?chatteur_id=${chatteurId}&debut=${period.debut}&fin=${period.fin}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Facture_${prenom}_${period.debut}_${period.fin}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la g\u00e9n\u00e9ration de la facture');
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDownloadAll() {
    setBatchProgress({ current: 0, total: 1 });
    try {
      const resp = await api.get(`/api/paies/factures-zip?debut=${period.debut}&fin=${period.fin}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([resp.data], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `IMPERA_Factures_${period.debut}_${period.fin}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setSuccess('Toutes les factures t\u00e9l\u00e9charg\u00e9es (ZIP)');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors du t\u00e9l\u00e9chargement ZIP');
    } finally {
      setBatchProgress(null);
    }
  }

  const paies = data?.paies || [];
  const managers = data?.managers || [];
  const directeurs = data?.directeurs || [];
  const resume = data?.resume || {};
  const top = resume.top_chatteurs || [];

  return (
    <div className="page-enter">
      {/* Toast */}
      {success && (
        <div className="toast-success" style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 100,
          animation: 'slideUp 0.3s ease',
        }}>{success}</div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontWeight: 700, margin: 0 }}>Paies</h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Calcul automatique et suivi des rémunérations</p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Download all invoices */}
          {paies.length > 0 && (
            <button
              className="btn-secondary haptic"
              onClick={handleDownloadAll}
              disabled={downloadingId !== null || batchProgress !== null}
              title="T\u00e9l\u00e9charger toutes les factures PDF de la p\u00e9riode"
              style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              {batchProgress ? (
                <>
                  <span className="spinner" style={{ width: 15, height: 15 }} />
                  {batchProgress.current}/{batchProgress.total}
                </>
              ) : (
                <>
                  <Download size={15} />
                  <span className="hide-mobile">Toutes les</span> factures
                </>
              )}
            </button>
          )}

          {/* Recalculate button (admin only) */}
          {!isManager && (
            <button
              className="btn-secondary"
              onClick={handleRecalculate}
              disabled={recalculating || loading}
              title="Recalculer les paies"
              style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <RefreshCw size={15} style={{ animation: recalculating ? 'spin 1s linear infinite' : 'none' }} />
              {recalculating ? 'Recalcul...' : 'Recalculer'}
            </button>
          )}

          {period && (
            <button className="btn-secondary" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              onClick={() => window.open(`/api/paies/export-csv?debut=${period.debut}&fin=${period.fin}`, '_blank')}>
              <Download size={14} /> CSV
            </button>
          )}

          {/* Period selector */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              className="btn-secondary"
              onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1rem', minWidth: '160px', justifyContent: 'space-between' }}
            >
              <Calendar size={15} />
              <span style={{ fontSize: '0.85rem' }}>{period?.label}</span>
              <ChevronDown size={15} style={{
                transform: showPeriodDropdown ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 200ms ease',
              }} />
            </button>
            {showPeriodDropdown && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowPeriodDropdown(false)} />
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '0.35rem',
                  background: 'var(--bg-card)', borderRadius: '10px', border: '1px solid var(--border-subtle)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 50,
                  minWidth: '240px', maxHeight: '320px', overflowY: 'auto',
                  animation: 'modalCardIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}>
                  {periods.map((p, i) => (
                    <button
                      key={p.debut}
                      onClick={() => { setSelectedIdx(i); setShowPeriodDropdown(false); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '0.6rem 1rem', border: 'none', cursor: 'pointer',
                        fontSize: '0.85rem', transition: 'background 150ms',
                        background: i === selectedIdx ? 'rgba(245,183,49,0.1)' : 'transparent',
                        color: i === selectedIdx ? '#f5b731' : 'var(--text-primary)',
                        fontWeight: i === selectedIdx ? 600 : 400,
                        borderLeft: i === selectedIdx ? '3px solid #f5b731' : '3px solid transparent',
                      }}
                      className={i !== selectedIdx ? 'hover-row' : ''}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Error with retry */}
      {error && !loading && !data && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          {error}
          <button onClick={fetchPaies} className="btn-ghost" style={{ marginLeft: '1rem', fontSize: '0.8rem' }}>Réessayer</button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card" style={{ height: '100px', animation: 'pulse-soft 1.5s ease infinite', opacity: 0.5 }} />
          ))}
        </div>
      ) : data ? (
        <>
          {/* Stat Cards */}
          <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <StatCard
              title="Net HT Équipe"
              value={fmtEur(resume.total_net_ht_equipe)}
              icon={Euro}
              color="#6366f1"
            />
            <StatCard
              title="Total Payé"
              value={fmtEur(resume.total_paye_equipe)}
              icon={Users}
              color="#f5b731"
            />
            <StatCard
              title="Trésorerie Agence"
              value={fmtEur(resume.tresorerie_agence)}
              icon={Building2}
              color="#10b981"
            />
          </div>

          {/* Top 3 Podium */}
          {top.length > 0 && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Trophy size={18} color="#f5b731" />
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)', margin: 0 }}>Top Chatteurs</h3>
              </div>
              <div className="stagger-children podium-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(top.length, 3)}, 1fr)`, gap: '0.75rem' }}>
                {top.map((t, i) => (
                  <div
                    key={t.chatteur_id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.7rem 0.75rem', borderRadius: '10px',
                      background: PODIUM_ICONS[i].bg,
                      border: `1px solid ${PODIUM_ICONS[i].color}25`,
                      transition: 'transform 200ms ease, box-shadow 200ms ease',
                    }}
                    className="hover-lift"
                  >
                    <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{PODIUM_ICONS[i].emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.82rem', color: '#1a1f2e', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.nom}</p>
                      <p style={{ fontSize: '0.7rem', color: '#64748b', margin: '0.15rem 0 0', whiteSpace: 'nowrap' }}>
                        Net HT: {fmtEur(t.net_ht)}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: '0.82rem', color: PODIUM_ICONS[i].color, margin: 0, whiteSpace: 'nowrap' }}>
                        +{fmtEur(t.prime)}
                      </p>
                      <p style={{ fontSize: '0.6rem', color: '#94a3b8', margin: '0.1rem 0 0' }}>
                        prime
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Table — Chatteurs */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1rem' }}>
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)', margin: 0 }}>Détail par chatteur</h3>
              {paies.length > 0 && (
                <span className="badge badge-navy" style={{ fontSize: '0.7rem' }}>
                  {paies.length} ligne{paies.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Chatteur</th>
                    <th>Plateforme</th>
                    <th style={{ textAlign: 'right' }}>Brut</th>
                    <th style={{ textAlign: 'right' }}>TTC €</th>
                    <th style={{ textAlign: 'right' }}>HT €</th>
                    <th style={{ textAlign: 'right' }}>Net HT</th>
                    <th style={{ textAlign: 'right' }}>Commission</th>
                    <th style={{ textAlign: 'right' }}>Malus</th>
                    <th style={{ textAlign: 'right' }}>Prime</th>
                    <th style={{ textAlign: 'right' }}>TOTAL</th>
                    <th style={{ textAlign: 'center' }}>Statut</th>
                    <th style={{ textAlign: 'center', width: '50px' }}>PDF</th>
                  </tr>
                </thead>
                <tbody className="stagger-rows">
                  {paies.length === 0 ? (
                    <tr>
                      <td colSpan={12} style={{ textAlign: 'center', color: '#94a3b8', padding: '2.5rem' }}>
                        <div style={{
                          width: 48, height: 48, borderRadius: '50%', margin: '0 auto 0.75rem',
                          background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Euro size={22} color="#6366f1" strokeWidth={1.5} />
                        </div>
                        <p style={{ fontWeight: 500, color: '#64748b' }}>Aucune paie pour cette période</p>
                        <p style={{ fontSize: '0.8rem' }}>Les paies se calculent automatiquement à chaque vente ajoutée.</p>
                      </td>
                    </tr>
                  ) : (
                    paies.map(p => {
                      const isUSD = p.devise === 'USD';
                      const statutStyle = STATUT_STYLES[p.statut] || STATUT_STYLES['calculé'];
                      const totalColor = p.total_chatteur > 0 ? '#f5b731' : '#ef4444';

                      return (
                        <tr
                          key={p.id}
                          className="hover-gold-row"
                          style={{ cursor: 'default' }}
                        >
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: '50%',
                                background: getChatteurColor(p.chatteur_couleur).bg,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.7rem', fontWeight: 700, color: getChatteurColor(p.chatteur_couleur).text, flexShrink: 0,
                              }}>
                                {getInitials(p.chatteur_prenom)}
                              </div>
                              <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                                {p.chatteur_prenom}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="badge" style={{
                              background: p.couleur_fond || '#1b2e4b',
                              color: p.couleur_texte || '#ffffff',
                            }}>
                              {p.plateforme_nom || '—'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.82rem', color: '#64748b' }}>
                            {isUSD ? fmtUsd(p.ventes_brutes) : fmtEur(p.ventes_brutes)}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.82rem', color: '#64748b' }}>
                            {fmtEur(p.ventes_ttc_eur)}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.82rem', color: '#64748b' }}>
                            {fmtEur(p.ventes_ht_eur)}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.82rem', fontWeight: 600 }}>
                            {fmtEur(p.net_ht_eur)}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.82rem', color: '#64748b' }}>
                            {fmtEur(p.commission_chatteur)}
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginLeft: '0.25rem' }}>
                              ({fmtPercent(p.taux_commission)})
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.82rem', color: p.malus_total > 0 ? '#ef4444' : '#94a3b8' }}>
                            {p.malus_total > 0 ? `-${fmtEur(p.malus_total)}` : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.82rem', color: p.prime > 0 ? '#10b981' : '#94a3b8' }}>
                            {p.prime > 0 ? `+${fmtEur(p.prime)}` : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.95rem', color: totalColor }}>
                            {fmtEur(p.total_chatteur)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <select
                              value={p.statut}
                              onChange={e => handleStatutChange(p.id, e.target.value)}
                              style={{
                                background: statutStyle.bg,
                                color: statutStyle.color,
                                border: statutStyle.border,
                                borderRadius: '20px',
                                padding: '0.2rem 0.5rem',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                outline: 'none',
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                textAlign: 'center',
                                minWidth: '75px',
                              }}
                            >
                              <option value="calculé">Calculé</option>
                              <option value="validé">Validé</option>
                              {!isManager && <option value="payé">Payé</option>}
                            </select>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="haptic hover-icon"
                              onClick={(e) => { e.stopPropagation(); handleDownloadFacture(p.chatteur_id, p.chatteur_prenom); }}
                              disabled={downloadingId === p.chatteur_id}
                              title={`T\u00e9l\u00e9charger la facture de ${p.chatteur_prenom}`}
                              style={{
                                background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)',
                                borderRadius: '8px', padding: '0.35rem', cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 200ms ease',
                              }}
                            >
                              {downloadingId === p.chatteur_id
                                ? <span className="spinner" style={{ width: 14, height: 14 }} />
                                : <Download size={14} color="#6366f1" />}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Manager Section */}
          {managers.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1rem' }}>
              <div style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <Crown size={16} color="#f5b731" />
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)', margin: 0 }}>Managers</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th style={{ textAlign: 'right' }}>% du Net HT Équipe</th>
                      <th style={{ textAlign: 'right' }}>Base (Net HT Équipe)</th>
                      <th style={{ textAlign: 'right' }}>TOTAL</th>
                      <th style={{ textAlign: 'center' }}>Statut</th>
                      <th style={{ textAlign: 'center', width: '50px' }}>PDF</th>
                    </tr>
                  </thead>
                  <tbody className="stagger-rows">
                    {managers.map(m => {
                      const statutStyle = STATUT_STYLES[m.statut] || STATUT_STYLES['calculé'];
                      return (
                        <tr
                          key={m.id}
                          className="hover-gold-row"
                        >
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: '50%',
                                background: getChatteurColor(m.chatteur_couleur).bg,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.7rem', fontWeight: 700, color: getChatteurColor(m.chatteur_couleur).text, flexShrink: 0,
                              }}>
                                <Crown size={16} />
                              </div>
                              <span style={{ fontWeight: 500 }}>
                                {m.chatteur_prenom}
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: '#6366f1' }}>
                            {fmtPercent(m.taux_net_equipe)}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.82rem', color: '#64748b' }}>
                            {fmtEur(resume.total_net_ht_equipe)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.95rem', color: '#f5b731' }}>
                            {fmtEur(m.total_chatteur)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <select
                              value={m.statut}
                              onChange={e => handleStatutChange(m.id, e.target.value)}
                              style={{
                                background: statutStyle.bg,
                                color: statutStyle.color,
                                border: statutStyle.border,
                                borderRadius: '20px',
                                padding: '0.2rem 0.5rem',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                outline: 'none',
                                appearance: 'none',
                                WebkitAppearance: 'none',
                                textAlign: 'center',
                                minWidth: '75px',
                              }}
                            >
                              <option value="calculé">Calculé</option>
                              <option value="validé">Validé</option>
                              {!isManager && <option value="payé">Payé</option>}
                            </select>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="haptic hover-icon"
                              onClick={(e) => { e.stopPropagation(); handleDownloadFacture(m.chatteur_id, m.chatteur_prenom); }}
                              disabled={downloadingId === m.chatteur_id}
                              title={`Télécharger la facture de ${m.chatteur_prenom}`}
                              style={{
                                background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)',
                                borderRadius: '8px', padding: '0.35rem', cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 200ms ease',
                              }}
                            >
                              {downloadingId === m.chatteur_id
                                ? <span className="spinner" style={{ width: 14, height: 14 }} />
                                : <Download size={14} color="#6366f1" />}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Directeur Section — admin only */}
          {directeurs.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1rem' }}>
              <div style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <Shield size={16} color="#6366f1" />
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)', margin: 0 }}>Directeur</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th style={{ textAlign: 'right' }}>% du Net HT Équipe</th>
                      <th style={{ textAlign: 'right' }}>Base (Net HT Équipe)</th>
                      <th style={{ textAlign: 'right' }}>TOTAL</th>
                      {!isManager && <th style={{ textAlign: 'center' }}>Statut</th>}
                    </tr>
                  </thead>
                  <tbody className="stagger-rows">
                    {directeurs.map(d => {
                      const statutStyle = STATUT_STYLES[d.statut] || STATUT_STYLES['calculé'];
                      return (
                        <tr key={d.id} className="hover-gold-row">
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: '50%',
                                background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.7rem', fontWeight: 700, color: '#fff', flexShrink: 0,
                              }}>
                                <Shield size={16} />
                              </div>
                              <span style={{ fontWeight: 500 }}>{d.chatteur_prenom}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: '#6366f1' }}>
                            {fmtPercent(d.taux_net_equipe)}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.82rem', color: '#64748b' }}>
                            {fmtEur(resume.total_net_ht_equipe)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.95rem', color: '#6366f1' }}>
                            {fmtEur(d.total_chatteur)}
                          </td>
                          {!isManager && (
                            <td style={{ textAlign: 'center' }}>
                              <select
                                value={d.statut}
                                onChange={e => handleStatutChange(d.id, e.target.value)}
                                style={{
                                  background: statutStyle.bg,
                                  color: statutStyle.color,
                                  border: statutStyle.border,
                                  borderRadius: '20px',
                                  padding: '0.2rem 0.5rem',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  outline: 'none',
                                  appearance: 'none',
                                  WebkitAppearance: 'none',
                                  textAlign: 'center',
                                  minWidth: '75px',
                                }}
                              >
                                <option value="calculé">Calculé</option>
                                <option value="validé">Validé</option>
                                <option value="payé">Payé</option>
                              </select>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Taux de change — petit texte discret */}
          {resume.taux_change && (
            <p style={{ fontSize: '0.72rem', color: '#94a3b8', textAlign: 'right', margin: '0.25rem 0 0' }}>
              Taux de change : 1 $ = {resume.taux_change.toFixed(4)} € (mis à jour automatiquement)
            </p>
          )}

        </>
      ) : null}

      {/* Error toast */}
      {error && !loading && (
        <div className="toast-error" style={{
          position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 100,
          animation: 'slideUp 0.3s ease',
        }}>{error}</div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 600px) {
          .podium-grid {
            grid-template-columns: 1fr !important;
          }
          .hide-mobile {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
