import { useState, useEffect } from 'react';
import { Activity, Trash2, RefreshCw } from 'lucide-react';
import api from '../../utils/api';

const TYPE_COLORS = {
  malus:    { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  prime:    { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  annonce:  { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  demande:  { bg: '#fefce8', color: '#ca8a04', border: '#fef08a' },
  objectif: { bg: '#faf5ff', color: '#9333ea', border: '#e9d5ff' },
  chatteur: { bg: '#ecfeff', color: '#0891b2', border: '#a5f3fc' },
  paie:     { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
  vente:    { bg: '#fdf4ff', color: '#c026d3', border: '#f5d0fe' },
};

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
  create_vente: 'Vente créée',
  update_vente: 'Vente modifiée',
  delete_vente: 'Vente supprimée',
  validate_vente: 'Vente validée',
  reject_vente: 'Vente rejetée',
  create_vente_chatteur: 'Vente ajoutée (chatteur)',
  update_vente_chatteur: 'Vente modifiée (chatteur)',
  delete_vente_chatteur: 'Vente supprimée (chatteur)',
  telegram_import: 'Import Telegram',
  delete_all_telegram_imports: 'Imports Telegram supprimés',
  delete_telegram_import: 'Import Telegram supprimé',
};

export default function ActivityLog({ embedded = false, canClear = true }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [entityType, setEntityType] = useState('');
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

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

  const handleClear = async () => {
    setClearing(true);
    try {
      await api.delete('/api/activity-logs');
      setClearConfirm(false);
      setPage(1);
      fetchLogs();
    } catch { /* empty */ }
    setClearing(false);
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div className={embedded ? '' : 'page-enter'} style={embedded ? {} : { padding: '2rem' }}>
      <div className="activity-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        {!embedded && (
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1f2e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={24} color="#f5b731" /> Journal d'activité
          </h1>
        )}
        <div className="activity-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
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
            <option value="vente">Ventes</option>
          </select>
          <button onClick={fetchLogs} className="btn-secondary"
            style={{ padding: '0.5rem', display: 'flex', alignItems: 'center' }}
            title="Rafraîchir">
            <RefreshCw size={16} />
          </button>
          {canClear && logs.length > 0 && (
            <button onClick={() => setClearConfirm(true)} className="btn-secondary"
              style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', color: '#ef4444' }}
              title="Nettoyer le journal">
              <Trash2 size={16} />
            </button>
          )}
        </div>
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
                  <td>{(() => {
                    const tc = TYPE_COLORS[log.entity_type];
                    return <span style={{
                      display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '999px',
                      fontSize: '0.75rem', fontWeight: 600,
                      background: tc?.bg || '#f1f5f9', color: tc?.color || '#64748b',
                      border: `1px solid ${tc?.border || '#e2e8f0'}`,
                    }}>{log.entity_type || '-'}</span>;
                  })()}</td>
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
              Page {page} / {totalPages} ({total} entrées)
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="btn-secondary">Suivant →</button>
          </div>
        )}
      </div>

      {/* Clear confirmation modal */}
      {clearConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 200ms ease',
        }} onClick={() => setClearConfirm(false)}>
          <div className="card" style={{ maxWidth: 420, width: '90%', padding: '1.5rem' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem', color: '#1a1f2e', fontSize: '1.1rem' }}>
              Nettoyer le journal
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
              Supprimer toutes les {total} entrées du journal d'activité ? Cette action est irréversible.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setClearConfirm(false)}>Annuler</button>
              <button className="btn-primary" onClick={handleClear} disabled={clearing}
                style={{ background: '#ef4444' }}>
                {clearing ? 'Suppression...' : 'Tout supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
