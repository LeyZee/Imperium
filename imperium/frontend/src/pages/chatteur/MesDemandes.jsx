import { useState, useEffect } from 'react';
import { CalendarCheck, Plus, Trash2, Clock, Check, X } from 'lucide-react';
import api from '../../api/index.js';
import { useToast } from '../../components/Toast.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';

const STATUT_BADGE = {
  en_attente: { cls: 'badge badge-warning', label: 'En attente', icon: Clock },
  approuve: { cls: 'badge badge-success', label: 'Approuvé', icon: Check },
  refuse: { cls: 'badge badge-danger', label: 'Refusé', icon: X },
};

export default function MesDemandes() {
  const [demandes, setDemandes] = useState([]);
  const [chatteurs, setChatteurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const toast = useToast();

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
    // Client-side validation
    if (!form.date_debut) { toast('Date de début requise', 'error'); return; }
    if (!form.date_fin) { toast('Date de fin requise', 'error'); return; }
    if (new Date(form.date_fin) <= new Date(form.date_debut)) {
      toast('La date de fin doit être après la date de début', 'error'); return;
    }
    if (form.type === 'echange' && !form.echange_avec_id) {
      toast('Sélectionnez un chatteur pour l\'échange', 'error'); return;
    }
    try {
      await api.post('/api/demandes', form);
      toast('Demande soumise', 'success');
      setShowForm(false);
      setForm({ type: 'conge', date_debut: '', date_fin: '', motif: '', echange_avec_id: '' });
      fetchData();
    } catch (err) {
      toast(err.response?.data?.error || 'Erreur', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/demandes/${deleteId}`);
      toast('Demande annulée', 'success');
      setDeleteId(null);
      fetchData();
    } catch (err) {
      toast(err.response?.data?.error || 'Erreur', 'error');
    }
  };

  return (
    <div className="page-enter" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1f2e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CalendarCheck size={24} color="#f5b731" /> Mes Demandes
        </h1>
        <button onClick={() => setShowForm(true)} className="btn-primary haptic">
          <Plus size={16} /> Nouvelle demande
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card" style={{ borderLeft: '3px solid #f5b731', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Nouvelle demande</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label className="label">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input-field">
                <option value="conge">Congé</option>
                <option value="echange">Échange de shift</option>
              </select>
            </div>
            <div>
              <label className="label">Date début</label>
              <input type="date" value={form.date_debut} onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="label">Date fin</label>
              <input type="date" value={form.date_fin} onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))} className="input-field" />
            </div>
            {form.type === 'echange' && (
              <div>
                <label className="label">Échanger avec</label>
                <select value={form.echange_avec_id} onChange={e => setForm(f => ({ ...f, echange_avec_id: e.target.value }))} className="input-field">
                  <option value="">Sélectionner...</option>
                  {chatteurs.map(c => <option key={c.id} value={c.id}>{c.prenom}</option>)}
                </select>
              </div>
            )}
          </div>

          <label className="label" style={{ marginTop: '1rem' }}>Motif (optionnel)</label>
          <textarea value={form.motif} onChange={e => setForm(f => ({ ...f, motif: e.target.value }))}
            className="input-field" style={{ minHeight: '60px', resize: 'vertical' }}
            placeholder="Raison de la demande..." />

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
            <button onClick={handleSubmit} className="btn-primary haptic">Soumettre</button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center' }}><div className="spinner" /></div>
      ) : demandes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#94a3b8' }}>
          Aucune demande
        </div>
      ) : (
        <div className="stagger-children" style={{ display: 'grid', gap: '0.75rem' }}>
          {demandes.map(d => {
            const badge = STATUT_BADGE[d.statut];
            const BadgeIcon = badge.icon;
            return (
              <div key={d.id} className="card hover-lift" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                flexWrap: 'wrap', gap: '0.75rem',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span className={d.type === 'conge' ? 'badge' : 'badge'} style={{
                      background: d.type === 'conge' ? 'rgba(59,130,246,0.1)' : 'rgba(168,85,247,0.1)',
                      color: d.type === 'conge' ? '#2563eb' : '#7c3aed',
                    }}>
                      {d.type === 'conge' ? 'Congé' : 'Échange'}
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1a1f2e' }}>
                      {d.date_debut} → {d.date_fin}
                    </span>
                  </div>
                  {d.motif && <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>{d.motif}</p>}
                  {d.echange_avec_prenom && <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.15rem' }}>Échange avec {d.echange_avec_prenom}</p>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={badge.cls} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <BadgeIcon size={14} /> {badge.label}
                  </span>
                  {d.statut === 'en_attente' && (
                    <button onClick={() => setDeleteId(d.id)} className="icon-btn" style={{ color: '#ef4444' }} title="Annuler">
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
