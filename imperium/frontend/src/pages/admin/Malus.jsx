import { useState, useEffect, useCallback } from 'react';
import { MinusCircle, Plus, Gift, Edit2, Trash2 } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';

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
  const [tab, setTab] = useState('malus'); // 'malus' | 'primes'
  const [periode, setPeriode] = useState(getPeriode);
  const [malus, setMalus] = useState([]);
  const [primes, setPrimes] = useState([]);
  const [chatteurs, setChatteurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { type: 'malus'|'prime', data?: {} }
  const [deleteModal, setDeleteModal] = useState(null);
  const { addToast } = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, pRes, cRes] = await Promise.all([
        api.get(`/api/malus?periode_debut=${periode.debut}&periode_fin=${periode.fin}`),
        api.get(`/api/primes?periode_debut=${periode.debut}&periode_fin=${periode.fin}`),
        api.get('/api/chatteurs'),
      ]);
      setMalus(mRes.data);
      setPrimes(pRes.data);
      setChatteurs(cRes.data);
    } catch { /* empty */ }
    setLoading(false);
  }, [periode]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSaveMalus = async (formData) => {
    try {
      if (formData.id) {
        await api.put(`/api/malus/${formData.id}`, formData);
        addToast('Malus mis à jour', 'success');
      } else {
        await api.post('/api/malus', formData);
        addToast('Malus ajouté', 'success');
      }
      setModal(null);
      fetchAll();
    } catch (err) {
      addToast(err.response?.data?.error || 'Erreur', 'error');
    }
  };

  const handleSavePrime = async (formData) => {
    try {
      if (formData.id) {
        await api.put(`/api/primes/${formData.id}`, formData);
        addToast('Prime mise à jour', 'success');
      } else {
        await api.post('/api/primes', formData);
        addToast('Prime ajoutée', 'success');
      }
      setModal(null);
      fetchAll();
    } catch (err) {
      addToast(err.response?.data?.error || 'Erreur', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      const url = deleteModal.type === 'malus' ? `/api/malus/${deleteModal.id}` : `/api/primes/${deleteModal.id}`;
      await api.delete(url);
      addToast(`${deleteModal.type === 'malus' ? 'Malus' : 'Prime'} supprimé(e)`, 'success');
      setDeleteModal(null);
      fetchAll();
    } catch (err) {
      addToast(err.response?.data?.error || 'Erreur', 'error');
    }
  };

  const totalMalus = malus.reduce((s, m) => s + m.montant, 0);
  const totalPrimes = primes.reduce((s, p) => s + p.montant, 0);

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1f2e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MinusCircle size={24} color="#f5b731" /> Malus & Primes
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input type="date" value={periode.debut} onChange={e => setPeriode(p => ({ ...p, debut: e.target.value }))}
            style={dateInputStyle} />
          <span style={{ color: '#94a3b8' }}>→</span>
          <input type="date" value={periode.fin} onChange={e => setPeriode(p => ({ ...p, fin: e.target.value }))}
            style={dateInputStyle} />
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard label="Total Malus" value={`${totalMalus.toFixed(2)} €`} color="#ef4444" count={malus.length} />
        <StatCard label="Total Primes" value={`${totalPrimes.toFixed(2)} €`} color="#22c55e" count={primes.length} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '1rem' }}>
        <button onClick={() => setTab('malus')}
          style={{ ...tabBtnStyle, ...(tab === 'malus' ? tabActiveStyle : {}) }}>
          <MinusCircle size={16} /> Malus
        </button>
        <button onClick={() => setTab('primes')}
          style={{ ...tabBtnStyle, ...(tab === 'primes' ? tabActiveStyle : {}) }}>
          <Gift size={16} /> Primes manuelles
        </button>
      </div>

      {/* Add button */}
      <div style={{ marginBottom: '1rem' }}>
        <button onClick={() => setModal({ type: tab })}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 1rem', borderRadius: '8px',
            background: '#f5b731', color: '#1a1f2e', border: 'none',
            cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
          }}>
          <Plus size={16} /> Ajouter {tab === 'malus' ? 'un malus' : 'une prime'}
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Chargement...</div>
        ) : tab === 'malus' ? (
          <MalusTable data={malus} onEdit={m => setModal({ type: 'malus', data: m })} onDelete={m => setDeleteModal({ ...m, type: 'malus' })} />
        ) : (
          <PrimesTable data={primes} onEdit={p => setModal({ type: 'prime', data: p })} onDelete={p => setDeleteModal({ ...p, type: 'prime' })} />
        )}
      </div>

      {/* Modal */}
      {modal && (
        <FormModal
          type={modal.type}
          data={modal.data}
          chatteurs={chatteurs}
          periode={periode}
          onClose={() => setModal(null)}
          onSave={modal.type === 'malus' ? handleSaveMalus : handleSavePrime}
        />
      )}

      {deleteModal && (
        <ConfirmModal
          message={`Supprimer ce ${deleteModal.type === 'malus' ? 'malus' : 'cette prime'} ?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteModal(null)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, color, count }) {
  return (
    <div style={{
      background: '#fff', borderRadius: '12px', padding: '1.25rem',
      border: '1px solid rgba(0,0,0,0.06)',
    }}>
      <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>{label}</p>
      <p style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</p>
      <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.25rem' }}>{count} entrée(s)</p>
    </div>
  );
}

function MalusTable({ data, onEdit, onDelete }) {
  if (data.length === 0) return <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Aucun malus pour cette période</div>;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
      <thead><tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <th style={thStyle}>Chatteur</th>
        <th style={thStyle}>Montant</th>
        <th style={thStyle}>Raison</th>
        <th style={thStyle}>Période</th>
        <th style={thStyle}>Date création</th>
        <th style={thStyle}>Actions</th>
      </tr></thead>
      <tbody>
        {data.map(m => (
          <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
            <td style={tdStyle}>{m.chatteur_prenom}</td>
            <td style={{ ...tdStyle, color: '#ef4444', fontWeight: 600 }}>{m.montant.toFixed(2)} €</td>
            <td style={tdStyle}>{m.raison || '-'}</td>
            <td style={tdStyle}>{m.periode}</td>
            <td style={tdStyle}>{new Date(m.created_at).toLocaleDateString('fr-FR')}</td>
            <td style={tdStyle}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => onEdit(m)} style={actionBtnStyle} title="Modifier"><Edit2 size={14} /></button>
                <button onClick={() => onDelete(m)} style={{ ...actionBtnStyle, color: '#ef4444' }} title="Supprimer"><Trash2 size={14} /></button>
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
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
      <thead><tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <th style={thStyle}>Chatteur</th>
        <th style={thStyle}>Montant</th>
        <th style={thStyle}>Raison</th>
        <th style={thStyle}>Période</th>
        <th style={thStyle}>Date création</th>
        <th style={thStyle}>Actions</th>
      </tr></thead>
      <tbody>
        {data.map(p => (
          <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
            <td style={tdStyle}>{p.chatteur_prenom}</td>
            <td style={{ ...tdStyle, color: '#22c55e', fontWeight: 600 }}>+{p.montant.toFixed(2)} €</td>
            <td style={tdStyle}>{p.raison || '-'}</td>
            <td style={tdStyle}>{p.periode_debut} → {p.periode_fin}</td>
            <td style={tdStyle}>{new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
            <td style={tdStyle}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => onEdit(p)} style={actionBtnStyle} title="Modifier"><Edit2 size={14} /></button>
                <button onClick={() => onDelete(p)} style={{ ...actionBtnStyle, color: '#ef4444' }} title="Supprimer"><Trash2 size={14} /></button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FormModal({ type, data, chatteurs, periode, onClose, onSave }) {
  const isEdit = !!data?.id;
  const [form, setForm] = useState(type === 'malus' ? {
    chatteur_id: data?.chatteur_id || '',
    montant: data?.montant || '',
    raison: data?.raison || '',
    periode: data?.periode || periode.debut,
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
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
          {isEdit ? 'Modifier' : 'Ajouter'} {type === 'malus' ? 'un malus' : 'une prime'}
        </h2>

        <label style={labelStyle}>Chatteur</label>
        <select value={form.chatteur_id} onChange={e => setForm(f => ({ ...f, chatteur_id: e.target.value }))}
          style={inputStyle} disabled={isEdit}>
          <option value="">Sélectionner...</option>
          {chatteurs.map(c => <option key={c.id} value={c.id}>{c.prenom}</option>)}
        </select>

        <label style={labelStyle}>Montant (€)</label>
        <input type="number" step="0.01" value={form.montant}
          onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
          style={inputStyle} />

        <label style={labelStyle}>Raison</label>
        <input type="text" value={form.raison}
          onChange={e => setForm(f => ({ ...f, raison: e.target.value }))}
          style={inputStyle} />

        {type === 'malus' ? (
          <>
            <label style={labelStyle}>Période</label>
            <input type="date" value={form.periode}
              onChange={e => setForm(f => ({ ...f, periode: e.target.value }))}
              style={inputStyle} />
          </>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Début</label>
              <input type="date" value={form.periode_debut}
                onChange={e => setForm(f => ({ ...f, periode_debut: e.target.value }))}
                style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Fin</label>
              <input type="date" value={form.periode_fin}
                onChange={e => setForm(f => ({ ...f, periode_fin: e.target.value }))}
                style={inputStyle} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={cancelBtnStyle}>Annuler</button>
          <button onClick={() => onSave(form)} style={saveBtnStyle}>{isEdit ? 'Modifier' : 'Ajouter'}</button>
        </div>
      </div>
    </div>
  );
}

const thStyle = { padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' };
const tdStyle = { padding: '0.75rem 1rem', color: '#334155' };
const dateInputStyle = { padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' };
const actionBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0.25rem' };
const tabBtnStyle = {
  display: 'flex', alignItems: 'center', gap: '0.4rem',
  padding: '0.6rem 1.25rem', border: '1px solid #e2e8f0', borderBottom: 'none',
  background: '#f8fafc', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem',
  borderRadius: '8px 8px 0 0', fontWeight: 500,
};
const tabActiveStyle = { background: '#fff', color: '#1a1f2e', fontWeight: 600, borderColor: '#f5b731' };
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle = { background: '#fff', borderRadius: '16px', padding: '2rem', width: '90%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' };
const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginTop: '0.75rem', marginBottom: '0.25rem' };
const inputStyle = { width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box' };
const cancelBtnStyle = { padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.85rem' };
const saveBtnStyle = { padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: '#f5b731', color: '#1a1f2e', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' };
