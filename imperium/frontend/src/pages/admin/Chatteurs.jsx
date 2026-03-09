import { useState, useEffect } from 'react';
import api from '../../api/index';
import { UserPlus, Edit, UserX, X } from 'lucide-react';

const emptyForm = {
  nom: '', prenom: '', email: '', adresse: '', code_postal: '',
  ville: '', pays: 'Bénin', iban: '', taux_commission: 0.15,
  is_nouveau: false, username: '', password: ''
};

export default function Chatteurs() {
  const [chatteurs, setChatteurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { fetchChatteurs(); }, []);

  async function fetchChatteurs() {
    try {
      const { data } = await api.get('/api/chatteurs');
      setChatteurs(data);
    } finally { setLoading(false); }
  }

  function openAdd() { setForm(emptyForm); setEditId(null); setModal(true); setError(''); }
  function openEdit(c) {
    setForm({ ...c, password: '', username: c.username || '' });
    setEditId(c.id); setModal(true); setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editId) await api.put(`/api/chatteurs/${editId}`, form);
      else await api.post('/api/chatteurs', form);
      setModal(false);
      fetchChatteurs();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    }
  }

  async function handleDeactivate(id) {
    if (!confirm('Désactiver ce chatteur ?')) return;
    await api.delete(`/api/chatteurs/${id}`);
    fetchChatteurs();
  }

  return (
    <div className="fade-in p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-navy">Chatteurs</h1>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <UserPlus size={16} /> Ajouter
        </button>
      </div>

      {loading ? <div className="text-center text-slate-400 py-12">Chargement...</div> : (
        <div className="card overflow-x-auto" style={{ padding: 0 }}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-3 px-4">Nom</th>
                <th className="text-left py-3 px-4">Email</th>
                <th className="text-left py-3 px-4">Pays</th>
                <th className="text-left py-3 px-4">Commission</th>
                <th className="text-left py-3 px-4">Statut</th>
                <th className="text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {chatteurs.map((c) => (
                <tr key={c.id}>
                  <td className="py-3 px-4 font-medium">{c.prenom} {c.nom}</td>
                  <td className="py-3 px-4 text-slate-500">{c.email || '—'}</td>
                  <td className="py-3 px-4 text-slate-500">{c.pays}</td>
                  <td className="py-3 px-4">
                    <span className="badge badge-navy">{(c.taux_commission * 100).toFixed(0)}%</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`badge ${c.actif ? 'badge-success' : 'badge-danger'}`}>
                      {c.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="py-3 px-4 flex gap-2">
                    <button onClick={() => openEdit(c)} className="text-navy hover:text-accent"><Edit size={16} /></button>
                    {c.actif && <button onClick={() => handleDeactivate(c.id)} className="text-red-400 hover:text-red-500"><UserX size={16} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ animation: 'floatIn 0.25s ease' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-navy">{editId ? 'Modifier' : 'Ajouter'} un chatteur</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Prénom *</label><input className="input-field" value={form.prenom} onChange={e => setForm({...form, prenom: e.target.value})} required /></div>
                <div><label className="label">Nom *</label><input className="input-field" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} required /></div>
              </div>
              <div><label className="label">Email</label><input className="input-field" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div><label className="label">Adresse</label><input className="input-field" value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Ville</label><input className="input-field" value={form.ville} onChange={e => setForm({...form, ville: e.target.value})} /></div>
                <div><label className="label">Pays</label><input className="input-field" value={form.pays} onChange={e => setForm({...form, pays: e.target.value})} /></div>
              </div>
              <div><label className="label">IBAN</label><input className="input-field" value={form.iban} onChange={e => setForm({...form, iban: e.target.value})} /></div>
              <div><label className="label">Taux de commission</label>
                <select className="input-field" value={form.taux_commission} onChange={e => setForm({...form, taux_commission: parseFloat(e.target.value)})}>
                  <option value={0.15}>15% (standard)</option>
                  <option value={0.10}>10% (nouveau)</option>
                </select>
              </div>
              {!editId && <>
                <div><label className="label">Username (compte login)</label><input className="input-field" value={form.username} onChange={e => setForm({...form, username: e.target.value})} /></div>
                <div><label className="label">Mot de passe</label><input className="input-field" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} /></div>
              </>}
              <button type="submit" className="btn-primary w-full mt-2">{editId ? 'Enregistrer' : 'Créer'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
