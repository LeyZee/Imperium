import { useState, useEffect } from 'react';
import api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { CardSkeleton } from '../../components/Skeleton.jsx';
import { useToast } from '../../components/Toast.jsx';
import { User, Mail, Percent, AlertTriangle, Lock, Save, Eye, EyeOff, Camera, Globe, Pencil, Send, CheckCircle } from 'lucide-react';

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

export default function ModeleProfil() {
  const { user } = useAuth();
  const toast = useToast();
  const [modele, setModele] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Password change form
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Email change
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function handleEmailChange() {
    if (!newEmail.trim()) return toast.error('Saisis un nouvel email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) return toast.error('Email invalide');
    setEmailSaving(true);
    try {
      await api.post('/api/auth/change-email', { new_email: newEmail.trim() });
      setEmailSent(true);
      toast.success('Email de vérification envoyé');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur');
    } finally {
      setEmailSaving(false);
    }
  }

  const fetchProfile = () => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api.get('/api/modele/profil', { signal: controller.signal })
      .then(({ data }) => setModele(data))
      .catch((err) => { if (!controller.signal.aborted) setError('Impossible de charger votre profil.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  };

  useEffect(() => {
    const cleanup = fetchProfile();
    return cleanup;
  }, []);

  const handlePasswordChange = async () => {
    if (!pwdForm.current_password || !pwdForm.new_password) {
      return toast('Remplis tous les champs', 'error');
    }
    if (pwdForm.new_password.length < 8) {
      return toast('Min. 8 caractères requis', 'error');
    }
    if (!/[A-Z]/.test(pwdForm.new_password)) {
      return toast('Le mot de passe doit contenir une majuscule', 'error');
    }
    if (!/[0-9]/.test(pwdForm.new_password)) {
      return toast('Le mot de passe doit contenir un chiffre', 'error');
    }
    if (!/[^a-zA-Z0-9]/.test(pwdForm.new_password)) {
      return toast('Le mot de passe doit contenir un caractère spécial', 'error');
    }
    if (pwdForm.new_password !== pwdForm.confirm_password) {
      return toast('Les mots de passe ne correspondent pas', 'error');
    }

    setSaving(true);
    try {
      await api.put('/api/auth/password', {
        current_password: pwdForm.current_password,
        new_password: pwdForm.new_password,
      });
      toast('Mot de passe mis à jour', 'success');
      setShowPwdForm(false);
      setPwdForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      toast(err.response?.data?.error || 'Erreur', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      return toast('Format accepté : JPEG, PNG, GIF, WebP', 'error');
    }
    if (file.size > 2 * 1024 * 1024) {
      return toast('Photo trop lourde (max 2 Mo)', 'error');
    }
    setUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api.put('/api/auth/profile', { photo: reader.result });
        setModele(prev => ({ ...prev, photo: reader.result }));
        toast('Photo mise à jour', 'success');
      } catch (err) {
        toast(err.response?.data?.error || 'Erreur lors du téléchargement', 'error');
      } finally {
        setUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading) return <div className="page-enter" style={{ maxWidth: 500, margin: '0 auto' }}><CardSkeleton count={2} /></div>;

  if (error) {
    return (
      <div className="page-enter" style={{ maxWidth: 500, margin: '0 auto' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.75rem 1rem', borderRadius: '10px',
          background: '#fef2f2', border: '1px solid #fecaca',
        }}>
          <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', color: '#991b1b' }}>{error}</span>
        </div>
        <button onClick={fetchProfile}
          className="btn-primary haptic" style={{ marginTop: '1rem' }}>
          Réessayer
        </button>
      </div>
    );
  }

  const photoUrl = modele?.photo || user?.photo;
  const avatarBg = modele?.couleur_fond || 'rgba(245,183,49,0.1)';
  const avatarText = modele?.couleur_texte || '#f5b731';
  const avatarBorder = (modele?.couleur_fond || '#f5b731') + '30';

  return (
    <div className="page-enter stagger-children" style={{ maxWidth: 500, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header avec photo */}
      <div className="card" style={{ textAlign: 'center', padding: '2rem 1.5rem 1.5rem' }}>
        <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 1rem' }}>
          {photoUrl ? (
            <img src={photoUrl} alt={modele?.pseudo || 'Profil'} style={{
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
              {(modele?.pseudo || '?')[0].toUpperCase()}
            </div>
          )}
          {/* Camera overlay button */}
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
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1b2e4b', marginBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <User size={22} color="#f5b731" /> {modele?.pseudo || 'Mon Profil'}
        </h1>
        <span style={{
          fontSize: '0.72rem', fontWeight: 600,
          padding: '0.2rem 0.6rem', borderRadius: '20px',
          background: '#fce7f3', color: '#be185d',
          display: 'inline-block', marginTop: '0.5rem',
        }}>
          Modèle
        </span>
      </div>

      {/* Infos */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.25rem' }}>
        <InfoRow icon={User} label="Pseudo" value={modele?.pseudo || '—'} />
        <InfoRow icon={Mail} label="Email" value={modele?.email || user?.email || '—'}
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
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 1rem', marginTop: '-0.25rem' }}>
            <input type="email" className="input-field"
              value={newEmail} onChange={e => setNewEmail(e.target.value)}
              placeholder="Nouvel email"
              style={{ flex: 1, fontSize: '0.82rem', padding: '0.5rem 0.75rem' }}
              autoFocus
            />
            <button onClick={handleEmailChange} disabled={emailSaving}
              className="btn-primary haptic"
              style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              {emailSaving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Send size={13} />}
              Vérifier
            </button>
            <button onClick={() => setShowEmailForm(false)}
              className="btn-secondary" style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem' }}>
              Annuler
            </button>
          </div>
        )}
        {emailSent && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', marginTop: '-0.25rem', background: 'rgba(16,185,129,0.06)', borderRadius: '8px' }}>
            <CheckCircle size={14} color="#10b981" />
            <span style={{ fontSize: '0.78rem', color: '#065f46' }}>
              Un email de vérification a été envoyé à <strong>{newEmail}</strong>
            </span>
          </div>
        )}
        <InfoRow
          icon={Globe} label="Plateformes"
          value={
            modele?.plateformes?.length > 0 ? (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {modele.plateformes.map(p => (
                  <span key={p.id || p.plateforme_id} style={{
                    fontSize: '0.72rem', fontWeight: 600,
                    padding: '0.2rem 0.55rem', borderRadius: '20px',
                    background: p.couleur_fond || '#f1f5f9',
                    color: p.couleur_texte || '#475569',
                  }}>
                    {p.nom || p.plateforme_nom}
                  </span>
                ))}
              </div>
            ) : '\u2014'
          }
        />
        <InfoRow
          icon={Percent} label="Part agence"
          value={modele?.part_percent != null ? `${(modele.part_percent * 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%` : '—'}
        />
      </div>

      {/* Change password section */}
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
                onChange={e => setPwdForm(f => ({ ...f, current_password: e.target.value }))}
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
                  onChange={e => setPwdForm(f => ({ ...f, new_password: e.target.value }))}
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
                onChange={e => setPwdForm(f => ({ ...f, confirm_password: e.target.value }))}
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
              <button onClick={handlePasswordChange} disabled={saving}
                className="btn-primary haptic" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Save size={16} />}
                Enregistrer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
