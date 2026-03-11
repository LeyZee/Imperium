import { useState, useEffect } from 'react';
import api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { CardSkeleton } from '../../components/Skeleton.jsx';
import { User, Mail, Globe, Percent, Shield, AlertTriangle } from 'lucide-react';

const PAYS_ISO = { 'France': 'fr', 'Benin': 'bj', 'B\u00e9nin': 'bj', 'Madagascar': 'mg' };

function InfoRow({ icon: Icon, label, value, extra }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.85rem 1rem', borderRadius: '10px',
      background: 'rgba(245,183,49,0.04)',
      transition: 'all 200ms ease',
      cursor: 'default',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,183,49,0.08)'; e.currentTarget.style.transform = 'translateX(4px)'; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,183,49,0.04)'; e.currentTarget.style.transform = 'translateX(0)'; }}
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
  const [chatteur, setChatteur] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.chatteur_id) {
      setLoading(false);
      return;
    }
    api.get(`/api/chatteurs/${user.chatteur_id}`)
      .then(({ data }) => setChatteur(data))
      .catch(() => setError('Impossible de charger ton profil.'))
      .finally(() => setLoading(false));
  }, [user?.chatteur_id]);

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
          <img src={photoUrl} alt="" style={{
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
            alt={chatteur?.pays || ''}
            style={{ width: 20, height: 14, borderRadius: 2, objectFit: 'cover' }}
          />
          <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{chatteur?.pays || 'France'}</span>
        </div>
      </div>

      {/* Infos */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1.25rem' }}>
        <InfoRow
          icon={Mail}
          label="Email"
          value={chatteur?.user_email || chatteur?.email || '\u2014'}
        />
        <InfoRow
          icon={Globe}
          label="Pays"
          value={chatteur?.pays || 'France'}
          extra={
            <img
              src={`https://flagcdn.com/w40/${iso}.png`}
              alt=""
              style={{ width: 18, height: 12, borderRadius: 2, objectFit: 'cover' }}
            />
          }
        />
        <InfoRow
          icon={Percent}
          label="Taux de commission"
          value={chatteur?.taux_commission != null ? `${(chatteur.taux_commission * 100).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : '\u2014'}
        />
        <InfoRow
          icon={Shield}
          label={"\u0052\u00f4le"}
          value={roleLabel}
        />
      </div>
    </div>
  );
}
