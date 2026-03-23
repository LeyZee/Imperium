export default function PageLoader() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f5f3ef',
        gap: '1rem',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          border: '3px solid rgba(27, 46, 75, 0.1)',
          borderTop: '3px solid #f5b731',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <span
        style={{
          fontFamily: 'Cinzel, serif',
          fontSize: '0.85rem',
          letterSpacing: '0.2em',
          color: '#1b2e4b',
          textTransform: 'uppercase',
          animation: 'pulse-soft 2s ease-in-out infinite',
        }}
      >
        IMPERIUM
      </span>
    </div>
  );
}
