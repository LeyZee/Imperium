import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../api/index';
import StatCard from '../../components/StatCard.jsx';
import {
  MessageSquare, Clock, TrendingUp, Play, Square,
  AlertTriangle, CheckCircle, RefreshCw, Wifi, WifiOff,
  Trash2, ExternalLink, ScrollText, Send, Filter, ChevronLeft, ChevronRight,
  XCircle, Edit3, User,
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

// ─── Message type labels & colors ──────────────────────────
const TYPE_META = {
  // Outgoing (bot → chatteur)
  vente_detected: { label: 'Vente détectée', color: '#10b981', icon: '✅', dir: 'out' },
  palier_reached: { label: 'Palier atteint', color: '#f5b731', icon: '\uD83C\uDFC6', dir: 'out' },
  paie_summary: { label: 'Paie', color: '#6366f1', icon: '\uD83D\uDCB0', dir: 'out' },
  shift_reminder: { label: 'Rappel shift', color: '#0ea5e9', icon: '\u23F0', dir: 'out' },
  missing_report: { label: 'Rapport manquant', color: '#f59e0b', icon: '\u26A0\uFE0F', dir: 'out' },
  announcement: { label: 'Annonce', color: '#8b5cf6', icon: '\uD83D\uDCE2', dir: 'out' },
  collective_goal: { label: 'Objectif collectif', color: '#ec4899', icon: '\uD83C\uDFAF', dir: 'out' },
  admin_broadcast: { label: 'Broadcast admin', color: '#1b2e4b', icon: '\uD83D\uDCE3', dir: 'out' },
  message: { label: 'Message', color: '#94a3b8', icon: '\uD83D\uDCE8', dir: 'out' },
  // Incoming (chatteur → bot)
  registration: { label: 'Enregistrement', color: '#10b981', icon: '\uD83D\uDC64', dir: 'in' },
  registration_failed: { label: 'Enregistrement échoué', color: '#ef4444', icon: '\uD83D\uDC64', dir: 'in' },
  auto_link: { label: 'Auto-link', color: '#0ea5e9', icon: '\uD83D\uDD17', dir: 'in' },
  vente_import: { label: 'Import vente', color: '#10b981', icon: '\uD83D\uDCB5', dir: 'in' },
  vente_duplicate: { label: 'Doublon ignoré', color: '#94a3b8', icon: '\uD83D\uDD04', dir: 'in' },
  vente_error: { label: 'Erreur import', color: '#ef4444', icon: '\u26A0\uFE0F', dir: 'in' },
  shift_selection: { label: 'Shift confirm\u00e9', color: '#10b981', icon: '\u2705', dir: 'in' },
  modele_selection: { label: 'Mod\u00e8le confirm\u00e9', color: '#10b981', icon: '\u2705', dir: 'in' },
  daily_summary: { label: 'R\u00e9cap quotidien', color: '#6366f1', icon: '\uD83D\uDCCA', dir: 'out' },
};

export default function TelegramBot({ embedded = false }) {
  const [activeTab, setActiveTab] = useState('bot'); // 'bot' | 'journal'
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'single'|'all', id?: number }
  const [deleteInput, setDeleteInput] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);
  const [announceLoading, setAnnounceLoading] = useState(false);
  const [announceResult, setAnnounceResult] = useState(null);
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

  async function handleAnnounceStart() {
    setAnnounceLoading(true);
    setAnnounceResult(null);
    try {
      const { data } = await api.post('/api/telegram/announce-start');
      setAnnounceResult(data);
      setSuccess(`Annonce envoyée dans ${data.sent} groupe(s)`);
      timerRef.current = setTimeout(() => setSuccess(''), 4000);
      setTimeout(() => setAnnounceResult(null), 10000);
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'envoi de l'annonce");
    } finally {
      setAnnounceLoading(false);
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

  async function handleBroadcast() {
    if (!broadcastMsg.trim()) return;
    setBroadcastSending(true);
    setBroadcastResult(null);
    try {
      const { data } = await api.post('/api/telegram/broadcast', { message: broadcastMsg.trim() });
      setBroadcastResult(data);
      setSuccess(`Message envoy\u00e9 \u00e0 ${data.sent} chatteur(s)`);
      timerRef.current = setTimeout(() => setSuccess(''), 4000);
      setBroadcastMsg('');
      // Clear result after 8 seconds
      setTimeout(() => setBroadcastResult(null), 8000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'envoi');
    } finally {
      setBroadcastSending(false);
    }
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
          <h1 style={{ fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MessageSquare size={22} color="#f5b731" /> Telegram Bot</h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Monitoring et contrôle du bot d'import automatique</p>
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '0.25rem', marginBottom: '1.25rem',
        background: '#f1f5f9', borderRadius: '10px', padding: '3px',
      }}>
        {[
          { id: 'bot', label: 'Bot & Imports', icon: Wifi },
          { id: 'journal', label: 'Journal d\'activité', icon: ScrollText },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '0.6rem 1rem', border: 'none', borderRadius: '8px',
              background: activeTab === tab.id ? '#fff' : 'transparent',
              color: activeTab === tab.id ? '#1a1f2e' : '#64748b',
              fontWeight: activeTab === tab.id ? 600 : 400,
              fontSize: '0.85rem', cursor: 'pointer',
              boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 200ms',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            }}>
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'journal' && <TelegramJournal />}

      {activeTab === 'bot' && (<>
      {/* ─── Bot Tab Content ─── */}

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
            value={
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {status.todayImports}
                {status.todayWarnings > 0 && (
                  <span title={`${status.todayWarnings} import(s) incomplet(s)`} style={{
                    fontSize: '0.65rem', fontWeight: 600, color: '#f59e0b',
                    background: 'rgba(245,158,11,0.12)', padding: '0.1rem 0.35rem',
                    borderRadius: '4px', lineHeight: 1.4,
                  }}>
                    {status.todayWarnings} ⚠️
                  </span>
                )}
              </span>
            }
            icon={TrendingUp}
            color={status.todayWarnings > 0 ? '#f59e0b' : '#10b981'}
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
                title="Rafraîchir" aria-label="Rafraîchir le statut"
                style={{ padding: '0.5rem' }}
              >
                <RefreshCw size={16} />
              </button>

              {isRunning ? (
                <>
                  {status.heartbeatStale && (
                    <button
                      className="btn-primary haptic"
                      onClick={handleStart}
                      disabled={actionLoading}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f59e0b' }}
                    >
                      {actionLoading ? (
                        <span className="spinner" style={{ width: 16, height: 16 }} />
                      ) : (
                        <><RefreshCw size={14} /> Redémarrer</>
                      )}
                    </button>
                  )}
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
                </>
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
            {status.startedAt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <CheckCircle size={13} color="#10b981" />
                <span>En ligne depuis : {formatDateTime(status.startedAt)}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Clock size={13} />
              <span>Dernier import : {formatDateTime(status.lastMessageAt)}</span>
            </div>
            {status.topicsCached > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#6366f1' }}>
                <MessageSquare size={13} />
                <span>{status.topicsCached} topic{status.topicsCached > 1 ? 's' : ''} en cache</span>
              </div>
            )}
            {status.errorsCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#f59e0b' }}>
                <AlertTriangle size={13} />
                <span>{status.errorsCount} erreur{status.errorsCount > 1 ? 's' : ''} depuis le démarrage</span>
              </div>
            )}
            {status.heartbeatStale && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#ef4444', fontWeight: 600 }}>
                <AlertTriangle size={13} />
                <span>Bot potentiellement bloqué — heartbeat absent depuis 2+ min</span>
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

      {/* Announce /start — Invite chatteurs to register */}
      {status && isRunning && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 250 }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <MessageSquare size={15} color="#8b5cf6" /> Inviter les chatteurs à s'enregistrer
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.5rem', lineHeight: 1.5 }}>
                Envoie un message dans <b>tous les groupes Telegram</b> pour demander aux chatteurs d'envoyer <code>/start</code> au bot en DM.
                Cela leur permet de recevoir des <b>confirmations de ventes</b>, des <b>rappels de shift</b> et des <b>notifications de paie</b> directement sur Telegram.
              </p>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                Le message listera automatiquement les chatteurs pas encore enregistr&eacute;s pour les identifier facilement.
              </p>
            </div>
            <button
              className="btn-secondary haptic"
              onClick={handleAnnounceStart}
              disabled={announceLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap', flexShrink: 0, alignSelf: 'center' }}
            >
              {announceLoading ? (
                <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Envoi...</>
              ) : (
                <><Send size={14} /> Envoyer l'annonce</>
              )}
            </button>
          </div>
          {announceResult && (
            <div style={{
              marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '8px',
              background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)',
              fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <CheckCircle size={14} color="#8b5cf6" />
                <span style={{ color: '#8b5cf6', fontWeight: 600 }}>Envoy&eacute; dans {announceResult.sent} groupe(s)</span>
              </span>
              {announceResult.unregisteredCount > 0 && (
                <span style={{ color: '#f59e0b', fontSize: '0.75rem' }}>
                  {announceResult.unregisteredCount} auto-link&eacute;(s) mais pas /start
                </span>
              )}
              {announceResult.noTelegramCount > 0 && (
                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                  {announceResult.noTelegramCount} pas encore d&eacute;tect&eacute;(s)
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Broadcast Message */}
      {status && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Send size={15} color="#0088cc" /> Message à tous les chatteurs
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <textarea
              value={broadcastMsg}
              onChange={e => setBroadcastMsg(e.target.value)}
              placeholder={"Écris un message qui sera envoyé en DM Telegram à chaque chatteur..."}
              className="input-field"
              style={{ flex: 1, minHeight: '70px', resize: 'vertical', fontSize: '0.85rem' }}
              maxLength={4096}
            />
            <button
              onClick={handleBroadcast}
              disabled={!broadcastMsg.trim() || broadcastSending}
              className="btn-primary haptic"
              style={{
                background: '#0088cc', color: '#fff', flexShrink: 0, height: 'fit-content',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.6rem 1rem',
              }}
            >
              {broadcastSending ? (
                <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Envoi...</>
              ) : (
                <><Send size={14} /> Envoyer</>
              )}
            </button>
          </div>
          {broadcastMsg.length > 0 && (
            <div style={{ fontSize: '0.7rem', color: broadcastMsg.length > 3800 ? '#ef4444' : '#94a3b8', marginTop: '0.3rem', textAlign: 'right' }}>
              {broadcastMsg.length} / 4096
            </div>
          )}
          {broadcastResult && (
            <div style={{
              marginTop: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '8px',
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
              fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <CheckCircle size={14} color="#10b981" />
              <span style={{ color: '#10b981', fontWeight: 600 }}>{broadcastResult.sent} envoyé(s)</span>
              {broadcastResult.failed > 0 && (
                <span style={{ color: '#ef4444' }}>&middot; {broadcastResult.failed} échoué(s)</span>
              )}
              {broadcastResult.skipped > 0 && (
                <span style={{ color: '#94a3b8' }}>&middot; {broadcastResult.skipped} non lié(s)</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Chatteur Telegram Status */}
      {status?.chatteurs && status.chatteurs.length > 0 && (
        <ChatteurTelegramStatus chatteurs={status.chatteurs} />
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
            <button onClick={fetchStatus} className="btn-ghost" title="Rafraîchir" aria-label="Rafraîchir les imports"
              style={{ padding: '0.3rem', borderRadius: '0.3rem', border: 'none', cursor: 'pointer', background: 'transparent', color: '#64748b' }}>
              <RefreshCw size={14} />
            </button>
            <a href="/admin/ventes" className="btn-ghost" title="Voir toutes les ventes" aria-label="Voir toutes les ventes"
              style={{ padding: '0.3rem', borderRadius: '0.3rem', border: 'none', cursor: 'pointer', background: 'transparent', color: '#64748b', display: 'flex', alignItems: 'center' }}>
              <ExternalLink size={14} />
            </a>
            {status?.recentImports?.length > 0 && (
              <button onClick={() => setDeleteConfirm({ type: 'all' })} className="btn-ghost" title="Tout supprimer" aria-label="Supprimer tous les imports"
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
                <th>Date rapport</th>
                <th>Chatteur</th>
                <th>Plateforme</th>
                <th>Mod&egrave;le</th>
                <th style={{ textAlign: 'center', width: 60 }}>Shift</th>
                <th style={{ textAlign: 'right' }}>Montant</th>
                <th style={{ width: 70 }}></th>
              </tr>
            </thead>
            <tbody className="stagger-rows">
              {(status?.recentImports || []).map(imp => {
                const hasModel = !!imp.modele_pseudo;
                const hasShift = !!imp.shift_id;
                const hasConflict = (imp.notes || '').includes('CONFLIT');
                const isComplete = hasModel && hasShift && !hasConflict;
                return (
                <tr key={imp.id} style={!isComplete ? { background: 'rgba(245,158,11,0.04)' } : undefined}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 500, color: '#1a1f2e' }}>
                      {imp.periode_debut
                        ? new Date(imp.periode_debut + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                        : '—'}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                      Import&eacute; {formatDateTime(imp.created_at?.endsWith('Z') ? imp.created_at : (imp.created_at + 'Z'))}
                    </div>
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
                  <td>
                    {hasModel ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>{imp.modele_pseudo}</span>
                        {hasConflict && (
                          <span title="Le topic et le shift indiquent des mod&egrave;les diff&eacute;rents" style={{
                            fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.3rem',
                            borderRadius: '3px', background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                          }}>CONFLIT</span>
                        )}
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                        fontSize: '0.75rem', color: '#f59e0b', fontWeight: 500,
                      }}>
                        <AlertTriangle size={12} /> Inconnu
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {hasShift ? (
                      <span title="Shift li&eacute;" style={{ color: '#10b981' }}><CheckCircle size={16} /></span>
                    ) : (
                      <span title="Shift non trouv&eacute;" style={{ color: '#f59e0b' }}><AlertTriangle size={16} /></span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#f5b731' }}>
                    {imp.montant_brut?.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {imp.devise === 'USD' ? '$' : '€'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.15rem', justifyContent: 'flex-end' }}>
                      <a href={`/admin/ventes?highlight=${imp.id}`}
                        title="Modifier cet import" aria-label="Modifier cet import"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: !isComplete ? '#f59e0b' : '#94a3b8', padding: '0.25rem', borderRadius: '0.25rem', display: 'flex', alignItems: 'center', opacity: isComplete ? 0.5 : 1 }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={e => e.currentTarget.style.opacity = isComplete ? '0.5' : '1'}>
                        <Edit3 size={14} />
                      </a>
                      <button onClick={() => setDeleteConfirm({ type: 'single', id: imp.id })}
                        title="Supprimer cet import" aria-label="Supprimer cet import"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.25rem', borderRadius: '0.25rem', opacity: 0.6 }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
              {(!status?.recentImports || status.recentImports.length === 0) && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: '2.5rem' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%', margin: '0 auto 0.75rem',
                      background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <MessageSquare size={22} color="#6366f1" strokeWidth={1.5} />
                    </div>
                    <p style={{ fontWeight: 500, color: '#64748b' }}>Aucun import Telegram</p>
                    <p style={{ fontSize: '0.8rem' }}>Les ventes import&eacute;es via le bot appara&icirc;tront ici.</p>
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
      </>)}
    </div>
  );
}

// ─── Journal Component ──────────────────────────────────────

function TelegramJournal() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const [successFilter, setSuccessFilter] = useState('');
  const [dirFilter, setDirFilter] = useState('');
  const PAGE_SIZE = 30;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      if (typeFilter) params.set('type', typeFilter);
      if (successFilter !== '') params.set('success', successFilter);
      if (dirFilter) params.set('direction', dirFilter);
      const { data } = await api.get(`/api/telegram/log?${params}`);
      setLogs(data.rows || []);
      setTotal(data.total || 0);
    } catch { /* empty */ }
    setLoading(false);
  }, [page, typeFilter, successFilter, dirFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {/* Filters */}
      <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Filter size={15} color="#64748b" />

          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
            className="input-field" style={{ width: 'auto', minWidth: 150, padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}>
            <option value="">Tous les types</option>
            {Object.entries(TYPE_META).map(([key, meta]) => (
              <option key={key} value={key}>{meta.icon} {meta.label}</option>
            ))}
          </select>
          <select value={dirFilter} onChange={e => { setDirFilter(e.target.value); setPage(0); }}
            className="input-field" style={{ width: 'auto', minWidth: 130, padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}>
            <option value="">📥📤 Tous</option>
            <option value="out">📤 Envoyés</option>
            <option value="in">📥 Reçus</option>
          </select>
          <select value={successFilter} onChange={e => { setSuccessFilter(e.target.value); setPage(0); }}
            className="input-field" style={{ width: 'auto', minWidth: 130, padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}>
            <option value="">Tous les statuts</option>
            <option value="1">{'✅'} Réussi</option>
            <option value="0">{'❌'} Échoué</option>
          </select>
          <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#64748b' }}>
            {total} entrée{total > 1 ? 's' : ''}
          </div>
          <button onClick={fetchLogs} className="btn-ghost" style={{ padding: '0.3rem', border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 140 }}>Date</th>
                <th style={{ width: 30, textAlign: 'center' }}></th>
                <th style={{ width: 160 }}>Type</th>
                <th>Chatteur</th>
                <th>Contenu</th>
                <th style={{ width: 80, textAlign: 'center' }}>Statut</th>
              </tr>
            </thead>
            <tbody className="stagger-rows">
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" /></td></tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '2.5rem' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%', margin: '0 auto 0.75rem',
                      background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <ScrollText size={22} color="#6366f1" strokeWidth={1.5} />
                    </div>
                    <p style={{ fontWeight: 500, color: '#64748b' }}>Aucun message dans le journal</p>
                    <p style={{ fontSize: '0.8rem' }}>Les messages envoyés et reçus par le bot apparaîtront ici.</p>
                  </td>
                </tr>
              ) : logs.map(log => {
                const meta = TYPE_META[log.message_type] || TYPE_META.message;
                const isIncoming = log.direction === 'in';
                return (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {formatDateTime(log.created_at?.endsWith('Z') ? log.created_at : (log.created_at + 'Z'))}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span title={isIncoming ? 'Reçu' : 'Envoyé'} style={{
                        fontSize: '0.85rem',
                        filter: 'none',
                      }}>
                        {isIncoming ? '📥' : '📤'}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        padding: '0.2rem 0.5rem', borderRadius: '6px',
                        fontSize: '0.75rem', fontWeight: 600,
                        background: `${meta.color}15`, color: meta.color,
                      }}>
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td>
                      {log.chatteur_prenom ? (
                        <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{log.chatteur_prenom}</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{log.chat_id ? `ID: ${log.chat_id}` : '—'}</span>
                      )}
                    </td>
                    <td style={{
                      fontSize: '0.78rem', color: '#475569',
                      maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {(log.content || '').replace(/<[^>]*>/g, '').substring(0, 120)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {log.success ? (
                        <span title={isIncoming ? 'Traité' : 'Envoyé'} style={{ color: '#10b981' }}>
                          <CheckCircle size={16} />
                        </span>
                      ) : (
                        <span title={log.error_message || 'Échoué'} style={{ color: '#ef4444', cursor: 'help' }}>
                          <XCircle size={16} />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
            padding: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.06)',
            fontSize: '0.8rem', color: '#64748b',
          }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="btn-ghost" style={{ padding: '0.3rem', border: 'none', background: 'transparent', cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.3 : 1 }}>
              <ChevronLeft size={16} />
            </button>
            <span>Page {page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="btn-ghost" style={{ padding: '0.3rem', border: 'none', background: 'transparent', cursor: page >= totalPages - 1 ? 'default' : 'pointer', opacity: page >= totalPages - 1 ? 0.3 : 1 }}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chatteur Telegram Status Component ─────────────────────

const PAYS_ISO = { 'France': 'fr', 'B\u00e9nin': 'bj', 'Benin': 'bj', 'Madagascar': 'mg' };

function ChatteurTelegramStatus({ chatteurs }) {
  const linked = chatteurs.filter(c => c.telegram_user_id && c.telegram_dm_ok);
  const autoLinked = chatteurs.filter(c => c.telegram_user_id && !c.telegram_dm_ok);
  const notLinked = chatteurs.filter(c => !c.telegram_user_id);

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <User size={15} color="#6366f1" /> Statut Telegram des chatteurs
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            padding: '0.2rem 0.5rem', borderRadius: '6px',
            background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 600,
          }}>
            <CheckCircle size={12} /> {linked.length}
          </span>
          {autoLinked.length > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.2rem 0.5rem', borderRadius: '6px',
              background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 600,
            }}>
              <AlertTriangle size={12} /> {autoLinked.length}
            </span>
          )}
          {notLinked.length > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.2rem 0.5rem', borderRadius: '6px',
              background: 'rgba(148,163,184,0.15)', color: '#94a3b8', fontWeight: 600,
            }}>
              <XCircle size={12} /> {notLinked.length}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {chatteurs.map(c => {
          const isFullyLinked = c.telegram_user_id && c.telegram_dm_ok;
          const isAutoLinked = c.telegram_user_id && !c.telegram_dm_ok;
          const bgColor = CHATTEUR_COLORS[c.couleur]?.bg || '#94a3b8';
          const iso = PAYS_ISO[c.pays];

          let statusIcon, statusColor, statusTitle;
          if (isFullyLinked) {
            statusIcon = '\u2705';
            statusColor = '#10b981';
            statusTitle = 'Enregistr\u00e9 — re\u00e7oit les DM';
          } else if (isAutoLinked) {
            statusIcon = '\u26A0\uFE0F';
            statusColor = '#f59e0b';
            statusTitle = 'D\u00e9tect\u00e9 dans les groupes mais n\'a pas fait /start — pas de DM';
          } else {
            statusIcon = '\u274C';
            statusColor = '#cbd5e1';
            statusTitle = 'Pas encore li\u00e9 \u00e0 Telegram';
          }

          return (
            <div key={c.id} title={statusTitle} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.35rem 0.65rem', borderRadius: '8px',
              background: `${statusColor}10`,
              border: `1px solid ${statusColor}30`,
              fontSize: '0.8rem',
              cursor: 'default',
              transition: 'transform 100ms',
            }}>
              {/* Avatar */}
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: `${bgColor}25`,
                border: `1.5px solid ${bgColor}60`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', fontWeight: 700, color: bgColor,
              }}>
                {c.prenom?.[0]?.toUpperCase()}
              </div>
              {/* Flag */}
              {iso && (
                <img src={`https://flagcdn.com/w20/${iso}.png`} alt={c.pays}
                  style={{ width: 14, height: 10, borderRadius: '1px', objectFit: 'cover' }} />
              )}
              {/* Name */}
              <span style={{ fontWeight: 500, color: '#1a1f2e' }}>{c.prenom}</span>
              {/* Role badge */}
              {c.role !== 'chatteur' && (
                <span style={{
                  fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase',
                  padding: '0.05rem 0.3rem', borderRadius: '3px',
                  background: c.role === 'manager' ? 'rgba(99,102,241,0.12)' : 'rgba(245,158,11,0.12)',
                  color: c.role === 'manager' ? '#6366f1' : '#f59e0b',
                }}>
                  {c.role}
                </span>
              )}
              {/* Status */}
              <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>{statusIcon}</span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{
        marginTop: '0.75rem', paddingTop: '0.6rem',
        borderTop: '1px solid rgba(0,0,0,0.06)',
        display: 'flex', gap: '1.25rem', flexWrap: 'wrap',
        fontSize: '0.7rem', color: '#94a3b8',
      }}>
        <span>{'✅'} Enregistr&eacute; (DM actifs)</span>
        <span>{'⚠️'} D&eacute;tect&eacute; (pas de /start)</span>
        <span>{'❌'} Non li&eacute;</span>
      </div>
    </div>
  );
}
