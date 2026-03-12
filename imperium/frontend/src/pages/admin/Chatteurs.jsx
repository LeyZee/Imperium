import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/index';
import { UserPlus, Edit, UserX, X, KeyRound, Camera, Search, MessageSquare, Trash2, Send, Eye } from 'lucide-react';
import { CHATTEUR_COLORS } from '../../constants/colors';
import { STATUTS, STATUT_MAP } from '../../constants/statuses';
import { useToast } from '../../components/Toast.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import { TableSkeleton } from '../../components/Skeleton.jsx';

const emptyForm = {
  prenom: '', email: '', code_postal: '',
  pays: 'Bénin', taux_commission: 0.15,
  role: 'chatteur', taux_net_equipe: 0.05, taux_horaire: 0, couleur: 0, statut: 'actif',
  is_nouveau: false, password: '',
  new_password: '', confirm_password: '', photo: null,
};

const ROLE_LABELS = { chatteur: 'Chatteur', manager: 'Manager', va: 'VA' };
const ROLE_COLORS = {
  chatteur: { bg: '#dbeafe', color: '#1e40af' },
  manager: { bg: '#fef3c7', color: '#b45309' },
  va: { bg: '#f3e8ff', color: '#7c3aed' },
};

const PAYS_ISO = { 'France': 'fr', 'Bénin': 'bj', 'Madagascar': 'mg' };

const COMMISSION_PRESETS = [
  { label: 'Recrue', value: 0.10, color: '#ef4444' },
  { label: 'Confirmé', value: 0.125, color: '#f59e0b' },
  { label: 'Qualifié', value: 0.15, color: '#22c55e' },
];

export default function Chatteurs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isManager = user?.role === 'manager';
  const basePath = user?.role === 'manager' ? '/manager' : '/admin';
  const [chatteurs, setChatteurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [search, setSearch] = useState('');
  const [confirmDel, setConfirmDel] = useState(null); // { id, prenom }
  const fileRef = useRef(null);
  const toast = useToast();

  const filtered = useMemo(() => {
    if (!search.trim()) return chatteurs;
    const q = search.toLowerCase();
    return chatteurs.filter(c =>
      c.prenom?.toLowerCase().includes(q) ||
      c.role?.toLowerCase().includes(q) ||
      c.pays?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  }, [chatteurs, search]);

  useEffect(() => { fetchChatteurs(); }, []);

  async function fetchChatteurs() {
    try {
      setFetchError(null);
      const { data } = await api.get('/api/chatteurs');
      setChatteurs(data);
    } catch (err) {
      setFetchError(err.response?.data?.error || 'Erreur lors du chargement des chatteurs');
    } finally { setLoading(false); }
  }

  function openAdd() { setForm(emptyForm); setEditId(null); setPhotoPreview(null); setModal(true); setError(''); }
  function openEdit(c) {
    const safe = Object.fromEntries(
      Object.entries(c).map(([k, v]) => [k, v === null || v === undefined ? '' : v])
    );
    setForm({
      ...emptyForm, ...safe,
      password: '',
      new_password: '', confirm_password: '',
      original_email: c.user_email || c.email || '',
      photo: c.photo || null,
    });
    setEditId(c.id); setPhotoPreview(c.photo || null); setModal(true); setError('');
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('Photo trop lourde (max 2 Mo)'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result);
      setForm(prev => ({ ...prev, photo: reader.result }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (editId && form.new_password) {
      if (form.new_password.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères');
      if (form.new_password !== form.confirm_password) return setError('Les mots de passe ne correspondent pas');
    }

    try {
      if (editId) {
        await api.put(`/api/chatteurs/${editId}`, form);

        const accountEmail = form.user_email || form.email;
        const hasAccountChanges = accountEmail && (
          form.new_password || accountEmail !== form.original_email || !form.user_id
        );
        if (hasAccountChanges) {
          await api.put(`/api/chatteurs/${editId}/account`, {
            email: accountEmail,
            new_password: form.new_password || undefined,
            confirm_password: form.confirm_password || undefined,
          });
        }
      } else {
        await api.post('/api/chatteurs', form);
      }
      setModal(false);
      toast.success(editId ? 'Chatteur mis à jour' : 'Chatteur créé');
      fetchChatteurs();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    }
  }

  async function handleDeactivate(id) {
    try {
      await api.delete(`/api/chatteurs/${id}`);
      toast.success('Chatteur désactivé');
      setConfirmDel(null);
      fetchChatteurs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur');
    }
  }

  const isEditingSelf = isManager && editId && user?.chatteur_id === editId;
  const commissionCustom = !COMMISSION_PRESETS.some(p => p.value === form.taux_commission);

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.5rem' }}>
        <h1 className="text-navy" style={{ fontWeight: 700 }}>Chatteurs</h1>
        <button onClick={openAdd} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
          <UserPlus size={16} /> Ajouter
        </button>
      </div>

      {/* Search bar */}
      <div style={{ marginBottom: '1rem', position: 'relative', maxWidth: '20rem' }}>
        <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input
          className="input-field"
          placeholder="Rechercher un chatteur..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: '2.25rem', fontSize: '0.85rem' }}
        />
      </div>

      {fetchError ? (
        <div className="alert alert-error" role="alert" style={{ marginBottom: '1rem' }}>
          {fetchError}
          <button onClick={fetchChatteurs} className="btn-ghost" style={{ marginLeft: '1rem', fontSize: '0.8rem' }}>Réessayer</button>
        </div>
      ) : loading ? (
        <div className="card" style={{ padding: '1rem' }}><TableSkeleton rows={8} cols={6} /></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Prénom</th>
                  <th>Rôle</th>
                  <th>Pays</th>
                  <th style={{ textAlign: 'center' }}>Commission</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="stagger-rows">
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                    {search ? 'Aucun résultat' : 'Aucun chatteur'}
                  </td></tr>
                )}
                {filtered.map((c) => {
                  const clr = CHATTEUR_COLORS[c.couleur] || CHATTEUR_COLORS[0];
                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {c.photo ? (
                            <img src={c.photo} alt="" style={{
                              width: 28, height: 28, borderRadius: '50%', objectFit: 'cover',
                              border: `2px solid ${clr.border}`, flexShrink: 0,
                            }} />
                          ) : (
                            <span style={{
                              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                              background: clr.bg, border: `2px solid ${clr.border}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.7rem', fontWeight: 700, color: clr.text,
                            }}>
                              {c.prenom?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          )}
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
                      <td style={{ textAlign: 'center' }}>
                        {c.role === 'va' ? (
                          <span className="badge" style={{ background: '#f3e8ff', color: '#7c3aed' }}>
                            {(c.taux_horaire || 0).toFixed(2)} €/h
                          </span>
                        ) : (
                          <>
                            <span className="badge badge-navy">{(c.taux_commission * 100).toFixed(1).replace('.0', '')}%</span>
                            {c.role === 'manager' && (
                              <span className="badge" style={{
                                marginLeft: '0.3rem', background: '#fef3c7', color: '#b45309',
                                fontSize: '0.65rem',
                              }}>
                                +{(c.taux_net_equipe * 100).toFixed(0)}% éq.
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td>
                        {(() => {
                          const s = STATUT_MAP[c.statut] || STATUT_MAP['actif'];
                          return (
                            <span style={{
                              fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem',
                              borderRadius: '20px', background: s.bg, color: s.color, border: `1px solid ${s.border}`,
                            }}>
                              {s.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => navigate(`${basePath}/chatteurs/${c.id}`)} className="btn-ghost" title="Voir d\u00e9tail"><Eye size={16} /></button>
                          <button onClick={() => openEdit(c)} className="btn-ghost"><Edit size={16} /></button>
                          {c.statut !== 'inactif' && !(isManager && (c.id === user?.chatteur_id || c.role === 'manager')) && <button onClick={() => setConfirmDel({ id: c.id, prenom: c.prenom })} className="btn-ghost" style={{ color: '#ef4444' }}><UserX size={16} /></button>}
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

              {/* Photo de profil */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
                  {photoPreview ? (
                    <img src={photoPreview} alt="" style={{
                      width: 72, height: 72, borderRadius: '50%', objectFit: 'cover',
                      border: '3px solid var(--navy)',
                    }} />
                  ) : (
                    <div style={{
                      width: 72, height: 72, borderRadius: '50%',
                      background: '#f1f5f9', border: '3px dashed #cbd5e1',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Camera size={24} color="#94a3b8" />
                    </div>
                  )}
                  <div style={{
                    position: 'absolute', bottom: -2, right: -2,
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'var(--navy)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Camera size={12} color="#fff" />
                  </div>
                  <input ref={fileRef} type="file" accept="image/*"
                    style={{ display: 'none' }} onChange={handlePhotoChange} />
                </div>
              </div>

              <div className="form-group">
                <label className="label">Prénom *</label>
                <input className="input-field" value={form.prenom} onChange={e => setForm({...form, prenom: e.target.value})} required />
              </div>
              {!isManager && (
                <div className="form-group">
                  <label className="label">Rôle</label>
                  <select className="input-field" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                    <option value="chatteur">Chatteur</option>
                    <option value="manager">Manager</option>
                    <option value="va">VA</option>
                  </select>
                </div>
              )}

              {/* Role-specific compensation */}
              {isEditingSelf && (
                <div className="form-group">
                  <label className="label">Commission personnelle</label>
                  <div style={{
                    padding: '0.5rem 0.75rem', borderRadius: '8px',
                    background: '#f1f5f9', border: '1px solid #e2e8f0',
                    fontSize: '0.85rem', color: '#64748b',
                  }}>
                    {(form.taux_commission * 100).toFixed(1).replace('.0', '')}%
                    <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem', color: '#94a3b8' }}>(non modifiable)</span>
                  </div>
                  {form.role === 'manager' && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <label className="label">Commission équipe</label>
                      <div style={{
                        padding: '0.5rem 0.75rem', borderRadius: '8px',
                        background: '#f1f5f9', border: '1px solid #e2e8f0',
                        fontSize: '0.85rem', color: '#64748b',
                      }}>
                        {(form.taux_net_equipe * 100).toFixed(0)}%
                        <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem', color: '#94a3b8' }}>(non modifiable)</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {isEditingSelf ? null : form.role === 'va' ? (
                <div className="form-group">
                  <label className="label">Taux horaire (€/h)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input className="input-field" type="number" step="0.50" min="0"
                      style={{ width: '7rem' }}
                      value={form.taux_horaire || ''}
                      placeholder="0.00"
                      onChange={e => setForm({...form, taux_horaire: parseFloat(e.target.value) || 0})} />
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>€ par heure</span>
                  </div>
                </div>
              ) : (
                <>
                  {/* Commission presets */}
                  <div className="form-group">
                    <label className="label">Commission personnelle</label>
                    {form.role === 'manager' ? (
                      <>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                          <button type="button"
                            onClick={() => setForm({...form, taux_commission: 0.10})}
                            style={{
                              padding: '0.3rem 0.7rem', borderRadius: '20px',
                              border: `2px solid ${form.taux_commission === 0.10 ? '#f59e0b' : '#e2e8f0'}`,
                              background: form.taux_commission === 0.10 ? 'rgba(245,158,11,0.1)' : '#fafafa',
                              color: form.taux_commission === 0.10 ? '#f59e0b' : '#94a3b8',
                              fontWeight: form.taux_commission === 0.10 ? 700 : 500,
                              fontSize: '0.75rem', cursor: 'pointer', transition: 'all 200ms',
                            }}>
                            10% Manager
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                          <input className="input-field" type="number" step="0.5" min="0" max="100"
                            style={{ width: '6rem', fontSize: '0.85rem' }}
                            value={form.taux_commission !== 0.10 ? (form.taux_commission * 100) : ''}
                            placeholder="Autre %"
                            onChange={e => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v) && v >= 0 && v <= 100) setForm({...form, taux_commission: v / 100});
                            }}
                            onFocus={e => {
                              if (form.taux_commission === 0.10) e.target.value = '10';
                            }} />
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            Actuel : {(form.taux_commission * 100).toFixed(1).replace('.0', '')}%
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                          {COMMISSION_PRESETS.map(p => {
                            const active = form.taux_commission === p.value;
                            return (
                              <button
                                key={p.value}
                                type="button"
                                onClick={() => setForm({...form, taux_commission: p.value})}
                                style={{
                                  padding: '0.3rem 0.7rem', borderRadius: '20px',
                                  border: `2px solid ${active ? p.color : '#e2e8f0'}`,
                                  background: active ? p.color + '18' : '#fafafa',
                                  color: active ? p.color : '#94a3b8',
                                  fontWeight: active ? 700 : 500,
                                  fontSize: '0.75rem', cursor: 'pointer',
                                  transition: 'all 200ms',
                                }}>
                                {(p.value * 100).toFixed(1).replace('.0', '')}% {p.label}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                          <input className="input-field" type="number" step="0.5" min="0" max="100"
                            value={commissionCustom ? (form.taux_commission * 100) : ''}
                            placeholder="Autre %"
                            style={{ width: '6rem', fontSize: '0.85rem' }}
                            onChange={e => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v) && v >= 0 && v <= 100) setForm({...form, taux_commission: v / 100});
                            }}
                            onFocus={e => {
                              if (!commissionCustom) e.target.value = (form.taux_commission * 100).toString();
                            }} />
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            Actuel : {(form.taux_commission * 100).toFixed(1).replace('.0', '')}%
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Manager: team commission rate */}
                  {form.role === 'manager' && (
                    <div className="form-group">
                      <label className="label">Commission équipe (%)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input className="input-field" type="number" step="0.5" min="0" max="100"
                          style={{ width: '6rem' }}
                          value={(form.taux_net_equipe * 100)}
                          onChange={e => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v >= 0 && v <= 100) setForm({...form, taux_net_equipe: v / 100});
                          }} />
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Sur toutes les ventes générées
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="form-group">
                <label className="label">Statut</label>
                <div style={{
                  display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.3rem',
                }}>
                  {STATUTS.map(s => {
                    const active = form.statut === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setForm({...form, statut: s.value})}
                        style={{
                          padding: '0.3rem 0.7rem', borderRadius: '20px',
                          border: `2px solid ${active ? s.border : '#e2e8f0'}`,
                          background: active ? s.bg : '#fafafa',
                          color: active ? s.color : '#94a3b8',
                          fontWeight: active ? 700 : 500,
                          fontSize: '0.75rem', cursor: 'pointer',
                          transition: 'all 200ms',
                        }}
                      >
                        {active ? '● ' : ''}{s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
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
              <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                <div><label className="label">Email</label><input className="input-field" type="email" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} /></div>
                <div><label className="label">Pays</label><input className="input-field" value={form.pays || ''} onChange={e => setForm({...form, pays: e.target.value})} /></div>
              </div>

              {/* Account section — create mode */}
              {!editId && (
                <div className="form-group">
                  <label className="label">Mot de passe (compte login)</label>
                  <input className="input-field" type="password" value={form.password || ''} onChange={e => setForm({...form, password: e.target.value})}
                    placeholder="Minimum 8 caractères (utilise l'email comme identifiant)" />
                </div>
              )}

              {/* Account section — edit mode (admin only) */}
              {editId && !isManager && (
                <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{
                    fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy)',
                    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem',
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                  }}>
                    <KeyRound size={14} /> Compte utilisateur
                  </div>

                  {!form.user_id && (
                    <div style={{
                      background: 'rgba(245, 183, 49, 0.08)', border: '1px solid rgba(245, 183, 49, 0.2)',
                      borderRadius: 'var(--radius)', padding: '0.6rem 0.8rem',
                      fontSize: '0.8rem', color: '#b45309', marginBottom: '0.75rem',
                    }}>
                      Aucun compte utilisateur lié. Remplissez les champs ci-dessous pour en créer un.
                    </div>
                  )}

                  <div className="form-group">
                    <label className="label">Email (identifiant)</label>
                    <input className="input-field" type="email"
                      value={form.user_email || form.email || ''}
                      onChange={e => setForm({...form, user_email: e.target.value, email: e.target.value})}
                      placeholder={form.user_id ? '' : 'Adresse email comme identifiant'} />
                  </div>
                  <div className="form-group">
                    <label className="label">{form.user_id ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe *'}</label>
                    <input className="input-field" type="password" value={form.new_password || ''}
                      onChange={e => setForm({...form, new_password: e.target.value})}
                      placeholder={form.user_id ? '••••••••' : 'Minimum 8 caractères'} />
                  </div>
                  <div className="form-group">
                    <label className="label">Confirmer le mot de passe</label>
                    <input className="input-field" type="password" value={form.confirm_password || ''}
                      onChange={e => setForm({...form, confirm_password: e.target.value})}
                      placeholder="Retapez le mot de passe" />
                  </div>
                </div>
              )}

              {/* Notes section (edit mode only) */}
              {editId && <NotesSection chatteurId={editId} />}

              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>{editId ? 'Enregistrer' : 'Créer'}</button>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDel}
        title="Désactiver ce chatteur ?"
        message={confirmDel ? `${confirmDel.prenom} sera marqué comme inactif. Cette action est réversible.` : ''}
        onConfirm={() => confirmDel && handleDeactivate(confirmDel.id)}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}

function NotesSection({ chatteurId }) {
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchNotes = async () => {
    try {
      const { data } = await api.get(`/api/notes?chatteur_id=${chatteurId}`);
      setNotes(data);
    } catch { /* empty */ }
    setLoading(false);
  };

  useEffect(() => { fetchNotes(); }, [chatteurId]);

  const addNote = async () => {
    if (!newNote.trim()) return;
    try {
      await api.post('/api/notes', { chatteur_id: chatteurId, content: newNote.trim() });
      setNewNote('');
      fetchNotes();
    } catch { /* empty */ }
  };

  const deleteNote = async (id) => {
    try {
      await api.delete(`/api/notes/${id}`);
      fetchNotes();
    } catch { /* empty */ }
  };

  return (
    <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
      <div style={{
        fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy)',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem',
        display: 'flex', alignItems: 'center', gap: '0.4rem',
      }}>
        <MessageSquare size={14} /> Notes ({notes.length})
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <textarea
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          placeholder="Ajouter une note..."
          style={{
            flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px',
            border: '1px solid #e2e8f0', fontSize: '0.8rem',
            minHeight: '40px', resize: 'vertical', fontFamily: 'inherit',
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); }
          }}
        />
        <button type="button" onClick={addNote}
          style={{
            background: '#f5b731', border: 'none', borderRadius: '8px',
            padding: '0.5rem', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end',
          }}>
          <Send size={16} color="#1a1f2e" />
        </button>
      </div>

      {loading ? (
        <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Chargement...</p>
      ) : notes.length === 0 ? (
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>Aucune note</p>
      ) : (
        <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {notes.map(n => (
            <div key={n.id} style={{
              background: '#f8fafc', borderRadius: '8px', padding: '0.5rem 0.75rem',
              fontSize: '0.8rem', border: '1px solid #f1f5f9',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ color: '#334155', lineHeight: 1.4, whiteSpace: 'pre-wrap', flex: 1 }}>{n.content}</p>
                <button type="button" onClick={() => deleteNote(n.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.1rem', flexShrink: 0 }}>
                  <Trash2 size={12} />
                </button>
              </div>
              <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                {n.author_prenom || n.author_email || '-'} · {new Date(n.created_at).toLocaleDateString('fr-FR')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
