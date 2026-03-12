import { useState, useEffect } from 'react';
import { CalendarCheck, Check, X, Clock, Filter } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast.jsx';

const STATUT_BADGE = {
  en_attente: { bg: 'rgba(245,183,49,0.12)', color: '#b8860b', label: 'En attente' },
  approuve: { bg: 'rgba(34,197,94,0.12)', color: '#16a34a', label: 'Approuvé' },
  refuse: { bg: 'rgba(239,68,68,0.12)', color: '#dc2626', label: 'Refusé' },
};

export default function Demandes() {
  const [demandes, setDemandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState('');
  const { addToast } = useToast();

  const fetchDemandes = async () => {
    setLoading(true);
    try {
      const params = filterStatut ? `?statut=${filterStatut}` : '';
      const { data } = await api.get(`/api/demandes${params}`);
      setDemandes(data);
    } catch { /* empty */ }
    setLoading(false);
  };

  useEffect(() => { fetchDemandes(); }, [filterStatut]);

  const handleReview = async (id, statut) => {
    try {
      await api.put(`/api/demandes/${id}/review`, { statut });
      addToast(`Demande ${statut === 'approuve' ? 'approuvée' : 'refusée'}`, 'success');
      fetchDemandes();
    } catch (err) {
      addToast(err.response?.data?.error || 'Erreur', 'error');
    }
  };

  const pendingCount = demandes.filter(d => d.statut === 'en_attente').length;

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1f2e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CalendarCheck size={24} color="#f5b731" /> Demandes
          {pendingCount > 0 && (
            <span style={{
              background: '#f5b731', color: '#1a1f2e', borderRadius: '12px',
              padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: 700,
            }}>
              {pendingCount}
            </span>
          )}
        </h1>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
          style={{
            padding: '0.5rem 0.75rem', borderRadius: '8px',
            border: '1px solid #e2e8f0', fontSize: '0.85rem', background: '#fff',
          }}>
          <option value="">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="approuve">Approuvé</option>
          <option value="refuse">Refusé</option>
        </select>
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Chargement...</div>
        ) : demandes.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Aucune demande</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={thStyle}>Chatteur</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Dates</th>
                <th style={thStyle}>Motif</th>
                <th style={thStyle}>Échange avec</th>
                <th style={thStyle}>Statut</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {demandes.map(d => {
                const badge = STATUT_BADGE[d.statut];
                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={tdStyle}>{d.chatteur_prenom}</td>
                    <td style={tdStyle}>
                      <span style={{
                        background: d.type === 'conge' ? 'rgba(59,130,246,0.1)' : 'rgba(168,85,247,0.1)',
                        color: d.type === 'conge' ? '#2563eb' : '#7c3aed',
                        padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem',
                      }}>
                        {d.type === 'conge' ? 'Congé' : 'Échange'}
                      </span>
                    </td>
                    <td style={tdStyle}>{d.date_debut} → {d.date_fin}</td>
                    <td style={{ ...tdStyle, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.motif || '-'}</td>
                    <td style={tdStyle}>{d.echange_avec_prenom || '-'}</td>
                    <td style={tdStyle}>
                      <span style={{
                        background: badge.bg, color: badge.color,
                        padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                      }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {d.statut === 'en_attente' && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleReview(d.id, 'approuve')}
                            style={{ ...actionBtnStyle, color: '#16a34a' }} title="Approuver">
                            <Check size={16} />
                          </button>
                          <button onClick={() => handleReview(d.id, 'refuse')}
                            style={{ ...actionBtnStyle, color: '#dc2626' }} title="Refuser">
                            <X size={16} />
                          </button>
                        </div>
                      )}
                      {d.statut !== 'en_attente' && d.reviewed_by_prenom && (
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                          Par {d.reviewed_by_prenom}
                        </span>
                      )}
                    </td>
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

const thStyle = { padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' };
const tdStyle = { padding: '0.75rem 1rem', color: '#334155' };
const actionBtnStyle = { background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' };
