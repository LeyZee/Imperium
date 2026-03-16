import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, CheckCheck, CalendarCheck, CreditCard, Megaphone, AlertCircle, TrendingUp, Calendar, MinusCircle, Gift, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/index.js';

const TYPE_ICONS = {
  demande: CalendarCheck,
  demande_review: CalendarCheck,
  paie_statut: CreditCard,
  paie: CreditCard,
  annonce: Megaphone,
  vente: TrendingUp,
  shift: Calendar,
  malus: MinusCircle,
  prime: Gift,
};

export default function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);
  const navigate = useNavigate();

  const fetchCount = useCallback(async () => {
    try {
      const { data } = await api.get('/api/notifications/count');
      setCount(data.count || 0);
    } catch { /* empty */ }
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/notifications');
      setNotifications(data);
    } catch { /* empty */ }
    setLoading(false);
  };

  // Poll count every 60 seconds
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  // Fetch notifications when panel opens
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open]);

  // Close panel on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleMarkRead = async (id) => {
    try {
      await api.put(`/api/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setCount(c => Math.max(0, c - 1));
    } catch { /* empty */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/api/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setCount(0);
    } catch { /* empty */ }
  };

  const handleClick = (notif) => {
    if (!notif.is_read) handleMarkRead(notif.id);
    if (notif.link) {
      navigate(notif.link);
      setOpen(false);
    }
  };

  // Extract vente ID from validate link pattern
  const getValidateId = (link) => {
    if (!link) return null;
    const match = link.match(/validate=(\d+)/);
    return match ? parseInt(match[1]) : null;
  };

  const handleValidateVente = async (e, notifId, venteId, statut) => {
    e.stopPropagation();
    try {
      await api.put(`/api/ventes/${venteId}/valider`, { statut });
      // Update notification: mark as read + remove validate link
      setNotifications(prev => prev.map(n =>
        n.id === notifId
          ? { ...n, is_read: 1, link: '/admin/ventes', message: `${n.message} — ${statut === 'validée' ? 'Validée' : 'Rejetée'}` }
          : n
      ));
      setCount(c => Math.max(0, c - 1));
      handleMarkRead(notifId);
      // Notify other components (e.g. Ventes page) to refresh
      window.dispatchEvent(new CustomEvent('vente-status-changed', { detail: { venteId, statut } }));
    } catch { /* empty */ }
  };

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bell icon */}
      <button
        onClick={() => setOpen(!open)}
        title="Notifications"
        className="navbar-icon-btn"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          position: 'relative', padding: '0.5rem',
          display: 'flex', alignItems: 'center',
          borderRadius: '12px',
          transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <Bell size={20} color="#1b2e4b" />
        {count > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            background: '#ef4444', color: '#fff',
            borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700,
            minWidth: '16px', height: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
          }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: '0.5rem',
          width: '360px', maxHeight: '480px', overflowY: 'auto',
          background: '#fff', borderRadius: '12px',
          border: '1px solid rgba(0,0,0,0.1)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
          zIndex: 1000,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0',
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1a1f2e' }}>Notifications</span>
            {count > 0 && (
              <button onClick={handleMarkAllRead} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#3b82f6', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem',
              }}>
                <CheckCheck size={14} /> Tout marquer comme lu
              </button>
            )}
          </div>

          {/* List */}
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Chargement...</div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Aucune notification</div>
          ) : (
            notifications.map(n => {
              const Icon = TYPE_ICONS[n.type] || AlertCircle;
              const validateId = getValidateId(n.link);
              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    display: 'flex', gap: '0.75rem', padding: '0.75rem 1rem',
                    borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                    background: n.is_read ? 'transparent' : 'rgba(245,183,49,0.04)',
                    transition: 'background 200ms',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(245,183,49,0.04)'}
                >
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: n.is_read ? '#f1f5f9' : 'rgba(245,183,49,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={16} color={n.is_read ? '#94a3b8' : '#f5b731'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '0.8rem', fontWeight: n.is_read ? 400 : 600,
                      color: '#1a1f2e', marginBottom: '0.15rem',
                    }}>
                      {n.title}
                    </p>
                    {n.message && (
                      <p style={{
                        fontSize: '0.75rem', color: '#64748b',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {n.message}
                      </p>
                    )}
                    {/* Validate/Reject buttons for pending ventes */}
                    {validateId && !n.is_read && (
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                        <button
                          onClick={(e) => handleValidateVente(e, n.id, validateId, 'validée')}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.2rem',
                            padding: '0.25rem 0.6rem', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600,
                            background: 'rgba(16,185,129,0.1)', color: '#10b981',
                            border: '1px solid rgba(16,185,129,0.2)', cursor: 'pointer',
                          }}
                        >
                          <Check size={12} /> Valider
                        </button>
                        <button
                          onClick={(e) => handleValidateVente(e, n.id, validateId, 'rejetée')}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.2rem',
                            padding: '0.25rem 0.6rem', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600,
                            background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                            border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer',
                          }}
                        >
                          <X size={12} /> Rejeter
                        </button>
                      </div>
                    )}
                    <p style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                      {formatTimeAgo(n.created_at)}
                    </p>
                  </div>
                  {!n.is_read && !validateId && (
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: '#f5b731', flexShrink: 0, alignSelf: 'center',
                    }} />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)}j`;
  return date.toLocaleDateString('fr-FR');
}
