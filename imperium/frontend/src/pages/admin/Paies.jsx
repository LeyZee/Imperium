import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import api from '../../api/index.js';
import StatCard from '../../components/StatCard.jsx';
import { CHATTEUR_COLORS } from '../../constants/colors.js';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Euro, TrendingUp, Calendar, Gift,
  Trophy, RefreshCw, ChevronDown, ChevronRight, Crown, Users, Shield,
  CheckCircle, Clock, AlertCircle, Download, FileText, CreditCard,
} from 'lucide-react';

/* ─── Palier thresholds — built from API data (DB = single source of truth) ─── */
import { getPalierHex } from '../../utils/palierColors.js';

const DEFAULT_PALIER_THRESHOLDS = [
  { seuil: 2500, label: 'Diamant', icon: '💎', color: '#06b6d4' },
  { seuil: 1500, label: 'Or', icon: '🥇', color: '#f5b731' },
  { seuil: 750, label: 'Argent', icon: '🥈', color: '#A8A9AD' },
  { seuil: 250, label: 'Bronze', icon: '🥉', color: '#CD7F32' },
];

function buildPalierThresholds(apiPaliers) {
  if (!apiPaliers || apiPaliers.length === 0) return DEFAULT_PALIER_THRESHOLDS;
  return apiPaliers
    .map((p, i) => ({
      seuil: p.seuil_net_ht,
      label: p.label || p.nom || 'Palier',
      icon: p.emoji || '●',
      color: getPalierHex(p, i),
    }))
    .sort((a, b) => b.seuil - a.seuil);
}

function getPalier(netHT, thresholds) {
  return (thresholds || DEFAULT_PALIER_THRESHOLDS).find(p => netHT >= p.seuil) || null;
}

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
  'calculé': { bg: 'rgba(249,115,22,0.1)', color: '#c2410c', border: '1px solid rgba(249,115,22,0.25)', stripe: '#ea580c', icon: AlertCircle },
  'validé': { bg: 'rgba(59,130,246,0.1)', color: '#1d4ed8', border: '1px solid rgba(59,130,246,0.25)', stripe: '#2563eb', icon: Clock },
  'payé': { bg: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.25)', stripe: '#059669', icon: CheckCircle },
};

/* Statut ordering for cycling + groupedPaies merge */
const STATUT_ORDER = { 'calculé': 0, 'validé': 1, 'payé': 2 };

const STATUT_ORDER_LIST = ['calculé', 'validé', 'payé'];
const STATUT_ORDER_LIST_MANAGER = ['calculé', 'validé']; // managers can't set 'payé'

function getNextStatut(current, isManager) {
  const list = isManager ? STATUT_ORDER_LIST_MANAGER : STATUT_ORDER_LIST;
  const idx = list.indexOf(current);
  return list[(idx + 1) % list.length];
}

/* ─── Statut Badge Component ─── */
function StatutBadge({ statut, onClick, label, isManager, loading, readOnly }) {
  const style = STATUT_STYLES[statut] || STATUT_STYLES['calculé'];
  const IconComponent = style.icon || AlertCircle;
  if (readOnly) {
    return (
      <span
        aria-label={`${label} — statut ${statut}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
          background: style.bg, color: style.color, border: style.border,
          borderRadius: '20px', padding: '0.25rem 0.6rem',
          fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap',
        }}
      >
        <IconComponent size={12} />
        <span>{statut.charAt(0).toUpperCase() + statut.slice(1)}</span>
      </span>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={loading}
      aria-label={`${label} — statut ${statut}, cliquer pour changer`}
      title={`Cliquer pour passer à « ${getNextStatut(statut, isManager)} »`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
        background: style.bg, color: style.color, border: style.border,
        borderRadius: '20px', padding: '0.25rem 0.6rem 0.25rem 0.5rem',
        fontSize: '0.72rem', fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
        outline: 'none', transition: 'all 200ms ease',
        whiteSpace: 'nowrap', opacity: loading ? 0.6 : 1,
      }}
    >
      {loading
        ? <span className="spinner" style={{ width: 12, height: 12 }} />
        : <IconComponent size={12} />
      }
      <span>{statut.charAt(0).toUpperCase() + statut.slice(1)}</span>
      <ChevronRight size={11} style={{ opacity: 0.6, marginLeft: '-0.1rem' }} />
    </button>
  );
}

const PODIUM_ICONS = [
  { rank: '1er', color: '#f5b731', bg: 'rgba(245,183,49,0.12)', badgeBg: 'linear-gradient(135deg, #f5b731, #e6a817)' },
  { rank: '2e', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', badgeBg: 'linear-gradient(135deg, #94a3b8, #64748b)' },
  { rank: '3e', color: '#cd7f32', bg: 'rgba(205,127,50,0.12)', badgeBg: 'linear-gradient(135deg, #cd7f32, #a0522d)' },
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
  const [showRecalcModal, setShowRecalcModal] = useState(false);
  const [showPayeConfirm, setShowPayeConfirm] = useState(null); // { ids, label } or null
  const [changingStatut, setChangingStatut] = useState(new Set()); // ids currently changing
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

  function requestStatutChange(paieIdOrIds, newStatut, label) {
    const ids = Array.isArray(paieIdOrIds) ? paieIdOrIds : [paieIdOrIds];
    // Confirmation required for "payé" (irreversible financially)
    if (newStatut === 'payé') {
      setShowPayeConfirm({ ids, label: label || 'cette paie', newStatut });
      return;
    }
    doStatutChange(ids, newStatut);
  }

  async function doStatutChange(ids, newStatut) {
    const idSet = new Set(ids);
    setChangingStatut(prev => new Set([...prev, ...ids]));
    // Optimistic update
    setData(prev => {
      if (!prev) return prev;
      const updateRows = rows => rows.map(p => idSet.has(p.id) ? { ...p, statut: newStatut } : p);
      return { ...prev, paies: updateRows(prev.paies), managers: updateRows(prev.managers), directeurs: updateRows(prev.directeurs) };
    });
    try {
      await Promise.all(ids.map(id => api.put(`/api/paies/${id}/statut`, { statut: newStatut })));
      setSuccess(`Statut mis à jour → ${newStatut}`);
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setError('Erreur changement de statut.');
      await fetchPaies(); // Rollback: refetch real data
    } finally {
      setChangingStatut(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next; });
    }
  }

  function handleBatchStatut(newStatut) {
    const allPaieIds = [
      ...paies.map(p => p.id),
      ...managers.map(m => m.id),
      ...directeurs.map(d => d.id),
    ].filter(Boolean);
    if (allPaieIds.length === 0) return;
    if (newStatut === 'payé') {
      setShowPayeConfirm({ ids: allPaieIds, label: 'toutes les paies', newStatut });
      return;
    }
    doStatutChange(allPaieIds, newStatut);
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

  // Group paie rows by chatteur (merge multi-platform rows into one)
  const groupedPaies = useMemo(() => {
    const grouped = {};
    for (const p of paies) {
      if (!grouped[p.chatteur_id]) {
        grouped[p.chatteur_id] = {
          chatteur_id: p.chatteur_id,
          chatteur_prenom: p.chatteur_prenom,
          chatteur_couleur: p.chatteur_couleur,
          taux_commission: p.taux_commission,
          platforms: [],
          paie_ids: [],
          ventes_brutes: 0,
          ventes_ttc_eur: 0,
          ventes_ht_eur: 0,
          net_ht_eur: 0,
          commission_chatteur: 0,
          malus_total: 0,
          prime: 0,
          total_chatteur: 0,
          statut: 'payé', // start high, will be set to lowest
        };
      }
      const g = grouped[p.chatteur_id];
      g.platforms.push({
        nom: p.plateforme_nom,
        couleur_fond: p.couleur_fond,
        couleur_texte: p.couleur_texte,
        devise: p.devise,
        ventes_brutes: p.ventes_brutes,
        ventes_ttc_eur: p.ventes_ttc_eur,
        ventes_ht_eur: p.ventes_ht_eur,
        net_ht_eur: p.net_ht_eur,
        commission_chatteur: p.commission_chatteur,
      });
      g.paie_ids.push(p.id);
      g.ventes_brutes += (p.ventes_brutes || 0);
      g.ventes_ttc_eur += (p.ventes_ttc_eur || 0);
      g.ventes_ht_eur += (p.ventes_ht_eur || 0);
      g.net_ht_eur += (p.net_ht_eur || 0);
      g.commission_chatteur += (p.commission_chatteur || 0);
      g.malus_total += (p.malus_total || 0);
      g.prime += (p.prime || 0);
      g.total_chatteur += (p.total_chatteur || 0);
      // Lowest statut wins: calculé < validé < payé
      if ((STATUT_ORDER[p.statut] ?? 0) < (STATUT_ORDER[g.statut] ?? 0)) {
        g.statut = p.statut;
      }
    }
    return Object.values(grouped).sort((a, b) => b.net_ht_eur - a.net_ht_eur);
  }, [paies]);

  // Build dynamic palier thresholds from API data (fallback to defaults)
  const palierThresholds = useMemo(() => buildPalierThresholds(data?.paliers_primes), [data?.paliers_primes]);

  // Aggregate net_ht per chatteur for palier badges
  const chatteurPaliers = useMemo(() => {
    const result = {};
    for (const g of groupedPaies) {
      result[g.chatteur_id] = getPalier(g.net_ht_eur, palierThresholds);
    }
    return result;
  }, [groupedPaies, palierThresholds]);

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
          <h1 style={{ fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CreditCard size={22} color="#f5b731" /> Paies</h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Calcul automatique et suivi des rémunérations</p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Download all invoices */}
          {paies.length > 0 && (
            <button
              className="btn-secondary haptic"
              onClick={handleDownloadAll}
              disabled={downloadingId !== null || batchProgress !== null}
              title="Télécharger toutes les factures PDF de la période"
              aria-label="Télécharger toutes les factures PDF"
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
              onClick={() => setShowRecalcModal(true)}
              disabled={recalculating || loading}
              title="Recalculer les paies" aria-label="Recalculer les paies"
              style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <RefreshCw size={15} style={{ animation: recalculating ? 'spin 1s linear infinite' : 'none' }} />
              {recalculating ? 'Recalcul...' : 'Recalculer'}
            </button>
          )}

          {period && (
            <button className="btn-secondary" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              aria-label="Exporter les paies en CSV"
              onClick={() => window.open(`/api/paies/export-csv?debut=${period.debut}&fin=${period.fin}`, '_blank')}>
              <Download size={14} /> CSV
            </button>
          )}

          {/* Period selector */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              className="btn-secondary"
              onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
              aria-expanded={showPeriodDropdown}
              aria-label="Sélectionner la période"
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
              title="Total Primes"
              value={fmtEur(resume.total_primes)}
              icon={Gift}
              color="#f59e0b"
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
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: '1.6rem', height: '1.6rem', borderRadius: '50%',
                      background: PODIUM_ICONS[i].badgeBg,
                      color: '#fff', fontSize: '0.7rem', fontWeight: 800,
                      flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                      letterSpacing: '-0.02em',
                    }}>{PODIUM_ICONS[i].rank}</span>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {groupedPaies.length > 0 && !isManager && (
                  <>
                    <button
                      className="btn-ghost"
                      onClick={() => handleBatchStatut('validé')}
                      style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem', borderRadius: '6px', color: '#1d4ed8', border: '1px solid rgba(59,130,246,0.25)' }}
                    >
                      Tout valider
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => handleBatchStatut('payé')}
                      style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem', borderRadius: '6px', color: '#059669', border: '1px solid rgba(16,185,129,0.25)' }}
                    >
                      Tout payer
                    </button>
                  </>
                )}
                {groupedPaies.length > 0 && (
                  <span className="badge badge-navy" style={{ fontSize: '0.7rem' }}>
                    {groupedPaies.length} chatteur{groupedPaies.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Chatteur</th>
                    <th>Plateforme(s)</th>
                    <th style={{ textAlign: 'right' }}>Ventes brutes</th>
                    <th className="hide-mobile" style={{ textAlign: 'right' }}>TTC (EUR)</th>
                    <th className="hide-mobile" style={{ textAlign: 'right' }}>HT (- TVA)</th>
                    <th style={{ textAlign: 'right' }}>Net HT</th>
                    <th className="hide-mobile" style={{ textAlign: 'right' }}>Commission</th>
                    <th className="hide-mobile" style={{ textAlign: 'right' }}>Malus</th>
                    <th style={{ textAlign: 'right' }}>Prime</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'center' }}>Statut</th>
                    <th style={{ textAlign: 'center', width: '50px' }}>PDF</th>
                  </tr>
                </thead>
                <tbody className="stagger-rows">
                  {groupedPaies.length === 0 ? (
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
                    groupedPaies.map(g => {
                      const statutStyle = STATUT_STYLES[g.statut] || STATUT_STYLES['calculé'];
                      const totalColor = g.total_chatteur > 0 ? '#f5b731' : '#ef4444';

                      return (
                        <tr
                          key={g.chatteur_id}
                          className="hover-gold-row"
                          style={{ cursor: 'default' }}
                        >
                          <td style={{ borderLeft: `4px solid ${statutStyle.stripe}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: '50%',
                                background: getChatteurColor(g.chatteur_couleur).bg,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.7rem', fontWeight: 700, color: getChatteurColor(g.chatteur_couleur).text, flexShrink: 0,
                              }}>
                                {getInitials(g.chatteur_prenom)}
                              </div>
                              <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                                {g.chatteur_prenom}
                              </span>
                              {chatteurPaliers[g.chatteur_id] && (
                                <span style={{
                                  fontSize: '0.6rem', fontWeight: 600,
                                  padding: '0.1rem 0.35rem', borderRadius: '6px',
                                  background: `${chatteurPaliers[g.chatteur_id].color}18`,
                                  color: chatteurPaliers[g.chatteur_id].color,
                                  border: `1px solid ${chatteurPaliers[g.chatteur_id].color}30`,
                                  whiteSpace: 'nowrap', marginLeft: '0.25rem',
                                }}>
                                  {chatteurPaliers[g.chatteur_id].icon} {chatteurPaliers[g.chatteur_id].label}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                              {g.platforms.map((pl, i) => (
                                <span key={i} className="badge" style={{
                                  background: pl.couleur_fond || '#1b2e4b',
                                  color: pl.couleur_texte || '#ffffff',
                                  fontSize: '0.72rem',
                                }}>
                                  {pl.nom || '—'}
                                </span>
                              ))}
                            </div>
                          </td>
                          {/* Ventes brutes */}
                          <td style={{ textAlign: 'right', fontSize: '0.82rem', color: '#64748b' }}>
                            {g.platforms.length > 1 ? (
                              <div>
                                <div style={{ fontWeight: 500 }}>{fmtEur(g.ventes_brutes)}</div>
                                <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: '2px', lineHeight: 1.4 }}>
                                  {g.platforms.map((pl, i) => (
                                    <div key={i}>{pl.nom}: {pl.devise === 'USD' ? fmtUsd(pl.ventes_brutes) : fmtEur(pl.ventes_brutes)}</div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              g.platforms[0]?.devise === 'USD' ? fmtUsd(g.ventes_brutes) : fmtEur(g.ventes_brutes)
                            )}
                          </td>
                          {/* TTC (EUR) */}
                          <td className="hide-mobile" style={{ textAlign: 'right', fontSize: '0.82rem', color: '#64748b' }}>
                            {g.platforms.length > 1 ? (
                              <div>
                                <div style={{ fontWeight: 500 }}>{fmtEur(g.ventes_ttc_eur)}</div>
                                <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: '2px', lineHeight: 1.4 }}>
                                  {g.platforms.map((pl, i) => (
                                    <div key={i}>{pl.nom}: {fmtEur(pl.ventes_ttc_eur)}</div>
                                  ))}
                                </div>
                              </div>
                            ) : fmtEur(g.ventes_ttc_eur)}
                          </td>
                          {/* HT (- TVA) */}
                          <td className="hide-mobile" style={{ textAlign: 'right', fontSize: '0.82rem', color: '#64748b' }}>
                            {g.platforms.length > 1 ? (
                              <div>
                                <div style={{ fontWeight: 500 }}>{fmtEur(g.ventes_ht_eur)}</div>
                                <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: '2px', lineHeight: 1.4 }}>
                                  {g.platforms.map((pl, i) => (
                                    <div key={i}>{pl.nom}: {fmtEur(pl.ventes_ht_eur)}</div>
                                  ))}
                                </div>
                              </div>
                            ) : fmtEur(g.ventes_ht_eur)}
                          </td>
                          {/* Net HT (- comm. plat.) */}
                          <td style={{ textAlign: 'right', fontSize: '0.82rem', fontWeight: 600 }}>
                            {g.platforms.length > 1 ? (
                              <div>
                                <div>{fmtEur(g.net_ht_eur)}</div>
                                <div style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 400, marginTop: '2px', lineHeight: 1.4 }}>
                                  {g.platforms.map((pl, i) => (
                                    <div key={i}>{pl.nom}: {fmtEur(pl.net_ht_eur)}</div>
                                  ))}
                                </div>
                              </div>
                            ) : fmtEur(g.net_ht_eur)}
                          </td>
                          {/* Commission chatteur (merged total) */}
                          <td className="hide-mobile" style={{ textAlign: 'right', fontSize: '0.82rem', color: '#64748b' }}>
                            {fmtEur(g.commission_chatteur)}
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginLeft: '0.25rem' }}>
                              ({fmtPercent(g.taux_commission)})
                            </span>
                          </td>
                          <td className="hide-mobile" style={{ textAlign: 'right', fontSize: '0.82rem', color: g.malus_total > 0 ? '#ef4444' : '#94a3b8' }}>
                            {g.malus_total > 0 ? `-${fmtEur(g.malus_total)}` : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.82rem', color: g.prime > 0 ? '#10b981' : '#94a3b8' }}>
                            {g.prime > 0 ? `+${fmtEur(g.prime)}` : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.95rem', color: totalColor }}>
                            {fmtEur(g.total_chatteur)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <StatutBadge
                              statut={g.statut}
                              onClick={() => requestStatutChange(g.paie_ids, getNextStatut(g.statut, isManager), g.chatteur_prenom)}
                              label={`Statut de ${g.chatteur_prenom}`}
                              isManager={isManager}
                              loading={g.paie_ids.some(id => changingStatut.has(id))}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="haptic hover-icon"
                              onClick={(e) => { e.stopPropagation(); handleDownloadFacture(g.chatteur_id, g.chatteur_prenom); }}
                              disabled={downloadingId === g.chatteur_id}
                              aria-label={`Télécharger la facture de ${g.chatteur_prenom}`}
                              title={`Télécharger la facture de ${g.chatteur_prenom}`}
                              style={{
                                background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)',
                                borderRadius: '8px', padding: '0.35rem', cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 200ms ease',
                              }}
                            >
                              {downloadingId === g.chatteur_id
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
                          <td style={{ borderLeft: `4px solid ${statutStyle.stripe}` }}>
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
                            <StatutBadge
                              statut={m.statut}
                              onClick={() => requestStatutChange(m.id, getNextStatut(m.statut, isManager), m.chatteur_prenom)}
                              label={`Statut de ${m.chatteur_prenom}`}
                              isManager={isManager}
                              loading={changingStatut.has(m.id)}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="haptic hover-icon"
                              onClick={(e) => { e.stopPropagation(); handleDownloadFacture(m.chatteur_id, m.chatteur_prenom); }}
                              disabled={downloadingId === m.chatteur_id}
                              aria-label={`Télécharger la facture de ${m.chatteur_prenom}`}
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
                    </tr>
                  </thead>
                  <tbody className="stagger-rows">
                    {directeurs.map(d => (
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
                        </tr>
                    ))}
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

      {/* Confirmation modal for Recalculer */}
      {showRecalcModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setShowRecalcModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="recalc-title"
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card, #fff)', borderRadius: '14px',
              padding: '1.75rem', maxWidth: '380px', width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              animation: 'modalCardIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
              textAlign: 'center',
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: '50%', margin: '0 auto 1rem',
              background: 'rgba(245,183,49,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <RefreshCw size={22} color="#f5b731" />
            </div>
            <h3 id="recalc-title" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy)', margin: '0 0 0.5rem' }}>
              Recalculer toutes les paies ?
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 1.25rem' }}>
              Les paies de la période <strong>{period?.label}</strong> seront recalculées à partir des ventes validées.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                className="btn-ghost"
                onClick={() => setShowRecalcModal(false)}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.82rem' }}
              >
                Annuler
              </button>
              <button
                className="btn-primary"
                onClick={() => { setShowRecalcModal(false); handleRecalculate(); }}
                style={{
                  padding: '0.5rem 1.25rem', fontSize: '0.82rem',
                  background: 'linear-gradient(135deg, #f5b731, #e6a817)',
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                }}
              >
                <RefreshCw size={14} /> Recalculer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation modal for Payé */}
      {showPayeConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setShowPayeConfirm(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card, #fff)', borderRadius: '14px',
              padding: '1.75rem', maxWidth: '380px', width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              animation: 'modalCardIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
              textAlign: 'center',
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: '50%', margin: '0 auto 1rem',
              background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle size={22} color="#059669" />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--navy)', margin: '0 0 0.5rem' }}>
              Marquer comme payé ?
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 1.25rem' }}>
              Confirmer le passage en <strong style={{ color: '#059669' }}>payé</strong> pour <strong>{showPayeConfirm.label}</strong> ?
              {showPayeConfirm.ids.length > 1 && (
                <span style={{ display: 'block', fontSize: '0.75rem', marginTop: '0.3rem', color: '#94a3b8' }}>
                  ({showPayeConfirm.ids.length} paie{showPayeConfirm.ids.length > 1 ? 's' : ''} concernée{showPayeConfirm.ids.length > 1 ? 's' : ''})
                </span>
              )}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                className="btn-ghost"
                onClick={() => setShowPayeConfirm(null)}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.82rem' }}
              >
                Annuler
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  const { ids, newStatut } = showPayeConfirm;
                  setShowPayeConfirm(null);
                  doStatutChange(ids, newStatut);
                }}
                style={{
                  padding: '0.5rem 1.25rem', fontSize: '0.82rem',
                  background: 'linear-gradient(135deg, #059669, #047857)',
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                }}
              >
                <CheckCircle size={14} /> Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (max-width: 768px) {
          .hide-mobile {
            display: none !important;
          }
        }
        @media (max-width: 600px) {
          .podium-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
