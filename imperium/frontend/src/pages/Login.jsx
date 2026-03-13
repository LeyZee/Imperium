import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LogIn, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [shakeKey, setShakeKey] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs.');
      setShakeKey(k => k + 1);
      return;
    }

    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else if (user.role === 'manager') {
        navigate('/manager/dashboard', { replace: true });
      } else {
        navigate('/chatteur/dashboard', { replace: true });
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Identifiants incorrects.';
      setError(msg);
      setShakeKey(k => k + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f5f3ef',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background decorative elements */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse at 20% 50%, rgba(27, 46, 75, 0.03) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(245, 183, 49, 0.04) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 80%, rgba(27, 46, 75, 0.02) 0%, transparent 70%)
          `,
          pointerEvents: 'none',
        }}
      />

      {/* Decorative lines */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '8%',
          width: '180px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(27,46,75,0.12), transparent)',
          transform: 'rotate(-15deg)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '20%',
          right: '8%',
          width: '140px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(245,183,49,0.2), transparent)',
          transform: 'rotate(15deg)',
        }}
      />

      {/* Login Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          position: 'relative',
          animation: 'pageEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Logo section */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'rgba(27, 46, 75, 0.06)',
              border: '2px solid rgba(27, 46, 75, 0.12)',
              marginBottom: '1.25rem',
            }}
          >
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1.5rem', color: '#1b2e4b', fontWeight: 700 }}>I</span>
          </div>
          <h1
            style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '2.5rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #1b2e4b 0%, #243a5e 50%, #1b2e4b 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '0.2em',
              marginBottom: '0.5rem',
            }}
          >
            IMPERIUM
          </h1>
          <p
            style={{
              fontSize: '0.8rem',
              color: '#64748b',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            Tableau de bord
          </p>
        </div>

        {/* Form Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
          }}
        >
          {error && (
            <div key={shakeKey} className="error-box shake" style={{ marginBottom: '1.25rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="text"
                className="input-field"
                placeholder="Votre adresse email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="label" htmlFor="password">Mot de passe</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="input-field"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    padding: '0.25rem',
                    display: 'flex',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', padding: '0.75rem' }}
            >
              {loading ? (
                <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
              ) : (
                <>
                  <LogIn size={16} />
                  Se connecter
                </>
              )}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.7rem', color: '#94a3b8' }}>
          IMPERIUM &copy; 2026 &mdash; Acc&egrave;s restreint
        </p>
      </div>

    </div>
  );
}
