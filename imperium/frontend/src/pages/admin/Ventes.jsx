import { useState, useEffect, useCallback } from 'react';
import api from '../../api/index';
import StatCard from '../../components/StatCard.jsx';
import {
  Plus, Euro, ShoppingBag, Trophy, BarChart3, X, Pencil, Trash2,
  ChevronDown, PackageOpen, Calendar, Download
} from 'lucide-react';

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

const EMPTY_FORM = { chatteur_id: '', modele_id: '', plateforme_id: '', montant_brut: '', date: today, notes: '' };

/* ─────────────────────────────────────────── */
export default function Ventes() {
  const [ventes, setVentes] = useState([]);
  const [chatteurs, setChatteurs] = useState([]);
  const [modeles, setModeles] = useState([]);
  const [plateformes, setPlateformes] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  /* Filters */
  const [activePlatform, setActivePlatform] = useState(null);
  const [filterChatteur, setFilterChatteur] = useState('');
  const [filterModele, setFilterModele] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  /* Modal */
  const [modal, setModal] = useState(null);       // null | 'add' | { ...vente }
  const [form, setForm] = useState(EMPTY_FORM);
  const [modalClosing, setModalClosing] = useState(false);

  /* Delete confirmation */
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  /* Feedback */
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /* ─── Data fetching ─── */
  const fetchVentes = useCallback(async (period, platId, chattId, modId) => {
    const params = new URLSearchParams();
    const p = period || selectedPeriod;
    if (p) {
      params.append('periode_debut', p.debut);
      params.append('periode_fin', p.fin);
    }
    if (chattId || filterChatteur) params.append('chatteur_id', chattId || filterChatteur);
    const { data } = await api.get(`/api/ventes?${params}`);

    // Client-side filters (platform + modele)
    const plat = platId !== undefined ? platId : activePlatform;
    const mod = modId !== undefined ? modId : filterModele;
    let filtered = data;
    if (plat) filtered = filtered.filter(v => v.plateforme_id === plat);
    if (mod) filtered = filtered.filter(v => String(v.modele_id) === String(mod));
    setVentes(filtered);

    // Also keep unfiltered for stats if needed
    return data;
  }, [selectedPeriod, filterChatteur, activePlatform, filterModele]);

  const fetchSummary = useCallback(async (period) => {
    const p = period || selectedPeriod;
    const params = p ? `?periode_debut=${p.debut}&periode_fin=${p.fin}` : '';
    try {
      const { data } = await api.get(`/api/ventes/summary${params}`);
      setSummary(data);
    } catch { /* ignore */ }
  }, [selectedPeriod]);

  useEffect(() => {
    (async () => {
      try {
        const [, c, m, p, dash] = await Promise.all([
          fetchVentes(),
          api.get('/api/chatteurs'),
          api.get('/api/modeles'),
          api.get('/api/plateformes'),
          api.get('/api/dashboard'),
        ]);
        setChatteurs(c.data);
        setModeles(m.data);
        setPlateformes(p.data);
        if (dash.data.periodes) setPeriods(dash.data.periodes);
        if (dash.data.periode) setSelectedPeriod(dash.data.periode);
        await fetchSummary();
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function refresh(period, platId, chattId, modId) {
    await Promise.all([fetchVentes(period, platId, chattId, modId), fetchSummary(period)]);
  }

  /* ─── Period selection ─── */
  function selectPeriod(p) {
    setSelectedPeriod(p);
    setShowPeriodDropdown(false);
    refresh(p);
  }

  /* ─── Platform tabs ─── */
  function selectPlatform(id) {
    setActivePlatform(id);
    refresh(undefined, id);
  }

  /* ─── Chatteur filter ─── */
  function changeChatteur(val) {
    setFilterChatteur(val);
    refresh(undefined, undefined, val);
  }

  /* ─── Modal open/close ─── */
  function openAddModal() {
    setForm(EMPTY_FORM);
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
    });
    setError('');
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
      };

      if (modal === 'add') {
        await api.post('/api/ventes', payload);
        setSuccess('Vente ajoutée avec succès');
      } else {
        await api.put(`/api/ventes/${modal.id}`, payload);
        setSuccess('Vente modifiée avec succès');
      }

      closeModal();
      setTimeout(() => setSuccess(''), 3000);
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
      setSuccess('Vente supprimée');
      setTimeout(() => setSuccess(''), 3000);
      await refresh();
    }, 300);
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
  const nbVentes = ventes.length;
  const topChatteur = summary?.top_chatteur
    ? summary.top_chatteur.prenom
    : '—';
  const moyVente = nbVentes > 0 ? (totalVentes / nbVentes) : 0;

  /* Colors for initials */
  const INIT_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#6366f1'];
  const getColor = id => INIT_COLORS[(id || 0) % INIT_COLORS.length];

  /* ─── Render ─── */
  return (
    <div className="page-enter">
      {/* ─── Toast ─── */}
      {success && (
        <div className="toast-success" style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 100,
          animation: 'slideUp 0.3s ease',
        }}>{success}</div>
      )}

      {/* ─── Header ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <h1 style={{ fontWeight: 700, margin: 0 }}>Ventes</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Period selector */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn-secondary"
              onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
              style={{ fontSize: '0.8rem', gap: '0.35rem' }}
            >
              <Calendar size={14} />
              {selectedPeriod ? formatPeriodLabel(selectedPeriod.debut, selectedPeriod.fin) : 'Période'}
              <ChevronDown size={14} style={{
                transition: 'transform 200ms ease',
                transform: showPeriodDropdown ? 'rotate(180deg)' : 'rotate(0)',
              }} />
            </button>
            {showPeriodDropdown && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 30,
                background: '#fff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.12)', minWidth: '200px',
                animation: 'slideUp 0.2s ease', overflow: 'hidden',
              }}>
                {periods.map((p, i) => (
                  <div
                    key={i}
                    onClick={() => selectPeriod(p)}
                    style={{
                      padding: '0.6rem 1rem', cursor: 'pointer', fontSize: '0.82rem',
                      background: selectedPeriod?.debut === p.debut ? 'rgba(245,183,49,0.1)' : 'transparent',
                      fontWeight: selectedPeriod?.debut === p.debut ? 600 : 400,
                      color: selectedPeriod?.debut === p.debut ? '#b8860b' : '#1a1f2e',
                      transition: 'background 150ms ease',
                    }}
                    className={selectedPeriod?.debut !== p.debut ? 'hover-row' : ''}
                  >
                    {formatPeriodLabel(p.debut, p.fin)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedPeriod && (
            <button className="btn-secondary" style={{ fontSize: '0.8rem' }}
              onClick={() => window.open(`/api/ventes/export-csv?periode_debut=${selectedPeriod.debut}&periode_fin=${selectedPeriod.fin}`, '_blank')}>
              <Download size={14} /> CSV
            </button>
          )}

          <button className="btn-primary" onClick={openAddModal}>
            <Plus size={16} /> Nouvelle vente
          </button>
        </div>
      </div>

      {/* ─── StatCards ─── */}
      <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <StatCard
          title="Total brut"
          value={`${totalVentes.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`}
          icon={Euro}
          color="#f5b731"
        />
        <StatCard
          title="Nb ventes"
          value={nbVentes}
          icon={ShoppingBag}
          color="#1b2e4b"
        />
        <StatCard
          title="Top chatteur"
          value={topChatteur}
          icon={Trophy}
          color="#10b981"
        />
        <StatCard
          title="Moyenne / vente"
          value={`${moyVente.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`}
          icon={BarChart3}
          color="#8b5cf6"
        />
      </div>

      {/* ─── Filter bar ─── */}
      <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        {/* Platform tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(0,0,0,0.04)', borderRadius: '10px', padding: '3px' }}>
          {[{ id: null, label: 'Toutes' }, ...plateformes.map(p => ({ id: p.id, label: p.nom }))].map(tab => (
            <button
              key={tab.id ?? 'all'}
              onClick={() => selectPlatform(tab.id)}
              style={{
                padding: '0.35rem 0.85rem', borderRadius: '8px', border: 'none',
                fontSize: '0.8rem', fontWeight: activePlatform === tab.id ? 600 : 400,
                cursor: 'pointer',
                background: activePlatform === tab.id ? '#fff' : 'transparent',
                color: activePlatform === tab.id ? '#1b2e4b' : '#64748b',
                boxShadow: activePlatform === tab.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 200ms ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right filters */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Modele filter */}
          <select
            className="input-field"
            value={filterModele}
            onChange={e => { setFilterModele(e.target.value); refresh(undefined, undefined, undefined, e.target.value); }}
            style={{ width: 'auto', minWidth: '160px', fontSize: '0.8rem' }}
          >
            <option value="">Tous les modèles</option>
            {modeles.map(m => <option key={m.id} value={m.id}>{m.pseudo}</option>)}
          </select>

          {/* Chatteur filter */}
          <select
            className="input-field"
            value={filterChatteur}
            onChange={e => changeChatteur(e.target.value)}
            style={{ width: 'auto', minWidth: '160px', fontSize: '0.8rem' }}
          >
            <option value="">Tous les chatteurs</option>
            {chatteurs.map(c => <option key={c.id} value={c.id}>{c.prenom}</option>)}
          </select>
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
      ) : ventes.length === 0 ? (
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
            {activePlatform || filterChatteur ? 'Aucun résultat avec ces filtres.' : 'Commencez par ajouter votre première vente.'}
          </p>
          {!activePlatform && !filterChatteur && (
            <button className="btn-primary" onClick={openAddModal}><Plus size={16} /> Ajouter une vente</button>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Période</th>
                <th>Chatteur</th>
                <th>Modèle</th>
                <th>Plateforme</th>
                <th style={{ textAlign: 'right' }}>Montant brut</th>
                <th>Notes</th>
                <th style={{ width: 80, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="stagger-rows">
              {ventes.map(v => {
                const devise = getDevise(v.plateforme_id);
                const isRemoving = deletingId === v.id;
                return (
                  <tr
                    key={v.id}
                    className={!isRemoving ? 'hover-gold-row' : ''}
                    style={{
                      transition: 'all 250ms ease',
                      opacity: isRemoving ? 0 : 1,
                      transform: isRemoving ? 'translateX(30px)' : 'translateX(0)',
                      maxHeight: isRemoving ? 0 : '200px',
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
                          background: `${getColor(v.chatteur_id)}15`,
                          border: `1.5px solid ${getColor(v.chatteur_id)}40`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.7rem', fontWeight: 700, color: getColor(v.chatteur_id),
                        }}>
                          {getInitial(chatteurs, v.chatteur_id)}
                        </div>
                        <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{getName(chatteurs, v.chatteur_id)}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500, fontSize: '0.85rem', color: '#1b2e4b' }}>
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
                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.95rem', color: '#f5b731', whiteSpace: 'nowrap' }}>
                      {v.montant_brut.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {devise === 'USD' ? '$' : '€'}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: '#94a3b8', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.notes || '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
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
                  <select className="input-field" value={form.chatteur_id} onChange={e => setForm({ ...form, chatteur_id: e.target.value })} required>
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
                      const selectedModele = modeles.find(m => String(m.id) === newModeleId);
                      const modelePfs = selectedModele?.plateformes || [];
                      // Auto-select plateforme if model has only one
                      let newPfId = form.plateforme_id;
                      if (modelePfs.length === 1) {
                        newPfId = String(modelePfs[0].id);
                      } else if (newModeleId && modelePfs.length > 0 && !modelePfs.find(p => String(p.id) === form.plateforme_id)) {
                        // Reset plateforme if current selection is not valid for this model
                        newPfId = '';
                      }
                      setForm({ ...form, modele_id: newModeleId, plateforme_id: newPfId });
                    }}
                    required
                  >
                    <option value="">Sélectionner...</option>
                    {modeles.map(m => <option key={m.id} value={m.id}>{m.pseudo}</option>)}
                  </select>
                </div>

                {/* Plateforme (filtered by selected model) */}
                <div>
                  <label className="label">Plateforme *</label>
                  {(() => {
                    const selectedModele = modeles.find(m => String(m.id) === form.modele_id);
                    const availablePfs = selectedModele?.plateformes?.length > 0
                      ? plateformes.filter(p => selectedModele.plateformes.some(mp => mp.id === p.id))
                      : plateformes;
                    return (
                      <select className="input-field" value={form.plateforme_id} onChange={e => setForm({ ...form, plateforme_id: e.target.value })} required>
                        <option value="">Sélectionner...</option>
                        {availablePfs.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                      </select>
                    );
                  })()}
                  {form.modele_id && (() => {
                    const selectedModele = modeles.find(m => String(m.id) === form.modele_id);
                    if (selectedModele?.plateformes?.length === 1) {
                      return (
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                          {selectedModele.pseudo} est uniquement sur {selectedModele.plateformes[0].nom}
                        </div>
                      );
                    }
                    return null;
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
                      onChange={e => setForm({ ...form, date: e.target.value })}
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
                <button type="submit" className="btn-primary" disabled={submitting}>
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
