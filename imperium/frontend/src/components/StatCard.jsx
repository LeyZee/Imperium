import { useState } from 'react';

export default function StatCard({ title, value, subtitle, icon: Icon, color = '#c9a84c' }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderColor: hovered ? color : 'rgba(255,255,255,0.06)',
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
              color: '#9aa5b4',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '0.375rem',
            }}
          >
            {title}
          </p>
          <p
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: hovered ? color : '#f5f0eb',
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
                color: '#6b7280',
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
              background: `${color}15`,
              border: `1px solid ${color}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 200ms ease',
              ...(hovered && {
                background: `${color}25`,
                border: `1px solid ${color}60`,
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
