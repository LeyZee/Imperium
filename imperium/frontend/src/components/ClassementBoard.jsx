import { useState, useEffect, useCallback } from 'react';
import { Trophy, Medal, TrendingUp } from 'lucide-react';
import api from '../utils/api';
import { CHATTEUR_COLORS } from '../constants/colors';

function getPeriode() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  if (now.getDate() <= 15) {
    return { debut: `${y}-${m}-01`, fin: `${y}-${m}-15` };
  }
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return { debut: `${y}-${m}-16`, fin: `${y}-${m}-${lastDay}` };
}

const PODIUM_COLORS = ['#f5b731', '#c0c0c0', '#cd7f32'];
const PODIUM_LABELS = ['🥇', '🥈', '🥉'];

export default function ClassementBoard() {
  const [periode, setPeriode] = useState(getPeriode);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchClassement = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/api/chatteurs/classement?periode_debut=${periode.debut}&periode_fin=${periode.fin}`);
      setData(res);
    } catch { /* empty */ }
    setLoading(false);
  }, [periode]);

  useEffect(() => { fetchClassement(); }, [fetchClassement]);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Chargement...</div>;
  if (!data) return null;

  const { classement, total_net_ht_equipe, prime_rates } = data;
  const top3 = classement.slice(0, 3);

  return (
    <div>
      {/* Period selector */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input type="date" value={periode.debut} onChange={e => setPeriode(p => ({ ...p, debut: e.target.value }))}
          style={dateInputStyle} />
        <span style={{ color: '#94a3b8' }}>→</span>
        <input type="date" value={periode.fin} onChange={e => setPeriode(p => ({ ...p, fin: e.target.value }))}
          style={dateInputStyle} />
      </div>

      {/* Cagnotte */}
      <div style={{
        background: 'linear-gradient(135deg, #1b2e4b 0%, #2d4a7a 100%)',
        borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem',
        color: '#fff', textAlign: 'center',
      }}>
        <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.25rem' }}>Cagnotte de la période</p>
        <p style={{ fontSize: '2rem', fontWeight: 700, color: '#f5b731' }}>
          {(total_net_ht_equipe * (prime_rates[0] + prime_rates[1] + prime_rates[2])).toFixed(2)} €
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.75rem', fontSize: '0.75rem' }}>
          <span>🥇 {(total_net_ht_equipe * prime_rates[0]).toFixed(2)} €</span>
          <span>🥈 {(total_net_ht_equipe * prime_rates[1]).toFixed(2)} €</span>
          <span>🥉 {(total_net_ht_equipe * prime_rates[2]).toFixed(2)} €</span>
        </div>
      </div>

      {/* Podium top 3 */}
      {top3.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {top3.map((c, i) => {
            const color = CHATTEUR_COLORS[c.couleur] || CHATTEUR_COLORS[0];
            return (
              <div key={c.id} style={{
                background: '#fff', borderRadius: '16px', padding: '1.25rem 1.5rem',
                border: `2px solid ${PODIUM_COLORS[i]}`, textAlign: 'center',
                minWidth: '140px', flex: '0 1 180px',
                transform: i === 0 ? 'scale(1.05)' : 'none',
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>{PODIUM_LABELS[i]}</div>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 0.5rem', fontWeight: 700, fontSize: '0.85rem',
                  color: color.text || '#fff',
                }}>
                  {c.prenom?.charAt(0)}
                </div>
                <p style={{ fontWeight: 700, color: '#1a1f2e', fontSize: '0.9rem' }}>{c.prenom}</p>
                <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  {c.total_net_ht.toFixed(2)} € Net HT
                </p>
                <p style={{ color: PODIUM_COLORS[i], fontWeight: 700, fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  +{c.prime.toFixed(2)} €
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Full ranking table */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {classement.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Aucune donnée pour cette période</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Chatteur</th>
                <th style={thStyle}>Net HT</th>
                <th style={thStyle}>Prime</th>
                <th style={thStyle}>Total paie</th>
              </tr>
            </thead>
            <tbody>
              {classement.map((c, i) => {
                const color = CHATTEUR_COLORS[c.couleur] || CHATTEUR_COLORS[0];
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', background: i < 3 ? 'rgba(245,183,49,0.04)' : 'transparent' }}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: i < 3 ? PODIUM_COLORS[i] : '#64748b' }}>
                      {i < 3 ? PODIUM_LABELS[i] : i + 1}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.7rem', fontWeight: 700, color: color.text || '#fff',
                        }}>
                          {c.prenom?.charAt(0)}
                        </div>
                        <span style={{ fontWeight: 600 }}>{c.prenom}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>{c.total_net_ht.toFixed(2)} €</td>
                    <td style={{ ...tdStyle, color: c.prime > 0 ? '#f5b731' : '#94a3b8', fontWeight: c.prime > 0 ? 700 : 400 }}>
                      {c.prime > 0 ? `+${c.prime.toFixed(2)} €` : '-'}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{c.total_paie.toFixed(2)} €</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const dateInputStyle = { padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' };
const thStyle = { padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' };
const tdStyle = { padding: '0.75rem 1rem', color: '#334155' };
