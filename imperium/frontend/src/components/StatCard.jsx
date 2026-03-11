import { useState, useEffect, useRef } from 'react';

export default function StatCard({ title, value, subtitle, icon: Icon, color = '#1b2e4b' }) {
  const [hovered, setHovered] = useState(false);
  const [popping, setPopping] = useState(false);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current !== value && value !== undefined && prevValueRef.current !== undefined) {
      setPopping(true);
      const timer = setTimeout(() => setPopping(false), 300);
      prevValueRef.current = value;
      return () => clearTimeout(timer);
    }
    prevValueRef.current = value;
  }, [value]);

  return (
    <div
      className="card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderColor: hovered ? color : 'rgba(0,0,0,0.08)',
        transform: hovered ? 'scale(1.02) translateY(-2px)' : 'scale(1) translateY(0)',
        transition: 'all 200ms ease',
        cursor: 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow top border */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: hovered
            ? `linear-gradient(90deg, transparent, ${color}, transparent)`
            : 'transparent',
          transition: 'background 200ms ease',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '0.375rem',
            }}
          >
            {title}
          </p>
          <p
            className={popping ? 'count-pop' : ''}
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: hovered ? color : '#1a1f2e',
              lineHeight: 1.1,
              transition: 'color 200ms ease',
              wordBreak: 'break-word',
            }}
          >
            {value ?? '—'}
          </p>
          {subtitle && (
            <p
              style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                marginTop: '0.375rem',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {Icon && (
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: `${color}12`,
              border: `1px solid ${color}25`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 200ms ease',
              ...(hovered && {
                background: `${color}20`,
                border: `1px solid ${color}50`,
              }),
            }}
          >
            <Icon size={20} color={color} strokeWidth={1.5} />
          </div>
        )}
      </div>
    </div>
  );
}
