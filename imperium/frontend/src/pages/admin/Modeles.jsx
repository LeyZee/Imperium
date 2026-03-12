import { useState, useEffect } from 'react';
import api from '../../api/index';
import { Plus, Edit, Trash2, X, Camera, User } from 'lucide-react';
import { useToast } from '../../components/Toast.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import { TableSkeleton } from '../../components/Skeleton.jsx';

const emptyForm = { pseudo: '', part_percent: 0.35, photo: null };

export default function Modeles() {
  const toast = useToast();
  const [modeles, setModeles] = useState([]);
  const [plateformes, setPlateformes] = useState([]);
  const [modelPlatforms, setModelPlatforms] = useState({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    try {
      setFetchError(null);
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
    } catch (err) {
      setFetchError(err.response?.data?.error || 'Erreur lors du chargement des modèles');
    } finally { setLoading(false); }
  }

  function openAdd() {
    setForm(emptyForm);
    setEditId(null);
    setSelectedPlatforms([]);
    setPhotoPreview(null);
    setModal(true);
    setError('');
  }

  function openEdit(m) {
    setForm({ ...m });
    setEditId(m.id);
    setSelectedPlatforms(modelPlatforms[m.id] || []);
    setPhotoPreview(m.photo || null);
    setModal(true);
    setError('');
  }

  function togglePlatform(pfId) {
    setSelectedPlatforms(prev =>
      prev.includes(pfId) ? prev.filter(id => id !== pfId) : [...prev, pfId]
    );
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('Photo trop volumineuse (max 2 Mo)'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm(f => ({ ...f, photo: ev.target.result }));
      setPhotoPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
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
      toast.success(editId ? 'Modèle mis à jour' : 'Modèle créé');
      fetchAll();
    } catch (err) { setError(err.response?.data?.error || 'Erreur'); }
  }

  async function handleDeactivate(id) {
    try {
      await api.delete(`/api/modeles/${id}`);
      toast.success('Modèle désactivé');
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.error || 'Erreur'); }
    setConfirmDel(null);
  }

  function getPfColor(pf) {
    if (pf.couleur_fond) return { bg: pf.couleur_fond, text: pf.couleur_texte || '#ffffff', border: pf.couleur_fond + '80' };
    return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
  }

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.5rem' }}>
        <h1 className="text-navy" style={{ fontWeight: 700 }}>Modèles</h1>
        <button onClick={openAdd} className="btn-primary" style={{ whiteSpace: 'nowrap' }}><Plus size={16} /> Ajouter</button>
      </div>

      {fetchError ? (
        <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          {fetchError}
          <button onClick={fetchAll} className="btn-ghost" style={{ marginLeft: '1rem', fontSize: '0.8rem' }}>Réessayer</button>
        </div>
      ) : loading ? <TableSkeleton rows={5} cols={4} /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Pseudo</th>
                  <th>Plateformes</th>
                  <th>Part agence (%)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="stagger-rows">
                {modeles.map((m) => {
                  const mPlatforms = (modelPlatforms[m.id] || [])
                    .map(pid => plateformes.find(p => p.id === pid))
                    .filter(Boolean);
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            width: '30px', height: '30px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                            background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid #e2e8f0',
                          }}>
                            {m.photo ? (
                              <img src={m.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <User size={14} color="#94a3b8" />
                            )}
                          </div>
                          <span style={{ fontWeight: 500 }}>{m.pseudo}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          {mPlatforms.length > 0 ? mPlatforms.map(p => {
                            const c = getPfColor(p);
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
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => openEdit(m)} className="btn-ghost"><Edit size={16} /></button>
                          <button onClick={() => setConfirmDel({ id: m.id, pseudo: m.pseudo })} className="btn-ghost" style={{ color: '#ef4444' }}><Trash2 size={16} /></button>
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
              {/* Photo */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                <label style={{ cursor: 'pointer', position: 'relative' }}>
                  <div style={{
                    width: '72px', height: '72px', borderRadius: '50%', overflow: 'hidden',
                    background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid #e2e8f0',
                  }}>
                    {photoPreview ? (
                      <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={28} color="#94a3b8" />
                    )}
                  </div>
                  <div style={{
                    position: 'absolute', bottom: -2, right: -2,
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: '#f5b731', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid white',
                  }}>
                    <Camera size={12} color="white" />
                  </div>
                  <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                </label>
              </div>

              <div className="form-group">
                <label className="label">Pseudo *</label>
                <input className="input-field" value={form.pseudo} onChange={e => setForm({...form, pseudo: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="label">Part agence : {(form.part_percent * 100).toFixed(0)}%</label>
                <input type="range" min="20" max="50" step="1" value={form.part_percent * 100}
                  onChange={e => setForm({...form, part_percent: parseInt(e.target.value) / 100})}
                  style={{ width: '100%', marginTop: '0.25rem', accentColor: '#f5b731' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                  <span>20%</span><span>50%</span>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="label">Plateformes</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                  {plateformes.map(p => {
                    const active = selectedPlatforms.includes(p.id);
                    const c = getPfColor(p);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlatform(p.id)}
                        style={{
                          padding: '0.4rem 0.85rem',
                          borderRadius: '20px',
                          border: active ? `2px solid ${c.bg}` : '2px solid #e2e8f0',
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

      <ConfirmModal
        open={!!confirmDel}
        title="Désactiver ce modèle ?"
        message={`${confirmDel?.pseudo || ''} sera marqué comme inactif. Cette action est réversible.`}
        onConfirm={() => handleDeactivate(confirmDel.id)}
        onCancel={() => setConfirmDel(null)}
        danger
      />
    </div>
  );
}
