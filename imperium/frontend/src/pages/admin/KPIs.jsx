import { useState, useEffect } from 'react';
import api from '../../api/index';

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

const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

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
    <div className="fade-in">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
        <h1 style={{ fontWeight: 700 }}>KPIs Chatteurs</h1>
        <select className="input-field" value={selectedPeriode} onChange={e => setSelectedPeriode(parseInt(e.target.value))}>
          {periodes.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
        </select>
      </div>

      {/* Top 3 cards */}
      {!loading && paies.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }} className="stagger-children">
          {paies.slice(0, 3).map((p, i) => (
            <div key={p.chatteur_id} className="card hover-lift" style={{ textAlign: 'center', borderColor: i === 0 ? '#f5b731' : 'rgba(0,0,0,0.08)', padding: '0.75rem 0.5rem' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{medals[i]}</div>
              <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{p.prenom}</div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f5b731', marginTop: '0.25rem' }}>{p.total_chatteur?.toFixed(0)} &euro;</div>
            </div>
          ))}
        </div>
      )}

      {loading ? <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>Chargement...</div> : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Rang</th>
                <th>Chatteur</th>
                <th style={{ textAlign: 'right' }}>Ventes brutes</th>
                <th style={{ textAlign: 'right' }}>Net HT</th>
                <th style={{ textAlign: 'right' }}>Commission</th>
                <th style={{ textAlign: 'right' }}>Malus</th>
                <th style={{ textAlign: 'right' }}>Prime</th>
                <th style={{ textAlign: 'right', color: '#f5b731' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {paies.map((p, i) => (
                <tr key={p.chatteur_id}>
                  <td>{medals[i] || `#${i+1}`}</td>
                  <td style={{ fontWeight: 500 }}>{p.prenom} {p.nom}</td>
                  <td style={{ textAlign: 'right' }}>{p.ventes_ttc_eur?.toFixed(2)} &euro;</td>
                  <td style={{ textAlign: 'right' }}>{p.net_ht_eur?.toFixed(2)} &euro;</td>
                  <td style={{ textAlign: 'right' }}>{p.commission_chatteur?.toFixed(2)} &euro;</td>
                  <td style={{ textAlign: 'right', color: '#ef4444' }}>{p.malus_total > 0 ? `-${p.malus_total?.toFixed(2)} \u20AC` : '\u2014'}</td>
                  <td style={{ textAlign: 'right', color: '#10b981' }}>{p.prime > 0 ? `+${p.prime?.toFixed(2)} \u20AC` : '\u2014'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#f5b731' }}>{p.total_chatteur?.toFixed(2)} &euro;</td>
                </tr>
              ))}
              {paies.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Aucune donn&eacute;e pour cette p&eacute;riode</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
