import { useState, useEffect } from 'react';
import api from '../../api/index';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

function getPeriodes() {
  const periods = [];
  const now = new Date();
  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear(), m = d.getMonth();
    const label1 = `1-15 ${d.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}`;
    const label2 = `15-fin ${d.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}`;
    periods.push({ label: label2, debut: `${y}-${String(m+1).padStart(2,'0')}-15`, fin: `${y}-${String(m+1).padStart(2,'0')}-${new Date(y, m+1, 0).getDate()}` });
    periods.push({ label: label1, debut: `${y}-${String(m+1).padStart(2,'0')}-01`, fin: `${y}-${String(m+1).padStart(2,'0')}-15` });
  }
  return periods;
}

const medals = ['🥇', '🥈', '🥉'];

export default function KPIs() {
  const periodes = getPeriodes();
  const [selectedPeriode, setSelectedPeriode] = useState(0);
  const [paies, setPaies] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchPaies(); }, [selectedPeriode]);

  async function fetchPaies() {
    setLoading(true);
    const p = periodes[selectedPeriode];
    try {
      const { data } = await api.get(`/api/paies?periode_debut=${p.debut}&periode_fin=${p.fin}`);
      const sorted = [...data].sort((a, b) => b.total_chatteur - a.total_chatteur);
      setPaies(sorted);
    } finally { setLoading(false); }
  }

  return (
    <div className="fade-in p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-navy">KPIs Chatteurs</h1>
        <select className="input-field w-64" value={selectedPeriode} onChange={e => setSelectedPeriode(parseInt(e.target.value))}>
          {periodes.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
        </select>
      </div>

      {/* Top 3 cards */}
      {!loading && paies.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6 stagger-children">
          {paies.slice(0, 3).map((p, i) => (
            <div key={p.chatteur_id} className="card text-center" style={{ borderColor: i === 0 ? '#f5b731' : 'rgba(0,0,0,0.08)' }}>
              <div className="text-4xl mb-2">{medals[i]}</div>
              <div className="font-bold text-lg">{p.prenom} {p.nom}</div>
              <div className="text-2xl font-bold mt-1" style={{ color: '#f5b731' }}>{p.total_chatteur?.toFixed(2)} €</div>
              <div className="text-slate-500 text-sm mt-1">Net brut: {p.net_ht_eur?.toFixed(2)} €</div>
            </div>
          ))}
        </div>
      )}

      {loading ? <div className="text-center text-slate-400 py-12">Chargement...</div> : (
        <div className="card overflow-x-auto" style={{ padding: 0 }}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-3 px-4">Rang</th>
                <th className="text-left py-3 px-4">Chatteur</th>
                <th className="text-right py-3 px-4">Ventes brutes</th>
                <th className="text-right py-3 px-4">Net HT</th>
                <th className="text-right py-3 px-4">Commission</th>
                <th className="text-right py-3 px-4">Malus</th>
                <th className="text-right py-3 px-4">Prime</th>
                <th className="text-right py-3 px-4" style={{ color: '#f5b731' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {paies.map((p, i) => (
                <tr key={p.chatteur_id}>
                  <td className="py-3 px-4">{medals[i] || `#${i+1}`}</td>
                  <td className="py-3 px-4 font-medium">{p.prenom} {p.nom}</td>
                  <td className="py-3 px-4 text-right">{p.ventes_ttc_eur?.toFixed(2)} €</td>
                  <td className="py-3 px-4 text-right">{p.net_ht_eur?.toFixed(2)} €</td>
                  <td className="py-3 px-4 text-right">{p.commission_chatteur?.toFixed(2)} €</td>
                  <td className="py-3 px-4 text-right text-red-500">{p.malus_total > 0 ? `-${p.malus_total?.toFixed(2)} €` : '—'}</td>
                  <td className="py-3 px-4 text-right text-green-500">{p.prime > 0 ? `+${p.prime?.toFixed(2)} €` : '—'}</td>
                  <td className="py-3 px-4 text-right font-bold" style={{ color: '#f5b731' }}>{p.total_chatteur?.toFixed(2)} €</td>
                </tr>
              ))}
              {paies.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate-400">Aucune donnée pour cette période</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
