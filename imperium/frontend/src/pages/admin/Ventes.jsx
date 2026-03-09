import { useState, useEffect } from 'react';
import api from '../../api/index';
import { Plus, Trash2 } from 'lucide-react';

const today = new Date().toISOString().split('T')[0];

export default function Ventes() {
  const [ventes, setVentes] = useState([]);
  const [chatteurs, setChatteurs] = useState([]);
  const [modeles, setModeles] = useState([]);
  const [plateformes, setPlateformes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ chatteur_id: '', modele_id: '', plateforme_id: '', montant_brut: '', date: today, notes: '' });
  const [filters, setFilters] = useState({ debut: '', fin: '', chatteur_id: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/api/ventes'),
      api.get('/api/chatteurs'),
      api.get('/api/modeles'),
      api.get('/api/plateformes'),
    ]).then(([v, c, m, p]) => {
      setVentes(v.data); setChatteurs(c.data); setModeles(m.data); setPlateformes(p.data);
    }).finally(() => setLoading(false));
  }, []);

  async function fetchVentes() {
    const params = new URLSearchParams();
    if (filters.debut) params.append('periode_debut', filters.debut);
    if (filters.fin) params.append('periode_fin', filters.fin);
    if (filters.chatteur_id) params.append('chatteur_id', filters.chatteur_id);
    const { data } = await api.get(`/api/ventes?${params}`);
    setVentes(data);
  }

  async function handleAdd(e) {
    e.preventDefault(); setError('');
    try {
      await api.post('/api/ventes', { ...form, montant_brut: parseFloat(form.montant_brut) });
      setForm({ chatteur_id: '', modele_id: '', plateforme_id: '', montant_brut: '', date: today, notes: '' });
      fetchVentes();
    } catch (err) { setError(err.response?.data?.error || 'Erreur'); }
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer cette vente ?')) return;
    await api.delete(`/api/ventes/${id}`);
    fetchVentes();
  }

  const getChatteurName = id => { const c = chatteurs.find(c => c.id == id); return c ? `${c.prenom} ${c.nom}` : '—'; };
  const getModeleName = id => { const m = modeles.find(m => m.id == id); return m ? `${m.prenom} ${m.nom}` : '—'; };
  const getPlatformeName = id => { const p = plateformes.find(p => p.id == id); return p ? p.nom : '—'; };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-or mb-6">Ventes</h1>

      {/* Formulaire ajout */}
      <div className="card mb-6">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">AJOUTER UNE VENTE</h2>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <form onSubmit={handleAdd} className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <select className="input-field" value={form.chatteur_id} onChange={e => setForm({...form, chatteur_id: e.target.value})} required>
            <option value="">Chatteur...</option>
            {chatteurs.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
          </select>
          <select className="input-field" value={form.modele_id} onChange={e => setForm({...form, modele_id: e.target.value})}>
            <option value="">Modèle...</option>
            {modeles.map(m => <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>)}
          </select>
          <select className="input-field" value={form.plateforme_id} onChange={e => setForm({...form, plateforme_id: e.target.value})} required>
            <option value="">Plateforme...</option>
            {plateformes.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
          <input className="input-field" type="number" step="0.01" placeholder="Montant brut" value={form.montant_brut} onChange={e => setForm({...form, montant_brut: e.target.value})} required />
          <input className="input-field" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required />
          <button type="submit" className="btn-primary flex items-center justify-center gap-2"><Plus size={16} /> Ajouter</button>
        </form>
      </div>

      {/* Filtres */}
      <div className="card mb-4">
        <div className="flex gap-3 items-center flex-wrap">
          <input className="input-field flex-1 min-w-32" type="date" placeholder="Date début" value={filters.debut} onChange={e => setFilters({...filters, debut: e.target.value})} />
          <input className="input-field flex-1 min-w-32" type="date" placeholder="Date fin" value={filters.fin} onChange={e => setFilters({...filters, fin: e.target.value})} />
          <select className="input-field flex-1 min-w-40" value={filters.chatteur_id} onChange={e => setFilters({...filters, chatteur_id: e.target.value})}>
            <option value="">Tous les chatteurs</option>
            {chatteurs.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
          </select>
          <button className="btn-primary" onClick={fetchVentes}>Filtrer</button>
        </div>
      </div>

      {loading ? <div className="text-center text-gray-400 py-12">Chargement...</div> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-400">
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-left py-3 px-4">Chatteur</th>
                <th className="text-left py-3 px-4">Modèle</th>
                <th className="text-left py-3 px-4">Plateforme</th>
                <th className="text-right py-3 px-4">Montant brut</th>
                <th className="text-left py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ventes.map((v, i) => (
                <tr key={v.id} className={i % 2 === 0 ? 'bg-white/5' : ''}>
                  <td className="py-3 px-4 text-gray-400">{new Date(v.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="py-3 px-4">{getChatteurName(v.chatteur_id)}</td>
                  <td className="py-3 px-4 text-gray-400">{getModeleName(v.modele_id)}</td>
                  <td className="py-3 px-4"><span className="badge">{getPlatformeName(v.plateforme_id)}</span></td>
                  <td className="py-3 px-4 text-right font-bold text-or">{v.montant_brut.toFixed(2)}</td>
                  <td className="py-3 px-4"><button onClick={() => handleDelete(v.id)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button></td>
                </tr>
              ))}
              {ventes.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-500">Aucune vente</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
