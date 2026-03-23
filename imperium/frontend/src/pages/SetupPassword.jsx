import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/index.js';
import { Lock, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';

export default function SetupPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [status, setStatus] = useState('loading'); // loading | valid | invalid | expired | used | success
  const [prenom, setPrenom] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/api/auth/setup-password/${token}`)
      .then(({ data }) => {
        if (data.valid) {
          setPrenom(data.prenom || '');
          setStatus('valid');
        } else {
          setStatus(data.reason || 'invalid');
        }
      })
      .catch(() => setStatus('invalid'));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password) return setError('Mot de passe requis');
    if (password.length < 8) return setError('Min. 8 caractères requis');
    if (!/[A-Z]/.test(password)) return setError('Le mot de passe doit contenir une majuscule');
    if (!/[0-9]/.test(password)) return setError('Le mot de passe doit contenir un chiffre');
    if (!/[^a-zA-Z0-9]/.test(password)) return setError('Le mot de passe doit contenir un caractère spécial');
    if (password !== confirm) return setError('Les mots de passe ne correspondent pas');

    setSaving(true);
    try {
      const { data } = await api.post(`/api/auth/setup-password/${token}`, { password });
      // Auto-login: store user in session
      sessionStorage.setItem('user', JSON.stringify(data.user));
      refreshUser(data.user);
      setStatus('success');
      setTimeout(() => {
        if (data.user.role === 'admin') navigate('/admin/dashboard', { replace: true });
        else if (data.user.role === 'manager') navigate('/manager/dashboard', { replace: true });
        else navigate('/chatteur/dashboard', { replace: true });
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la configuration');
    } finally {
      setSaving(false);
    }
  };

  const renderContent = () => {
    if (status === 'loading') {
      return (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 1rem' }} />
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Vérification du lien...</p>
        </div>
      );
    }

    if (status === 'success') {
      return (
        <div style={{ textAlign: 'center', padding: '1.5rem' }}>
          <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1b2e4b', marginBottom: '0.5rem' }}>
            Mot de passe créé !
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Redirection vers ton tableau de bord...</p>
        </div>
      );
    }

    if (status === 'expired' || status === 'used' || status === 'invalid') {
      const messages = {
        expired: { title: 'Lien expiré', text: 'Ce lien d\'invitation a expiré. Demande un nouveau lien à ton administrateur.' },
        used: { title: 'Lien déjà utilisé', text: 'Ce lien a déjà été utilisé pour créer un mot de passe.' },
        invalid: { title: 'Lien invalide', text: 'Ce lien d\'invitation n\'est pas valide.' },
      };
      const msg = messages[status] || messages.invalid;
      return (
        <div style={{ textAlign: 'center', padding: '1.5rem' }}>
          <AlertTriangle size={48} color="#f59e0b" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1b2e4b', marginBottom: '0.5rem' }}>
            {msg.title}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.6 }}>{msg.text}</p>
          <a href="/login" className="btn-primary" style={{ display: 'inline-flex', marginTop: '1.5rem', padding: '0.6rem 1.5rem' }}>
            Aller à la connexion
          </a>
        </div>
      );
    }

    // status === 'valid' — show password form
    return (
      <div style={{ padding: '0.5rem 0' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1b2e4b', marginBottom: '0.25rem', textAlign: 'center' }}>
          Bienvenue {prenom} !
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.82rem', textAlign: 'center', marginBottom: '1.5rem' }}>
          Choisis un mot de passe pour accéder à Imperium
        </p>

        {error && (
          <div className="error-box shake" style={{ marginBottom: '1rem' }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="label">Mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'}
                className="input-field"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 car., 1 maj., 1 chiffre, 1 spécial"
                autoComplete="new-password"
                autoFocus
                disabled={saving}
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                style={{
                  position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0.25rem', display: 'flex',
                }}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Confirmer le mot de passe</label>
            <input
              type={showPwd ? 'text' : 'password'}
              className="input-field"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Retapez le mot de passe"
              autoComplete="new-password"
              disabled={saving}
            />
          </div>

          {password && confirm && password !== confirm && (
            <p style={{ fontSize: '0.75rem', color: '#ef4444', margin: '-0.5rem 0 0.75rem' }}>
              Les mots de passe ne correspondent pas
            </p>
          )}

          <button type="submit" className="btn-primary" disabled={saving}
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', padding: '0.75rem' }}>
            {saving ? (
              <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
            ) : (
              <><Lock size={16} /> Créer mon mot de passe</>
            )}
          </button>
        </form>
      </div>
    );
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#f5f3ef',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse at 20% 50%, rgba(27, 46, 75, 0.03) 0%, transparent 60%),
          radial-gradient(ellipse at 80% 20%, rgba(245, 183, 49, 0.04) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 80%, rgba(27, 46, 75, 0.02) 0%, transparent 70%)
        `,
        pointerEvents: 'none',
      }} />
      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', animation: 'pageEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(27, 46, 75, 0.06)', border: '2px solid rgba(27, 46, 75, 0.12)',
            marginBottom: '1.25rem',
          }}>
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1.5rem', color: '#1b2e4b', fontWeight: 700 }}>I</span>
          </div>
          <h1 style={{
            fontFamily: 'Cinzel, serif', fontSize: '2.5rem', fontWeight: 700,
            background: 'linear-gradient(135deg, #1b2e4b 0%, #243a5e 50%, #1b2e4b 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            letterSpacing: '0.2em', marginBottom: '0.5rem',
          }}>
            IMPERIUM
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Tableau de bord
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#ffffff', border: '1px solid rgba(0, 0, 0, 0.08)',
          borderRadius: '16px', padding: '2rem',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
        }}>
          {renderContent()}
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.7rem', color: '#94a3b8' }}>
          IMPERIUM &copy; 2026 &mdash; Acc&egrave;s restreint
        </p>
      </div>
    </div>
  );
}
