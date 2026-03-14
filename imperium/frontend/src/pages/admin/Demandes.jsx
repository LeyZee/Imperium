import { useState, useEffect } from 'react';
import { CalendarCheck, Check, X } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast.jsx';
import { CHATTEUR_COLORS } from '../../constants/colors.js';

const STATUT_BADGE = {
  en_attente: { cls: 'badge badge-warning', label: 'En attente' },
  approuve: { cls: 'badge badge-success', label: 'Approuvé' },
  refuse: { cls: 'badge badge-danger', label: 'Refusé' },
};

export default function Demandes() {
  const [demandes, setDemandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState('');
  const toast = useToast();

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
      toast(`Demande ${statut === 'approuve' ? 'approuvée' : 'refusée'}`, 'success');
      fetchDemandes();
    } catch (err) {
      toast(err.response?.data?.error || 'Erreur', 'error');
    }
  };

  const pendingCount = demandes.filter(d => d.statut === 'en_attente').length;

  return (
    <div className="page-enter" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1f2e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CalendarCheck size={24} color="#f5b731" /> Demandes
          {pendingCount > 0 && <span className="badge badge-gold">{pendingCount}</span>}
        </h1>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
          className="input-field" style={{ width: 'auto' }}>
          <option value="">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="approuve">Approuvé</option>
          <option value="refuse">Refusé</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>
        ) : demandes.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Aucune demande</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Chatteur</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Motif</th>
                <th>Échange avec</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="stagger-rows">
              {demandes.map(d => {
                const badge = STATUT_BADGE[d.statut];
                return (
                  <tr key={d.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: `${CHATTEUR_COLORS[d.chatteur_couleur]?.bg || '#94a3b8'}20`,
                          border: `1.5px solid ${CHATTEUR_COLORS[d.chatteur_couleur]?.bg || '#94a3b8'}50`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.65rem', fontWeight: 700,
                          color: CHATTEUR_COLORS[d.chatteur_couleur]?.bg || '#94a3b8',
                        }}>
                          {d.chatteur_prenom?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{d.chatteur_prenom}</span>
                      </div>
                    </td>
                    <td>
                      <span className={d.type === 'conge' ? 'badge badge-navy' : 'badge badge-gold'}>
                        {d.type === 'conge' ? 'Congé' : 'Échange'}
                      </span>
                    </td>
                    <td>{d.date_debut} → {d.date_fin}</td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.motif || '-'}</td>
                    <td>
                      {d.echange_avec_prenom ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                            background: `${CHATTEUR_COLORS[d.echange_avec_couleur]?.bg || '#94a3b8'}20`,
                            border: `1.5px solid ${CHATTEUR_COLORS[d.echange_avec_couleur]?.bg || '#94a3b8'}50`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.65rem', fontWeight: 700,
                            color: CHATTEUR_COLORS[d.echange_avec_couleur]?.bg || '#94a3b8',
                          }}>
                            {d.echange_avec_prenom?.[0]?.toUpperCase() || '?'}
                          </div>
                          <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{d.echange_avec_prenom}</span>
                        </div>
                      ) : '-'}
                    </td>
                    <td><span className={badge.cls}>{badge.label}</span></td>
                    <td>
                      {d.statut === 'en_attente' && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => handleReview(d.id, 'approuve')}
                            className="icon-btn" style={{ color: '#16a34a' }} title="Approuver">
                            <Check size={16} />
                          </button>
                          <button onClick={() => handleReview(d.id, 'refuse')}
                            className="icon-btn" style={{ color: '#dc2626' }} title="Refuser">
                            <X size={16} />
                          </button>
                        </div>
                      )}
                      {d.statut !== 'en_attente' && d.reviewed_by_prenom && (
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Par {d.reviewed_by_prenom}</span>
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
