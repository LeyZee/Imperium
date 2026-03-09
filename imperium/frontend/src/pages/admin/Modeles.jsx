import { useState, useEffect } from 'react';
import api from '../../api/index';
import { Plus, Edit, Trash2, X } from 'lucide-react';

const emptyForm = { pseudo: '', part_percent: 0.35 };

export default function Modeles() {
  const [modeles, setModeles] = useState([]);
  const [plateformes, setPlateformes] = useState([]);
  const [modelPlatforms, setModelPlatforms] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    try {
      const [mRes, pRes] = await Promise.all([
        api.get('/api/modeles'),
        api.get('/api/plateformes'),
      ]);
      setModeles(mRes.data);
      setPlateformes(pRes.data);

      const map = {};
      await Promise.all(mRes.data.map(async (m) => {
        const { data } = await api.get(`/api/modeles/${m.id}/plateformes`);
        map[m.id] = data.map(p => p.id);
      }));
      setModelPlatforms(map);
    } finally { setLoading(false); }
  }

  function openAdd() {
    setForm(emptyForm);
    setEditId(null);
    setSelectedPlatforms([]);
    setModal(true);
    setError('');
  }

  function openEdit(m) {
    setForm({ ...m });
    setEditId(m.id);
    setSelectedPlatforms(modelPlatforms[m.id] || []);
    setModal(true);
    setError('');
  }

  function togglePlatform(pfId) {
    setSelectedPlatforms(prev =>
      prev.includes(pfId) ? prev.filter(id => id !== pfId) : [...prev, pfId]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError('');
    try {
      let modeleId = editId;
      if (editId) {
        await api.put(`/api/modeles/${editId}`, form);
      } else {
        const { data } = await api.post('/api/modeles', form);
        modeleId = data.id;
      }

      const current = modelPlatforms[modeleId] || [];
      const toAdd = selectedPlatforms.filter(id => !current.includes(id));
      const toRemove = current.filter(id => !selectedPlatforms.includes(id));
      await Promise.all([
        ...toAdd.map(pid => api.post(`/api/modeles/${modeleId}/plateformes`, { plateforme_id: pid })),
        ...toRemove.map(pid => api.delete(`/api/modeles/${modeleId}/plateformes/${pid}`)),
      ]);

      setModal(false);
      setSuccess(editId ? 'Modèle mis à jour' : 'Modèle créé');
      setTimeout(() => setSuccess(''), 3000);
      fetchAll();
    } catch (err) { setError(err.response?.data?.error || 'Erreur'); }
  }

  async function handleDeactivate(id) {
    if (!confirm('Désactiver ce modèle ?')) return;
    await api.delete(`/api/modeles/${id}`);
    setSuccess('Modèle désactivé');
    setTimeout(() => setSuccess(''), 3000);
    fetchAll();
  }

  const PLATFORM_COLORS = {
    'OnlyFans': { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
    'Reveal': { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  };

  function getPfColor(name) {
    return PLATFORM_COLORS[name] || { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.5rem' }}>
        <h1 className="text-navy" style={{ fontWeight: 700 }}>Modèles</h1>
        <button onClick={openAdd} className="btn-primary" style={{ whiteSpace: 'nowrap' }}><Plus size={16} /> Ajouter</button>
      </div>

      {success && <div className="toast-success" style={{ marginBottom: '0.75rem' }}>{success}</div>}

      {loading ? <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>Chargement...</div> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Pseudo</th>
                  <th>Plateformes</th>
                  <th>Part (%)</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {modeles.map((m) => {
                  const mPlatforms = (modelPlatforms[m.id] || [])
                    .map(pid => plateformes.find(p => p.id === pid))
                    .filter(Boolean);
                  return (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 500 }}>{m.pseudo}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {mPlatforms.length > 0 ? mPlatforms.map(p => {
                            const c = getPfColor(p.nom);
                            return (
                              <span key={p.id} style={{
                                fontSize: '0.65rem', fontWeight: 600,
                                padding: '0.15rem 0.45rem', borderRadius: '20px',
                                background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                              }}>
                                {p.nom}
                              </span>
                            );
                          }) : (
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Aucune</span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, color: '#f5b731' }}>{(m.part_percent * 100).toFixed(0)}%</td>
                      <td>
                        <span className={`badge ${m.actif ? 'badge-success' : 'badge-danger'}`}>
                          {m.actif ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => openEdit(m)} className="btn-ghost"><Edit size={16} /></button>
                          {m.actif && <button onClick={() => handleDeactivate(m.id)} className="btn-ghost" style={{ color: '#ef4444' }}><Trash2 size={16} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '28rem' }}>
            <div className="modal-header">
              <span className="modal-title-text">{editId ? 'Modifier' : 'Ajouter'} un modèle</span>
              <button onClick={() => setModal(false)} className="close-btn"><X size={20} /></button>
            </div>
            {error && <div className="toast-error" style={{ marginBottom: '0.75rem' }}>{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label">Pseudo *</label>
                <input className="input-field" value={form.pseudo} onChange={e => setForm({...form, pseudo: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="label">Part modèle : {(form.part_percent * 100).toFixed(0)}%</label>
                <input type="range" min="35" max="40" step="1" value={form.part_percent * 100}
                  onChange={e => setForm({...form, part_percent: parseInt(e.target.value) / 100})}
                  style={{ width: '100%', marginTop: '0.25rem', accentColor: '#f5b731' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                  <span>35%</span><span>40%</span>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="label">Plateformes</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                  {plateformes.map(p => {
                    const active = selectedPlatforms.includes(p.id);
                    const c = getPfColor(p.nom);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlatform(p.id)}
                        style={{
                          padding: '0.4rem 0.85rem',
                          borderRadius: '20px',
                          border: `2px solid ${active ? c.border : '#e2e8f0'}`,
                          background: active ? c.bg : '#fafafa',
                          color: active ? c.text : '#94a3b8',
                          fontWeight: active ? 700 : 500,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          transition: 'all 200ms',
                        }}
                      >
                        {active ? '✓ ' : ''}{p.nom}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%' }}>{editId ? 'Enregistrer' : 'Créer'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
