import { useState, useEffect } from 'react';
import { Activity, Search, Filter } from 'lucide-react';
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
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1f2e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={24} color="#f5b731" /> Journal d'activité
        </h1>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            value={entityType}
            onChange={e => { setEntityType(e.target.value); setPage(1); }}
            style={{
              padding: '0.5rem 0.75rem', borderRadius: '8px',
              border: '1px solid #e2e8f0', fontSize: '0.85rem',
              background: '#fff', color: '#1a1f2e',
            }}
          >
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
      </div>

      <div style={{
        background: '#fff', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Chargement...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Aucune activité enregistrée</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Utilisateur</th>
                <th style={thStyle}>Action</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Détails</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={tdStyle}>{new Date(log.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={tdStyle}>{log.user_prenom || log.user_email || '-'}</td>
                  <td style={tdStyle}>{ACTION_LABELS[log.action] || log.action}</td>
                  <td style={tdStyle}>
                    <span style={{
                      background: 'rgba(245, 183, 49, 0.1)', color: '#b8860b',
                      padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem',
                    }}>
                      {log.entity_type || '-'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.details || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '1rem', borderTop: '1px solid #e2e8f0' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={paginationBtnStyle}>← Précédent</button>
            <span style={{ padding: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
              Page {page} / {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={paginationBtnStyle}>Suivant →</button>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600,
  color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em',
};

const tdStyle = {
  padding: '0.75rem 1rem', color: '#334155',
};

const paginationBtnStyle = {
  padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #e2e8f0',
  background: '#fff', cursor: 'pointer', fontSize: '0.8rem', color: '#334155',
};
