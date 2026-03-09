import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LogIn, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    setLoading(true);
    try {
      const user = await login(username.trim(), password);
      if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/chatteur/dashboard', { replace: true });
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Identifiants incorrects.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f1523',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background marble texture */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse at 20% 50%, rgba(201, 168, 76, 0.04) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(26, 39, 68, 0.8) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 80%, rgba(15, 21, 35, 0.9) 0%, transparent 70%)
          `,
          pointerEvents: 'none',
        }}
      />

      {/* Decorative lines */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '5%',
          width: '200px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.2), transparent)',
          transform: 'rotate(-15deg)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '15%',
          right: '5%',
          width: '150px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.15), transparent)',
          transform: 'rotate(15deg)',
        }}
      />

      {/* Login Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          position: 'relative',
          animation: 'fadeIn 0.4s ease',
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
              background: 'rgba(201, 168, 76, 0.08)',
              border: '1px solid rgba(201, 168, 76, 0.25)',
              marginBottom: '1.25rem',
            }}
          >
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1.5rem', color: '#c9a84c' }}>I</span>
          </div>
          <h1
            style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '2.5rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #c9a84c 0%, #e8cc7a 50%, #c9a84c 100%)',
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
              color: '#9aa5b4',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            Agency Management Platform
          </p>
        </div>

        {/* Form Card */}
        <div
          style={{
            background: '#1a2744',
            border: '1px solid rgba(201, 168, 76, 0.15)',
            borderRadius: '14px',
            padding: '2rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          {error && (
            <div className="error-box" style={{ marginBottom: '1.25rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="label" htmlFor="username">Identifiant</label>
              <input
                id="username"
                type="text"
                className="input-field"
                placeholder="Votre identifiant"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
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
                    color: '#6b7280',
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

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.7rem', color: '#6b7280' }}>
          IMPERIUM © 2026 — Accès restreint
        </p>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
