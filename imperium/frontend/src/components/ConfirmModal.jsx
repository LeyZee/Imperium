import { AlertTriangle } from 'lucide-react';

export default function ConfirmModal({ open, title, message, onConfirm, onCancel, danger = true }) {
  if (!open) return null;

  return (
    <>
      <div onClick={onCancel} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)', zIndex: 1000,
      }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        background: '#fff', borderRadius: '16px', padding: '2rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        zIndex: 1001, width: '100%', maxWidth: '400px',
        textAlign: 'center',
      }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: danger ? '#fef2f2' : '#eff6ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1rem',
        }}>
          <AlertTriangle size={24} color={danger ? '#dc2626' : '#2563eb'} />
        </div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1a1f2e', margin: '0 0 0.5rem' }}>
          {title || 'Confirmer'}
        </h3>
        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={onCancel}
            className="btn-ghost"
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 600,
              border: 'none', borderRadius: '8px', cursor: 'pointer',
              color: '#fff',
              background: danger ? '#dc2626' : '#1b2e4b',
            }}
          >
            Confirmer
          </button>
        </div>
      </div>
    </>
  );
}
