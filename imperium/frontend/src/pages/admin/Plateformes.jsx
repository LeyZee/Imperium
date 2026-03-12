import { useState, useEffect } from 'react';
import api from '../../api/index';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import { useToast } from '../../components/Toast.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import { TableSkeleton } from '../../components/Skeleton.jsx';

const DEVISE_SYMBOLS = { 'USD': '$', 'EUR': '€', 'GBP': '£' };
const emptyForm = { nom: '', tva_rate: 0, commission_rate: 20, devise: 'USD', couleur_fond: '#1b2e4b', couleur_texte: '#ffffff' };

export default function Plateformes() {
  const toast = useToast();
  const [plateformes, setPlateformes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => { fetchPlateformes(); }, []);

  async function fetchPlateformes() {
    try {
      setFetchError(null);
      const { data } = await api.get('/api/plateformes');
      setPlateformes(data);
    } catch (err) {
      setFetchError(err.response?.data?.error || 'Erreur lors du chargement des plateformes');
    } finally { setLoading(false); }
  }

  function openAdd() { setForm(emptyForm); setEditId(null); setModal(true); setError(''); }
  function openEdit(p) {
    setForm({
      ...p,
      tva_rate: p.tva_rate * 100,
      commission_rate: p.commission_rate * 100,
      couleur_fond: p.couleur_fond || '#1b2e4b',
      couleur_texte: p.couleur_texte || '#ffffff',
    });
    setEditId(p.id); setModal(true); setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError('');
    try {
      const payload = { ...form, tva_rate: form.tva_rate / 100, commission_rate: form.commission_rate / 100 };
      if (editId) await api.put(`/api/plateformes/${editId}`, payload);
      else await api.post('/api/plateformes', payload);
      setModal(false);
      toast.success(editId ? 'Plateforme modifiée' : 'Plateforme créée');
      fetchPlateformes();
    } catch (err) { setError(err.response?.data?.error || 'Erreur'); }
  }

  async function handleDeactivate(id) {
    try {
      await api.delete(`/api/plateformes/${id}`);
      toast.success('Plateforme désactivée');
      fetchPlateformes();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
    setConfirmDel(null);
  }

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.5rem' }}>
        <h1 style={{ fontWeight: 700 }}>Plateformes</h1>
        <button onClick={openAdd} className="btn-primary" style={{ whiteSpace: 'nowrap' }}><Plus size={16} /> Ajouter</button>
      </div>

      {fetchError ? (
        <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          {fetchError}
          <button onClick={fetchPlateformes} className="btn-ghost" style={{ marginLeft: '1rem', fontSize: '0.8rem' }}>Réessayer</button>
        </div>
      ) : loading ? <TableSkeleton rows={3} cols={6} /> : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>TVA</th>
                <th>Commission</th>
                <th>Devise</th>
                <th>Couleur</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="stagger-rows">
              {plateformes.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500 }}>{p.nom}</td>
                  <td>{(p.tva_rate * 100).toFixed(0)}%</td>
                  <td>{(p.commission_rate * 100).toFixed(0)}%</td>
                  <td><span className="badge badge-navy">{p.devise} ({DEVISE_SYMBOLS[p.devise] || p.devise})</span></td>
                  <td>
                    <span style={{
                      background: p.couleur_fond || '#1b2e4b',
                      color: p.couleur_texte || '#ffffff',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}>{p.nom}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => openEdit(p)} className="btn-ghost"><Edit size={16} /></button>
                      <button onClick={() => setConfirmDel({ id: p.id, nom: p.nom })} className="btn-ghost" style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
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
                <input className="input-field" type="number" min="0" max="100" step="0.1" value={form.tva_rate} onChange={e => setForm({...form, tva_rate: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="form-group">
                <label className="label">Commission plateforme (%)</label>
                <input className="input-field" type="number" min="0" max="100" step="0.1" value={form.commission_rate} onChange={e => setForm({...form, commission_rate: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="form-group">
                <label className="label">Devise</label>
                <select className="input-field" value={form.devise} onChange={e => setForm({...form, devise: e.target.value})}>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="label">Couleur de fond</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="color" value={form.couleur_fond} onChange={e => setForm({...form, couleur_fond: e.target.value})}
                      style={{ width: '40px', height: '36px', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', padding: '2px' }} />
                    <input className="input-field" value={form.couleur_fond} onChange={e => setForm({...form, couleur_fond: e.target.value})}
                      style={{ flex: 1, fontSize: '0.8rem' }} />
                  </div>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="label">Couleur du texte</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="color" value={form.couleur_texte} onChange={e => setForm({...form, couleur_texte: e.target.value})}
                      style={{ width: '40px', height: '36px', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', padding: '2px' }} />
                    <input className="input-field" value={form.couleur_texte} onChange={e => setForm({...form, couleur_texte: e.target.value})}
                      style={{ flex: 1, fontSize: '0.8rem' }} />
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="label" style={{ fontSize: '0.7rem', margin: 0 }}>Aperçu :</span>
                <span style={{
                  background: form.couleur_fond, color: form.couleur_texte,
                  padding: '0.25rem 0.75rem', borderRadius: '20px', fontWeight: 600, fontSize: '0.8rem',
                }}>{form.nom || 'Plateforme'}</span>
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}>{editId ? 'Enregistrer' : 'Créer'}</button>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDel}
        title="Désactiver cette plateforme ?"
        message={`${confirmDel?.nom || ''} sera marquée comme inactive. Cette action est réversible.`}
        onConfirm={() => handleDeactivate(confirmDel.id)}
        onCancel={() => setConfirmDel(null)}
        danger
      />
    </div>
  );
}
