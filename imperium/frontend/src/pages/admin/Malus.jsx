import { useState, useEffect, useCallback } from 'react';
import { MinusCircle, Plus, Gift, Edit2, Trash2 } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import { CHATTEUR_COLORS } from '../../constants/colors.js';

function getPeriode() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  if (now.getDate() <= 15) {
    return { debut: `${y}-${m}-01`, fin: `${y}-${m}-15` };
  }
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return { debut: `${y}-${m}-16`, fin: `${y}-${m}-${lastDay}` };
}

export default function MalusPage() {
  const [tab, setTab] = useState('malus');
  const [periode, setPeriode] = useState(getPeriode);
  const [malus, setMalus] = useState([]);
  const [primes, setPrimes] = useState([]);
  const [chatteurs, setChatteurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [modal, setModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const toast = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [mRes, pRes, cRes] = await Promise.all([
        api.get(`/api/malus?periode_debut=${periode.debut}&periode_fin=${periode.fin}`),
        api.get(`/api/primes?periode_debut=${periode.debut}&periode_fin=${periode.fin}`),
        api.get('/api/chatteurs'),
      ]);
      setMalus(mRes.data);
      setPrimes(pRes.data);
      setChatteurs(cRes.data);
    } catch {
      setFetchError('Impossible de charger les données.');
    }
    setLoading(false);
  }, [periode]);

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

  const totalMalusFixe = malus.filter(m => m.type_malus !== 'pourcentage').reduce((s, m) => s + m.montant, 0);
  const totalMalusPct = malus.filter(m => m.type_malus === 'pourcentage').reduce((s, m) => s + m.montant, 0);
  const totalPrimes = primes.reduce((s, p) => s + p.montant, 0);

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ fontWeight: 700, color: '#1a1f2e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MinusCircle size={24} color="#f5b731" /> Malus & Primes
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={periode.debut} onChange={e => setPeriode(p => ({ ...p, debut: e.target.value }))}
            className="input-field" style={{ width: 'auto', minWidth: 0 }} />
          <span style={{ color: '#94a3b8' }}>→</span>
          <input type="date" value={periode.fin} onChange={e => setPeriode(p => ({ ...p, fin: e.target.value }))}
            className="input-field" style={{ width: 'auto', minWidth: 0 }} />
        </div>
      </div>

      {/* Fetch error */}
      {fetchError && (
        <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          {fetchError}
          <button onClick={fetchAll} className="btn-ghost" style={{ marginLeft: '1rem', fontSize: '0.8rem' }}>Réessayer</button>
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card hover-lift">
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Malus</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>
            {totalMalusFixe > 0 ? `${totalMalusFixe.toFixed(2)} €` : ''}
            {totalMalusFixe > 0 && totalMalusPct > 0 ? ' + ' : ''}
            {totalMalusPct > 0 ? `${totalMalusPct}%` : ''}
            {totalMalusFixe === 0 && totalMalusPct === 0 ? '0.00 €' : ''}
          </p>
          <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.25rem' }}>{malus.length} entrée(s)</p>
        </div>
        <div className="card hover-lift">
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Primes</p>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#22c55e' }}>{totalPrimes.toFixed(2)} €</p>
          <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.25rem' }}>{primes.length} entrée(s)</p>
        </div>
      </div>

      {/* Tabs + Add */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0' }}>
          {[{ key: 'malus', icon: MinusCircle, label: 'Malus' }, { key: 'primes', icon: Gift, label: 'Primes manuelles' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.6rem 1.25rem', border: '1px solid #e2e8f0', borderBottom: 'none',
                background: tab === t.key ? '#fff' : '#f8fafc',
                color: tab === t.key ? '#1a1f2e' : '#64748b',
                cursor: 'pointer', fontSize: '0.85rem',
                borderRadius: '8px 8px 0 0', fontWeight: tab === t.key ? 600 : 500,
                borderColor: tab === t.key ? '#f5b731' : '#e2e8f0',
                transition: 'all 200ms',
              }}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>
        <button onClick={() => setModal({ type: tab })} className="btn-primary haptic">
          <Plus size={16} /> Ajouter {tab === 'malus' ? 'un malus' : 'une prime'}
        </button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>
        ) : tab === 'malus' ? (
          <MalusTable data={malus} onEdit={m => setModal({ type: 'malus', data: m })} onDelete={m => setDeleteModal({ ...m, type: 'malus' })} />
        ) : (
          <PrimesTable data={primes} onEdit={p => setModal({ type: 'prime', data: p })} onDelete={p => setDeleteModal({ ...p, type: 'prime' })} />
        )}
      </div>

      {modal && (
        <FormModal type={modal.type} data={modal.data} chatteurs={chatteurs} periode={periode}
          saving={saving} onClose={() => setModal(null)} onSave={modal.type === 'malus' ? handleSaveMalus : handleSavePrime} />
      )}

      <ConfirmModal open={!!deleteModal} message={deleteModal ? `Supprimer ce ${deleteModal.type === 'malus' ? 'malus' : 'cette prime'} ?` : ''}
        onConfirm={handleDelete} onCancel={() => setDeleteModal(null)} />
    </div>
  );
}

function MalusTable({ data, onEdit, onDelete }) {
  if (data.length === 0) return <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Aucun malus pour cette période</div>;
  return (
    <table>
      <thead><tr>
        <th>Chatteur</th><th>Type</th><th>Montant</th><th>Raison</th><th className="hide-sm">Période</th><th className="hide-sm">Date création</th><th>Actions</th>
      </tr></thead>
      <tbody className="stagger-rows">
        {data.map(m => (
          <tr key={m.id}>
            <td>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: `${CHATTEUR_COLORS[m.chatteur_couleur]?.bg || '#94a3b8'}20`,
                  border: `1.5px solid ${CHATTEUR_COLORS[m.chatteur_couleur]?.bg || '#94a3b8'}50`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 700,
                  color: CHATTEUR_COLORS[m.chatteur_couleur]?.bg || '#94a3b8',
                }}>
                  {m.chatteur_prenom?.[0]?.toUpperCase() || '?'}
                </div>
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

function PrimesTable({ data, onEdit, onDelete }) {
  if (data.length === 0) return <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Aucune prime pour cette période</div>;
  return (
    <table>
      <thead><tr>
        <th>Chatteur</th><th>Montant</th><th>Raison</th><th className="hide-sm">Période</th><th className="hide-sm">Date création</th><th>Actions</th>
      </tr></thead>
      <tbody className="stagger-rows">
        {data.map(p => (
          <tr key={p.id}>
            <td>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: `${CHATTEUR_COLORS[p.chatteur_couleur]?.bg || '#94a3b8'}20`,
                  border: `1.5px solid ${CHATTEUR_COLORS[p.chatteur_couleur]?.bg || '#94a3b8'}50`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 700,
                  color: CHATTEUR_COLORS[p.chatteur_couleur]?.bg || '#94a3b8',
                }}>
                  {p.chatteur_prenom?.[0]?.toUpperCase() || '?'}
                </div>
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

function FormModal({ type, data, chatteurs, periode, saving, onClose, onSave }) {
  const isEdit = !!data?.id;
  const [form, setForm] = useState(type === 'malus' ? {
    chatteur_id: data?.chatteur_id || '',
    montant: data?.montant || '',
    raison: data?.raison || '',
    periode: data?.periode || periode.debut,
    periode_fin: data?.periode_fin || periode.fin,
    type_malus: data?.type_malus || 'montant',
    ...(isEdit ? { id: data.id } : {}),
  } : {
    chatteur_id: data?.chatteur_id || '',
    montant: data?.montant || '',
    raison: data?.raison || '',
    periode_debut: data?.periode_debut || periode.debut,
    periode_fin: data?.periode_fin || periode.fin,
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
          className="input-field" disabled={isEdit}>
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
