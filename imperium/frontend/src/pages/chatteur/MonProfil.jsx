import { useState, useEffect } from 'react';
import api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { CardSkeleton } from '../../components/Skeleton.jsx';
import { useToast } from '../../components/Toast.jsx';
import { User, Mail, Globe, Percent, Shield, AlertTriangle, Lock, Save, Eye, EyeOff } from 'lucide-react';

const PAYS_ISO = { 'France': 'fr', 'Benin': 'bj', 'Bénin': 'bj', 'Madagascar': 'mg' };

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

export default function MonProfil() {
  const { user } = useAuth();
  const toast = useToast();
  const [chatteur, setChatteur] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Password change form
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchProfile = () => {
    if (!user?.chatteur_id) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api.get(`/api/chatteurs/${user.chatteur_id}`, { signal: controller.signal })
      .then(({ data }) => setChatteur(data))
      .catch((err) => { if (!controller.signal.aborted) setError('Impossible de charger ton profil.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  };

  useEffect(() => {
    const cleanup = fetchProfile();
    return cleanup;
  }, [user?.chatteur_id]);

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

  const iso = PAYS_ISO[chatteur?.pays] || 'fr';
  const photoUrl = chatteur?.photo || user?.photo;
  const roleLabel = { chatteur: 'Chatteur', manager: 'Manager', va: 'VA' }[chatteur?.role] || 'Chatteur';

  return (
    <div className="page-enter stagger-children" style={{ maxWidth: 500, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header avec photo */}
      <div className="card" style={{ textAlign: 'center', padding: '2rem 1.5rem 1.5rem' }}>
        {photoUrl ? (
          <img src={photoUrl} alt={chatteur?.prenom || 'Profil'} style={{
            width: 80, height: 80, borderRadius: '50%', objectFit: 'cover',
            border: '3px solid rgba(245,183,49,0.4)', margin: '0 auto 1rem',
            display: 'block',
          }} />
        ) : (
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'rgba(245,183,49,0.12)', border: '3px solid rgba(245,183,49,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <User size={32} color="#f5b731" />
          </div>
        )}
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1b2e4b', marginBottom: '0.35rem' }}>
          {chatteur?.prenom || 'Mon Profil'}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <img
            src={`https://flagcdn.com/w40/${iso}.png`}
            alt={chatteur?.pays || 'France'}
            style={{ width: 20, height: 14, borderRadius: 2, objectFit: 'cover' }}
          />
          <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{chatteur?.pays || 'France'}</span>
        </div>
      </div>

      {/* Infos */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.25rem' }}>
        <InfoRow icon={Mail} label="Email" value={chatteur?.user_email || chatteur?.email || '\u2014'} />
        <InfoRow
          icon={Globe} label="Pays" value={chatteur?.pays || 'France'}
          extra={<img src={`https://flagcdn.com/w40/${iso}.png`} alt="" style={{ width: 18, height: 12, borderRadius: 2, objectFit: 'cover' }} />}
        />
        <InfoRow
          icon={Percent} label="Taux de commission"
          value={chatteur?.taux_commission != null ? `${(chatteur.taux_commission * 100).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : '\u2014'}
        />
        <InfoRow icon={Shield} label="Rôle" value={roleLabel} />
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
