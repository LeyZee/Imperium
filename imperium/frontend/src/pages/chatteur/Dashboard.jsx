import { useState, useEffect } from 'react';
import api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import StatCard from '../../components/StatCard.jsx';
import { CardSkeleton } from '../../components/Skeleton.jsx';
import { Trophy, TrendingUp, Euro, AlertTriangle } from 'lucide-react';

const medals = ['🥇', '🥈', '🥉'];

function getMessage(rang, nbChatteurs) {
  if (!rang || rang <= 0) return { text: 'Pas encore de classement pour cette période.', color: '#64748b' };
  if (rang === 1) return { text: "Tu es en tête de l'équipe, continue comme ça !", color: '#f59e0b' };
  if (rang <= 3) return { text: 'Tu es dans le top 3, encore un effort !', color: '#10b981' };
  if (rang <= Math.ceil((nbChatteurs || 10) / 2)) return { text: 'Tu es dans la première moitié, pousse encore !', color: '#3b82f6' };
  return { text: 'Continue à donner le meilleur de toi-même !', color: '#6366f1' };
}

function getPeriodeCourante() {
  const now = new Date();
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0');
  const day = now.getDate();
  if (day < 15) return { debut: `${y}-${m}-01`, fin: `${y}-${m}-15` };
  const next = new Date(y, now.getMonth() + 1, 1);
  const ny = next.getFullYear(), nm = String(next.getMonth() + 1).padStart(2, '0');
  return { debut: `${y}-${m}-15`, fin: `${ny}-${nm}-01` };
}

function formatPeriod(debut, fin) {
  const d = new Date(debut + 'T00:00:00');
  const f = new Date(fin + 'T00:00:00');
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} → ${f.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

export default function ChatteurDashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState(null);
  const [ventes, setVentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const periode = getPeriodeCourante();

  useEffect(() => {
    if (!user?.chatteur_id) return;
    setLoading(true);
    Promise.all([
      api.get(`/api/chatteurs/${user.chatteur_id}/kpis?periode_debut=${periode.debut}&periode_fin=${periode.fin}`),
      api.get(`/api/ventes?chatteur_id=${user.chatteur_id}&periode_debut=${periode.debut}&periode_fin=${periode.fin}`)
        .catch(() => ({ data: [] }))
    ]).then(([k, v]) => {
      setKpis(k.data);
      const ventesData = v.data?.ventes || v.data || [];
      setVentes(Array.isArray(ventesData) ? ventesData.slice(0, 5) : []);
    })
    .catch(() => setError('Impossible de charger les données.'))
    .finally(() => setLoading(false));
  }, [user]);

  const paieEstimee = kpis?.paies?.[0]?.total_chatteur || 0;
  const rang = kpis?.rang || 0;
  const nbChatteurs = kpis?.nb_chatteurs || 0;
  const totalBrut = kpis?.ventes?.[0]?.total_brut || 0;
  const devise = kpis?.ventes?.[0]?.devise || 'USD';
  const msg = getMessage(rang, nbChatteurs);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div>
        <h1 className="text-navy" style={{ fontWeight: 700 }}>Bonjour {user?.prenom || 'toi'} 👋</h1>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
          {formatPeriod(periode.debut, periode.fin)}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.75rem 1rem', borderRadius: '10px',
          background: '#fef2f2', border: '1px solid #fecaca',
        }}>
          <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.82rem', color: '#991b1b' }}>{error}</span>
        </div>
      )}

      {/* Message d'encouragement */}
      {!loading && (
        <div className="card" style={{ borderLeft: `3px solid ${msg.color}`, padding: '0.85rem 1.25rem' }}>
          <p style={{ fontWeight: 500, color: msg.color, fontSize: '0.9rem', margin: 0 }}>
            {rang > 0 && <span style={{ marginRight: '0.4rem' }}>{medals[rang - 1] || `#${rang}`}</span>}
            {msg.text}
          </p>
        </div>
      )}

      {/* Stats */}
      {loading ? (
        <CardSkeleton count={3} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }} className="stagger-children">
          <StatCard
            title="Ma paie estimée"
            value={`${paieEstimee.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
            subtitle="Période en cours"
            icon={Euro}
            color="#f5b731"
          />
          <StatCard
            title="Mon rang"
            value={rang > 0 ? (medals[rang - 1] || `#${rang}`) : '—'}
            subtitle={nbChatteurs > 0 ? `sur ${nbChatteurs} chatteurs` : 'Aucun classement'}
            icon={Trophy}
            color="#1b2e4b"
          />
          <StatCard
            title="Ventes (période)"
            value={`${totalBrut.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${devise === 'USD' ? '$' : '€'}`}
            subtitle="Montant brut"
            icon={TrendingUp}
            color="#10b981"
          />
        </div>
      )}

      {/* Dernières ventes */}
      {!loading && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
          }}>
            <h2 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', letterSpacing: '0.05em', margin: 0 }}>
              MES DERNIÈRES VENTES
            </h2>
          </div>
          <div style={{ padding: '0 1.25rem' }}>
            {ventes.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '2rem 0', textAlign: 'center' }}>
                Aucune vente enregistrée pour cette période
              </p>
            ) : (
              <div>
                {ventes.map(v => (
                  <div key={v.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem' }}>
                        {v.created_at ? new Date(v.created_at).toLocaleDateString('fr-FR') : '—'}
                      </span>
                      {v.modele_pseudo && (
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>· {v.modele_pseudo}</span>
                      )}
                    </div>
                    <span style={{ fontWeight: 700, color: '#f5b731' }}>
                      {(v.montant_brut || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} $
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
