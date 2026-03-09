import { useState, useEffect } from 'react';
import api from '../../api/index';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/StatCard';
import { Trophy, TrendingUp, Euro, Calendar } from 'lucide-react';

const medals = ['🥇', '🥈', '🥉'];

function getMessage(rang) {
  if (rang === 1) return { text: "Tu es en tête de l'équipe, continue comme ça !", color: 'text-yellow-400' };
  if (rang <= 3) return { text: "Tu es dans le top 3, encore un effort !", color: 'text-green-400' };
  return { text: "Continue à donner le meilleur de toi-même !", color: 'text-blue-400' };
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-or border-t-transparent rounded-full animate-spin" /></div>;

  const paieEstimee = kpis?.paies?.[0]?.total_chatteur || 0;
  const rang = kpis?.rang || 0;
  const msg = getMessage(rang);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bonjour {user?.prenom || 'toi'} 👋</h1>
        <p className="text-gray-400 text-sm mt-1">Période : {periode.debut} → {periode.fin}</p>
      </div>

      {/* Message d'encouragement */}
      <div className="card border border-white/10">
        <p className={`font-medium ${msg.color}`}>
          {rang > 0 && (medals[rang - 1] || `#${rang}`)} {msg.text}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Ma paie estimée" value={`${paieEstimee.toFixed(2)} €`} subtitle="Période en cours" icon={Euro} color="text-or" />
        <StatCard title="Mon rang" value={medals[rang - 1] || `#${rang || '—'}`} subtitle={`sur ${kpis?.nb_chatteurs || '?'} chatteurs`} icon={Trophy} color="text-yellow-400" />
        <StatCard title="Ventes (période)" value={kpis?.ventes?.[0]?.total_brut?.toFixed(2) + ' $' || '0 $'} subtitle="Montant brut" icon={TrendingUp} color="text-green-400" />
      </div>

      {/* Dernières ventes */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">MES DERNIÈRES VENTES</h2>
        {ventes.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucune vente enregistrée pour cette période</p>
        ) : (
          <div className="space-y-2">
            {ventes.map(v => (
              <div key={v.id} className="flex justify-between items-center py-2 border-b border-white/5">
                <div>
                  <span className="text-sm">{new Date(v.created_at).toLocaleDateString('fr-FR')}</span>
                  {v.modele_id && <span className="text-gray-400 text-xs ml-2">· {v.modele_prenom || ''}</span>}
                </div>
                <span className="font-bold text-or">{v.montant_brut.toFixed(2)} $</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
