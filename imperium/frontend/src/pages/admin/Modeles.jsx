import { useState, useEffect } from 'react';
import api from '../../api/index';
import { Plus, Edit, X } from 'lucide-react';

const emptyForm = { nom: '', prenom: '', part_percent: 0.35 };

export default function Modeles() {
  const [modeles, setModeles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { fetchModeles(); }, []);

  async function fetchModeles() {
    try { const { data } = await api.get('/api/modeles'); setModeles(data); }
    finally { setLoading(false); }
  }

  function openAdd() { setForm(emptyForm); setEditId(null); setModal(true); setError(''); }
  function openEdit(m) { setForm({ ...m }); setEditId(m.id); setModal(true); setError(''); }

  async function handleSubmit(e) {
    e.preventDefault(); setError('');
    try {
      if (editId) await api.put(`/api/modeles/${editId}`, form);
      else await api.post('/api/modeles', form);
      setModal(false); fetchModeles();
    } catch (err) { setError(err.response?.data?.error || 'Erreur'); }
  }

  return (
    <div className="fade-in p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-navy">Modèles</h1>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2"><Plus size={16} /> Ajouter</button>
      </div>

      {loading ? <div className="text-center text-slate-400 py-12">Chargement...</div> : (
        <div className="card overflow-x-auto" style={{ padding: 0 }}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-3 px-4">Nom</th>
                <th className="text-left py-3 px-4">Part (%)</th>
                <th className="text-left py-3 px-4">Statut</th>
                <th className="text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {modeles.map((m) => (
                <tr key={m.id}>
                  <td className="py-3 px-4 font-medium">{m.prenom} {m.nom}</td>
                  <td className="py-3 px-4 font-bold" style={{ color: '#f5b731' }}>{(m.part_percent * 100).toFixed(0)}%</td>
                  <td className="py-3 px-4">
                    <span className={`badge ${m.actif ? 'badge-success' : 'badge-danger'}`}>
                      {m.actif ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4"><button onClick={() => openEdit(m)} className="text-navy hover:text-accent"><Edit size={16} /></button></td>
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
              <h2 className="text-lg font-bold text-navy">{editId ? 'Modifier' : 'Ajouter'} un modèle</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Prénom *</label><input className="input-field" value={form.prenom} onChange={e => setForm({...form, prenom: e.target.value})} required /></div>
                <div><label className="label">Nom *</label><input className="input-field" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} required /></div>
              </div>
              <div>
                <label className="label">Part modèle : {(form.part_percent * 100).toFixed(0)}%</label>
                <input type="range" min="35" max="40" step="1" value={form.part_percent * 100}
                  onChange={e => setForm({...form, part_percent: parseInt(e.target.value) / 100})}
                  className="w-full mt-1" style={{ accentColor: '#f5b731' }} />
                <div className="flex justify-between text-xs text-slate-400 mt-1"><span>35%</span><span>40%</span></div>
              </div>
              <button type="submit" className="btn-primary w-full mt-2">{editId ? 'Enregistrer' : 'Créer'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
