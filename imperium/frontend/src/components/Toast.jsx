import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext();

const ICONS = {
  success: { Icon: CheckCircle, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  error: { Icon: XCircle, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  warning: { Icon: AlertTriangle, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  info: { Icon: Info, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
};

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [exiting, setExiting] = useState(new Set());

  const removeToast = useCallback((id) => {
    setExiting(prev => new Set(prev).add(id));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      setExiting(prev => { const next = new Set(prev); next.delete(id); return next; });
    }, 200);
  }, []);

  const addToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  }, [removeToast]);

  const toastApi = useMemo(() => Object.assign(
    (msg, type) => addToast(msg, type),
    {
      success: (msg) => addToast(msg, 'success'),
      error: (msg) => addToast(msg, 'error', 6000),
      warning: (msg) => addToast(msg, 'warning'),
      info: (msg) => addToast(msg, 'info'),
    }
  ), [addToast]);

  return (
    <ToastContext.Provider value={toastApi}>
      {children}
      {/* Toast container */}
      <div style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const { Icon, color, bg, border } = ICONS[t.type] || ICONS.info;
          const isExiting = exiting.has(t.id);
          return (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: '10px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                pointerEvents: 'auto',
                animation: isExiting ? 'slideOut 200ms ease forwards' : 'slideIn 250ms ease-out',
                maxWidth: '400px',
              }}
            >
              <Icon size={18} color={color} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.85rem', color: '#1a1f2e', flex: 1 }}>{t.message}</span>
              <button
                onClick={() => removeToast(t.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '2px', color: '#94a3b8', flexShrink: 0,
                  transition: 'color 150ms ease',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#64748b'}
                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
