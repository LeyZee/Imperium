import { useState, useRef, useEffect } from 'react';
import api from '../../api/index';
import { useAuth } from '../../context/AuthContext';
import { validateEmail, validatePassword } from '../../utils/validators';
import { Camera, Save, Eye, EyeOff } from 'lucide-react';

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const fileRef = useRef(null);

  const [prenom, setPrenom] = useState(user?.prenom || '');
  const [email, setEmail] = useState(user?.email || '');
  const [photo, setPhoto] = useState(user?.photo || null);
  const [photoPreview, setPhotoPreview] = useState(user?.photo || null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const timerRef = useRef(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('Photo trop lourde (max 2 Mo)'); return; }
    const reader = new FileReader();
    reader.onload = () => { setPhotoPreview(reader.result); setPhoto(reader.result); };
    reader.readAsDataURL(file);
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(''); setSuccess('');

    const emailErr = validateEmail(email);
    if (emailErr) return setError(emailErr);

    if (newPassword) {
      if (!currentPassword) return setError('Mot de passe actuel requis');
      const pwdErr = validatePassword(newPassword);
      if (pwdErr) return setError(pwdErr);
      if (newPassword !== confirmPassword) return setError('Les mots de passe ne correspondent pas');
    }

    setSaving(true);
    try {
      const payload = { email, prenom, photo };
      if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }
      const { data } = await api.put('/api/auth/profile', payload);
      refreshUser({ email: data.email, prenom: data.prenom, photo: data.photo });
      setSuccess(newPassword ? 'Profil et mot de passe mis à jour' : 'Profil mis à jour');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      timerRef.current = setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally { setSaving(false); }
  }

  return (
    <div className="page-enter">
      <h1 className="text-navy" style={{ fontWeight: 700, marginBottom: '1.5rem' }}>Paramètres</h1>

      <div className="card" style={{ maxWidth: '32rem' }}>
        {success && <div className="toast-success" style={{ marginBottom: '1rem' }}>{success}</div>}
        {error && <div className="toast-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <form onSubmit={handleSave}>
          {/* Photo */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
              {photoPreview ? (
                <img src={photoPreview} alt="" style={{
                  width: 88, height: 88, borderRadius: '50%', objectFit: 'cover',
                  border: '3px solid var(--navy)',
                }} />
              ) : (
                <div style={{
                  width: 88, height: 88, borderRadius: '50%',
                  background: '#f1f5f9', border: '3px dashed #cbd5e1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Camera size={28} color="#94a3b8" />
                </div>
              )}
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--navy)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                border: '2px solid #fff',
              }}>
                <Camera size={13} color="#fff" />
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
            </div>
          </div>

          {/* Profile info */}
          <div className="form-group">
            <label className="label" htmlFor="settings-prenom">Prénom</label>
            <input id="settings-prenom" className="input-field" value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Votre prénom" />
          </div>
          <div className="form-group">
            <label className="label" htmlFor="settings-email">Email (identifiant)</label>
            <input id="settings-email" className="input-field" type="email" value={email} onChange={e => setEmail(e.target.value)} required aria-required="true" />
          </div>

          {/* Password section */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
            <div style={{
              fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy)',
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem',
            }}>
              Changer le mot de passe
            </div>
            <div className="form-group">
              <label className="label" htmlFor="settings-current-pwd">Mot de passe actuel</label>
              <div style={{ position: 'relative' }}>
                <input id="settings-current-pwd" className="input-field" type={showCurrent ? 'text' : 'password'}
                  value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••" style={{ paddingRight: '2.5rem' }} />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                  aria-label={showCurrent ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.25rem', display: 'flex' }}>
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="label" htmlFor="settings-new-pwd">Nouveau mot de passe</label>
              <div style={{ position: 'relative' }}>
                <input id="settings-new-pwd" className="input-field" type={showNew ? 'text' : 'password'}
                  value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 caractères" style={{ paddingRight: '2.5rem' }} />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  aria-label={showNew ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.25rem', display: 'flex' }}>
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label className="label" htmlFor="settings-confirm-pwd">Confirmer</label>
              <input id="settings-confirm-pwd" className="input-field" type="password" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)} placeholder="Retapez le mot de passe" />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={saving}
            style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }}>
            <Save size={16} />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  );
}
