import { useState, useEffect, useCallback } from 'react';
import { MinusCircle, Plus, Gift, Edit2, Trash2, Award, TrendingDown, Sparkles } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import { CHATTEUR_COLORS } from '../../constants/colors.js';
import { PALIER_COLOR_OPTIONS, getTierColorFromPalier } from '../../utils/palierColors.js';

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mql.matches);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

function getDefaultPeriode() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  if (now.getDate() < 15) {
    return { debut: `${y}-${m}-01`, fin: `${y}-${m}-15` };
  }
  const next = new Date(y, now.getMonth() + 1, 1);
  const ny = next.getFullYear(), nm = String(next.getMonth() + 1).padStart(2, '0');
  return { debut: `${y}-${m}-15`, fin: `${ny}-${nm}-01` };
}

export default function MalusPage() {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('malus');
  const [malus, setMalus] = useState([]);
  const [primes, setPrimes] = useState([]);
  const [chatteurs, setChatteurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [modal, setModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [paliersPrimes, setPaliersPrimes] = useState([]);
  const [paliersPrimesModal, setPaliersPrimesModal] = useState(null);
  const [deletePaliersPrimes, setDeletePaliersPrimes] = useState(false);
  const toast = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [mRes, pRes, cRes, ppRes] = await Promise.all([
        api.get('/api/malus'),
        api.get('/api/primes'),
        api.get('/api/chatteurs'),
        api.get('/api/objectifs/paliers-primes').catch(() => ({ data: [] })),
      ]);
      setMalus(mRes.data);
      setPrimes(pRes.data);
      setChatteurs(cRes.data);
      setPaliersPrimes(ppRes.data || []);
    } catch {
      setFetchError('Impossible de charger les données.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const [saving, setSaving] = useState(false);

  const handleSaveMalus = async (formData) => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = { ...formData, montant: parseFloat(formData.montant), chatteur_id: parseInt(formData.chatteur_id) };
      if (payload.id) {
        await api.put(`/api/malus/${payload.id}`, payload);
        toast('Malus mis à jour', 'success');
      } else {
        await api.post('/api/malus', payload);
        toast('Malus ajouté', 'success');
      }
      setModal(null);
      fetchAll();
    } catch (err) {
      toast(err.response?.data?.error || 'Erreur', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrime = async (formData) => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = { ...formData, montant: parseFloat(formData.montant), chatteur_id: parseInt(formData.chatteur_id) };
      if (payload.id) {
        await api.put(`/api/primes/${payload.id}`, payload);
        toast('Prime mise à jour', 'success');
      } else {
        await api.post('/api/primes', payload);
        toast('Prime ajoutée', 'success');
      }
      setModal(null);
      fetchAll();
    } catch (err) {
      toast(err.response?.data?.error || 'Erreur', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      const url = deleteModal.type === 'malus' ? `/api/malus/${deleteModal.id}` : `/api/primes/${deleteModal.id}`;
      await api.delete(url);
      toast(`${deleteModal.type === 'malus' ? 'Malus' : 'Prime'} supprimé(e)`, 'success');
      setDeleteModal(null);
      fetchAll();
    } catch (err) {
      toast(err.response?.data?.error || 'Erreur', 'error');
    }
  };

  const handleSavePaliersPrimes = async (form) => {
    try {
      const payload = { paliers: form.paliers };
      if (paliersPrimes.length > 0) {
        await api.put('/api/objectifs/paliers-primes', payload);
        toast('Paliers de primes mis à jour', 'success');
      } else {
        await api.post('/api/objectifs/paliers-primes', payload);
        toast('Paliers de primes créés', 'success');
      }
      setPaliersPrimesModal(null);
      fetchAll();
    } catch (err) {
      toast(err.response?.data?.error || 'Erreur', 'error');
    }
  };

  const handleDeletePaliersPrimes = async () => {
    try {
      await api.delete('/api/objectifs/paliers-primes');
      toast('Paliers de primes supprimés', 'success');
      setDeletePaliersPrimes(false);
      fetchAll();
    } catch (err) {
      toast(err.response?.data?.error || 'Erreur', 'error');
    }
  };

  const totalMalusFixe = malus.filter(m => m.type_malus !== 'pourcentage').reduce((s, m) => s + m.montant, 0);
  const totalMalusPct = malus.filter(m => m.type_malus === 'pourcentage').reduce((s, m) => s + m.montant, 0);
  const totalPrimesManuelles = primes.reduce((s, p) => s + p.montant, 0);
  const totalPalierBonus = paliersPrimes.reduce((s, p) => s + (p.bonus || 0), 0);
  const netBalance = totalPrimesManuelles + totalPalierBonus - totalMalusFixe;

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ fontWeight: 700, color: '#1a1f2e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={24} color="#f5b731" /> Primes & Malus
        </h1>
      </div>

      {/* Fetch error */}
      {fetchError && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          {fetchError}
          <button onClick={fetchAll} className="btn-ghost" style={{ marginLeft: '1rem', fontSize: '0.8rem' }}>Réessayer</button>
        </div>
      )}

      {/* Stat Cards — 3 columns */}
      <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {/* Malus */}
        <div className="card hover-lift" style={{ borderLeft: '4px solid #ef4444', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', opacity: 0.08 }}>
            <TrendingDown size={40} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
            <MinusCircle size={14} color="#ef4444" />
            <p style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Malus</p>
          </div>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ef4444' }}>
            {totalMalusFixe > 0 ? `${totalMalusFixe.toFixed(2)} €` : ''}
            {totalMalusFixe > 0 && totalMalusPct > 0 ? ' + ' : ''}
            {totalMalusPct > 0 ? `${totalMalusPct}%` : ''}
            {totalMalusFixe === 0 && totalMalusPct === 0 ? '0.00 €' : ''}
          </p>
          <p style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.2rem' }}>{malus.length} entrée(s)</p>
        </div>

        {/* Primes manuelles */}
        <div className="card hover-lift" style={{ borderLeft: '4px solid #22c55e', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', opacity: 0.08 }}>
            <Gift size={40} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
            <Gift size={14} color="#22c55e" />
            <p style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Primes manuelles</p>
          </div>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#22c55e' }}>{totalPrimesManuelles.toFixed(2)} €</p>
          <p style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.2rem' }}>{primes.length} entrée(s)</p>
        </div>

        {/* Primes par palier */}
        <div className="card hover-lift" style={{ borderLeft: '4px solid #3b82f6', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', opacity: 0.08 }}>
            <Award size={40} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
            <Award size={14} color="#3b82f6" />
            <p style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Primes par palier</p>
          </div>
          <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#3b82f6' }}>
            {paliersPrimes.length > 0 ? `${paliersPrimes.length} palier(s)` : 'Non configuré'}
          </p>
          <p style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            {paliersPrimes.length > 0 ? `Jusqu'à +${totalPalierBonus}€ par chatteur` : 'Aucun palier défini'}
          </p>
        </div>
      </div>

      {/* ─── SECTION 1: Paliers de primes individuelles ─── */}
      {!loading && (
        <PaliersPrimesSection
          paliers={paliersPrimes}
          onEdit={() => setPaliersPrimesModal(paliersPrimes.length > 0 ? { paliers: paliersPrimes } : {})}
          onDelete={() => setDeletePaliersPrimes(true)}
        />
      )}

      {/* ─── SECTION 2: Malus & Primes manuelles ─── */}
      <div className="card" style={{ marginTop: '1.25rem', padding: 0, overflow: 'hidden' }}>
        {/* Tabs header inside the card */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0',
          background: '#fafbfc', flexWrap: 'wrap', gap: '0.5rem',
        }}>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {[
              { key: 'malus', icon: MinusCircle, label: 'Malus', color: '#ef4444' },
              { key: 'primes', icon: Gift, label: 'Primes manuelles', color: '#22c55e' },
            ].map(t => {
              const active = tab === t.key;
              return (
                <button key={t.key} onClick={() => setTab(t.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.45rem 0.85rem', border: 'none',
                    background: active ? `${t.color}10` : 'transparent',
                    color: active ? t.color : '#64748b',
                    cursor: 'pointer', fontSize: '0.82rem',
                    borderRadius: '8px', fontWeight: active ? 600 : 500,
                    transition: 'all 200ms',
                  }}>
                  <t.icon size={15} /> {t.label}
                  <span style={{
                    fontSize: '0.65rem', padding: '1px 6px', borderRadius: '99px',
                    background: active ? `${t.color}15` : '#f1f5f9',
                    color: active ? t.color : '#94a3b8',
                    fontWeight: 700,
                  }}>
                    {t.key === 'malus' ? malus.length : primes.length}
                  </span>
                </button>
              );
            })}
          </div>
          <button onClick={() => setModal({ type: tab })} className="btn-primary haptic" style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}>
            <Plus size={14} /> {tab === 'malus' ? 'Malus' : 'Prime'}
          </button>
        </div>

        {/* Table content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>
        ) : tab === 'malus' ? (
          <MalusTable data={malus} isMobile={isMobile} onEdit={m => setModal({ type: 'malus', data: m })} onDelete={m => setDeleteModal({ ...m, type: 'malus' })} />
        ) : (
          <PrimesTable data={primes} isMobile={isMobile} onEdit={p => setModal({ type: 'prime', data: p })} onDelete={p => setDeleteModal({ ...p, type: 'prime' })} />
        )}
      </div>

      {modal && (
        <FormModal type={modal.type} data={modal.data} chatteurs={chatteurs}
          saving={saving} onClose={() => setModal(null)} onSave={modal.type === 'malus' ? handleSaveMalus : handleSavePrime} />
      )}

      <ConfirmModal open={!!deleteModal} message={deleteModal ? `Supprimer ce ${deleteModal.type === 'malus' ? 'malus' : 'cette prime'} ?` : ''}
        onConfirm={handleDelete} onCancel={() => setDeleteModal(null)} />

      {paliersPrimesModal && (
        <PaliersPrimesModal data={paliersPrimesModal}
          onClose={() => setPaliersPrimesModal(null)} onSave={handleSavePaliersPrimes} />
      )}

      {deletePaliersPrimes && (
        <ConfirmModal message="Supprimer les paliers de primes individuelles ?" onConfirm={handleDeletePaliersPrimes} onCancel={() => setDeletePaliersPrimes(false)} />
      )}
    </div>
  );
}

function ChatteurAvatar({ prenom, couleur, size = 30 }) {
  const bg = CHATTEUR_COLORS[couleur]?.bg || '#94a3b8';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `${bg}20`, border: `1.5px solid ${bg}50`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: `${size * 0.023}rem`, fontWeight: 700, color: bg,
    }}>
      {prenom?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

function MalusTable({ data, onEdit, onDelete, isMobile }) {
  if (data.length === 0) return (
    <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
      <MinusCircle size={28} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
      <p>Aucun malus enregistré</p>
    </div>
  );

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem' }} className="stagger-children">
        {data.map(m => (
          <div key={m.id} className="hover-lift" style={{
            padding: '0.75rem', borderRadius: '10px', background: '#fff',
            border: '1px solid #fee2e2', borderLeft: '3px solid #ef4444',
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            transition: 'all 200ms ease',
          }}>
            <ChatteurAvatar prenom={m.chatteur_prenom} couleur={m.chatteur_couleur} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1a1f2e' }}>{m.chatteur_prenom}</span>
                <span style={{
                  fontSize: '0.6rem', padding: '1px 6px', borderRadius: '99px', fontWeight: 600,
                  background: m.type_malus === 'pourcentage' ? '#fef3c7' : '#fce7f3',
                  color: m.type_malus === 'pourcentage' ? '#92400e' : '#be185d',
                }}>{m.type_malus === 'pourcentage' ? '%' : '€'}</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{m.raison || 'Pas de raison'}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.95rem' }}>
                -{m.type_malus === 'pourcentage' ? `${m.montant}%` : `${m.montant.toFixed(2)}€`}
              </div>
              <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem', justifyContent: 'flex-end' }}>
                <button onClick={() => onEdit(m)} className="icon-btn" style={{ padding: '4px' }}><Edit2 size={13} /></button>
                <button onClick={() => onDelete(m)} className="icon-btn" style={{ color: '#ef4444', padding: '4px' }}><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <table>
      <thead><tr>
        <th>Chatteur</th><th>Type</th><th>Montant</th><th>Raison</th><th className="hide-sm">Période</th><th className="hide-sm">Date</th><th>Actions</th>
      </tr></thead>
      <tbody className="stagger-rows">
        {data.map(m => (
          <tr key={m.id}>
            <td>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ChatteurAvatar prenom={m.chatteur_prenom} couleur={m.chatteur_couleur} />
                <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{m.chatteur_prenom}</span>
              </div>
            </td>
            <td>
              <span style={{
                fontSize: '0.7rem', padding: '2px 8px', borderRadius: '99px', fontWeight: 600,
                background: m.type_malus === 'pourcentage' ? '#fef3c7' : '#fce7f3',
                color: m.type_malus === 'pourcentage' ? '#92400e' : '#be185d',
              }}>
                {m.type_malus === 'pourcentage' ? '%' : '€'}
              </span>
            </td>
            <td style={{ color: '#ef4444', fontWeight: 600 }}>
              {m.type_malus === 'pourcentage' ? `${m.montant}%` : `${m.montant.toFixed(2)} €`}
            </td>
            <td>{m.raison || '-'}</td>
            <td className="hide-sm">{m.periode_fin && m.periode_fin !== m.periode ? `${m.periode} → ${m.periode_fin}` : m.periode}</td>
            <td className="hide-sm">{new Date(m.created_at).toLocaleDateString('fr-FR')}</td>
            <td>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => onEdit(m)} className="icon-btn" title="Modifier"><Edit2 size={14} /></button>
                <button onClick={() => onDelete(m)} className="icon-btn" style={{ color: '#ef4444' }} title="Supprimer"><Trash2 size={14} /></button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PrimesTable({ data, onEdit, onDelete, isMobile }) {
  if (data.length === 0) return (
    <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
      <Gift size={28} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
      <p>Aucune prime enregistrée</p>
    </div>
  );

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem' }} className="stagger-children">
        {data.map(p => (
          <div key={p.id} className="hover-lift" style={{
            padding: '0.75rem', borderRadius: '10px', background: '#fff',
            border: '1px solid #dcfce7', borderLeft: '3px solid #22c55e',
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            transition: 'all 200ms ease',
          }}>
            <ChatteurAvatar prenom={p.chatteur_prenom} couleur={p.chatteur_couleur} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1a1f2e' }}>{p.chatteur_prenom}</span>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{p.raison || 'Pas de raison'}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ color: '#22c55e', fontWeight: 700, fontSize: '0.95rem' }}>+{p.montant.toFixed(2)}€</div>
              <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem', justifyContent: 'flex-end' }}>
                <button onClick={() => onEdit(p)} className="icon-btn" style={{ padding: '4px' }}><Edit2 size={13} /></button>
                <button onClick={() => onDelete(p)} className="icon-btn" style={{ color: '#ef4444', padding: '4px' }}><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <table>
      <thead><tr>
        <th>Chatteur</th><th>Montant</th><th>Raison</th><th className="hide-sm">Période</th><th className="hide-sm">Date</th><th>Actions</th>
      </tr></thead>
      <tbody className="stagger-rows">
        {data.map(p => (
          <tr key={p.id}>
            <td>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ChatteurAvatar prenom={p.chatteur_prenom} couleur={p.chatteur_couleur} />
                <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{p.chatteur_prenom}</span>
              </div>
            </td>
            <td style={{ color: '#22c55e', fontWeight: 600 }}>+{p.montant.toFixed(2)} €</td>
            <td>{p.raison || '-'}</td>
            <td className="hide-sm">{p.periode_debut} → {p.periode_fin}</td>
            <td className="hide-sm">{new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
            <td>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => onEdit(p)} className="icon-btn" title="Modifier"><Edit2 size={14} /></button>
                <button onClick={() => onDelete(p)} className="icon-btn" style={{ color: '#ef4444' }} title="Supprimer"><Trash2 size={14} /></button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FormModal({ type, data, chatteurs, saving, onClose, onSave }) {
  const isEdit = !!data?.id;
  const defaultPeriode = getDefaultPeriode();
  const [form, setForm] = useState(type === 'malus' ? {
    chatteur_id: data?.chatteur_id || '',
    montant: data?.montant || '',
    raison: data?.raison || '',
    periode: data?.periode || defaultPeriode.debut,
    periode_fin: data?.periode_fin || defaultPeriode.fin,
    type_malus: data?.type_malus || 'montant',
    ...(isEdit ? { id: data.id } : {}),
  } : {
    chatteur_id: data?.chatteur_id || '',
    montant: data?.montant || '',
    raison: data?.raison || '',
    periode_debut: data?.periode_debut || defaultPeriode.debut,
    periode_fin: data?.periode_fin || defaultPeriode.fin,
    ...(isEdit ? { id: data.id } : {}),
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
          {isEdit ? 'Modifier' : 'Ajouter'} {type === 'malus' ? 'un malus' : 'une prime'}
        </h2>

        <label className="label">Chatteur</label>
        <select value={form.chatteur_id} onChange={e => setForm(f => ({ ...f, chatteur_id: e.target.value }))}
          className="input-field" disabled={isEdit} aria-label="Sélectionner le chatteur">
          <option value="">Sélectionner...</option>
          {chatteurs.map(c => <option key={c.id} value={c.id}>{c.prenom}</option>)}
        </select>

        {type === 'malus' && (
          <>
            <label className="label" style={{ marginTop: '0.75rem' }}>Type</label>
            <div style={{ display: 'flex', gap: 0 }}>
              {[{ key: 'montant', label: 'Montant fixe (€)' }, { key: 'pourcentage', label: 'Pourcentage (%)' }].map(t => (
                <button key={t.key} type="button" onClick={() => setForm(f => ({ ...f, type_malus: t.key }))}
                  style={{
                    flex: 1, padding: '0.5rem', border: '1px solid #e2e8f0', cursor: 'pointer',
                    fontSize: '0.8rem', fontWeight: form.type_malus === t.key ? 600 : 400,
                    background: form.type_malus === t.key ? '#1b2e4b' : '#f8fafc',
                    color: form.type_malus === t.key ? '#fff' : '#64748b',
                    borderRadius: t.key === 'montant' ? '6px 0 0 6px' : '0 6px 6px 0',
                    transition: 'all 200ms',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          </>
        )}

        <label className="label" style={{ marginTop: '0.75rem' }}>
          {type === 'malus' && form.type_malus === 'pourcentage' ? 'Pourcentage (%)' : 'Montant (€)'}
        </label>
        <input type="number" step={type === 'malus' && form.type_malus === 'pourcentage' ? '0.1' : '0.01'}
          value={form.montant} placeholder={type === 'malus' && form.type_malus === 'pourcentage' ? 'Ex: 5 pour 5%' : ''}
          onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
          className="input-field" />

        <label className="label" style={{ marginTop: '0.75rem' }}>Raison</label>
        <input type="text" value={form.raison}
          onChange={e => setForm(f => ({ ...f, raison: e.target.value }))}
          className="input-field" />

        {type === 'malus' ? (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <div style={{ flex: 1 }}>
              <label className="label">Début</label>
              <input type="date" value={form.periode}
                onChange={e => setForm(f => ({ ...f, periode: e.target.value }))} className="input-field" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Fin</label>
              <input type="date" value={form.periode_fin}
                onChange={e => setForm(f => ({ ...f, periode_fin: e.target.value }))} className="input-field" />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <div style={{ flex: 1 }}>
              <label className="label">Début</label>
              <input type="date" value={form.periode_debut}
                onChange={e => setForm(f => ({ ...f, periode_debut: e.target.value }))} className="input-field" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Fin</label>
              <input type="date" value={form.periode_fin}
                onChange={e => setForm(f => ({ ...f, periode_fin: e.target.value }))} className="input-field" />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="button" disabled={saving} onClick={() => onSave(form)} className="btn-primary haptic">
            {saving ? 'Envoi...' : (isEdit ? 'Modifier' : 'Ajouter')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========== PALIERS PRIMES INDIVIDUELLES ========== */

const DEFAULT_PALIERS_PRIMES = [
  { seuil_net_ht: 500, bonus: 15, label: 'Bronze', emoji: '🥉' },
  { seuil_net_ht: 1000, bonus: 30, label: 'Argent', emoji: '🥈' },
  { seuil_net_ht: 1500, bonus: 50, label: 'Or', emoji: '🥇' },
];

const EMOJI_PRESETS = ['🥉', '🥈', '🥇', '💎', '🏆', '🔥', '⭐', '💥', '⚡', '🌟', '🎯', '🚀'];

function PaliersPrimesSection({ paliers, onEdit, onDelete }) {
  if (!paliers || paliers.length === 0) {
    return (
      <div className="card stagger-item" style={{
        padding: '2rem', textAlign: 'center',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
        border: '1px solid rgba(59,130,246,0.15)',
        borderLeft: '4px solid #3b82f6',
      }}>
        <div style={{ animation: 'floatSoft 3s ease-in-out infinite', display: 'inline-block' }}>
          <Award size={36} color="#3b82f6" style={{ margin: '0 auto 0.75rem' }} />
        </div>
        <p style={{ fontWeight: 600, color: '#1a1f2e', marginBottom: '0.5rem' }}>
          Primes individuelles par palier
        </p>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
          {`Définissez des paliers de ventes Net HT — chaque chatteur qui atteint un seuil reçoit un bonus fixe.`}
        </p>
        <button onClick={onEdit} className="btn-primary haptic">
          <Plus size={14} /> Configurer les paliers
        </button>
      </div>
    );
  }

  return (
    <div className="card stagger-item" style={{
      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
      border: '1px solid rgba(59,130,246,0.15)',
      borderLeft: '4px solid #3b82f6',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Award size={20} color="#3b82f6" />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1f2e', margin: 0 }}>
            Primes individuelles par palier
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={onEdit} className="icon-btn" title="Modifier" aria-label="Modifier les paliers de primes"><Edit2 size={14} /></button>
          <button onClick={onDelete} className="icon-btn" style={{ color: '#ef4444' }} title="Supprimer" aria-label="Supprimer les paliers de primes"><Trash2 size={14} /></button>
        </div>
      </div>

      <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '1rem' }}>
        Chaque chatteur qui atteint un seuil de ventes Net HT individuel gagne le bonus correspondant.
      </p>

      {/* Vertical timeline layout */}
      <div style={{ position: 'relative', paddingLeft: '2rem' }}>
        {/* Timeline line */}
        <div style={{
          position: 'absolute', left: '11px', top: '8px', bottom: '8px',
          width: '2px',
          background: paliers.length > 1
            ? `linear-gradient(180deg, ${paliers.map((p, i) => {
                const tc = getTierColorFromPalier(p, i);
                const pct = Math.round((i / (paliers.length - 1)) * 100);
                return `${tc.bg} ${pct}%`;
              }).join(', ')})`
            : getTierColorFromPalier(paliers[0], 0).bg,
          borderRadius: '2px',
        }} />

        {paliers.map((p, i) => {
          const tc = getTierColorFromPalier(p, i);
          return (
            <div key={p.id || i} style={{
              position: 'relative', marginBottom: i < paliers.length - 1 ? '0.75rem' : 0,
              display: 'flex', alignItems: 'stretch',
            }}>
              {/* Timeline dot */}
              <div style={{
                position: 'absolute', left: '-2rem', top: '50%', transform: 'translateY(-50%)',
                width: '22px', height: '22px', borderRadius: '50%',
                background: tc.bg,
                border: `3px solid ${tc.bg}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', color: '#fff', fontWeight: 700,
                boxShadow: `0 2px 8px ${tc.bg}30`,
                zIndex: 1,
              }}>
                {p.emoji || (i + 1)}
              </div>

              {/* Card */}
              <div className="hover-lift" style={{
                flex: 1, padding: '0.75rem 1rem', borderRadius: '12px',
                background: 'rgba(255,255,255,0.8)',
                border: `1px solid ${tc.border}`,
                borderLeft: `4px solid ${tc.bg}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '0.75rem',
                transition: 'all 200ms ease',
              }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: tc.text }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>
                    Seuil : <strong style={{ color: '#1a1f2e' }}>{p.seuil_net_ht.toLocaleString('fr-FR')} {'€'}</strong> ventes Net HT
                  </div>
                </div>
                <div style={{
                  padding: '0.35rem 0.75rem', borderRadius: '20px',
                  background: `${tc.bg}15`, border: `1px solid ${tc.border}`,
                  fontSize: '0.9rem', fontWeight: 800, color: '#10b981',
                  whiteSpace: 'nowrap',
                }}>
                  +{p.bonus}{'€'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ========== PALIERS PRIMES MODAL ========== */

function PaliersPrimesModal({ data, onClose, onSave }) {
  const isEdit = data.paliers && data.paliers.length > 0;
  const [form, setForm] = useState({
    paliers: isEdit ? data.paliers.map(p => ({
      seuil_net_ht: p.seuil_net_ht, bonus: p.bonus, label: p.label, emoji: p.emoji || '', couleur: p.couleur || '',
    })) : DEFAULT_PALIERS_PRIMES.map(p => ({ ...p, couleur: '' })),
  });

  const updatePalier = (idx, field, value) => {
    setForm(f => ({
      ...f,
      paliers: f.paliers.map((p, i) => i === idx ? { ...p, [field]: value } : p),
    }));
  };

  const addPalier = () => {
    setForm(f => ({
      ...f,
      paliers: [...f.paliers, { seuil_net_ht: '', bonus: '', label: '', emoji: '', couleur: '' }],
    }));
  };

  const removePalier = (idx) => {
    setForm(f => ({ ...f, paliers: f.paliers.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = () => {
    const parsed = {
      paliers: form.paliers.map(p => ({
        seuil_net_ht: parseFloat(p.seuil_net_ht),
        bonus: parseFloat(p.bonus),
        label: p.label,
        emoji: p.emoji || undefined,
        couleur: p.couleur || undefined,
      })),
    };
    onSave(parsed);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Award size={18} color="#3b82f6" />
          {isEdit ? 'Modifier les' : 'Configurer les'} paliers de primes
        </h2>

        <p style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.75rem' }}>
          {`Définissez des seuils de ventes Net HT individuel. Chaque chatteur qui atteint un seuil reçoit le bonus correspondant (le plus haut palier atteint s'applique).`}
        </p>

        {/* Paliers editor */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <label className="label" style={{ margin: 0 }}>Paliers</label>
            <button onClick={addPalier} className="btn-ghost" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
              <Plus size={12} /> Ajouter
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {form.paliers.map((p, i) => {
              const previewColor = p.couleur || PALIER_COLOR_OPTIONS[i % PALIER_COLOR_OPTIONS.length].hex;
              return (
              <div key={i} style={{
                padding: '0.6rem', borderRadius: '10px', background: '#f8fafc',
                border: `1px solid #e2e8f0`, borderLeft: `4px solid ${previewColor}`,
              }}>
                {/* Row 1: emoji + label + delete */}
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <input type="text" value={p.emoji} placeholder={'🏆'}
                    onChange={e => updatePalier(i, 'emoji', e.target.value)}
                    style={{ width: '40px', textAlign: 'center', padding: '0.3rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }} />
                  <input type="text" value={p.label} placeholder="Label"
                    onChange={e => updatePalier(i, 'label', e.target.value)}
                    style={{ flex: 1, padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }} />
                  {form.paliers.length > 1 && (
                    <button onClick={() => removePalier(i)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px',
                    }}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                {/* Row 2: emoji presets */}
                <div style={{ display: 'flex', gap: '2px', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                  {EMOJI_PRESETS.map(em => (
                    <button key={em} onClick={() => updatePalier(i, 'emoji', em)}
                      style={{
                        width: '26px', height: '26px', borderRadius: '6px',
                        border: p.emoji === em ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                        background: p.emoji === em ? 'rgba(59,130,246,0.08)' : '#fff',
                        cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{em}</button>
                  ))}
                </div>
                {/* Row 3: color picker */}
                <div style={{ display: 'flex', gap: '3px', marginBottom: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.6rem', color: '#94a3b8', marginRight: '2px' }}>Couleur</span>
                  {PALIER_COLOR_OPTIONS.map(c => (
                    <button key={c.hex} onClick={() => updatePalier(i, 'couleur', c.hex)}
                      title={c.label}
                      style={{
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: c.hex,
                        border: p.couleur === c.hex ? '2.5px solid #1a1f2e' : '2px solid transparent',
                        cursor: 'pointer', padding: 0,
                        boxShadow: p.couleur === c.hex ? `0 0 0 2px ${c.hex}40` : 'none',
                      }} />
                  ))}
                </div>
                {/* Row 4: seuil + bonus side by side */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ fontSize: '0.6rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>Seuil</span>
                    <input type="number" value={p.seuil_net_ht} placeholder="0"
                      onChange={e => updatePalier(i, 'seuil_net_ht', e.target.value)}
                      style={{ width: '100%', minWidth: 0, padding: '0.3rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem', textAlign: 'right' }} />
                    <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{'€'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 600 }}>+</span>
                    <input type="number" step="0.01" value={p.bonus} placeholder="0"
                      onChange={e => updatePalier(i, 'bonus', e.target.value)}
                      style={{ width: '100%', minWidth: 0, padding: '0.3rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem', textAlign: 'right' }} />
                    <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 600 }}>{'€'}</span>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={handleSubmit} className="btn-primary haptic">{isEdit ? 'Modifier' : 'Créer'}</button>
        </div>
      </div>
    </div>
  );
}
