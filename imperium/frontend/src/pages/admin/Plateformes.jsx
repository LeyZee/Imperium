import { useState, useEffect } from 'react';
import api from '../../api/index';
import { Plus, Edit, Trash2, X } from 'lucide-react';

const emptyForm = { nom: '', tva_rate: 0, commission_rate: 0.20, devise: 'USD' };

export default function Plateformes() {
  const [plateformes, setPlateformes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { fetchPlateformes(); }, []);

  async function fetchPlateformes() {
    try { const { data } = await api.get('/api/plateformes'); setPlateformes(data); }
    finally { setLoading(false); }
  }

  function openAdd() { setForm(emptyForm); setEditId(null); setModal(true); setError(''); }
  function openEdit(p) { setForm({ ...p, tva_rate: p.tva_rate * 100, commission_rate: p.commission_rate * 100 }); setEditId(p.id); setModal(true); setError(''); }

  async function handleSubmit(e) {
    e.preventDefault(); setError('');
    try {
      const payload = { ...form, tva_rate: form.tva_rate / 100, commission_rate: form.commission_rate / 100 };
      if (editId) await api.put(`/api/plateformes/${editId}`, payload);
      else await api.post('/api/plateformes', payload);
      setModal(false);
      setSuccess(editId ? 'Plateforme modifiée avec succès' : 'Plateforme créée avec succès');
      setTimeout(() => setSuccess(''), 3000);
      fetchPlateformes();
    } catch (err) { setError(err.response?.data?.error || 'Erreur'); }
  }

  async function handleDeactivate(id) {
    if (!confirm('Désactiver cette plateforme ?')) return;
    try {
      await api.delete(`/api/plateformes/${id}`);
      setSuccess('Plateforme désactivée');
      setTimeout(() => setSuccess(''), 3000);
      fetchPlateformes();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
      setTimeout(() => setError(''), 3000);
    }
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.5rem' }}>
        <h1 style={{ fontWeight: 700 }}>Plateformes</h1>
        <button onClick={openAdd} className="btn-primary" style={{ whiteSpace: 'nowrap' }}><Plus size={16} /> Ajouter</button>
      </div>

      {success && <div className="toast-success" style={{ marginBottom: '0.75rem' }}>{success}</div>}

      {loading ? <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>Chargement...</div> : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>TVA</th>
                <th>Commission</th>
                <th>Devise</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plateformes.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500 }}>{p.nom}</td>
                  <td>{(p.tva_rate * 100).toFixed(0)}%</td>
                  <td>{(p.commission_rate * 100).toFixed(0)}%</td>
                  <td><span className="badge badge-navy">{p.devise}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => openEdit(p)} className="btn-ghost"><Edit size={16} /></button>
                      <button onClick={() => handleDeactivate(p.id)} className="btn-ghost" style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <span className="modal-title-text">{editId ? 'Modifier' : 'Ajouter'} une plateforme</span>
              <button onClick={() => setModal(false)} className="close-btn"><X size={20} /></button>
            </div>
            {error && <div className="toast-error" style={{ marginBottom: '0.75rem' }}>{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label">Nom *</label>
                <input className="input-field" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="label">TVA (%)</label>
                <input className="input-field" type="number" min="0" max="100" step="0.1" value={form.tva_rate} onChange={e => setForm({...form, tva_rate: parseFloat(e.target.value)})} />
              </div>
              <div className="form-group">
                <label className="label">Commission plateforme (%)</label>
                <input className="input-field" type="number" min="0" max="100" step="0.1" value={form.commission_rate} onChange={e => setForm({...form, commission_rate: parseFloat(e.target.value)})} />
              </div>
              <div className="form-group">
                <label className="label">Devise</label>
                <select className="input-field" value={form.devise} onChange={e => setForm({...form, devise: e.target.value})}>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}>{editId ? 'Enregistrer' : 'Créer'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
