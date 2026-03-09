import { useState, useEffect } from 'react';
import api from '../../api/index';
import { useAuth } from '../../context/AuthContext';
import { Download } from 'lucide-react';

const STATUT_COLORS = {
  'calculé': 'bg-yellow-500/20 text-yellow-400',
  'validé': 'bg-blue-500/20 text-blue-400',
  'payé': 'bg-green-500/20 text-green-400',
};

export default function MesFactures() {
  const { user } = useAuth();
  const [paies, setPaies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/paies').then(({ data }) => {
      setPaies(data.filter(p => p.chatteur_id === user?.chatteur_id));
    }).finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-or mb-6">Mes Factures</h1>

      {loading ? <div className="text-center text-gray-400 py-12">Chargement...</div> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-400">
                <th className="text-left py-3 px-4">Période</th>
                <th className="text-right py-3 px-4">Ventes brutes</th>
                <th className="text-right py-3 px-4">Total payé</th>
                <th className="text-left py-3 px-4">Statut</th>
                <th className="text-center py-3 px-4">Facture</th>
              </tr>
            </thead>
            <tbody>
              {paies.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? 'bg-white/5' : ''}>
                  <td className="py-3 px-4">{p.periode_debut} → {p.periode_fin}</td>
                  <td className="py-3 px-4 text-right">{p.ventes_ttc_eur?.toFixed(2)} €</td>
                  <td className="py-3 px-4 text-right font-bold text-or">{p.total_chatteur?.toFixed(2)} €</td>
                  <td className="py-3 px-4">
                    <span className={`badge ${STATUT_COLORS[p.statut] || ''}`}>{p.statut}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {p.statut !== 'calculé' ? (
                      <a href={`/api/paies/${p.id}/facture`} target="_blank" rel="noopener noreferrer"
                        className="text-or hover:text-yellow-300 inline-flex items-center gap-1">
                        <Download size={16} />
                      </a>
                    ) : <span className="text-gray-600 text-xs">En attente</span>}
                  </td>
                </tr>
              ))}
              {paies.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-gray-500">Aucune paie enregistrée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
