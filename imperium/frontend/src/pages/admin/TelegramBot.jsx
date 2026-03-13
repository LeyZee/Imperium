import { useState, useEffect, useRef } from 'react';
import api from '../../api/index';
import StatCard from '../../components/StatCard.jsx';
import {
  MessageSquare, Clock, TrendingUp, Play, Square,
  AlertTriangle, CheckCircle, RefreshCw, Wifi, WifiOff,
  Trash2, ExternalLink,
} from 'lucide-react';
import { CHATTEUR_COLORS } from '../../constants/colors.js';

function formatUptime(seconds) {
  if (!seconds) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}j ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${date} à ${hours}h${minutes}`;
}

export default function TelegramBot({ embedded = false }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'single'|'all', id?: number }
  const [deleteInput, setDeleteInput] = useState('');
  const intervalRef = useRef(null);
  const timerRef = useRef(null);

  async function fetchStatus() {
    try {
      const { data } = await api.get('/api/telegram/status');
      setStatus(data);
      setError('');
    } catch (err) {
      setError('Impossible de charger le statut du bot.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 15000);
    return () => { clearInterval(intervalRef.current); if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  async function handleStart() {
    setActionLoading(true);
    try {
      await api.post('/api/telegram/start');
      setSuccess('Bot Telegram démarré');
      timerRef.current = setTimeout(() => setSuccess(''), 3000);
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur au démarrage du bot');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStop() {
    setActionLoading(true);
    try {
      await api.post('/api/telegram/stop');
      setSuccess('Bot Telegram arrêté');
      timerRef.current = setTimeout(() => setSuccess(''), 3000);
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur à l\'arrêt du bot');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteImport(id) {
    try {
      await api.delete(`/api/ventes/${id}`);
      setSuccess('Import supprimé');
      timerRef.current = setTimeout(() => setSuccess(''), 3000);
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur à la suppression');
    }
    setDeleteConfirm(null);
  }

  async function handleDeleteAllImports() {
    try {
      const { data } = await api.delete('/api/telegram/imports');
      setSuccess(data.message || 'Imports supprimés');
      timerRef.current = setTimeout(() => setSuccess(''), 3000);
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur à la suppression');
    }
    setDeleteConfirm(null);
    setDeleteInput('');
  }

  const isRunning = status?.running;
  const statusColor = isRunning ? '#10b981' : '#ef4444';

  return (
    <div className={embedded ? '' : 'page-enter'}>
      {/* Toast */}
      {success && (
        <div className="toast-success" style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 100,
          animation: 'slideUp 0.3s ease',
        }}>{success}</div>
      )}

      {/* Header */}
      {!embedded && (
        <div style={{ marginBottom: '1.25rem' }}>
          <h1 style={{ fontWeight: 700, margin: 0 }}>Telegram Bot</h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Monitoring et contrôle du bot d'import automatique</p>
        </div>
      )}

      {/* Stat Cards */}
      {loading ? (
        <div className="telegram-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card" style={{ height: '100px', animation: 'pulse-soft 1.5s ease infinite', opacity: 0.5 }} />
          ))}
        </div>
      ) : status ? (
        <div className="stagger-children telegram-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <StatCard
            title="Statut"
            value={
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: statusColor,
                  boxShadow: isRunning ? '0 0 8px rgba(16,185,129,0.5)' : 'none',
                  animation: isRunning ? 'pulse-soft 2s ease infinite' : 'none',
                }} />
                {isRunning ? 'Actif' : 'Inactif'}
              </span>
            }
            icon={isRunning ? Wifi : WifiOff}
            color={statusColor}
          />
          <StatCard
            title="Uptime"
            value={formatUptime(status.uptime)}
            icon={Clock}
            color="#6366f1"
          />
          <StatCard
            title="Messages traités"
            value={status.messagesProcessed}
            icon={MessageSquare}
            color="#f5b731"
          />
          <StatCard
            title="Imports aujourd'hui"
            value={status.todayImports}
            icon={TrendingUp}
            color="#10b981"
          />
        </div>
      ) : null}

      {/* Control Panel */}
      {status && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)', marginBottom: '0.25rem' }}>Panneau de contrôle</h3>
              {status.botUsername && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  fontSize: '0.8rem', color: '#64748b',
                  background: 'rgba(0,0,0,0.04)', padding: '0.2rem 0.6rem',
                  borderRadius: '20px',
                }}>
                  <MessageSquare size={12} /> @{status.botUsername}
                </span>
              )}
              {!status.hasBotToken && (
                <p style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '0.25rem' }}>
                  TELEGRAM_BOT_TOKEN non configuré dans le fichier .env
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                className="btn-secondary"
                onClick={fetchStatus}
                title="Rafraîchir"
                style={{ padding: '0.5rem' }}
              >
                <RefreshCw size={16} />
              </button>

              {isRunning ? (
                <button
                  className="btn-danger haptic"
                  onClick={handleStop}
                  disabled={actionLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {actionLoading ? (
                    <span className="spinner" style={{ width: 16, height: 16 }} />
                  ) : (
                    <><Square size={14} /> Arrêter le bot</>
                  )}
                </button>
              ) : (
                <button
                  className="btn-primary haptic"
                  onClick={handleStart}
                  disabled={actionLoading || !status.hasBotToken}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {actionLoading ? (
                    <span className="spinner" style={{ width: 16, height: 16 }} />
                  ) : (
                    <><Play size={14} /> Démarrer le bot</>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Info row */}
          <div style={{
            marginTop: '1rem', paddingTop: '0.75rem',
            borderTop: '1px solid rgba(0,0,0,0.06)',
            display: 'flex', gap: '1.5rem', flexWrap: 'wrap',
            fontSize: '0.8rem', color: '#64748b',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Clock size={13} />
              <span>Dernier import : {formatDateTime(status.lastMessageAt)}</span>
            </div>
            {status.errorsCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#f59e0b' }}>
                <AlertTriangle size={13} />
                <span>{status.errorsCount} erreur{status.errorsCount > 1 ? 's' : ''} depuis le démarrage</span>
              </div>
            )}
          </div>

          {/* Last error */}
          {status.lastError && (
            <div style={{
              marginTop: '0.75rem', padding: '0.6rem 0.85rem',
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: '8px', fontSize: '0.8rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#ef4444', fontWeight: 600, marginBottom: '0.25rem' }}>
                <AlertTriangle size={13} /> Dernière erreur
              </div>
              <p style={{ color: '#64748b', margin: 0 }}>{status.lastError.message}</p>
              <p style={{ color: '#94a3b8', margin: '0.15rem 0 0', fontSize: '0.7rem' }}>
                {formatDateTime(status.lastError.at)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Recent Imports */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)', margin: 0 }}>Imports récents</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {status?.recentImports?.length > 0 && (
              <span className="badge badge-navy" style={{ fontSize: '0.7rem' }}>
                {status.recentImports.length} derniers
              </span>
            )}
            <button onClick={fetchStatus} className="btn-ghost" title="Rafraîchir"
              style={{ padding: '0.3rem', borderRadius: '0.3rem', border: 'none', cursor: 'pointer', background: 'transparent', color: '#64748b' }}>
              <RefreshCw size={14} />
            </button>
            <a href="/admin/ventes" className="btn-ghost" title="Voir toutes les ventes"
              style={{ padding: '0.3rem', borderRadius: '0.3rem', border: 'none', cursor: 'pointer', background: 'transparent', color: '#64748b', display: 'flex', alignItems: 'center' }}>
              <ExternalLink size={14} />
            </a>
            {status?.recentImports?.length > 0 && (
              <button onClick={() => setDeleteConfirm({ type: 'all' })} className="btn-ghost" title="Tout supprimer"
                style={{ padding: '0.3rem', borderRadius: '0.3rem', border: 'none', cursor: 'pointer', background: 'transparent', color: '#ef4444' }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date / heure</th>
                <th>Chatteur</th>
                <th>Plateforme</th>
                <th style={{ textAlign: 'right' }}>Montant</th>
                <th>Source</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody className="stagger-rows">
              {(status?.recentImports || []).map(imp => (
                <tr key={imp.id}>
                  <td style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                    {formatDateTime(imp.created_at?.endsWith('Z') ? imp.created_at : (imp.created_at + 'Z'))}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: `${CHATTEUR_COLORS[imp.chatteur_couleur]?.bg || '#94a3b8'}20`,
                        border: `1.5px solid ${CHATTEUR_COLORS[imp.chatteur_couleur]?.bg || '#94a3b8'}50`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.65rem', fontWeight: 700,
                        color: CHATTEUR_COLORS[imp.chatteur_couleur]?.bg || '#94a3b8',
                      }}>
                        {imp.chatteur_prenom?.[0]?.toUpperCase() || '?'}
                      </div>
                      <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{imp.chatteur_prenom}</span>
                    </div>
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: imp.couleur_fond || '#1b2e4b',
                      color: imp.couleur_texte || '#ffffff',
                    }}>
                      {imp.plateforme_nom}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#f5b731' }}>
                    {imp.montant_brut?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {imp.devise === 'USD' ? '$' : '€'}
                  </td>
                  <td style={{ fontSize: '0.75rem', color: '#94a3b8', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {imp.notes?.replace('Import Telegram — ', '') || '—'}
                  </td>
                  <td>
                    <button onClick={() => setDeleteConfirm({ type: 'single', id: imp.id })}
                      title="Supprimer cet import"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.25rem', borderRadius: '0.25rem', opacity: 0.6 }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {(!status?.recentImports || status.recentImports.length === 0) && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '2.5rem' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%', margin: '0 auto 0.75rem',
                      background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <MessageSquare size={22} color="#6366f1" strokeWidth={1.5} />
                    </div>
                    <p style={{ fontWeight: 500, color: '#64748b' }}>Aucun import Telegram</p>
                    <p style={{ fontSize: '0.8rem' }}>Les ventes importées via le bot apparaîtront ici.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease',
        }} onClick={() => { setDeleteConfirm(null); setDeleteInput(''); }}>
          <div style={{
            background: '#fff', borderRadius: '0.75rem', padding: '1.5rem', width: '100%', maxWidth: 420,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }} onClick={e => e.stopPropagation()}>
            {deleteConfirm.type === 'single' ? (
              <>
                <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: '#1a1f2e' }}>Supprimer cet import ?</h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1.25rem' }}>
                  Cette vente importée par Telegram sera définitivement supprimée et les paies seront recalculées.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Annuler</button>
                  <button className="btn btn-danger" onClick={() => handleDeleteImport(deleteConfirm.id)}>Supprimer</button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#ef4444' }}>Supprimer TOUS les imports Telegram ?</h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
                  Cette action est irréversible. Toutes les ventes importées via le bot Telegram seront supprimées et les paies recalculées.
                </p>
                <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1rem' }}>
                  Tapez <strong>SUPPRIMER</strong> pour confirmer :
                </p>
                <input
                  type="text" className="input-field" value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  placeholder="SUPPRIMER"
                  style={{ marginBottom: '1.25rem', width: '100%' }}
                />
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button className="btn btn-secondary" onClick={() => { setDeleteConfirm(null); setDeleteInput(''); }}>Annuler</button>
                  <button className="btn btn-danger" disabled={deleteInput !== 'SUPPRIMER'} onClick={handleDeleteAllImports}>
                    Tout supprimer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error toast */}
      {error && !loading && (
        <div className="toast-error" style={{
          position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 100,
          animation: 'slideUp 0.3s ease',
        }}>{error}</div>
      )}
    </div>
  );
}
