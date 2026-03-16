import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import StatCard from '../../components/StatCard.jsx';
import { CardSkeleton } from '../../components/Skeleton.jsx';
import {
  Plus, TrendingUp, ShoppingBag, BarChart3, X, Pencil, Trash2,
  ChevronDown, Lock, Bot, User, Shield, AlertTriangle, Calendar, Clock, CheckCircle, XCircle,
  RotateCcw
} from 'lucide-react';
import Pagination, { ITEMS_PER_PAGE } from '../../components/Pagination.jsx';
import { useToast } from '../../components/Toast.jsx';

/* ─── Period helpers ─── */
function getPeriodeCourante() {
  const now = new Date();
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0');
  const day = now.getDate();
  if (day < 15) return { debut: `${y}-${m}-01`, fin: `${y}-${m}-15` };
  const next = new Date(y, now.getMonth() + 1, 1);
  const ny = next.getFullYear(), nm = String(next.getMonth() + 1).padStart(2, '0');
  return { debut: `${y}-${m}-15`, fin: `${ny}-${nm}-01` };
}

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

function formatPeriod(debut, fin) {
  const d = new Date(debut + 'T00:00:00');
  const f = new Date(fin + 'T00:00:00');
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} \u2192 ${f.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

function formatPeriodShort(debut, fin) {
  const d = new Date(debut + 'T00:00:00');
  const f = new Date(fin + 'T00:00:00');
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} \u2192 ${f.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}

function formatCreatedAt(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
    ` ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

const today = (() => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
})();

const CRENEAUX_LABELS = { 1: '08h-14h', 2: '14h-20h', 3: '20h-02h', 4: '02h-08h' };

const EMPTY_FORM = { modele_id: '', plateforme_id: '', montant_brut: '', date: today, notes: '', shift_id: '' };

function getSource(vente) {
  if (vente.source) return vente.source;
  if (vente.notes?.startsWith('Import Telegram')) return 'telegram';
  if (vente.notes?.startsWith('Ajout manuel')) return 'chatteur';
  return 'admin';
}

/* ═══════════════════════════════════════════════ */
export default function MesVentes() {
  const { user } = useAuth();
  const toast = useToast();
  const [ventes, setVentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  /* Period selection */
  const [periode, setPeriode] = useState(getPeriodeCourante);
  const [periods, setPeriods] = useState([]);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [periodLocked, setPeriodLocked] = useState(false);

  /* Chatteur's assigned models */
  const [chatteurModeles, setChatteurModeles] = useState([]);
  const [plateformes, setPlateformes] = useState([]);

  /* Modal */
  const [modal, setModal] = useState(null); // null | 'add' | { ...vente }
  const [form, setForm] = useState(EMPTY_FORM);
  const [modalClosing, setModalClosing] = useState(false);

  /* Shifts for vente */
  const [availableShifts, setAvailableShifts] = useState([]);

  /* Delete confirmation */
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  /* Filters */
  const [plateformeFilter, setPlateformeFilter] = useState('all'); // 'all' | plateforme_id
  const [sourceFilter, setSourceFilter] = useState('all'); // 'all' | 'telegram' | 'chatteur' | 'manager' | 'admin'
  const [statutFilter, setStatutFilter] = useState('all'); // 'all' | 'en_attente' | 'validée' | 'rejetée'
  const [currentPage, setCurrentPage] = useState(1);

  /* Exchange rate for EUR conversion */
  const [tauxChange, setTauxChange] = useState(0.92); // fallback

  /* Feedback */
  const [error, setError] = useState('');
  const [fetchError, setFetchError] = useState('');

  /* ─── Fetch data ─── */
  const fetchVentes = useCallback(async (p) => {
    const per = p || periode;
    try {
      setFetchError('');
      const params = new URLSearchParams({ periode_debut: per.debut, periode_fin: per.fin });
      const [{ data: ventesData }, { data: statusData }] = await Promise.all([
        api.get(`/api/ventes?${params}`),
        api.get(`/api/ventes/periode-status?${params}`),
      ]);
      setVentes(ventesData);
      setPeriodLocked(statusData.locked);
    } catch { setFetchError('Impossible de charger les ventes.'); }
  }, [periode]);

  const fetchModeles = useCallback(async () => {
    if (!user?.chatteur_id) return;
    try {
      const [{ data: modData }, { data: pfData }] = await Promise.all([
        api.get(`/api/shifts/chatteur-modeles/${user.chatteur_id}`),
        api.get('/api/plateformes'),
      ]);
      setChatteurModeles(modData);
      setPlateformes(pfData.filter(p => p.actif !== 0));
    } catch { /* silent */ }
  }, [user?.chatteur_id]);

  const fetchPeriods = useCallback(async () => {
    try {
      const APP_START_DATE = '2026-03-01';
      const { data } = await api.get(`/api/ventes/summary?periode_debut=${periode.debut}&periode_fin=${periode.fin}`);
      if (data.taux_change) setTauxChange(data.taux_change);
      // Build periods from current + past months (no earlier than app launch)
      const ps = [];
      const now = new Date();
      for (let i = 0; i < 24; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        d.setMonth(d.getMonth() - Math.floor(i / 2));
        const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
        let debut, fin;
        if (i % 2 === 0) {
          // Second half (15→next-01)
          const next = new Date(y, d.getMonth() + 1, 1);
          debut = `${y}-${m}-15`;
          fin = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
        } else {
          // First half (01→15)
          debut = `${y}-${m}-01`;
          fin = `${y}-${m}-15`;
        }
        if (debut < APP_START_DATE) break;
        ps.push({ debut, fin });
      }
      // Deduplicate
      const seen = new Set();
      const unique = ps.filter(p => {
        const key = `${p.debut}-${p.fin}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setPeriods(unique);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    Promise.all([fetchVentes(), fetchModeles(), fetchPeriods()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchVentes();
  }, [periode]);

  /* ─── Filtered ventes ─── */
  const filteredVentes = useMemo(() => ventes.filter(v => {
    if (plateformeFilter !== 'all' && v.plateforme_id !== Number(plateformeFilter)) return false;
    if (sourceFilter !== 'all' && getSource(v) !== sourceFilter) return false;
    if (statutFilter !== 'all' && v.statut !== statutFilter) return false;
    return true;
  }), [ventes, plateformeFilter, sourceFilter, statutFilter]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [plateformeFilter, sourceFilter, statutFilter, periode]);

  const totalPages = Math.ceil(filteredVentes.length / ITEMS_PER_PAGE);
  const paginatedVentes = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredVentes.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredVentes, currentPage]);

  /* ─── Stats (based on filtered, converted to EUR) ─── */
  const { totalEur, nbVentes, moyenneEur } = useMemo(() => {
    const total = filteredVentes.reduce((s, v) => {
      const eur = v.devise === 'USD' ? v.montant_brut * tauxChange : v.montant_brut;
      return s + eur;
    }, 0);
    const nb = filteredVentes.length;
    return { totalEur: total, nbVentes: nb, moyenneEur: nb > 0 ? total / nb : 0 };
  }, [filteredVentes, tauxChange]);

  /* ─── Source, statut & plateforme counts ─── */
  const { sourceCounts, statutCounts, plateformeCounts } = useMemo(() => {
    const sc = { telegram: 0, chatteur: 0, manager: 0, admin: 0 };
    const stc = { en_attente: 0, 'validée': 0, 'rejetée': 0 };
    const pc = {};
    ventes.forEach(v => {
      sc[getSource(v)]++;
      if (v.statut) stc[v.statut]++;
      pc[v.plateforme_id] = (pc[v.plateforme_id] || 0) + 1;
    });
    return { sourceCounts: sc, statutCounts: stc, plateformeCounts: pc };
  }, [ventes]);

  /* ─── Fetch shifts for vente ─── */
  async function fetchShiftsForVente(modeleId, plateformeId) {
    try {
      const params = new URLSearchParams({ days: '14' });
      if (modeleId) params.append('modele_id', modeleId);
      if (plateformeId) params.append('plateforme_id', plateformeId);
      const { data } = await api.get(`/api/shifts/for-vente?${params}`);
      setAvailableShifts(data);
    } catch { setAvailableShifts([]); }
  }

  /* ─── Modal helpers ─── */
  function openAddModal() {
    setForm(EMPTY_FORM);
    setAvailableShifts([]);
    setError('');
    setModal('add');
    fetchShiftsForVente('', '');
  }

  function openEditModal(vente) {
    setForm({
      modele_id: vente.modele_id ? String(vente.modele_id) : '',
      plateforme_id: String(vente.plateforme_id),
      montant_brut: String(vente.montant_brut),
      date: vente.periode_debut || today,
      notes: vente.notes || '',
      shift_id: vente.shift_id ? String(vente.shift_id) : '',
    });
    setError('');
    fetchShiftsForVente(vente.modele_id, vente.plateforme_id);
    setModal(vente);
  }

  function closeModal() {
    setModalClosing(true);
    setTimeout(() => { setModal(null); setModalClosing(false); setError(''); }, 200);
  }

  /* ─── Submit add/edit ─── */
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.modele_id) { setError('Modèle requis'); return; }
    if (!form.plateforme_id) { setError('Plateforme requise'); return; }
    if (!form.montant_brut || isNaN(Number(form.montant_brut)) || Number(form.montant_brut) <= 0) {
      setError('Le montant doit être un nombre positif'); return;
    }
    if (!form.date) { setError('Date requise'); return; }
    if (!form.shift_id) { setError('Shift requis — sélectionne le shift correspondant'); return; }

    setSubmitting(true);
    try {
      const payload = {
        plateforme_id: Number(form.plateforme_id),
        montant_brut: parseFloat(form.montant_brut),
        date: form.date,
        modele_id: form.modele_id ? Number(form.modele_id) : null,
        notes: form.notes || null,
        shift_id: Number(form.shift_id),
      };

      if (modal === 'add') {
        await api.post('/api/ventes/mes-ventes', payload);
        toast.success('Vente ajoutée !');
      } else {
        await api.put(`/api/ventes/mes-ventes/${modal.id}`, payload);
        toast.success('Vente modifiée !');
      }

      closeModal();
      // Refresh with the period matching the form date
      const newPeriode = getPeriode(form.date);
      setPeriode(newPeriode);
      await fetchVentes(newPeriode);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setSubmitting(false);
    }
  }

  /* ─── Delete ─── */
  async function handleDelete(id) {
    setDeletingId(id);
    try {
      await api.delete(`/api/ventes/mes-ventes/${id}`);
      toast.success('Vente supprimée');
      setDeleteTarget(null);
      await fetchVentes();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  }

  /* ─── Platform options filtered by selected model ─── */
  function getAvailablePlateformes() {
    if (!form.modele_id) return plateformes;
    const cmModel = chatteurModeles.find(cm => String(cm.id) === form.modele_id);
    if (cmModel?.plateformes?.length > 0) {
      return plateformes.filter(p => cmModel.plateformes.some(cp => cp.id === p.id));
    }
    return plateformes;
  }

  /* ─── Source badge ─── */
  const SOURCE_CONFIG = {
    telegram: { label: 'Telegram', icon: Bot, color: '#059669', bg: 'rgba(16,185,129,0.1)' },
    chatteur: { label: 'Chatteur', icon: User, color: '#1e40af', bg: '#dbeafe' },
    manager:  { label: 'Manager', icon: Shield, color: '#b45309', bg: '#fef3c7' },
    admin:    { label: 'Directeur', icon: Shield, color: '#6366f1', bg: '#ede9fe' },
  };

  if (loading) return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <CardSkeleton /><CardSkeleton /><CardSkeleton />
      </div>
    </div>
  );

  return (
    <div style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1b2e4b', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={22} color="#f5b731" /> Mes Ventes</h1>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.25rem 0 0' }}>
            Ajoute et gère tes ventes pour chaque période
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Period selector */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
            >
              <Calendar size={14} />
              {formatPeriodShort(periode.debut, periode.fin)}
              <ChevronDown size={14} style={{ transition: 'transform 200ms', transform: showPeriodDropdown ? 'rotate(180deg)' : 'none' }} />
            </button>
            {showPeriodDropdown && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowPeriodDropdown(false)} />
                <div style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: '0.35rem',
                  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                  borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                  zIndex: 50, minWidth: '220px', overflow: 'hidden',
                  animation: 'modalCardIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  maxHeight: 300, overflowY: 'auto',
                }}>
                  {periods.map((p, i) => {
                    const isActive = p.debut === periode.debut && p.fin === periode.fin;
                    return (
                      <button
                        key={i}
                        onClick={() => { setPeriode(p); setShowPeriodDropdown(false); }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '0.6rem 1rem', border: 'none', cursor: 'pointer',
                          background: isActive ? 'rgba(245,183,49,0.1)' : 'transparent',
                          color: isActive ? '#f5b731' : 'var(--text-primary)',
                          fontWeight: isActive ? 600 : 400, fontSize: '0.8rem',
                          borderLeft: isActive ? '3px solid #f5b731' : '3px solid transparent',
                          transition: 'background 150ms',
                        }}
                        className={!isActive ? 'hover-row' : ''}
                      >
                        {formatPeriodShort(p.debut, p.fin)}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Action buttons */}
          {!periodLocked && (
            <button onClick={openAddModal} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
              <Plus size={16} /> Ajouter
            </button>
          )}
        </div>
      </div>

      {/* Locked period warning */}
      {periodLocked && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
          background: 'rgba(245,183,49,0.08)', border: '1px solid rgba(245,183,49,0.25)',
          borderRadius: 12, marginBottom: '1rem', fontSize: '0.8rem', color: '#92400e',
        }}>
          <Lock size={16} />
          Cette période est validée — les modifications ne sont plus possibles.
        </div>
      )}

      {/* Fetch error */}
      {fetchError && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          {fetchError}
          <button onClick={() => fetchVentes()} className="btn-ghost" style={{ marginLeft: '1rem', fontSize: '0.8rem' }}>Réessayer</button>
        </div>
      )}

      {/* ─── Filter Bar ─── */}
      {ventes.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
          padding: '0.6rem 0.85rem', marginBottom: '1rem',
          background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
        }}>
          {plateformes.length > 1 && (
            <select
              className="input-field"
              value={plateformeFilter}
              onChange={e => setPlateformeFilter(e.target.value)}
              style={{ width: 'auto', minWidth: '150px', fontSize: '0.8rem' }}
            >
              <option value="all">Toutes les plateformes</option>
              {plateformes.map(p => <option key={p.id} value={String(p.id)}>{p.nom} ({plateformeCounts[p.id] || 0})</option>)}
            </select>
          )}
          <select
            className="input-field"
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
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
            style={{ width: 'auto', minWidth: '150px', fontSize: '0.8rem' }}
          >
            <option value="all">Tous les statuts</option>
            <option value="en_attente">En attente ({statutCounts.en_attente})</option>
            <option value="validée">Validée ({statutCounts['validée']})</option>
            <option value="rejetée">Rejetée ({statutCounts['rejetée']})</option>
          </select>

          {/* Reset button when filters are active */}
          {(plateformeFilter !== 'all' || sourceFilter !== 'all' || statutFilter !== 'all') && (
            <button
              onClick={() => { setPlateformeFilter('all'); setSourceFilter('all'); setStatutFilter('all'); }}
              className="btn-ghost"
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <RotateCcw size={12} /> Reset
            </button>
          )}
        </div>
      )}

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <StatCard icon={TrendingUp} title="Total brut" value={`${totalEur.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`} color="#1b2e4b" />
        <StatCard icon={ShoppingBag} title="Nombre de ventes" value={nbVentes} color="#f5b731" />
        <StatCard icon={BarChart3} title="Moyenne / vente" value={`${moyenneEur.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`} color="#10b981" />
      </div>

      {/* Ventes list */}
      {filteredVentes.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem 1rem', background: '#fff',
          borderRadius: 16, border: '1px solid #e2e8f0',
        }}>
          <ShoppingBag size={40} color="#cbd5e1" style={{ marginBottom: '0.75rem' }} />
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
            {sourceFilter !== 'all' || statutFilter !== 'all' ? 'Aucun résultat avec ces filtres pour cette période' : 'Aucune vente pour cette période'}
          </p>
          {!periodLocked && sourceFilter === 'all' && statutFilter === 'all' && (
            <button onClick={openAddModal} className="btn-primary" style={{ marginTop: '1rem', fontSize: '0.8rem' }}>
              <Plus size={14} style={{ marginRight: 4 }} /> Ajouter ma première vente
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {paginatedVentes.map(v => {
            const source = getSource(v);
            return (
              <div
                key={v.id}
                style={{
                  background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0',
                  padding: '0.875rem 1rem', display: 'flex', alignItems: 'center',
                  gap: '0.75rem', flexWrap: 'wrap',
                }}
              >
                {/* Model badge */}
                <div style={{
                  padding: '0.25rem 0.6rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600,
                  background: v.modele_couleur_fond || '#f1f5f9',
                  color: v.modele_couleur_texte || '#475569',
                  whiteSpace: 'nowrap',
                }}>
                  {v.modele_pseudo || 'Sans modèle'}
                </div>

                {/* Platform badge */}
                <div style={{
                  padding: '0.2rem 0.5rem', borderRadius: 6, fontSize: '0.65rem', fontWeight: 600,
                  background: v.plateforme_couleur_fond || '#e2e8f0',
                  color: v.plateforme_couleur_texte || '#475569',
                }}>
                  {v.plateforme_nom}
                </div>

                {/* Amount */}
                <div style={{ flex: 1, textAlign: 'right', fontWeight: 700, fontSize: '0.95rem', color: '#1b2e4b' }}>
                  {v.montant_brut.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {v.devise === 'USD' ? '$' : '\u20ac'}
                </div>

                {/* Source badge */}
                {(() => {
                  const cfg = SOURCE_CONFIG[source] || SOURCE_CONFIG.admin;
                  const Icon = cfg.icon;
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.25rem',
                      padding: '0.15rem 0.5rem', borderRadius: 6, fontSize: '0.6rem', fontWeight: 600,
                      background: cfg.bg, color: cfg.color,
                    }}>
                      <Icon size={10} /> {cfg.label}
                    </div>
                  );
                })()}

                {/* Statut badge */}
                {v.statut && v.statut !== 'validée' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.2rem',
                    padding: '0.15rem 0.4rem', borderRadius: 6, fontSize: '0.6rem', fontWeight: 600,
                    background: v.statut === 'en_attente' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                    color: v.statut === 'en_attente' ? '#f59e0b' : '#ef4444',
                  }}>
                    {v.statut === 'en_attente' ? <Clock size={10} /> : <XCircle size={10} />}
                    {v.statut === 'en_attente' ? 'En attente' : 'Rejetée'}
                  </div>
                )}

                {/* Date */}
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', minWidth: 70 }}>
                  {formatCreatedAt(v.created_at)}
                </div>

                {/* Actions */}
                {!periodLocked && (
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      onClick={() => openEditModal(v)}
                      className="btn-ghost"
                      style={{ padding: '0.3rem' }}
                      title="Modifier"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(v)}
                      className="btn-ghost"
                      style={{ padding: '0.3rem', color: '#ef4444' }}
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

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
              maxWidth: 440, width: '100%',
              ...(modalClosing ? { transform: 'scale(0.95)', opacity: 0, transition: 'all 200ms ease' } : {}),
            }}
          >
            <div className="modal-header">
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1b2e4b' }}>
                {modal === 'add' ? 'Nouvelle vente' : 'Modifier la vente'}
              </h2>
              <button className="close-btn" onClick={closeModal}><X size={18} /></button>
            </div>

            {error && <div className="toast-error" style={{ marginBottom: '0.75rem' }}>{error}</div>}

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {/* Modèle */}
                <div>
                  <label className="label">Modèle *</label>
                  <select
                    className="input-field"
                    value={form.modele_id}
                    required
                    onChange={e => {
                      const newModeleId = e.target.value;
                      const cmModel = chatteurModeles.find(cm => String(cm.id) === newModeleId);
                      const modelePfs = cmModel?.plateformes || [];
                      let newPfId = form.plateforme_id;
                      if (modelePfs.length === 1) {
                        newPfId = String(modelePfs[0].id);
                      } else if (newModeleId && modelePfs.length > 0 && !modelePfs.find(p => String(p.id) === form.plateforme_id)) {
                        newPfId = '';
                      }
                      setForm({ ...form, modele_id: newModeleId, plateforme_id: newPfId, shift_id: '' });
                      fetchShiftsForVente(newModeleId, newPfId);
                    }}
                  >
                    <option value="">Sélectionner...</option>
                    {chatteurModeles.map(m => (
                      <option key={m.id} value={m.id}>{m.pseudo}</option>
                    ))}
                  </select>
                  {chatteurModeles.length === 0 && (
                    <div style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '0.2rem' }}>
                      Aucun shift assigné — contacte ton manager
                    </div>
                  )}
                </div>

                {/* Plateforme */}
                <div>
                  <label className="label">Plateforme *</label>
                  <select
                    className="input-field"
                    value={form.plateforme_id}
                    onChange={e => {
                      setForm({ ...form, plateforme_id: e.target.value, shift_id: '' });
                      fetchShiftsForVente(form.modele_id, e.target.value);
                    }}
                    required
                  >
                    <option value="">Sélectionner...</option>
                    {getAvailablePlateformes().map(p => (
                      <option key={p.id} value={p.id}>{p.nom}</option>
                    ))}
                  </select>
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
                    <label className="label">Date *</label>
                    <input
                      className="input-field"
                      type="date"
                      value={form.date}
                      onChange={e => setForm({ ...form, date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Period preview */}
                {form.date && (
                  <div style={{
                    fontSize: '0.7rem', color: '#64748b', background: '#f8fafc',
                    padding: '0.4rem 0.6rem', borderRadius: 8,
                  }}>
                    Période : {formatPeriod(getPeriode(form.date).debut, getPeriode(form.date).fin)}
                  </div>
                )}

                {/* Shift (required) */}
                <div>
                  <label className="label">Shift *</label>
                  <select
                    className="input-field"
                    value={form.shift_id}
                    onChange={e => setForm({ ...form, shift_id: e.target.value })}
                    required
                  >
                    <option value="">Sélectionner le shift...</option>
                    {availableShifts.map(s => (
                      <option key={s.id} value={s.id}>
                        {new Date(s.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} — {CRENEAUX_LABELS[s.creneau] || '?'}
                        {s.modele_pseudo ? ` (${s.modele_pseudo})` : ''}
                      </option>
                    ))}
                  </select>
                  {availableShifts.length === 0 && (
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                      Aucun shift trouvé (14 derniers jours)
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="label">Notes</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    placeholder="Notes optionnelles..."
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={closeModal}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Enregistrement...' : (modal === 'add' ? 'Ajouter' : 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1b2e4b' }}>Supprimer cette vente ?</h2>
              <button className="close-btn" onClick={() => setDeleteTarget(null)}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.5rem 0 1rem' }}>
              Vente de <strong>{deleteTarget.montant_brut.toLocaleString('fr-FR')} {deleteTarget.devise === 'USD' ? '$' : '\u20ac'}</strong>
              {deleteTarget.modele_pseudo && <> — {deleteTarget.modele_pseudo}</>}
              {deleteTarget.plateforme_nom && <> ({deleteTarget.plateforme_nom})</>}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Annuler</button>
              <button
                className="btn-primary"
                style={{ background: '#ef4444' }}
                onClick={() => handleDelete(deleteTarget.id)}
                disabled={deletingId === deleteTarget.id}
              >
                {deletingId === deleteTarget.id ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
