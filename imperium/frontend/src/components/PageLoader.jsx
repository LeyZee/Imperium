export default function PageLoader() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#0f1523',
        gap: '1rem',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          border: '3px solid rgba(201, 168, 76, 0.15)',
          borderTop: '3px solid #c9a84c',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <span
        style={{
          fontFamily: 'Cinzel, serif',
          fontSize: '0.85rem',
          letterSpacing: '0.2em',
          color: 'rgba(201, 168, 76, 0.6)',
          textTransform: 'uppercase',
        }}
      >
        IMPERIUM
      </span>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
