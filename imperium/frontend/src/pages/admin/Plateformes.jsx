import { useState, useEffect } from 'react';
import api from '../../api/index';
import { Plus, Edit, X } from 'lucide-react';

const emptyForm = { nom: '', tva_rate: 0, commission_rate: 0.20, devise: 'USD' };

export default function Plateformes() {
  const [plateformes, setPlateformes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');

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
      setModal(false); fetchPlateformes();
    } catch (err) { setError(err.response?.data?.error || 'Erreur'); }
  }

  return (
    <div className="fade-in p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-navy">Plateformes</h1>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2"><Plus size={16} /> Ajouter</button>
      </div>

      {loading ? <div className="text-center text-slate-400 py-12">Chargement...</div> : (
        <div className="card overflow-x-auto" style={{ padding: 0 }}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-3 px-4">Nom</th>
                <th className="text-left py-3 px-4">TVA</th>
                <th className="text-left py-3 px-4">Commission</th>
                <th className="text-left py-3 px-4">Devise</th>
                <th className="text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plateformes.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 px-4 font-medium">{p.nom}</td>
                  <td className="py-3 px-4">{(p.tva_rate * 100).toFixed(0)}%</td>
                  <td className="py-3 px-4">{(p.commission_rate * 100).toFixed(0)}%</td>
                  <td className="py-3 px-4"><span className="badge badge-navy">{p.devise}</span></td>
                  <td className="py-3 px-4"><button onClick={() => openEdit(p)} className="text-navy hover:text-accent"><Edit size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="card w-full max-w-md" style={{ animation: 'floatIn 0.25s ease' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-navy">{editId ? 'Modifier' : 'Ajouter'} une plateforme</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div><label className="label">Nom *</label><input className="input-field" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} required /></div>
              <div><label className="label">TVA (%)</label><input className="input-field" type="number" min="0" max="100" step="0.1" value={form.tva_rate} onChange={e => setForm({...form, tva_rate: parseFloat(e.target.value)})} /></div>
              <div><label className="label">Commission plateforme (%)</label><input className="input-field" type="number" min="0" max="100" step="0.1" value={form.commission_rate} onChange={e => setForm({...form, commission_rate: parseFloat(e.target.value)})} /></div>
              <div><label className="label">Devise</label>
                <select className="input-field" value={form.devise} onChange={e => setForm({...form, devise: e.target.value})}>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
              <button type="submit" className="btn-primary w-full mt-2">{editId ? 'Enregistrer' : 'Créer'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
