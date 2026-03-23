import { useState, useEffect } from 'react';
import api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import { CHATTEUR_COLORS } from '../../constants/colors.js';
import { Mail, Shield, Lock, Save, Eye, EyeOff, Camera, Pencil, Send, CheckCircle, User as UserIcon } from 'lucide-react';

const ROLE_COLORS = {
  chatteur: { bg: '#dbeafe', color: '#1e40af' },
  manager: { bg: '#fef3c7', color: '#b45309' },
  directeur: { bg: '#ede9fe', color: '#6366f1' },
  va: { bg: '#f3e8ff', color: '#7c3aed' },
  admin: { bg: '#fef3c7', color: '#92400e' },
};
const ROLE_LABELS = { chatteur: 'Chatteur', manager: 'Manager', directeur: 'Directeur', va: 'VA', admin: 'Admin' };

function InfoRow({ icon: Icon, label, value, extra }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.85rem 1rem', borderRadius: '10px',
      background: 'rgba(245,183,49,0.04)',
      transition: 'all 200ms ease',
      cursor: 'default',
    }}
    className="hover-row"
    >
      <div style={{
        width: 36, height: 36, borderRadius: '10px',
        background: 'rgba(27,46,75,0.06)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={16} color="#1b2e4b" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 500, marginBottom: '0.1rem' }}>{label}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1b2e4b' }}>{value || '\u2014'}</span>
          {extra}
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();

  // Editable prenom
  const [editingPrenom, setEditingPrenom] = useState(false);
  const [prenomValue, setPrenomValue] = useState(user?.prenom || '');
  const [savingPrenom, setSavingPrenom] = useState(false);

  // Email change (verified flow for manager, direct for admin)
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Password change
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  // Photo upload
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Chatteur data (for couleur)
  const [chatteurData, setChatteurData] = useState(null);

  useEffect(() => {
    // Fetch full user data from /me to get chatteur info
    api.get('/api/auth/me').then(({ data }) => {
      if (data.chatteur) setChatteurData(data.chatteur);
    }).catch(() => {});
  }, []);

  const roleColor = ROLE_COLORS[user?.role] || ROLE_COLORS.admin;
  const roleLabel = ROLE_LABELS[user?.role] || user?.role;

  // Avatar color: use assigned user color from CHATTEUR_COLORS, fallback to role color
  const userClr = (user?.couleur != null ? CHATTEUR_COLORS[user.couleur] : null)
    || (chatteurData?.couleur != null ? CHATTEUR_COLORS[chatteurData.couleur] : null);
  const avatarBg = userClr?.bg || roleColor.bg;
  const avatarText = userClr?.text || roleColor.color;
  const avatarBorder = userClr?.border || `${roleColor.color}30`;

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast('Photo trop lourde (max 2 Mo)', 'error');
    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const { data } = await api.put('/api/auth/profile', { photo: reader.result });
        refreshUser({ photo: data.photo });
        toast('Photo mise à jour', 'success');
      } catch (err) {
        toast(err.response?.data?.error || 'Erreur', 'error');
      } finally {
        setUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePrenomSave = async () => {
    if (!prenomValue.trim()) return toast('Prénom requis', 'error');
    setSavingPrenom(true);
    try {
      const { data } = await api.put('/api/auth/profile', { prenom: prenomValue.trim() });
      refreshUser({ prenom: data.prenom });
      setEditingPrenom(false);
      toast('Prénom mis à jour', 'success');
    } catch (err) {
      toast(err.response?.data?.error || 'Erreur', 'error');
    } finally {
      setSavingPrenom(false);
    }
  };

  const handleEmailChange = async () => {
    if (!newEmail.trim()) return toast('Saisis un nouvel email', 'error');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) return toast('Email invalide', 'error');

    setEmailSaving(true);
    try {
      if (user?.role === 'admin') {
        // Admin: direct email change
        const { data } = await api.put('/api/auth/profile', { email: newEmail.trim() });
        refreshUser({ email: data.email });
        setShowEmailForm(false);
        setNewEmail('');
        toast('Email mis à jour', 'success');
      } else {
        // Manager: verified email change flow
        await api.post('/api/auth/change-email', { new_email: newEmail.trim() });
        setEmailSent(true);
        toast('Email de vérification envoyé', 'success');
      }
    } catch (err) {
      toast(err.response?.data?.error || 'Erreur', 'error');
    } finally {
      setEmailSaving(false);
    }
  };

  const handlePasswordSave = async () => {
    const { current_password, new_password, confirm_password } = pwdForm;
    if (!current_password) return toast('Mot de passe actuel requis', 'error');
    if (!new_password) return toast('Nouveau mot de passe requis', 'error');
    if (new_password.length < 8) return toast('Min. 8 caractères requis', 'error');
    if (!/[A-Z]/.test(new_password)) return toast('Le mot de passe doit contenir une majuscule', 'error');
    if (!/[0-9]/.test(new_password)) return toast('Le mot de passe doit contenir un chiffre', 'error');
    if (!/[^a-zA-Z0-9]/.test(new_password)) return toast('Le mot de passe doit contenir un caractère spécial', 'error');
    if (new_password !== confirm_password) return toast('Les mots de passe ne correspondent pas', 'error');

    setSavingPwd(true);
    try {
      await api.put('/api/auth/profile', { current_password, new_password });
      setPwdForm({ current_password: '', new_password: '', confirm_password: '' });
      setShowPwdForm(false);
      toast('Mot de passe mis à jour', 'success');
    } catch (err) {
      toast(err.response?.data?.error || 'Erreur', 'error');
    } finally {
      setSavingPwd(false);
    }
  };

  const photoUrl = user?.photo;

  return (
    <div className="page-enter stagger-children" style={{ maxWidth: 500, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header with photo */}
      <div className="card" style={{ textAlign: 'center', padding: '2rem 1.5rem 1.5rem' }}>
        <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 1rem' }}>
          {photoUrl ? (
            <img src={photoUrl} alt={user?.prenom || 'Profil'} style={{
              width: 80, height: 80, borderRadius: '50%', objectFit: 'cover',
              border: `3px solid ${avatarBorder}`, display: 'block',
            }} />
          ) : (
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: avatarBg, border: `3px solid ${avatarBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.75rem', fontWeight: 700, color: avatarText,
            }}>
              {(user?.prenom || user?.email || '?')[0].toUpperCase()}
            </div>
          )}
          <label
            className="haptic"
            style={{
              position: 'absolute', bottom: -2, right: -2,
              width: 28, height: 28, borderRadius: '50%',
              background: '#f5b731', border: '2px solid #fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              transition: 'transform 150ms ease',
            }}
            title="Changer la photo"
          >
            {uploadingPhoto
              ? <span className="spinner" style={{ width: 14, height: 14 }} />
              : <Camera size={14} color="#fff" />}
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handlePhotoUpload}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        {/* Editable prenom */}
        {editingPrenom ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
            <input
              className="input-field"
              value={prenomValue}
              onChange={e => setPrenomValue(e.target.value)}
              style={{ fontSize: '1rem', fontWeight: 700, textAlign: 'center', maxWidth: 200, padding: '0.4rem 0.75rem' }}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handlePrenomSave()}
            />
            <button onClick={handlePrenomSave} disabled={savingPrenom}
              className="btn-primary haptic" style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}>
              {savingPrenom ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Save size={13} />}
            </button>
            <button onClick={() => { setEditingPrenom(false); setPrenomValue(user?.prenom || ''); }}
              className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}>
              Annuler
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1b2e4b', marginBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <UserIcon size={22} color="#f5b731" /> {user?.prenom || 'Mon Profil'}
            </h1>
            <button
              onClick={() => { setPrenomValue(user?.prenom || ''); setEditingPrenom(true); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', display: 'flex' }}
              title="Modifier le prénom"
            >
              <Pencil size={13} color="#94a3b8" />
            </button>
          </div>
        )}
        <span style={{
          fontSize: '0.72rem', fontWeight: 600,
          padding: '0.2rem 0.6rem', borderRadius: '20px',
          background: roleColor.bg, color: roleColor.color,
          display: 'inline-block', marginTop: '0.5rem',
        }}>
          {roleLabel}
        </span>
      </div>

      {/* Info cards */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.25rem' }}>
        <InfoRow icon={Mail} label="Email" value={user?.email || '\u2014'}
          extra={
            !showEmailForm && !emailSent && (
              <button onClick={() => { setShowEmailForm(true); setNewEmail(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', display: 'flex' }}
                title="Modifier l'email">
                <Pencil size={13} color="#94a3b8" />
              </button>
            )
          }
        />
        {showEmailForm && !emailSent && (
          <div style={{
            display: 'flex', gap: '0.5rem', alignItems: 'center',
            padding: '0.5rem 1rem', marginTop: '-0.25rem',
          }}>
            <input
              type="email" className="input-field"
              value={newEmail} onChange={e => setNewEmail(e.target.value)}
              placeholder="Nouvel email"
              style={{ flex: 1, fontSize: '0.82rem', padding: '0.5rem 0.75rem' }}
              autoFocus
            />
            <button onClick={handleEmailChange} disabled={emailSaving}
              className="btn-primary haptic"
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {emailSaving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Send size={13} />}
              {user?.role === 'admin' ? 'Enregistrer' : 'Vérifier'}
            </button>
            <button onClick={() => setShowEmailForm(false)}
              className="btn-secondary" style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>
              Annuler
            </button>
          </div>
        )}
        {emailSent && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.5rem 1rem', marginTop: '-0.25rem',
            background: 'rgba(16,185,129,0.06)', borderRadius: '8px',
          }}>
            <CheckCircle size={14} color="#10b981" />
            <span style={{ fontSize: '0.78rem', color: '#065f46' }}>
              Un email de vérification a été envoyé à <strong>{newEmail}</strong>
            </span>
          </div>
        )}
        <InfoRow icon={Shield} label="Rôle" value={
          <span style={{
            fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.5rem',
            borderRadius: '20px', background: roleColor.bg, color: roleColor.color,
          }}>{roleLabel}</span>
        } />
      </div>

      {/* Password section */}
      <div className="card" style={{ padding: '1.25rem' }}>
        {!showPwdForm ? (
          <button
            onClick={() => setShowPwdForm(true)}
            className="btn-secondary haptic"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <Lock size={16} /> Changer mon mot de passe
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1b2e4b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={16} color="#f5b731" /> Changer le mot de passe
            </h3>

            <div>
              <label className="label" style={{ fontSize: '0.75rem' }}>Mot de passe actuel</label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={pwdForm.current_password}
                onChange={e => setPwdForm(p => ({ ...p, current_password: e.target.value }))}
                className="input-field"
                placeholder="Mot de passe actuel"
                autoComplete="current-password"
              />
            </div>

            <div>
              <label className="label" style={{ fontSize: '0.75rem' }}>Nouveau mot de passe</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={pwdForm.new_password}
                  onChange={e => setPwdForm(p => ({ ...p, new_password: e.target.value }))}
                  className="input-field"
                  style={{ paddingRight: '2.5rem' }}
                  placeholder="Min. 8 car., 1 maj., 1 chiffre, 1 spécial"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem',
                  }}
                  title={showPwd ? 'Masquer' : 'Afficher'}
                >
                  {showPwd ? <EyeOff size={16} color="#94a3b8" /> : <Eye size={16} color="#94a3b8" />}
                </button>
              </div>
            </div>

            <div>
              <label className="label" style={{ fontSize: '0.75rem' }}>Confirmer</label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={pwdForm.confirm_password}
                onChange={e => setPwdForm(p => ({ ...p, confirm_password: e.target.value }))}
                className="input-field"
                placeholder="Confirmer le mot de passe"
                autoComplete="new-password"
              />
            </div>

            {pwdForm.new_password && pwdForm.confirm_password && pwdForm.new_password !== pwdForm.confirm_password && (
              <p style={{ fontSize: '0.75rem', color: '#ef4444', margin: 0 }}>Les mots de passe ne correspondent pas</p>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button onClick={() => { setShowPwdForm(false); setPwdForm({ current_password: '', new_password: '', confirm_password: '' }); }}
                className="btn-secondary" style={{ flex: 1 }}>
                Annuler
              </button>
              <button onClick={handlePasswordSave} disabled={savingPwd}
                className="btn-primary haptic" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                {savingPwd ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Save size={16} />}
                Enregistrer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
