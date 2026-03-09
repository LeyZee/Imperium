import { useState, useEffect } from 'react';
import api from '../../api/index';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/StatCard';
import { Trophy, TrendingUp, Euro, Calendar } from 'lucide-react';

const medals = ['🥇', '🥈', '🥉'];

function getMessage(rang) {
  if (rang === 1) return { text: "Tu es en tête de l'équipe, continue comme ça !", color: 'text-amber-500' };
  if (rang <= 3) return { text: "Tu es dans le top 3, encore un effort !", color: 'text-green-500' };
  return { text: "Continue à donner le meilleur de toi-même !", color: 'text-blue-500' };
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

export default function ChatteurDashboard() {
  const { user } = useAuth();
  const [kpis, setKpis] = useState(null);
  const [ventes, setVentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const periode = getPeriodeCourante();

  useEffect(() => {
    if (!user?.chatteur_id) return;
    Promise.all([
      api.get(`/api/chatteurs/${user.chatteur_id}/kpis?periode_debut=${periode.debut}&periode_fin=${periode.fin}`),
      api.get(`/api/ventes?chatteur_id=${user.chatteur_id}&periode_debut=${periode.debut}&periode_fin=${periode.fin}`)
    ]).then(([k, v]) => { setKpis(k.data); setVentes(v.data.slice(0, 5)); })
    .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner" /></div>;

  const paieEstimee = kpis?.paies?.[0]?.total_chatteur || 0;
  const rang = kpis?.rang || 0;
  const msg = getMessage(rang);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <h1 className="text-navy" style={{ fontWeight: 700 }}>Bonjour {user?.prenom || 'toi'} 👋</h1>
        <p className="text-slate-500 text-sm mt-1">Période : {periode.debut} → {periode.fin}</p>
      </div>

      {/* Message d'encouragement */}
      <div className="card" style={{ borderLeft: '3px solid #f5b731' }}>
        <p className={`font-medium ${msg.color}`}>
          {rang > 0 && (medals[rang - 1] || `#${rang}`)} {msg.text}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger-children">
        <StatCard title="Ma paie estimée" value={`${paieEstimee.toFixed(2)} €`} subtitle="Période en cours" icon={Euro} color="#f5b731" />
        <StatCard title="Mon rang" value={medals[rang - 1] || `#${rang || '—'}`} subtitle={`sur ${kpis?.nb_chatteurs || '?'} chatteurs`} icon={Trophy} color="#1b2e4b" />
        <StatCard title="Ventes (période)" value={kpis?.ventes?.[0]?.total_brut?.toFixed(2) + ' $' || '0 $'} subtitle="Montant brut" icon={TrendingUp} color="#10b981" />
      </div>

      {/* Dernières ventes */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <h2 className="text-sm font-semibold text-slate-500">MES DERNIÈRES VENTES</h2>
        </div>
        <div style={{ padding: '0 1.5rem' }}>
          {ventes.length === 0 ? (
            <p className="text-slate-400 text-sm py-6">Aucune vente enregistrée pour cette période</p>
          ) : (
            <div>
              {ventes.map(v => (
                <div key={v.id} className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <span className="text-sm">{new Date(v.created_at).toLocaleDateString('fr-FR')}</span>
                    {v.modele_id && <span className="text-slate-400 text-xs ml-2">· {v.modele_pseudo || ''}</span>}
                  </div>
                  <span className="font-bold" style={{ color: '#f5b731' }}>{v.montant_brut.toFixed(2)} $</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
