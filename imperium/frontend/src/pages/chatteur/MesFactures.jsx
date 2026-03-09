import { useState, useEffect } from 'react';
import api from '../../api/index';
import { useAuth } from '../../context/AuthContext';
import { Download } from 'lucide-react';

const STATUT_COLORS = {
  'calculé': 'badge-warning',
  'validé': 'badge-navy',
  'payé': 'badge-success',
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
    <div className="fade-in">
      <h1 className="text-navy" style={{ fontWeight: 700, marginBottom: '1rem' }}>Mes Factures</h1>

      {loading ? <div className="text-center text-slate-400 py-12">Chargement...</div> : (
        <div className="card overflow-x-auto" style={{ padding: 0 }}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-3 px-4">Période</th>
                <th className="text-right py-3 px-4">Ventes brutes</th>
                <th className="text-right py-3 px-4">Total payé</th>
                <th className="text-left py-3 px-4">Statut</th>
                <th className="text-center py-3 px-4">Facture</th>
              </tr>
            </thead>
            <tbody>
              {paies.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 px-4">{p.periode_debut} → {p.periode_fin}</td>
                  <td className="py-3 px-4 text-right">{p.ventes_ttc_eur?.toFixed(2)} €</td>
                  <td className="py-3 px-4 text-right font-bold" style={{ color: '#f5b731' }}>{p.total_chatteur?.toFixed(2)} €</td>
                  <td className="py-3 px-4">
                    <span className={`badge ${STATUT_COLORS[p.statut] || 'badge-navy'}`}>{p.statut}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {p.statut !== 'calculé' ? (
                      <a href={`/api/paies/${p.id}/facture`} target="_blank" rel="noopener noreferrer"
                        className="text-navy hover:text-accent inline-flex items-center gap-1">
                        <Download size={16} />
                      </a>
                    ) : <span className="text-slate-400 text-xs">En attente</span>}
                  </td>
                </tr>
              ))}
              {paies.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">Aucune paie enregistrée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
