import { useState, useEffect, useRef } from 'react';
import api from '../../api/index';
import StatCard from '../../components/StatCard.jsx';
import {
  MessageSquare, Clock, TrendingUp, Play, Square,
  AlertTriangle, CheckCircle, RefreshCw, Wifi, WifiOff,
} from 'lucide-react';

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

export default function TelegramBot() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const intervalRef = useRef(null);

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
    return () => clearInterval(intervalRef.current);
  }, []);

  async function handleStart() {
    setActionLoading(true);
    try {
      await api.post('/api/telegram/start');
      setSuccess('Bot Telegram démarré');
      setTimeout(() => setSuccess(''), 3000);
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
      setTimeout(() => setSuccess(''), 3000);
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur à l\'arrêt du bot');
    } finally {
      setActionLoading(false);
    }
  }

  const isRunning = status?.running;
  const statusColor = isRunning ? '#10b981' : '#ef4444';

  return (
    <div className="fade-in">
      {/* Toast */}
      {success && (
        <div className="toast-success" style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 100,
          animation: 'slideUp 0.3s ease',
        }}>{success}</div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontWeight: 700, margin: 0 }}>Telegram Bot</h1>
        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Monitoring et contrôle du bot d'import automatique</p>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card" style={{ height: '100px', animation: 'pulse-soft 1.5s ease infinite', opacity: 0.5 }} />
          ))}
        </div>
      ) : status ? (
        <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
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
                  className="btn-danger"
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
                  className="btn-primary"
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
          {status?.recentImports?.length > 0 && (
            <span className="badge badge-navy" style={{ fontSize: '0.7rem' }}>
              {status.recentImports.length} derniers
            </span>
          )}
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
              </tr>
            </thead>
            <tbody className="stagger-children">
              {(status?.recentImports || []).map(imp => (
                <tr key={imp.id}>
                  <td style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                    {formatDateTime(imp.created_at?.endsWith('Z') ? imp.created_at : (imp.created_at + 'Z'))}
                  </td>
                  <td style={{ fontWeight: 500 }}>{imp.chatteur_prenom}</td>
                  <td>
                    <span className={imp.devise === 'USD' ? 'badge badge-gold' : 'badge badge-navy'}>
                      {imp.plateforme_nom}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#f5b731' }}>
                    {imp.montant_brut?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {imp.devise === 'USD' ? '$' : '€'}
                  </td>
                  <td style={{ fontSize: '0.75rem', color: '#94a3b8', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {imp.notes?.replace('Import Telegram — ', '') || '—'}
                  </td>
                </tr>
              ))}
              {(!status?.recentImports || status.recentImports.length === 0) && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: '#94a3b8', padding: '2.5rem' }}>
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
