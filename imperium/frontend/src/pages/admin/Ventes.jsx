import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/index';
import StatCard from '../../components/StatCard.jsx';
import {
  Plus, Euro, ShoppingBag, BarChart3, X, Pencil, Trash2,
  ChevronDown, ChevronUp, PackageOpen, Calendar, Download, Check, XCircle, Clock,
  Bot, User, Shield, RotateCcw, TrendingUp, TrendingDown, ArrowUpDown
} from 'lucide-react';
import { CHATTEUR_COLORS } from '../../constants/colors.js';
import Pagination, { ITEMS_PER_PAGE } from '../../components/Pagination.jsx';
import { useToast } from '../../components/Toast.jsx';

/* ─── Period auto-calc (mirrors backend utils/period.js) ─── */
function getPeriode(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDate();
  const year = d.getFullYear();
  const month = d.getMonth();
  if (day < 15) {
    return {
      debut: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      fin: `${year}-${String(month + 1).padStart(2, '0')}-15`,
    };
  }
  const next = new Date(year, month + 1, 1);
  return {
    debut: `${year}-${String(month + 1).padStart(2, '0')}-15`,
    fin: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`,
  };
}

function formatPeriodLabel(debut, fin) {
  if (!debut || !fin) return '';
  const d = new Date(debut + 'T00:00:00');
  const f = new Date(fin + 'T00:00:00');
  const moisD = d.toLocaleDateString('fr-FR', { month: 'short' });
  const moisF = f.toLocaleDateString('fr-FR', { month: 'short' });
  const dayD = d.getDate();
  const dayF = f.getDate();
  if (d.getMonth() === f.getMonth() || dayF === 1) {
    return `${dayD} – ${dayF === 1 ? '1' : dayF} ${dayF === 1 ? moisF : moisD} ${f.getFullYear()}`;
  }
  return `${dayD} ${moisD} – ${dayF} ${moisF} ${f.getFullYear()}`;
}

function formatCreatedAt(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${date} à ${hours}h${minutes}`;
}

const today = (() => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
})();

const STATUT_STYLES = {
  'en_attente': { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', label: 'En attente' },
  'validée': { bg: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', label: 'Validée' },
  'rejetée': { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', label: 'Rejetée' },
};

const CRENEAUX_LABELS = { 1: '08h-14h', 2: '14h-20h', 3: '20h-02h', 4: '02h-08h' };

const SOURCE_CONFIG = {
  telegram: { label: 'Telegram', icon: Bot, color: '#059669', bg: 'rgba(16,185,129,0.1)' },
  chatteur: { label: 'Chatteur', icon: User, color: '#1e40af', bg: '#dbeafe' },
  manager:  { label: 'Manager', icon: Shield, color: '#b45309', bg: '#fef3c7' },
  admin:    { label: 'Directeur', icon: Shield, color: '#6366f1', bg: '#ede9fe' },
};

function SourceBadge({ source }) {
  const cfg = SOURCE_CONFIG[source] || SOURCE_CONFIG.admin;
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      padding: '0.15rem 0.5rem', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600,
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
    }}>
      <Icon size={11} /> {cfg.label}
    </span>
  );
}

const EMPTY_FORM = { chatteur_id: '', modele_id: '', plateforme_id: '', montant_brut: '', date: today, notes: '', shift_id: '' };

/* ─── Previous period helper ─── */
function getPreviousPeriod(period) {
  if (!period) return null;
  const d = new Date(period.debut + 'T00:00:00');
  const day = d.getDate();
  const year = d.getFullYear();
  const month = d.getMonth();
  if (day === 15) {
    // Current is 15–01: previous is 01–15 of same month
    return {
      debut: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      fin: `${year}-${String(month + 1).padStart(2, '0')}-15`,
    };
  }
  // Current is 01–15: previous is 15–01 of previous month
  const prevMonth = new Date(year, month - 1, 15);
  return {
    debut: `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-15`,
    fin: `${year}-${String(month + 1).padStart(2, '0')}-01`,
  };
}

/* ─── Delta trend badge ─── */
function DeltaBadge({ current, previous, suffix = '€', invert = false }) {
  if (previous === null || previous === undefined || previous === 0) return null;
  const delta = ((current - previous) / previous) * 100;
  if (!isFinite(delta) || isNaN(delta)) return null;
  const isUp = delta > 0;
  const isNeutral = Math.abs(delta) < 0.5;
  const isGood = invert ? !isUp : isUp;
  const color = isNeutral ? '#94a3b8' : isGood ? '#10b981' : '#ef4444';
  const bg = isNeutral ? 'rgba(148,163,184,0.1)' : isGood ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';
  const Icon = isUp ? TrendingUp : TrendingDown;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
      padding: '0.1rem 0.45rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 600,
      color, background: bg, whiteSpace: 'nowrap',
    }}>
      <Icon size={11} />
      {isUp ? '+' : ''}{delta.toFixed(0)}%
    </span>
  );
}

/* ─── Sortable table header ─── */
function SortableHeader({ label, field, sortCol, sortDir, onSort, align }) {
  const isActive = sortCol === field;
  return (
    <th
      onClick={() => onSort(field)}
      role="columnheader"
      aria-sort={isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      style={{
        cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
        textAlign: align || 'left',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        {label}
        {isActive ? (
          sortDir === 'asc' ? <ChevronUp size={13} style={{ opacity: 0.7 }} /> : <ChevronDown size={13} style={{ opacity: 0.7 }} />
        ) : (
          <ArrowUpDown size={12} style={{ opacity: 0.25 }} />
        )}
      </span>
    </th>
  );
}

/* ─────────────────────────────────────────── */
export default function Ventes() {
  const toast = useToast();
  const [allVentes, setAllVentes] = useState([]);
  const [chatteurs, setChatteurs] = useState([]);
  const [modeles, setModeles] = useState([]);
  const [plateformes, setPlateformes] = useState([]);
  const [summary, setSummary] = useState(null);
  const [prevSummary, setPrevSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  /* Filters */
  const [activePlatform, setActivePlatform] = useState(null);
  const [filterChatteur, setFilterChatteur] = useState('');
  const [filterModele, setFilterModele] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statutFilter, setStatutFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  /* Sorting */
  const [sortCol, setSortCol] = useState(null);   // null | 'periode' | 'chatteur' | 'plateforme' | 'montant' | 'source' | 'statut'
  const [sortDir, setSortDir] = useState('desc');  // 'asc' | 'desc'

  /* Modal */
  const [modal, setModal] = useState(null);       // null | 'add' | { ...vente }
  const [form, setForm] = useState(EMPTY_FORM);
  const [modalClosing, setModalClosing] = useState(false);
  const [chatteurModeles, setChatteurModeles] = useState(null); // null = all models, [] = filtered

  /* Shifts for vente */
  const [availableShifts, setAvailableShifts] = useState([]);
  /* Chatteur-platform associations from shifts (for filter dropdowns) */
  const [chatteurPlatformMap, setChatteurPlatformMap] = useState({});

  /* Delete confirmation */
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  /* Feedback */
  const [error, setError] = useState('');
  const [fetchError, setFetchError] = useState(null);

  /* ─── Data fetching ─── */
  const fetchVentes = useCallback(async (period) => {
    const params = new URLSearchParams();
    const p = period || selectedPeriod;
    if (p) {
      params.append('periode_debut', p.debut);
      params.append('periode_fin', p.fin);
    }
    const { data } = await api.get(`/api/ventes?${params}`);
    setAllVentes(data);
    return data;
  }, [selectedPeriod]);

  const fetchSummary = useCallback(async (period) => {
    const p = period || selectedPeriod;
    const params = p ? `?periode_debut=${p.debut}&periode_fin=${p.fin}` : '';
    try {
      const { data } = await api.get(`/api/ventes/summary${params}`);
      setSummary(data);
    } catch { /* ignore */ }
    // Fetch previous period summary for delta badges
    const prev = getPreviousPeriod(p);
    if (prev) {
      try {
        const { data } = await api.get(`/api/ventes/summary?periode_debut=${prev.debut}&periode_fin=${prev.fin}`);
        setPrevSummary(data);
      } catch { setPrevSummary(null); }
    } else {
      setPrevSummary(null);
    }
  }, [selectedPeriod]);

  async function initialFetch() {
    setLoading(true);
    setFetchError(null);
    try {
      // Load reference data + dashboard period in parallel
      const [c, m, p, dash, sh] = await Promise.all([
        api.get('/api/chatteurs'),
        api.get('/api/modeles'),
        api.get('/api/plateformes'),
        api.get('/api/dashboard'),
        api.get('/api/shifts'),
      ]);
      setChatteurs(c.data);
      setModeles(m.data);
      setPlateformes(p.data);
      // Build chatteur → Set<plateforme_id> map from shifts
      const cpMap = {};
      (sh.data || []).forEach(s => {
        if (!cpMap[s.chatteur_id]) cpMap[s.chatteur_id] = new Set();
        cpMap[s.chatteur_id].add(s.plateforme_id);
      });
      setChatteurPlatformMap(cpMap);
      const initialPeriod = dash.data.periode || null;
      if (dash.data.periodes) setPeriods(dash.data.periodes);
      if (initialPeriod) setSelectedPeriod(initialPeriod);
      // Now fetch ventes + summary with the correct period
      await Promise.all([fetchVentes(initialPeriod), fetchSummary(initialPeriod)]);
    } catch {
      setFetchError('Impossible de charger les données.');
    }
    setLoading(false);
  }

  useEffect(() => {
    initialFetch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh when a vente is validated/rejected from NotificationPanel
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('vente-status-changed', handler);
    return () => window.removeEventListener('vente-status-changed', handler);
  }, [selectedPeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refresh(period) {
    await Promise.all([fetchVentes(period), fetchSummary(period)]);
  }

  /* ─── Period selection ─── */
  function selectPeriod(p) {
    setSelectedPeriod(p);
    setShowPeriodDropdown(false);
    refresh(p);
  }

  /* ─── Cascading filter changes ─── */
  function selectPlatform(id) {
    setActivePlatform(id);
    // Reset dependent filters if their value is no longer valid
    setFilterModele('');
    setFilterChatteur('');
  }

  function changeModele(val) {
    setFilterModele(val);
    setFilterChatteur('');
  }

  function changeChatteur(val) {
    setFilterChatteur(val);
  }

  /* ─── Modal open/close ─── */
  async function fetchChatteurModeles(chatteurId) {
    if (!chatteurId) { setChatteurModeles(null); return; }
    try {
      const { data } = await api.get(`/api/shifts/chatteur-modeles/${chatteurId}`);
      setChatteurModeles(data);
    } catch { setChatteurModeles(null); }
  }

  async function fetchShiftsForVente(chatteurId, modeleId, plateformeId, refDate) {
    if (!chatteurId) { setAvailableShifts([]); return; }
    try {
      const params = new URLSearchParams({ chatteur_id: chatteurId, days: 14 });
      if (modeleId) params.append('modele_id', modeleId);
      if (plateformeId) params.append('plateforme_id', plateformeId);
      if (refDate) params.append('ref_date', refDate);
      const { data } = await api.get(`/api/shifts/for-vente?${params}`);
      setAvailableShifts(data);
    } catch { setAvailableShifts([]); }
  }

  function openAddModal() {
    setForm(EMPTY_FORM);
    setChatteurModeles(null);
    setAvailableShifts([]);
    setError('');
    setModal('add');
  }

  function openEditModal(vente) {
    setForm({
      chatteur_id: String(vente.chatteur_id),
      modele_id: vente.modele_id ? String(vente.modele_id) : '',
      plateforme_id: String(vente.plateforme_id),
      montant_brut: String(vente.montant_brut),
      date: vente.periode_debut || today,
      notes: vente.notes || '',
      shift_id: vente.shift_id ? String(vente.shift_id) : '',
    });
    setError('');
    fetchChatteurModeles(vente.chatteur_id);
    fetchShiftsForVente(vente.chatteur_id, vente.modele_id, vente.plateforme_id, vente.periode_debut);
    setModal(vente);
  }

  function closeModal() {
    setModalClosing(true);
    setTimeout(() => {
      setModal(null);
      setModalClosing(false);
      setError('');
    }, 200);
  }

  /* ─── Submit add/edit ─── */
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!form.chatteur_id) { setError('Chatteur requis'); return; }
    if (!form.plateforme_id) { setError('Plateforme requise'); return; }
    if (!form.montant_brut || isNaN(Number(form.montant_brut)) || Number(form.montant_brut) <= 0) {
      setError('Le montant doit être un nombre positif'); return;
    }
    if (!form.date) { setError('Date requise'); return; }
    if (!form.shift_id) { setError('Shift requis'); return; }

    setSubmitting(true);
    try {
      const periode = getPeriode(form.date);
      const payload = {
        chatteur_id: Number(form.chatteur_id),
        plateforme_id: Number(form.plateforme_id),
        montant_brut: parseFloat(form.montant_brut),
        periode_debut: periode.debut,
        periode_fin: periode.fin,
        modele_id: form.modele_id ? Number(form.modele_id) : null,
        notes: form.notes || null,
        shift_id: form.shift_id ? Number(form.shift_id) : undefined,
      };

      if (modal === 'add') {
        await api.post('/api/ventes', payload);
        toast.success('Vente ajoutée avec succès');
      } else {
        await api.put(`/api/ventes/${modal.id}`, payload);
        toast.success('Vente modifiée avec succès');
      }

      closeModal();
      await refresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  }

  /* ─── Delete ─── */
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    setTimeout(async () => {
      await api.delete(`/api/ventes/${deleteTarget.id}`);
      setDeleteTarget(null);
      setDeletingId(null);
      toast.success('Vente supprimée');
      await refresh();
    }, 300);
  }

  /* ─── Validate / Reject ─── */
  async function handleValider(venteId, statut) {
    try {
      await api.put(`/api/ventes/${venteId}/valider`, { statut });
      toast.success(statut === 'validée' ? 'Vente validée' : 'Vente rejetée');
      await refresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur');
    }
  }

  /* ─── Helpers ─── */
  const getName = (list, id) => {
    const item = list.find(x => x.id == id);
    if (!item) return '—';
    return item.pseudo || item.prenom || '—';
  };
  const getPlatName = id => plateformes.find(p => p.id == id)?.nom || '—';
  const getPlatColor = id => plateformes.find(p => p.id == id)?.couleur_fond || '#1b2e4b';
  const getPlatTextColor = id => plateformes.find(p => p.id == id)?.couleur_texte || '#ffffff';
  const getDevise = id => plateformes.find(p => p.id == id)?.devise || 'EUR';
  const getInitial = (list, id) => {
    const item = list.find(x => x.id == id);
    return item?.prenom?.[0]?.toUpperCase() || '?';
  };

  const periodeCalc = form.date ? getPeriode(form.date) : null;

  const totalVentes = summary ? (summary.total_brut_usd || 0) : 0;
  const totalNetHT = summary ? (summary.total_net_ht_eur || 0) : 0;
  const totalPrimes = summary ? (summary.total_primes || 0) : 0;
  const topChatteur = summary?.top_chatteur
    ? summary.top_chatteur.prenom
    : '—';

  /* Colors for initials — use chatteur DB colors via CHATTEUR_COLORS */
  const getChatteurColorFromList = (id) => {
    const c = chatteurs.find(x => x.id == id);
    return CHATTEUR_COLORS[c?.couleur]?.bg || '#94a3b8';
  };

  /* ─── Source helper ─── */
  function getSource(vente) {
    if (vente.source) return vente.source;
    if (vente.notes?.startsWith('Import Telegram')) return 'telegram';
    if (vente.notes?.startsWith('Ajout manuel')) return 'chatteur';
    return 'admin';
  }

  /* ─── Cascading filter: filtered ventes ─── */
  const ventes = useMemo(() => {
    let filtered = allVentes;
    if (activePlatform) filtered = filtered.filter(v => v.plateforme_id === activePlatform);
    if (filterModele) filtered = filtered.filter(v => String(v.modele_id) === String(filterModele));
    if (filterChatteur) filtered = filtered.filter(v => String(v.chatteur_id) === String(filterChatteur));
    return filtered;
  }, [allVentes, activePlatform, filterModele, filterChatteur]);

  /* ─── Cascading filter: dropdown options with counts ─── */
  const modeleOptionsWithCounts = useMemo(() => {
    // Filter models by platform association (modeles_plateformes), then count ventes
    let relevantModeles = modeles;
    if (activePlatform) {
      relevantModeles = modeles.filter(m => m.plateformes?.some(p => p.id === activePlatform));
    }
    let pool = allVentes;
    if (activePlatform) pool = pool.filter(v => v.plateforme_id === activePlatform);
    if (filterChatteur) pool = pool.filter(v => String(v.chatteur_id) === String(filterChatteur));
    const counts = {};
    pool.forEach(v => { if (v.modele_id) counts[v.modele_id] = (counts[v.modele_id] || 0) + 1; });
    return relevantModeles.map(m => ({ ...m, venteCount: counts[m.id] || 0 }));
  }, [allVentes, activePlatform, filterChatteur, modeles]);

  const chatteurOptionsWithCounts = useMemo(() => {
    // Filter chatteurs by those who have shifts on the selected platform
    let pool = allVentes;
    if (activePlatform) pool = pool.filter(v => v.plateforme_id === activePlatform);
    if (filterModele) pool = pool.filter(v => String(v.modele_id) === String(filterModele));
    const counts = {};
    pool.forEach(v => { counts[v.chatteur_id] = (counts[v.chatteur_id] || 0) + 1; });
    let relevantChatteurs = chatteurs;
    if (activePlatform) {
      relevantChatteurs = chatteurs.filter(c => chatteurPlatformMap[c.id]?.has(activePlatform));
    }
    return relevantChatteurs.map(c => ({ ...c, venteCount: counts[c.id] || 0 }));
  }, [allVentes, activePlatform, filterModele, chatteurs, chatteurPlatformMap]);

  /* ─── Source & statut counts + displayed ventes ─── */
  const { sourceCounts, statutCounts } = useMemo(() => {
    const sc = { telegram: 0, chatteur: 0, manager: 0, admin: 0 };
    const stc = { en_attente: 0, 'validée': 0, 'rejetée': 0 };
    ventes.forEach(v => { sc[getSource(v)]++; if (v.statut) stc[v.statut]++; });
    return { sourceCounts: sc, statutCounts: stc };
  }, [ventes]);

  const displayedVentes = useMemo(() => ventes.filter(v => {
    if (sourceFilter !== 'all' && getSource(v) !== sourceFilter) return false;
    if (statutFilter !== 'all' && v.statut !== statutFilter) return false;
    return true;
  }), [ventes, sourceFilter, statutFilter]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [sourceFilter, statutFilter, selectedPeriod, activePlatform, filterChatteur, filterModele]);

  const nbVentes = displayedVentes.length;
  const moyVente = nbVentes > 0 ? (totalVentes / nbVentes) : 0;
  const totalPages = Math.ceil(displayedVentes.length / ITEMS_PER_PAGE);

  /* Sort handler */
  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir(col === 'montant' ? 'desc' : 'asc');
    }
  }

  const sortedVentes = useMemo(() => [...displayedVentes].sort((a, b) => {
    // Pending ventes always on top
    if (a.statut === 'en_attente' && b.statut !== 'en_attente') return -1;
    if (a.statut !== 'en_attente' && b.statut === 'en_attente') return 1;

    if (!sortCol) return 0;

    let cmp = 0;
    switch (sortCol) {
      case 'periode':
        cmp = (a.periode_debut || '').localeCompare(b.periode_debut || '');
        break;
      case 'chatteur': {
        const nameA = getName(chatteurs, a.chatteur_id);
        const nameB = getName(chatteurs, b.chatteur_id);
        cmp = nameA.localeCompare(nameB, 'fr');
        break;
      }
      case 'plateforme':
        cmp = getPlatName(a.plateforme_id).localeCompare(getPlatName(b.plateforme_id), 'fr');
        break;
      case 'montant':
        cmp = (a.montant_brut || 0) - (b.montant_brut || 0);
        break;
      case 'source':
        cmp = (getSource(a)).localeCompare(getSource(b));
        break;
      case 'statut':
        cmp = (a.statut || '').localeCompare(b.statut || '');
        break;
      default:
        cmp = 0;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  }), [displayedVentes, sortCol, sortDir, chatteurs, plateformes]);

  const paginatedVentes = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedVentes.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedVentes, currentPage]);

  /* ─── Render ─── */
  return (
    <div className="page-enter">
      {/* ─── Header ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h1 style={{ fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={22} color="#f5b731" /> Ventes</h1>
          {(() => {
            const pendingCount = ventes.filter(v => v.statut === 'en_attente').length;
            return pendingCount > 0 ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)',
              }}>
                <Clock size={12} /> {pendingCount} en attente
              </span>
            ) : null;
          })()}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Period selector */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn-secondary"
              onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
              aria-expanded={showPeriodDropdown}
              aria-haspopup="listbox"
              aria-label="Sélectionner une période"
              style={{ fontSize: '0.8rem', gap: '0.35rem', padding: '0.5rem 1rem' }}
            >
              <Calendar size={14} />
              {selectedPeriod ? formatPeriodLabel(selectedPeriod.debut, selectedPeriod.fin) : 'Période'}
              <ChevronDown size={14} style={{
                transition: 'transform 200ms ease',
                transform: showPeriodDropdown ? 'rotate(180deg)' : 'rotate(0)',
              }} />
            </button>
            {showPeriodDropdown && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowPeriodDropdown(false)} />
                <div style={{
                  position: 'absolute', top: '100%', marginTop: '0.35rem', right: 0, zIndex: 50,
                  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.12)', minWidth: '220px',
                  animation: 'modalCardIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)', overflow: 'hidden',
                }}>
                  {periods.map((p, i) => {
                    const isActive = selectedPeriod?.debut === p.debut && selectedPeriod?.fin === p.fin;
                    return (
                      <button
                        key={i}
                        onClick={() => selectPeriod(p)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '0.6rem 1rem', border: 'none', cursor: 'pointer', fontSize: '0.82rem',
                          background: isActive ? 'rgba(245,183,49,0.1)' : 'transparent',
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? '#f5b731' : 'var(--text-primary)',
                          borderLeft: isActive ? '3px solid #f5b731' : '3px solid transparent',
                          transition: 'background 150ms',
                        }}
                        className={!isActive ? 'hover-row' : ''}
                      >
                        {formatPeriodLabel(p.debut, p.fin)}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {selectedPeriod && (
            <button className="btn-secondary" style={{ fontSize: '0.8rem' }}
              aria-label="Exporter les ventes en CSV"
              onClick={() => window.open(`/api/ventes/export-csv?periode_debut=${selectedPeriod.debut}&periode_fin=${selectedPeriod.fin}`, '_blank')}>
              <Download size={14} /> CSV
            </button>
          )}

          <button className="btn-primary" onClick={openAddModal}>
            <Plus size={16} /> Nouvelle vente
          </button>
        </div>
      </div>

      {/* ─── Fetch error ─── */}
      {fetchError && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          {fetchError}
          <button onClick={initialFetch} className="btn-ghost" style={{ marginLeft: '1rem', fontSize: '0.8rem' }}>Réessayer</button>
        </div>
      )}

      {/* ─── StatCards ─── */}
      <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <StatCard
          title="Total brut"
          value={`${totalVentes.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`}
          icon={Euro}
          color="#f5b731"
          subtitle={prevSummary ? <DeltaBadge current={totalVentes} previous={prevSummary.total_brut_usd || 0} /> : null}
        />
        <StatCard
          title="Nb ventes"
          value={nbVentes}
          icon={ShoppingBag}
          color="#1b2e4b"
          subtitle={prevSummary ? <DeltaBadge current={nbVentes} previous={prevSummary.nb_ventes || 0} /> : null}
        />
        <StatCard
          title="Moyenne / vente"
          value={`${moyVente.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`}
          icon={BarChart3}
          color="#8b5cf6"
          subtitle={prevSummary ? <DeltaBadge current={moyVente} previous={prevSummary.nb_ventes > 0 ? (prevSummary.total_brut_usd / prevSummary.nb_ventes) : 0} /> : null}
        />
      </div>

      {/* ─── Filter Bar ─── */}
      <div className="card" style={{ padding: '0.6rem 1rem', marginBottom: '1rem' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
        }}>
          <select
            className="input-field"
            value={activePlatform ?? ''}
            onChange={e => selectPlatform(e.target.value ? Number(e.target.value) : null)}
            aria-label="Filtrer par plateforme"
            style={{ width: 'auto', minWidth: '150px', fontSize: '0.8rem' }}
          >
            <option value="">Toutes les plateformes</option>
            {plateformes.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
          <select
            className="input-field"
            value={filterModele}
            onChange={e => changeModele(e.target.value)}
            aria-label="Filtrer par modèle"
            style={{ width: 'auto', minWidth: '150px', fontSize: '0.8rem' }}
          >
            <option value="">Tous les modèles</option>
            {modeleOptionsWithCounts.map(m => <option key={m.id} value={m.id}>{m.pseudo} ({m.venteCount})</option>)}
          </select>
          <select
            className="input-field"
            value={filterChatteur}
            onChange={e => changeChatteur(e.target.value)}
            aria-label="Filtrer par chatteur"
            style={{ width: 'auto', minWidth: '150px', fontSize: '0.8rem' }}
          >
            <option value="">Tous les chatteurs</option>
            {chatteurOptionsWithCounts.map(c => <option key={c.id} value={c.id}>{c.prenom} ({c.venteCount})</option>)}
          </select>
          <select
            className="input-field"
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            aria-label="Filtrer par source"
            style={{ width: 'auto', minWidth: '150px', fontSize: '0.8rem' }}
          >
            <option value="all">Toutes les sources</option>
            <option value="telegram">Telegram ({sourceCounts.telegram})</option>
            <option value="chatteur">Chatteur ({sourceCounts.chatteur})</option>
            <option value="manager">Manager ({sourceCounts.manager})</option>
            <option value="admin">Directeur ({sourceCounts.admin})</option>
          </select>
          <select
            className="input-field"
            value={statutFilter}
            onChange={e => setStatutFilter(e.target.value)}
            aria-label="Filtrer par statut"
            style={{ width: 'auto', minWidth: '150px', fontSize: '0.8rem' }}
          >
            <option value="all">Tous les statuts</option>
            <option value="en_attente">En attente ({statutCounts.en_attente})</option>
            <option value="validée">Validée ({statutCounts['validée']})</option>
            <option value="rejetée">Rejetée ({statutCounts['rejetée']})</option>
          </select>

          {/* Reset button when filters are active */}
          {(sourceFilter !== 'all' || statutFilter !== 'all' || activePlatform !== null || filterModele || filterChatteur) && (
            <button
              onClick={() => { setSourceFilter('all'); setStatutFilter('all'); setActivePlatform(null); setFilterModele(''); setFilterChatteur(''); }}
              className="btn-ghost"
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <RotateCcw size={12} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* ─── Table ─── */}
      {loading ? (
        <div className="card" style={{ padding: 0 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{
              padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.04)',
              display: 'flex', gap: '1rem', alignItems: 'center',
            }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f1f5f9', animation: 'pulse-soft 1.5s ease infinite' }} />
              <div style={{ flex: 1 }}>
                <div style={{ width: '40%', height: 12, borderRadius: 6, background: '#f1f5f9', marginBottom: 6, animation: 'pulse-soft 1.5s ease infinite' }} />
                <div style={{ width: '25%', height: 10, borderRadius: 6, background: '#f1f5f9', animation: 'pulse-soft 1.5s ease infinite' }} />
              </div>
              <div style={{ width: 80, height: 14, borderRadius: 6, background: '#f1f5f9', animation: 'pulse-soft 1.5s ease infinite' }} />
            </div>
          ))}
        </div>
      ) : displayedVentes.length === 0 ? (
        /* Empty state */
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 1rem',
            background: 'rgba(245,183,49,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PackageOpen size={28} color="#f5b731" strokeWidth={1.5} />
          </div>
          <p style={{ fontWeight: 600, color: '#1a1f2e', marginBottom: '0.5rem' }}>Aucune vente</p>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>
            {activePlatform || filterChatteur || sourceFilter !== 'all' || statutFilter !== 'all' ? 'Aucun résultat avec ces filtres.' : 'Commencez par ajouter votre première vente.'}
          </p>
          {!activePlatform && !filterChatteur && sourceFilter === 'all' && statutFilter === 'all' && (
            <button className="btn-primary" onClick={openAddModal}><Plus size={16} /> Ajouter une vente</button>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ minWidth: '1050px' }}>
            <thead>
              <tr>
                <SortableHeader label="Période" field="periode" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Chatteur" field="chatteur" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <th style={{ whiteSpace: 'nowrap' }}>Modèle</th>
                <SortableHeader label="Plateforme" field="plateforme" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <th style={{ whiteSpace: 'nowrap' }}>Shift</th>
                <SortableHeader label="Montant brut" field="montant" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} align="right" />
                <SortableHeader label="Source" field="source" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Statut" field="statut" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
                <th style={{ whiteSpace: 'nowrap' }}>Notes</th>
                <th style={{ width: 180, textAlign: 'center', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="stagger-rows">
              {paginatedVentes.map(v => {
                const devise = getDevise(v.plateforme_id);
                const isRemoving = deletingId === v.id;
                const isPending = v.statut === 'en_attente';
                return (
                  <tr
                    key={v.id}
                    className={!isRemoving ? 'hover-gold-row' : ''}
                    style={{
                      transition: 'all 250ms ease',
                      opacity: isRemoving ? 0 : 1,
                      transform: isRemoving ? 'translateX(30px)' : 'translateX(0)',
                      maxHeight: isRemoving ? 0 : '200px',
                      background: isPending ? 'rgba(245,158,11,0.04)' : undefined,
                      borderLeft: isPending ? '3px solid #f59e0b' : '3px solid transparent',
                    }}
                  >
                    <td style={{ fontSize: '0.82rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                      <div>{formatPeriodLabel(v.periode_debut, v.periode_fin)}</div>
                      {v.created_at && (
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                          Ajoutée le {formatCreatedAt(v.created_at)}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                          background: `${getChatteurColorFromList(v.chatteur_id)}20`,
                          border: `1.5px solid ${getChatteurColorFromList(v.chatteur_id)}50`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.7rem', fontWeight: 700, color: getChatteurColorFromList(v.chatteur_id),
                        }}>
                          {getInitial(chatteurs, v.chatteur_id)}
                        </div>
                        <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{getName(chatteurs, v.chatteur_id)}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{
                        background: v.modele_couleur_fond || '#f1f5f9',
                        color: v.modele_couleur_texte || '#475569',
                        fontWeight: 500, fontSize: '0.8rem',
                      }}>
                        {v.modele_pseudo || '—'}
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{
                        background: getPlatColor(v.plateforme_id),
                        color: getPlatTextColor(v.plateforme_id),
                      }}>
                        {getPlatName(v.plateforme_id)}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {v.shift_date ? (
                        <span>
                          {new Date(v.shift_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          {' — '}{CRENEAUX_LABELS[v.shift_creneau] || '?'}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.95rem', color: '#f5b731', whiteSpace: 'nowrap' }}>
                      {v.montant_brut.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {devise === 'USD' ? '$' : '€'}
                    </td>
                    <td>
                      <SourceBadge source={v.source} />
                    </td>
                    <td>
                      {(() => {
                        const st = STATUT_STYLES[v.statut] || STATUT_STYLES['validée'];
                        return (
                          <span style={{
                            display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '20px',
                            fontSize: '0.75rem', fontWeight: 600,
                            background: st.bg, color: st.color, border: st.border,
                          }}>
                            {st.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: '#94a3b8', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.notes || '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center', alignItems: 'center' }}>
                        {isPending && (
                          <>
                            <button
                              onClick={() => handleValider(v.id, 'validée')}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                                padding: '0.3rem 0.65rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600,
                                background: 'rgba(16,185,129,0.1)', color: '#10b981',
                                border: '1px solid rgba(16,185,129,0.25)', cursor: 'pointer',
                                transition: 'all 150ms',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.2)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.1)'; }}
                            >
                              <Check size={13} /> Valider
                            </button>
                            <button
                              onClick={() => handleValider(v.id, 'rejetée')}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                                padding: '0.3rem 0.65rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600,
                                background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                                border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer',
                                transition: 'all 150ms',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                            >
                              <XCircle size={13} /> Rejeter
                            </button>
                          </>
                        )}
                        <button className="btn-ghost" onClick={() => openEditModal(v)} title="Modifier" style={{ padding: '0.3rem' }}>
                          <Pencil size={15} />
                        </button>
                        <button className="btn-ghost" onClick={() => setDeleteTarget(v)} title="Supprimer" style={{ padding: '0.3rem', color: '#ef4444' }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <Pagination page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      )}

      {/* ─── Add/Edit Modal ─── */}
      {modal && (
        <div
          className="modal-overlay"
          onClick={closeModal}
          style={modalClosing ? { opacity: 0, transition: 'opacity 200ms ease' } : {}}
        >
          <div
            className="modal-card"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 480, width: '100%',
              ...(modalClosing ? { transform: 'scale(0.95)', opacity: 0, transition: 'all 200ms ease' } : {}),
            }}
          >
            {/* Header */}
            <div className="modal-header">
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1b2e4b' }}>
                {modal === 'add' ? 'Nouvelle vente' : 'Modifier la vente'}
              </h2>
              <button className="close-btn" onClick={closeModal}><X size={18} /></button>
            </div>

            {error && <div className="toast-error" style={{ marginBottom: '0.75rem' }}>{error}</div>}

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {/* Chatteur */}
                <div>
                  <label className="label">Chatteur *</label>
                  <select className="input-field" value={form.chatteur_id} onChange={e => {
                    const val = e.target.value;
                    setForm({ ...form, chatteur_id: val, modele_id: '', plateforme_id: '', shift_id: '' });
                    fetchChatteurModeles(val);
                    fetchShiftsForVente(val, '', '', form.date);
                  }} required>
                    <option value="">Sélectionner...</option>
                    {chatteurs.map(c => <option key={c.id} value={c.id}>{c.prenom}</option>)}
                  </select>
                </div>

                {/* Modèle (before Plateforme so we can filter) */}
                <div>
                  <label className="label">Modèle *</label>
                  <select
                    className="input-field"
                    value={form.modele_id}
                    onChange={e => {
                      const newModeleId = e.target.value;
                      // Use chatteurModeles platforms if available, fallback to model's configured platforms
                      const cmModel = chatteurModeles?.find(cm => String(cm.id) === newModeleId);
                      const modelePfs = cmModel?.plateformes || modeles.find(m => String(m.id) === newModeleId)?.plateformes || [];
                      let newPfId = form.plateforme_id;
                      if (modelePfs.length === 1) {
                        newPfId = String(modelePfs[0].id);
                      } else if (newModeleId && modelePfs.length > 0 && !modelePfs.find(p => String(p.id) === form.plateforme_id)) {
                        newPfId = '';
                      }
                      setForm({ ...form, modele_id: newModeleId, plateforme_id: newPfId, shift_id: '' });
                      fetchShiftsForVente(form.chatteur_id, newModeleId, newPfId, form.date);
                    }}
                    required
                  >
                    <option value="">Sélectionner...</option>
                    {(chatteurModeles && form.chatteur_id
                      ? modeles.filter(m => chatteurModeles.some(cm => cm.id === m.id))
                      : modeles
                    ).map(m => <option key={m.id} value={m.id}>{m.pseudo}</option>)}
                  </select>
                  {chatteurModeles && form.chatteur_id && chatteurModeles.length === 0 && (
                    <div style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '0.2rem' }}>
                      Ce chatteur n'a aucun shift assigné
                    </div>
                  )}
                  {chatteurModeles && form.chatteur_id && chatteurModeles.length > 0 && (
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      Filtré par les modèles assignés ({chatteurModeles.length})
                    </div>
                  )}
                </div>

                {/* Plateforme (filtered by chatteur's shifts for selected model) */}
                <div>
                  <label className="label">Plateforme *</label>
                  {(() => {
                    // If we have chatteurModeles data and a model is selected, filter platforms by what the chatteur actually works on
                    const cmModel = chatteurModeles?.find(cm => String(cm.id) === form.modele_id);
                    let availablePfs;
                    if (cmModel?.plateformes?.length > 0) {
                      // Filter to platforms this chatteur has shifts for on this model
                      availablePfs = plateformes.filter(p => cmModel.plateformes.some(cp => cp.id === p.id));
                    } else {
                      // Fallback: filter by model's configured platforms
                      const selectedModele = modeles.find(m => String(m.id) === form.modele_id);
                      availablePfs = selectedModele?.plateformes?.length > 0
                        ? plateformes.filter(p => selectedModele.plateformes.some(mp => mp.id === p.id))
                        : plateformes;
                    }
                    return (
                      <select className="input-field" value={form.plateforme_id} onChange={e => {
                        setForm({ ...form, plateforme_id: e.target.value, shift_id: '' });
                        fetchShiftsForVente(form.chatteur_id, form.modele_id, e.target.value, form.date);
                      }} required>
                        <option value="">Sélectionner...</option>
                        {availablePfs.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                      </select>
                    );
                  })()}
                </div>

                {/* Montant + Date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="label">Montant brut *</label>
                    <input
                      className="input-field"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={form.montant_brut}
                      onChange={e => setForm({ ...form, montant_brut: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Date du rapport *</label>
                    <input
                      className="input-field"
                      type="date"
                      value={form.date}
                      onChange={e => {
                        setForm({ ...form, date: e.target.value, shift_id: '' });
                        if (form.chatteur_id) fetchShiftsForVente(form.chatteur_id, form.modele_id, form.plateforme_id, e.target.value);
                      }}
                      required
                    />
                  </div>
                </div>

                {/* Period badge */}
                {periodeCalc && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    fontSize: '0.75rem', color: '#64748b', background: 'rgba(0,0,0,0.03)',
                    padding: '0.3rem 0.75rem', borderRadius: '20px', width: 'fit-content',
                  }}>
                    <Calendar size={12} />
                    Période : {formatPeriodLabel(periodeCalc.debut, periodeCalc.fin)}
                  </div>
                )}

                {/* Shift (optional for admin) */}
                {form.chatteur_id && (
                  <div>
                    <label className="label">Shift *</label>
                    <select className="input-field" value={form.shift_id} onChange={e => setForm({ ...form, shift_id: e.target.value })} required>
                      <option value="">S&eacute;lectionner le shift...</option>
                      {availableShifts.map(s => {
                        const shiftDate = new Date(s.date + 'T00:00:00');
                        const refDate = form.date ? new Date(form.date + 'T00:00:00') : new Date();
                        const diffDays = Math.round((shiftDate - refDate) / (1000 * 60 * 60 * 24));
                        const proximity = diffDays === 0 ? '\u2B50' : Math.abs(diffDays) <= 1 ? '\u2705' : '';
                        return (
                          <option key={s.id} value={s.id}>
                            {proximity}{proximity ? ' ' : ''}{shiftDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} — {CRENEAUX_LABELS[s.creneau] || '?'}
                            {s.modele_pseudo ? ` (${s.modele_pseudo})` : ''}
                            {s.plateforme_nom ? ` [${s.plateforme_nom}]` : ''}
                          </option>
                        );
                      })}
                    </select>
                    {availableShifts.length > 0 && (
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        {availableShifts.length} shift{availableShifts.length > 1 ? 's' : ''} trouv&eacute;{availableShifts.length > 1 ? 's' : ''} {'(\u2B50 = m\u00eame jour)'}
                      </div>
                    )}
                    {form.chatteur_id && availableShifts.length === 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.3rem', padding: '0.4rem 0.6rem', background: 'rgba(245,158,11,0.08)', borderRadius: '0.3rem', border: '1px solid rgba(245,158,11,0.2)' }}>
                        Aucun shift trouv&eacute; autour de cette date. V&eacute;rifiez le planning ou changez la date du rapport.
                      </div>
                    )}
                  </div>
                )}

                {/* Notes (optional) */}
                <div>
                  <label className="label">Notes <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optionnel)</span></label>
                  <textarea
                    className="input-field"
                    rows={2}
                    placeholder="Notes..."
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={closeModal}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={submitting || (form.chatteur_id && availableShifts.length === 0)}>
                  {submitting ? (
                    <span className="spinner" style={{ width: 16, height: 16 }} />
                  ) : (
                    <>{modal === 'add' ? <><Plus size={16} /> Ajouter</> : <><Pencil size={16} /> Modifier</>}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div
            className="modal-card"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: '50%', margin: '0 auto 1rem',
              background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Trash2 size={24} color="#ef4444" strokeWidth={1.5} />
            </div>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem' }}>Supprimer cette vente ?</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
              {deleteTarget.montant_brut.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {getDevise(deleteTarget.plateforme_id) === 'USD' ? '$' : '€'}
              {' — '}{getName(chatteurs, deleteTarget.chatteur_id)}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Annuler</button>
              <button className="btn-danger" onClick={confirmDelete}>
                <Trash2 size={15} /> Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
