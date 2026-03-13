import { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';

const DEFAULT_COLORS = ['#f5b731', '#1b2e4b', '#6366f1', '#10b981', '#ef4444', '#8b5cf6', '#f97316', '#06b6d4'];

/**
 * Shared animated SVG donut chart with tooltip + legend.
 *
 * @param {Object[]} data      — array of { label, value, color?, extra? }
 * @param {string}   title     — card header text
 * @param {string}   valueLabel— suffix for center total and legend values ("€", "$")
 * @param {string}   emptyText — placeholder when data is empty
 * @param {number}   maxLegend — max items shown in legend (default Infinity)
 * @param {number}   size      — SVG size in px (default 140)
 * @param {boolean}  withCard  — wrap in .card container (default true)
 */
export default function DonutChart({
  data,
  title = 'Répartition',
  valueLabel = '€',
  emptyText = 'Aucune donnée pour cette période',
  maxLegend = Infinity,
  size = 140,
  withCard = true,
}) {
  const [animated, setAnimated] = useState(false);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    setAnimated(false);
    if (data && data.length > 0) {
      const t = setTimeout(() => setAnimated(true), 50);
      return () => clearTimeout(t);
    }
  }, [data]);

  if (!data || data.length === 0) {
    const empty = (
      <div style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
        <BarChart3 size={28} color="#cbd5e1" style={{ margin: '0 auto 0.5rem' }} />
        <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>{emptyText}</p>
      </div>
    );
    return withCard ? <div className="card" style={{ padding: 0, overflow: 'hidden' }}><Header title={title} />{empty}</div> : empty;
  }

  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  const stroke = 28, radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = data.map((item, i) => {
    const pct = total > 0 ? item.value / total : 0;
    const dashLen = pct * circumference;
    const color = item.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
    const seg = { ...item, color, pct, dashLen, offset, index: i };
    offset += dashLen;
    return seg;
  });

  const legendItems = maxLegend < Infinity ? segments.slice(0, maxLegend) : segments;

  const content = (
    <>
      {withCard && <Header title={title} />}
      <div style={{ padding: withCard ? '1.25rem' : 0, display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* SVG Donut */}
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
            {segments.map((seg) => (
              <circle
                key={seg.index}
                cx={size/2} cy={size/2} r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeDasharray={`${animated ? seg.dashLen : 0} ${circumference - (animated ? seg.dashLen : 0)}`}
                strokeDashoffset={animated ? -seg.offset : 0}
                strokeLinecap="round"
                transform={`rotate(-90 ${size/2} ${size/2})`}
                style={{
                  transition: `stroke-dasharray 800ms cubic-bezier(0.4, 0, 0.2, 1) ${seg.index * 150}ms, stroke-dashoffset 800ms cubic-bezier(0.4, 0, 0.2, 1) ${seg.index * 150}ms, opacity 200ms ease`,
                  cursor: 'pointer',
                  opacity: hovered !== null && hovered !== seg.index ? 0.35 : 1,
                }}
                onMouseEnter={() => setHovered(seg.index)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </svg>
          {/* Center text */}
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
            opacity: animated ? 1 : 0, transition: 'opacity 600ms ease 400ms',
          }}>
            {hovered !== null ? (
              <>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1b2e4b' }}>
                  {segments[hovered].value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                </span>
                <span style={{ fontSize: '0.55rem', color: '#64748b', maxWidth: size * 0.55, textAlign: 'center', lineHeight: 1.2 }}>
                  {segments[hovered].label}
                </span>
              </>
            ) : (
              <>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1b2e4b' }}>
                  {total.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                </span>
                <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{valueLabel} total</span>
              </>
            )}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: '100px' }}>
          {legendItems.map((seg) => (
            <div
              key={seg.index}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                opacity: !animated ? 0 : (hovered !== null && hovered !== seg.index ? 0.4 : 1),
                transform: animated ? 'translateX(0)' : 'translateX(10px)',
                transition: `opacity 400ms ease ${animated ? '0ms' : `${600 + seg.index * 100}ms`}, transform 400ms ease ${600 + seg.index * 100}ms`,
                background: hovered === seg.index ? 'rgba(245,183,49,0.06)' : 'transparent',
                borderRadius: 6, padding: '0.15rem 0.25rem', margin: '-0.15rem -0.25rem',
                cursor: 'default',
              }}
              onMouseEnter={() => setHovered(seg.index)}
              onMouseLeave={() => setHovered(null)}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 500, color: '#1b2e4b', flex: 1 }}>
                {seg.label}
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b' }}>
                {(seg.pct * 100).toFixed(0)}%
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f5b731', whiteSpace: 'nowrap' }}>
                {seg.value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} {valueLabel}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return withCard
    ? <div className="card" style={{ padding: 0, overflow: 'hidden' }}>{content}</div>
    : content;
}

function Header({ title }) {
  return (
    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--navy)', margin: 0 }}>{title}</h3>
    </div>
  );
}
