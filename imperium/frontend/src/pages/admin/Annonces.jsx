import { useState, useEffect } from 'react';
import { Megaphone, Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';
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
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1f2e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Megaphone size={24} color="#f5b731" /> Annonces
        </h1>
        <button onClick={() => setModal({ title: '', content: '' })}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 1rem', borderRadius: '8px',
            background: '#f5b731', color: '#1a1f2e', border: 'none',
            cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
          }}>
          <Plus size={16} /> Nouvelle annonce
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Chargement...</div>
      ) : annonces.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Aucune annonce</div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {annonces.map(a => (
            <div key={a.id} style={{
              background: '#fff', borderRadius: '12px', padding: '1.25rem',
              border: `1px solid ${a.actif ? 'rgba(245,183,49,0.3)' : 'rgba(0,0,0,0.06)'}`,
              opacity: a.actif ? 1 : 0.6,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1f2e' }}>{a.title}</h3>
                    <span style={{
                      fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: '12px',
                      background: a.actif ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      color: a.actif ? '#16a34a' : '#dc2626',
                    }}>
                      {a.actif ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{a.content}</p>
                  <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                    Par {a.author_prenom || a.author_email || '-'} · {new Date(a.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => setModal(a)} style={actionBtnStyle} title="Modifier"><Edit2 size={16} /></button>
                  {a.actif && (
                    <button onClick={() => setDeleteId(a.id)} style={{ ...actionBtnStyle, color: '#ef4444' }} title="Désactiver"><EyeOff size={16} /></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <AnnonceModal data={modal} onClose={() => setModal(null)} onSave={handleSave} />
      )}

      {deleteId && (
        <ConfirmModal
          message="Désactiver cette annonce ?"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

function AnnonceModal({ data, onClose, onSave }) {
  const [form, setForm] = useState({ title: data.title || '', content: data.content || '', ...(data.id ? { id: data.id } : {}) });

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
          {data.id ? 'Modifier' : 'Nouvelle'} annonce
        </h2>
        <label style={labelStyle}>Titre</label>
        <input type="text" value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          style={inputStyle} placeholder="Titre de l'annonce" />

        <label style={labelStyle}>Contenu</label>
        <textarea value={form.content}
          onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }}
          placeholder="Contenu de l'annonce..." />

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={cancelBtnStyle}>Annuler</button>
          <button onClick={() => onSave(form)} style={saveBtnStyle}>{data.id ? 'Modifier' : 'Publier'}</button>
        </div>
      </div>
    </div>
  );
}

const actionBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0.25rem' };
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle = { background: '#fff', borderRadius: '16px', padding: '2rem', width: '90%', maxWidth: '520px' };
const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginTop: '0.75rem', marginBottom: '0.25rem' };
const inputStyle = { width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', boxSizing: 'border-box' };
const cancelBtnStyle = { padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.85rem' };
const saveBtnStyle = { padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: '#f5b731', color: '#1a1f2e', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' };
