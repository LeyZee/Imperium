import { useState, useEffect } from 'react';
import { Megaphone, Plus, Edit2, EyeOff } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';

export default function Annonces() {
  const [annonces, setAnnonces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const { addToast } = useToast();

  const fetchAnnonces = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/annonces');
      setAnnonces(data);
    } catch { /* empty */ }
    setLoading(false);
  };

  useEffect(() => { fetchAnnonces(); }, []);

  const handleSave = async (form) => {
    try {
      if (form.id) {
        await api.put(`/api/annonces/${form.id}`, form);
        addToast('Annonce mise à jour', 'success');
      } else {
        await api.post('/api/annonces', form);
        addToast('Annonce créée', 'success');
      }
      setModal(null);
      fetchAnnonces();
    } catch (err) {
      addToast(err.response?.data?.error || 'Erreur', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/annonces/${deleteId}`);
      addToast('Annonce désactivée', 'success');
      setDeleteId(null);
      fetchAnnonces();
    } catch (err) {
      addToast(err.response?.data?.error || 'Erreur', 'error');
    }
  };

  return (
    <div className="page-enter" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1f2e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Megaphone size={24} color="#f5b731" /> Annonces
        </h1>
        <button onClick={() => setModal({ title: '', content: '' })} className="btn-primary haptic">
          <Plus size={16} /> Nouvelle annonce
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : annonces.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Aucune annonce</div>
      ) : (
        <div className="stagger-children" style={{ display: 'grid', gap: '1rem' }}>
          {annonces.map(a => (
            <div key={a.id} className="card" style={{
              borderLeft: a.actif ? '3px solid #f5b731' : '3px solid transparent',
              opacity: a.actif ? 1 : 0.6,
              transition: 'opacity 200ms',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1f2e' }}>{a.title}</h3>
                    <span className={a.actif ? 'badge badge-success' : 'badge badge-danger'}>
                      {a.actif ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{a.content}</p>
                  <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                    Par {a.author_prenom || a.author_email || '-'} · {new Date(a.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setModal(a)} className="icon-btn" title="Modifier"><Edit2 size={16} /></button>
                  {a.actif && (
                    <button onClick={() => setDeleteId(a.id)} className="icon-btn" style={{ color: '#ef4444' }} title="Désactiver"><EyeOff size={16} /></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <AnnonceModal data={modal} onClose={() => setModal(null)} onSave={handleSave} />}
      {deleteId && <ConfirmModal message="Désactiver cette annonce ?" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />}
    </div>
  );
}

function AnnonceModal({ data, onClose, onSave }) {
  const [form, setForm] = useState({ title: data.title || '', content: data.content || '', ...(data.id ? { id: data.id } : {}) });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
          {data.id ? 'Modifier' : 'Nouvelle'} annonce
        </h2>
        <label className="label">Titre</label>
        <input type="text" value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          className="input-field" placeholder="Titre de l'annonce" />

        <label className="label" style={{ marginTop: '0.75rem' }}>Contenu</label>
        <textarea value={form.content}
          onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          className="input-field" style={{ minHeight: '120px', resize: 'vertical' }}
          placeholder="Contenu de l'annonce..." />

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-secondary">Annuler</button>
          <button onClick={() => onSave(form)} className="btn-primary haptic">{data.id ? 'Modifier' : 'Publier'}</button>
        </div>
      </div>
    </div>
  );
}
