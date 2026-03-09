import { useState, useEffect } from 'react';
import api from '../../api/index';
import { UserPlus, Edit, UserX, X } from 'lucide-react';
import { CHATTEUR_COLORS } from '../../constants/colors';

const emptyForm = {
  prenom: '', email: '', adresse: '', code_postal: '',
  ville: '', pays: 'Bénin', iban: '', taux_commission: 0.15,
  role: 'chatteur', taux_net_equipe: 0, couleur: 0,
  is_nouveau: false, username: '', password: ''
};

const ROLE_LABELS = { chatteur: 'Chatteur', manager: 'Manager', va: 'VA' };
const ROLE_COLORS = {
  chatteur: { bg: '#dbeafe', color: '#1e40af' },
  manager: { bg: '#fef3c7', color: '#b45309' },
  va: { bg: '#f3e8ff', color: '#7c3aed' },
};

const PAYS_ISO = { 'France': 'fr', 'Bénin': 'bj', 'Madagascar': 'mg' };

export default function Chatteurs() {
  const [chatteurs, setChatteurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      setSuccess(editId ? 'Chatteur mis à jour' : 'Chatteur créé');
      setTimeout(() => setSuccess(''), 3000);
      fetchChatteurs();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    }
  }

  async function handleDeactivate(id) {
    if (!confirm('Désactiver ce chatteur ?')) return;
    await api.delete(`/api/chatteurs/${id}`);
    setSuccess('Chatteur désactivé');
    setTimeout(() => setSuccess(''), 3000);
    fetchChatteurs();
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.5rem' }}>
        <h1 className="text-navy" style={{ fontWeight: 700 }}>Chatteurs</h1>
        <button onClick={openAdd} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
          <UserPlus size={16} /> Ajouter
        </button>
      </div>

      {success && <div className="toast-success" style={{ marginBottom: '0.75rem' }}>{success}</div>}

      {loading ? <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>Chargement...</div> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Prénom</th>
                  <th>Rôle</th>
                  <th>Pays</th>
                  <th>Commission</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {chatteurs.map((c) => {
                  const clr = CHATTEUR_COLORS[c.couleur] || CHATTEUR_COLORS[0];
                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{
                            width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                            background: clr.bg, border: `2px solid ${clr.border}`,
                          }} />
                          <span style={{ fontWeight: 500 }}>{c.prenom}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem',
                          borderRadius: '20px',
                          background: ROLE_COLORS[c.role]?.bg || '#f1f5f9',
                          color: ROLE_COLORS[c.role]?.color || '#475569',
                        }}>
                          {ROLE_LABELS[c.role] || c.role}
                        </span>
                      </td>
                      <td>
                        {PAYS_ISO[c.pays] ? (
                          <img
                            src={`https://flagcdn.com/w40/${PAYS_ISO[c.pays]}.png`}
                            alt={c.pays}
                            title={c.pays}
                            style={{ width: 24, height: 'auto', borderRadius: 3, verticalAlign: 'middle', cursor: 'default' }}
                          />
                        ) : (
                          <span title={c.pays || '—'} style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            {c.pays || '—'}
                          </span>
                        )}
                      </td>
                      <td><span className="badge badge-navy">{(c.taux_commission * 100).toFixed(0)}%</span></td>
                      <td>
                        <span className={`badge ${c.actif ? 'badge-success' : 'badge-danger'}`}>
                          {c.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => openEdit(c)} className="btn-ghost"><Edit size={16} /></button>
                          {c.actif && <button onClick={() => handleDeactivate(c.id)} className="btn-ghost" style={{ color: '#ef4444' }}><UserX size={16} /></button>}
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
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '32rem' }}>
            <div className="modal-header">
              <span className="modal-title-text">{editId ? 'Modifier' : 'Ajouter'} un chatteur</span>
              <button onClick={() => setModal(false)} className="close-btn"><X size={20} /></button>
            </div>
            {error && <div className="toast-error" style={{ marginBottom: '0.75rem' }}>{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label">Prénom *</label>
                <input className="input-field" value={form.prenom} onChange={e => setForm({...form, prenom: e.target.value})} required />
              </div>
              <div className="form-group">
                <label className="label">Rôle</label>
                <select className="input-field" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="chatteur">Chatteur</option>
                  <option value="manager">Manager</option>
                  <option value="va">VA</option>
                </select>
              </div>
              {form.role === 'manager' && (
                <div className="form-group">
                  <label className="label">Taux Net Équipe (%)</label>
                  <input className="input-field" type="number" step="0.01" min="0" max="1"
                    value={form.taux_net_equipe}
                    onChange={e => setForm({...form, taux_net_equipe: parseFloat(e.target.value) || 0})} />
                </div>
              )}
              <div className="form-group">
                <label className="label">Couleur (shifts)</label>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)',
                  gap: '0.3rem', marginTop: '0.3rem',
                  padding: '0.5rem', background: '#f8fafc',
                  borderRadius: '10px', border: '1px solid #e2e8f0',
                }}>
                  {CHATTEUR_COLORS.map((clr, i) => {
                    const selected = form.couleur === i;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setForm({...form, couleur: i})}
                        title={clr.label}
                        style={{
                          width: '100%', aspectRatio: '1', borderRadius: '8px',
                          background: clr.bg,
                          border: selected ? `3px solid ${clr.text}` : '2px solid transparent',
                          cursor: 'pointer',
                          transition: 'all 150ms ease',
                          transform: selected ? 'scale(1.1)' : 'scale(1)',
                          boxShadow: selected ? `0 2px 8px ${clr.border}80` : 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.7rem', fontWeight: 700, color: clr.text,
                        }}
                      >
                        {selected ? '✓' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="form-group"><label className="label">Email</label><input className="input-field" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div className="form-group"><label className="label">Adresse</label><input className="input-field" value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} /></div>
              <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                <div><label className="label">Ville</label><input className="input-field" value={form.ville} onChange={e => setForm({...form, ville: e.target.value})} /></div>
                <div><label className="label">Pays</label><input className="input-field" value={form.pays} onChange={e => setForm({...form, pays: e.target.value})} /></div>
              </div>
              <div className="form-group"><label className="label">IBAN</label><input className="input-field" value={form.iban} onChange={e => setForm({...form, iban: e.target.value})} /></div>
              <div className="form-group">
                <label className="label">Taux de commission</label>
                <select className="input-field" value={form.taux_commission} onChange={e => setForm({...form, taux_commission: parseFloat(e.target.value)})}>
                  <option value={0.15}>15% (standard)</option>
                  <option value={0.10}>10% (nouveau)</option>
                </select>
              </div>
              {!editId && <>
                <div className="form-group"><label className="label">Username (compte login)</label><input className="input-field" value={form.username} onChange={e => setForm({...form, username: e.target.value})} /></div>
                <div className="form-group"><label className="label">Mot de passe</label><input className="input-field" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} /></div>
              </>}
              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>{editId ? 'Enregistrer' : 'Créer'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
