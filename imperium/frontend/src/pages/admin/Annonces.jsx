import { useState, useEffect, useCallback } from 'react';
import { Megaphone, Plus, Edit2, EyeOff, Send, CheckCircle, Info } from 'lucide-react';
import api from '../../api/index.js';
import { useToast } from '../../components/Toast.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import usePolling from '../../hooks/usePolling.js';

export default function Annonces() {
  const [annonces, setAnnonces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const toast = useToast();

  const fetchAnnonces = useCallback(async () => {
    setLoading(prev => !annonces.length ? true : prev);
    try {
      const { data } = await api.get('/api/annonces');
      setAnnonces(data);
    } catch { /* empty */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAnnonces(); }, []);

  // Auto-refresh every 30s
  usePolling(fetchAnnonces, 30000);

  const handleSave = async (form) => {
    try {
      if (form.id) {
        await api.put(`/api/annonces/${form.id}`, form);
        toast('Annonce mise \u00e0 jour', 'success');
      } else {
        const { data } = await api.post('/api/annonces', form);
        if (data.telegramStats) {
          const s = data.telegramStats;
          toast(`Annonce cr\u00e9\u00e9e ! Telegram : ${s.sent} envoy\u00e9(s)${s.skipped > 0 ? `, ${s.skipped} non li\u00e9(s)` : ''}`, 'success');
        } else {
          toast('Annonce cr\u00e9\u00e9e', 'success');
        }
      }
      setModal(null);
      fetchAnnonces();
    } catch (err) {
      toast(err.response?.data?.error || 'Erreur', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/annonces/${deleteId}`);
      toast('Annonce désactivée', 'success');
      setDeleteId(null);
      fetchAnnonces();
    } catch (err) {
      toast(err.response?.data?.error || 'Erreur', 'error');
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

      {/* Guide / description */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
        padding: '0.75rem 1rem', marginBottom: '1.25rem',
        background: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.15)',
        borderRadius: '8px', fontSize: '0.82rem', color: '#475569', lineHeight: 1.5,
      }}>
        <Info size={16} color="#6366f1" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong style={{ color: '#1a1f2e' }}>Comment ça marche ?</strong> Créez une annonce pour communiquer avec votre équipe.
          L'annonce sera visible dans le tableau de bord de chaque chatteur.
          Vous pouvez aussi l'envoyer directement en <strong>message privé Telegram</strong> à tous les chatteurs liés, ils recevront une notification instantanée sur leur téléphone.
        </div>
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
                  <button onClick={() => setModal(a)} className="icon-btn" title="Modifier" aria-label={`Modifier l'annonce ${a.title}`}><Edit2 size={16} /></button>
                  {a.actif && (
                    <button onClick={() => setDeleteId(a.id)} className="icon-btn" style={{ color: '#ef4444' }} title="Désactiver" aria-label={`Désactiver l'annonce ${a.title}`}><EyeOff size={16} /></button>
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
  const isNew = !data.id;
  const [form, setForm] = useState({
    title: data.title || '',
    content: data.content || '',
    sendTelegram: false,
    ...(data.id ? { id: data.id } : {}),
  });
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSending(true);
    try {
      await onSave(form);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
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

        {/* Telegram toggle — only for new announcements */}
        {isNew && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            marginTop: '1rem', padding: '0.75rem 1rem',
            background: form.sendTelegram ? 'rgba(0, 136, 204, 0.08)' : '#f8fafc',
            border: `1px solid ${form.sendTelegram ? '#0088cc' : '#e2e8f0'}`,
            borderRadius: '8px', cursor: 'pointer',
            transition: 'all 200ms',
          }}>
            <div style={{
              width: 40, height: 22, borderRadius: 11,
              background: form.sendTelegram ? '#0088cc' : '#cbd5e1',
              position: 'relative', transition: 'background 200ms', flexShrink: 0,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 2,
                left: form.sendTelegram ? 20 : 2,
                transition: 'left 200ms',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
              <input type="checkbox" checked={form.sendTelegram}
                onChange={e => setForm(f => ({ ...f, sendTelegram: e.target.checked }))}
                style={{ display: 'none' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: form.sendTelegram ? '#0088cc' : '#475569' }}>
                <Send size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Envoyer aussi via Telegram
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>
                Chaque chatteur recevra l'annonce en message privé
              </div>
            </div>
          </label>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-secondary" disabled={sending}>Annuler</button>
          <button onClick={handleSubmit}
            className="btn-primary haptic"
            disabled={!form.title.trim() || !form.content.trim() || sending}
            style={form.sendTelegram && isNew ? { background: '#0088cc' } : {}}
          >
            {sending ? (
              <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Envoi...</>
            ) : data.id ? 'Modifier' : form.sendTelegram ? (
              <><Send size={14} /> Publier + Telegram</>
            ) : 'Publier'}
          </button>
        </div>
      </div>
    </div>
  );
}
