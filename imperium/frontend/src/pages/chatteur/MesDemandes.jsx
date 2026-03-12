import { useState, useEffect } from 'react';
import { CalendarCheck, Plus, Trash2, Clock, Check, X } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';

const STATUT_BADGE = {
  en_attente: { bg: 'rgba(245,183,49,0.12)', color: '#b8860b', label: 'En attente', icon: Clock },
  approuve: { bg: 'rgba(34,197,94,0.12)', color: '#16a34a', label: 'Approuvé', icon: Check },
  refuse: { bg: 'rgba(239,68,68,0.12)', color: '#dc2626', label: 'Refusé', icon: X },
};

export default function MesDemandes() {
  const [demandes, setDemandes] = useState([]);
  const [chatteurs, setChatteurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const { addToast } = useToast();

  const [form, setForm] = useState({
    type: 'conge', date_debut: '', date_fin: '', motif: '', echange_avec_id: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dRes, cRes] = await Promise.all([
        api.get('/api/demandes'),
        api.get('/api/chatteurs'),
      ]);
      setDemandes(dRes.data);
      setChatteurs(cRes.data);
    } catch { /* empty */ }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async () => {
    try {
      await api.post('/api/demandes', form);
      addToast('Demande soumise', 'success');
      setShowForm(false);
      setForm({ type: 'conge', date_debut: '', date_fin: '', motif: '', echange_avec_id: '' });
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.error || 'Erreur', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/demandes/${deleteId}`);
      addToast('Demande annulée', 'success');
      setDeleteId(null);
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.error || 'Erreur', 'error');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1f2e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CalendarCheck size={24} color="#f5b731" /> Mes Demandes
        </h1>
        <button onClick={() => setShowForm(true)} style={addBtnStyle}>
          <Plus size={16} /> Nouvelle demande
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{
          background: '#fff', borderRadius: '12px', padding: '1.5rem',
          border: '1px solid rgba(245,183,49,0.3)', marginBottom: '1.5rem',
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Nouvelle demande</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inputStyle}>
                <option value="conge">Congé</option>
                <option value="echange">Échange de shift</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Date début</label>
              <input type="date" value={form.date_debut} onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Date fin</label>
              <input type="date" value={form.date_fin} onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))} style={inputStyle} />
            </div>
            {form.type === 'echange' && (
              <div>
                <label style={labelStyle}>Échanger avec</label>
                <select value={form.echange_avec_id} onChange={e => setForm(f => ({ ...f, echange_avec_id: e.target.value }))} style={inputStyle}>
                  <option value="">Sélectionner...</option>
                  {chatteurs.map(c => <option key={c.id} value={c.id}>{c.prenom}</option>)}
                </select>
              </div>
            )}
          </div>

          <label style={{ ...labelStyle, marginTop: '1rem' }}>Motif (optionnel)</label>
          <textarea value={form.motif} onChange={e => setForm(f => ({ ...f, motif: e.target.value }))}
            style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
            placeholder="Raison de la demande..." />

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button onClick={() => setShowForm(false)} style={cancelBtnStyle}>Annuler</button>
            <button onClick={handleSubmit} style={saveBtnStyle}>Soumettre</button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Chargement...</div>
      ) : demandes.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: '12px' }}>
          Aucune demande
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {demandes.map(d => {
            const badge = STATUT_BADGE[d.statut];
            const BadgeIcon = badge.icon;
            return (
              <div key={d.id} style={{
                background: '#fff', borderRadius: '12px', padding: '1rem 1.25rem',
                border: '1px solid rgba(0,0,0,0.06)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexWrap: 'wrap', gap: '0.75rem',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{
                      background: d.type === 'conge' ? 'rgba(59,130,246,0.1)' : 'rgba(168,85,247,0.1)',
                      color: d.type === 'conge' ? '#2563eb' : '#7c3aed',
                      padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem',
                    }}>
                      {d.type === 'conge' ? 'Congé' : 'Échange'}
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1a1f2e' }}>
                      {d.date_debut} → {d.date_fin}
                    </span>
                  </div>
                  {d.motif && <p style={{ fontSize: '0.8rem', color: '#64748b' }}>{d.motif}</p>}
                  {d.echange_avec_prenom && <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Échange avec {d.echange_avec_prenom}</p>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    background: badge.bg, color: badge.color,
                    padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600,
                  }}>
                    <BadgeIcon size={14} /> {badge.label}
                  </span>
                  {d.statut === 'en_attente' && (
                    <button onClick={() => setDeleteId(d.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                      title="Annuler">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deleteId && (
        <ConfirmModal message="Annuler cette demande ?" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
      )}
    </div>
  );
}

const addBtnStyle = { display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: '8px', background: '#f5b731', color: '#1a1f2e', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' };
const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' };
const inputStyle = { width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box' };
const cancelBtnStyle = { padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.85rem' };
const saveBtnStyle = { padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: '#f5b731', color: '#1a1f2e', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' };
