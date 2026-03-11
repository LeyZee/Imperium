export function Skeleton({ width, height = '1rem', borderRadius = '6px', style }) {
  return (
    <div style={{
      width: width || '100%',
      height,
      borderRadius,
      background: 'linear-gradient(90deg, #e2e8f0 25%, #f8fafc 50%, #e2e8f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeletonPulse 1.5s ease-in-out infinite',
      ...style,
    }} />
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <table className="data-table" style={{ width: '100%' }}>
      <thead>
        <tr>
          {Array.from({ length: cols }).map((_, i) => (
            <th key={i}><Skeleton width="60%" height="0.75rem" /></th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <td key={c}><Skeleton width={c === 0 ? '80%' : '50%'} height="0.85rem" /></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CardSkeleton({ count = 4 }) {
  return (
    <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          background: '#fff', borderRadius: '12px', padding: '1.25rem',
          border: '1px solid rgba(0,0,0,0.06)',
        }}>
          <Skeleton width="40%" height="0.7rem" style={{ marginBottom: '0.75rem' }} />
          <Skeleton width="60%" height="1.5rem" />
        </div>
      ))}
    </div>
  );
}
