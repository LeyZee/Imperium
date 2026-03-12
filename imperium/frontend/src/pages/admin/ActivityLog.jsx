import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import api from '../../utils/api';

const ACTION_LABELS = {
  create_malus: 'Malus créé',
  update_malus: 'Malus modifié',
  delete_malus: 'Malus supprimé',
  create_prime: 'Prime créée',
  update_prime: 'Prime modifiée',
  delete_prime: 'Prime supprimée',
  create_note: 'Note ajoutée',
  delete_note: 'Note supprimée',
  create_annonce: 'Annonce créée',
  update_annonce: 'Annonce modifiée',
  delete_annonce: 'Annonce désactivée',
  create_demande: 'Demande créée',
  review_demande: 'Demande traitée',
  delete_demande: 'Demande annulée',
  create_objectif: 'Objectif créé',
  update_objectif: 'Objectif modifié',
  delete_objectif: 'Objectif supprimé',
  update_paie_statut: 'Statut paie modifié',
};

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [entityType, setEntityType] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (entityType) params.set('entity_type', entityType);
      const { data } = await api.get(`/api/activity-logs?${params}`);
      setLogs(data.data || []);
      setTotal(data.total || 0);
    } catch { /* empty */ }
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [page, entityType]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="page-enter" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1f2e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={24} color="#f5b731" /> Journal d'activité
        </h1>
        <select value={entityType} onChange={e => { setEntityType(e.target.value); setPage(1); }}
          className="input-field" style={{ width: 'auto' }}>
          <option value="">Tous les types</option>
          <option value="malus">Malus</option>
          <option value="prime">Primes</option>
          <option value="annonce">Annonces</option>
          <option value="demande">Demandes</option>
          <option value="objectif">Objectifs</option>
          <option value="chatteur">Chatteurs</option>
          <option value="paie">Paies</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Aucune activité enregistrée</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Utilisateur</th>
                <th>Action</th>
                <th>Type</th>
                <th>Détails</th>
              </tr>
            </thead>
            <tbody className="stagger-rows">
              {logs.map(log => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{log.user_prenom || log.user_email || '-'}</td>
                  <td>{ACTION_LABELS[log.action] || log.action}</td>
                  <td><span className="badge badge-gold">{log.entity_type || '-'}</span></td>
                  <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.details || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '1rem', borderTop: '1px solid #e2e8f0' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="btn-secondary">← Précédent</button>
            <span style={{ padding: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
              Page {page} / {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="btn-secondary">Suivant →</button>
          </div>
        )}
      </div>
    </div>
  );
}
