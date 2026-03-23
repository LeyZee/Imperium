import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/index.js';
import { CheckCircle, AlertTriangle } from 'lucide-react';

export default function VerifyEmail() {
  const { token } = useParams();
  const [status, setStatus] = useState('loading'); // loading | success | expired | used | invalid | conflict
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    api.get(`/api/auth/verify-email/${token}`)
      .then(({ data }) => {
        if (data.success) {
          setNewEmail(data.new_email);
          setStatus('success');
        } else {
          setStatus(data.reason || 'invalid');
        }
      })
      .catch(() => setStatus('invalid'));
  }, [token]);

  const messages = {
    expired: { title: 'Lien expiré', text: 'Ce lien de vérification a expiré. Refais une demande de changement d\'email depuis ton profil.' },
    used: { title: 'Lien déjà utilisé', text: 'Ce changement d\'email a déjà été confirmé.' },
    invalid: { title: 'Lien invalide', text: 'Ce lien de vérification n\'est pas valide.' },
    conflict: { title: 'Email déjà pris', text: 'Cet email est désormais utilisé par un autre compte. Choisis un autre email.' },
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
          {status === 'loading' && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 1rem' }} />
              <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Vérification en cours...</p>
            </div>
          )}

          {status === 'success' && (
            <div style={{ textAlign: 'center', padding: '1.5rem' }}>
              <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 1rem' }} />
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1b2e4b', marginBottom: '0.5rem' }}>
                Email mis à jour !
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.6 }}>
                Ton adresse email a été changée pour <strong style={{ color: '#1b2e4b' }}>{newEmail}</strong>.
                Utilise cette adresse pour te connecter.
              </p>
              <a href="/login" className="btn-primary" style={{ display: 'inline-flex', marginTop: '1.5rem', padding: '0.6rem 1.5rem' }}>
                Se connecter
              </a>
            </div>
          )}

          {messages[status] && (
            <div style={{ textAlign: 'center', padding: '1.5rem' }}>
              <AlertTriangle size={48} color="#f59e0b" style={{ margin: '0 auto 1rem' }} />
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1b2e4b', marginBottom: '0.5rem' }}>
                {messages[status].title}
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.6 }}>{messages[status].text}</p>
              <a href="/login" className="btn-primary" style={{ display: 'inline-flex', marginTop: '1.5rem', padding: '0.6rem 1.5rem' }}>
                Aller à la connexion
              </a>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.7rem', color: '#94a3b8' }}>
          IMPERIUM &copy; 2026 &mdash; Acc&egrave;s restreint
        </p>
      </div>
    </div>
  );
}
