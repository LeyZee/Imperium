import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

// ─── Colors ───
const C = {
  marble: '#f5f3ef',
  white: '#ffffff',
  navy: '#1b2e4b',
  navyDark: '#142338',
  navyDeep: '#0c1420',
  gold: '#d4a04a',
  goldDark: '#b8883a',
  text: '#1a1f2e',
  textMuted: '#64748b',
  textLight: '#94a3b8',
  border: 'rgba(27, 46, 75, 0.08)',
};

// ─── Scroll reveal hook ───
function useReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

// ─── Reveal wrapper ───
function Reveal({ children, delay = 0, direction = 'up', style = {} }) {
  const [ref, visible] = useReveal(0.1);
  const transforms = { up: 'translateY(40px)', down: 'translateY(-40px)', left: 'translateX(-40px)', right: 'translateX(40px)', none: 'none' };
  return (
    <div ref={ref} style={{
      ...style,
      opacity: visible ? 1 : 0,
      transform: visible ? 'none' : transforms[direction],
      transition: `opacity 0.8s ease ${delay}s, transform 0.8s ease ${delay}s`
    }}>
      {children}
    </div>
  );
}

// ─── Gold Particles (hero background) ───
function GoldParticles() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    const particles = [];
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    // Create particles
    for (let i = 0; i < 35; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speedY: -(Math.random() * 0.3 + 0.1),
        speedX: (Math.random() - 0.5) * 0.2,
        opacity: Math.random() * 0.4 + 0.1,
        pulse: Math.random() * Math.PI * 2
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.pulse += 0.02;
        const alpha = p.opacity * (0.5 + 0.5 * Math.sin(p.pulse));
        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 160, 74, ${alpha})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <canvas ref={canvasRef} aria-hidden="true" style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: 0
    }} />
  );
}

// ─── Animated counter hook ───
function useCountUp(end, duration = 1.5, suffix = '') {
  const [ref, visible] = useReveal(0.3);
  const [count, setCount] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (!visible || started.current) return;
    started.current = true;
    const startTime = performance.now();
    const isNeg = end < 0;
    const abs = Math.abs(end);
    const step = (now) => {
      const progress = Math.min((now - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setCount(Math.round(eased * abs));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [visible, end, duration]);
  return [ref, `${end < 0 ? '-' : '+'}${count}${suffix}`];
}

// ─── Animated SVG graph line ───
function AnimatedGraph({ points, color, labels, cardBg, variant, dots }) {
  const [ref, visible] = useReveal(0.2);
  const [hoveredDot, setHoveredDot] = useState(null);
  const coords = points.split(' ').map(p => p.split(',').map(Number));
  let pathLen = 0;
  for (let i = 1; i < coords.length; i++) {
    pathLen += Math.hypot(coords[i][0] - coords[i-1][0], coords[i][1] - coords[i-1][1]);
  }
  const isBad = variant === 'bad';
  const glowClass = isBad ? 'agency-graph-line-bad' : 'agency-graph-line-good';
  const dotCoords = dots ? dots.split(' ').map(p => p.split(',').map(Number)) : coords;
  const total = dotCoords.length;

  return (
    <div ref={ref} className="agency-graph-container" style={{ margin: '1.5rem 0', position: 'relative' }}>
      <svg viewBox="0 0 400 180" style={{ width: '100%', height: 'auto' }}>
        {[0, 1, 2, 3].map(i => (
          <line key={i} x1="40" y1={30 + i * 40} x2="380" y2={30 + i * 40} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        ))}
        <polyline
          points={points} fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={pathLen}
          strokeDashoffset={visible ? 0 : pathLen}
          style={{ transition: 'stroke-dashoffset 2s ease-out', opacity: 0.12, filter: 'blur(6px)' }}
          className={visible ? glowClass : ''}
        />
        <polyline
          points={points} fill="none" stroke={color} strokeWidth="3"
          strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={pathLen}
          strokeDashoffset={visible ? 0 : pathLen}
          style={{ transition: 'stroke-dashoffset 2s ease-out' }}
        />
        {dotCoords.map(([x, y], i) => {
          const isLast = i === total - 1;
          return (
            <g key={i} style={{ opacity: visible ? 1 : 0, transition: `opacity 0.4s ease ${0.5 + i * 0.2}s` }}>
              <circle cx={x} cy={y} r={isLast ? 18 : 14} fill={color} opacity="0"
                className={visible ? (isLast ? 'agency-dot-permanent' : 'agency-dot-pulse') : ''}
                style={isLast ? {} : { animationDelay: `${2 + i * (3 / total)}s` }}
              />
              <circle cx={x} cy={y} r={isLast ? 12 : 8} fill={color} opacity={isLast ? 0.2 : 0.1} />
              {/* Solid filled dot */}
              <circle cx={x} cy={y} r={isLast ? 6 : 5} fill={color} />
              {/* Invisible hover target */}
              <circle cx={x} cy={y} r="20" fill="transparent" style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredDot(i)}
                onMouseLeave={() => setHoveredDot(null)}
              />
            </g>
          );
        })}
        <text x="40" y="172" fill={C.textLight} fontSize="9" fontFamily="Inter, sans-serif">Début</text>
        <text x="340" y="172" fill={C.textLight} fontSize="9" fontFamily="Inter, sans-serif">12 mois</text>
      </svg>
      {/* HTML overlay badges */}
      {labels.map(({ x, y, text, bold, tooltip }, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${(x / 400) * 100}%`,
          top: `${(y / 180) * 100}%`,
          transform: 'translate(-50%, -50%)',
          padding: bold ? '0.4rem 0.85rem' : '0.3rem 0.7rem',
          background: isBad ? 'rgba(231,76,60,0.2)' : 'rgba(212,160,74,0.2)',
          border: `1px solid ${isBad ? 'rgba(231,76,60,0.35)' : 'rgba(212,160,74,0.35)'}`,
          borderRadius: '20px',
          color: color,
          fontSize: bold ? '0.72rem' : '0.65rem',
          fontWeight: bold ? 700 : 600,
          whiteSpace: 'nowrap',
          opacity: visible ? 1 : 0,
          transition: `opacity 0.5s ease ${0.6 + i * 0.25}s`,
          backdropFilter: 'blur(6px)',
          letterSpacing: '0.03em',
          pointerEvents: 'none',
          boxShadow: isBad ? '0 2px 8px rgba(231,76,60,0.15)' : '0 2px 8px rgba(212,160,74,0.15)'
        }}>{text}</div>
      ))}
      {/* Tooltip on hover */}
      {hoveredDot !== null && labels[hoveredDot]?.tooltip && (() => {
        const dx = dotCoords[hoveredDot][0];
        const dy = dotCoords[hoveredDot][1];
        const showAbove = dy > 90;
        const leftPct = (dx / 400) * 100;
        const clampedLeft = Math.max(25, Math.min(75, leftPct));
        return (
          <div style={{
            position: 'absolute',
            left: `${clampedLeft}%`,
            ...(showAbove
              ? { bottom: `${100 - (dy / 180) * 100 + 8}%` }
              : { top: `${(dy / 180) * 100 + 8}%` }),
            transform: 'translateX(-50%)',
            padding: '0.5rem 0.85rem',
            background: isBad ? 'rgba(30, 15, 15, 0.95)' : 'rgba(20, 18, 12, 0.95)',
            border: `1px solid ${isBad ? 'rgba(231,76,60,0.3)' : 'rgba(212,160,74,0.3)'}`,
            borderRadius: '10px',
            color: 'rgba(255,255,255,0.85)',
            fontSize: '0.68rem',
            lineHeight: 1.5,
            maxWidth: '220px',
            whiteSpace: 'normal',
            backdropFilter: 'blur(12px)',
            boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 15px ${isBad ? 'rgba(231,76,60,0.1)' : 'rgba(212,160,74,0.1)'}`,
            pointerEvents: 'none',
            zIndex: 10,
            animation: 'agencyTooltipIn 0.2s ease-out'
          }}>{labels[hoveredDot].tooltip}</div>
        );
      })()}
    </div>
  );
}

// ─── Stat display helpers ───
function StatItem({ icon, label, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '1rem', color, marginBottom: '0.25rem' }}>{icon}</div>
      <div style={{ fontSize: '0.7rem', color: C.textLight, letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}

function AnimatedStat({ end, suffix, label, color, variant }) {
  const [ref, display] = useCountUp(end, 1.5, suffix);
  const cls = variant === 'bad' ? 'agency-counter-shake' : variant === 'good' ? 'agency-counter-glow' : '';
  return (
    <div ref={ref} style={{ textAlign: 'center' }}>
      <div className={cls} style={{
        fontSize: 'clamp(1.2rem, 2vw, 1.5rem)',
        fontFamily: "'Cinzel', serif",
        fontWeight: 700, color, marginBottom: '0.25rem'
      }}>{display}</div>
      <div style={{ fontSize: '0.7rem', color: C.textLight, letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}

// ─── Parallax card wrapper ───
function ParallaxCard({ children, className, style }) {
  const cardRef = useRef(null);
  const graphRef = useRef(null);
  const handleMove = useCallback((e) => {
    const card = cardRef.current;
    const graph = card?.querySelector('.agency-graph-container');
    if (!card || !graph) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    graph.style.transform = `translate(${-x * 8}px, ${-y * 6}px)`;
    graph.style.transition = 'transform 0.15s ease-out';
  }, []);
  const handleLeave = useCallback(() => {
    const card = cardRef.current;
    const graph = card?.querySelector('.agency-graph-container');
    if (graph) {
      graph.style.transform = 'translate(0, 0)';
      graph.style.transition = 'transform 0.4s ease-out';
    }
  }, []);
  return (
    <div ref={cardRef} className={className} style={style}
      onMouseMove={handleMove} onMouseLeave={handleLeave}>
      {children}
    </div>
  );
}

// ─── Icons ───
const ChevronDown = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
);
const ArrowRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
);
function AnimatedHamburger({ isOpen, color }) {
  const barStyle = {
    display: 'block', width: '22px', height: '2px',
    background: color || '#fff', borderRadius: '2px',
    transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
    transformOrigin: 'center'
  };
  return (
    <div style={{ width: '22px', height: '16px', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <span style={{ ...barStyle, transform: isOpen ? 'translateY(7px) rotate(45deg)' : 'none', opacity: 1 }} />
      <span style={{ ...barStyle, opacity: isOpen ? 0 : 1, transform: isOpen ? 'scaleX(0)' : 'scaleX(1)' }} />
      <span style={{ ...barStyle, transform: isOpen ? 'translateY(-7px) rotate(-45deg)' : 'none', opacity: 1 }} />
    </div>
  );
}
const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);
const DotIcon = () => (
  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: C.gold, marginRight: '0.5rem' }} />
);

// ─── Haptic feedback ───
function haptic(intensity = 'light') {
  if (!navigator.vibrate) return;
  const patterns = { light: [8], medium: [15], heavy: [25, 30, 25] };
  navigator.vibrate(patterns[intensity] || patterns.light);
}

// ─── FAQ Item ───
function FAQItem({ q, a, dark }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef(null);
  return (
    <div style={{
      borderLeft: `2px solid ${open ? C.gold : 'rgba(212, 160, 74, 0.15)'}`,
      transition: 'border-color 0.3s ease',
      marginBottom: '0.5rem'
    }}>
      <button
        onClick={() => { setOpen(!open); haptic('light'); }}
        className="agency-faq-btn"
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1.4rem 1.5rem', background: 'none', border: 'none',
          cursor: 'pointer',
          fontFamily: "'Cinzel', serif", fontSize: 'clamp(0.9rem, 1.5vw, 1.05rem)', fontWeight: 500,
          color: dark ? 'rgba(255,255,255,0.85)' : C.navy, textAlign: 'left', gap: '1rem',
          transition: 'color 0.3s ease'
        }}
        onMouseEnter={e => e.currentTarget.style.color = C.gold}
        onMouseLeave={e => e.currentTarget.style.color = dark ? 'rgba(255,255,255,0.85)' : C.navy}
      >
        <span>{q}</span>
        <span style={{
          color: C.gold, fontSize: '1.3rem', fontWeight: 300,
          transition: 'transform 0.3s ease',
          transform: open ? 'rotate(45deg)' : 'none',
          flexShrink: 0, marginLeft: '1rem'
        }}>+</span>
      </button>
      <div style={{
        maxHeight: open ? `${contentRef.current?.scrollHeight || 200}px` : '0',
        overflow: 'hidden',
        transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <div ref={contentRef} style={{
          padding: '0 1.5rem 1.4rem',
          color: dark ? 'rgba(255,255,255,0.45)' : C.textMuted,
          fontSize: '0.9rem', lineHeight: 1.8
        }}>{a}</div>
      </div>
    </div>
  );
}

// ─── CTA Button ───
function CTAButton({ href, onClick, children, variant }) {
  const isOutline = variant === 'outline';
  return (
    <a
      href={href}
      onClick={e => { haptic('medium'); onClick && onClick(e); }}
      className="agency-cta-btn"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.75rem',
        background: isOutline ? 'transparent' : `linear-gradient(135deg, ${C.gold}, ${C.goldDark})`,
        color: isOutline ? C.gold : C.navy,
        padding: '1.1rem 2.8rem',
        borderRadius: '0',
        fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '0.8rem',
        textDecoration: 'none',
        border: isOutline ? `1px solid ${C.gold}` : 'none',
        cursor: 'pointer',
        letterSpacing: '0.18em', textTransform: 'uppercase',
        transition: 'all 0.4s ease',
        boxShadow: isOutline ? 'none' : '0 4px 20px rgba(196, 136, 77, 0.25)',
        position: 'relative', overflow: 'hidden'
      }}
      onMouseEnter={e => {
        if (isOutline) {
          e.currentTarget.style.background = C.gold;
          e.currentTarget.style.color = C.navy;
        } else {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 30px rgba(196, 136, 77, 0.35)';
        }
      }}
      onMouseLeave={e => {
        if (isOutline) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = C.gold;
        } else {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(196, 136, 77, 0.25)';
        }
      }}
    >
      {children}
      <ArrowRight />
    </a>
  );
}

// ─── Section label with line ───
function SectionLabel({ children, dark }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
      <div className="agency-label-line" style={{ width: '40px', height: '1px', background: C.gold }} />
      <span style={{
        fontSize: '0.75rem', fontWeight: 500, color: dark ? C.gold : C.gold,
        letterSpacing: '0.2em', textTransform: 'uppercase'
      }}>{children}</span>
    </div>
  );
}

// ─── Performance Chart (bar chart with tabs) ───
function PerformanceChart() {
  const [activeTab, setActiveTab] = useState(0);
  const [ref, visible] = useReveal(0.15);

  const tabs = [
    {
      label: 'FR Créatrice', sub: 'Marché français',
      range: 'De 2 840€ à 29 870€/mois', growth: '+952%',
      bars: [2840, 3200, 4500, 7200, 9800, 11500, 14200, 18000, 22500, 25800, 24100, 29870],
      annotations: [
        { month: 0, text: 'Lancement', icon: '🚀' },
        { month: 3, text: 'Cap franchi', icon: '⚡' },
        { month: 8, text: 'Coup marketing', icon: '⚡' },
        { month: 11, text: 'Objectif', icon: '🚀' }
      ]
    },
    {
      label: 'FR Influenceuse', sub: 'Avec audience',
      range: 'De 8 200€ à 52 400€/mois', growth: '+539%',
      bars: [8200, 12500, 16800, 21000, 24500, 28900, 33200, 38000, 42500, 47200, 44800, 52400],
      annotations: [
        { month: 0, text: 'Lancement', icon: '🚀' },
        { month: 2, text: 'Cap franchi', icon: '⚡' },
        { month: 7, text: 'Accélération', icon: '⚡' },
        { month: 11, text: 'Objectif', icon: '🚀' }
      ]
    },
    {
      label: 'US Créatrice', sub: 'Marché US',
      range: 'De 4 100$ à 41 200$/mois', growth: '+905%',
      bars: [4100, 5800, 8200, 11500, 15200, 18900, 23400, 28000, 33500, 37800, 35200, 41200],
      annotations: [
        { month: 0, text: 'Lancement', icon: '🚀' },
        { month: 3, text: 'Cap franchi', icon: '⚡' },
        { month: 9, text: 'Coup marketing', icon: '⚡' },
        { month: 11, text: 'Objectif', icon: '🚀' }
      ]
    }
  ];

  const data = tabs[activeTab];
  const maxVal = Math.max(...data.bars);
  const yAxisSteps = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal];

  const formatVal = (v) => {
    if (v >= 1000) return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'K€';
    return v + '€';
  };

  return (
    <div ref={ref} style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(212, 160, 74, 0.12)',
      borderRadius: '16px', padding: '2rem',
      opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(30px)',
      transition: 'opacity 0.8s ease, transform 0.8s ease'
    }}>
      {/* Tabs */}
      <div className="agency-perf-tabs" style={{
        display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap'
      }}>
        {tabs.map((tab, i) => (
          <button key={tab.label} onClick={() => { setActiveTab(i); haptic('light'); }} style={{
            background: i === activeTab ? `linear-gradient(135deg, ${C.gold}, ${C.goldDark})` : 'transparent',
            color: i === activeTab ? C.navyDeep : 'rgba(255,255,255,0.5)',
            border: i === activeTab ? 'none' : '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px', padding: '0.55rem 1rem',
            cursor: 'pointer', fontFamily: "'Inter', sans-serif",
            fontSize: '0.78rem', fontWeight: i === activeTab ? 700 : 500,
            transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: '0.4rem'
          }}>
            <span style={{ fontWeight: 700 }}>{tab.label}</span>
            <span style={{
              fontSize: '0.68rem', opacity: 0.7,
              fontWeight: 400
            }}>({tab.sub})</span>
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap'
      }}>
        <div style={{
          background: 'rgba(212, 160, 74, 0.08)',
          border: '1px solid rgba(212, 160, 74, 0.15)',
          borderRadius: '8px', padding: '0.5rem 1rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}>
          <span style={{ color: C.gold, fontSize: '0.85rem' }}>✦</span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 500 }}>{data.range}</span>
        </div>
        <div style={{
          background: 'rgba(212, 160, 74, 0.08)',
          border: '1px solid rgba(212, 160, 74, 0.15)',
          borderRadius: '8px', padding: '0.5rem 1rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}>
          <span style={{ color: C.gold, fontSize: '0.85rem' }}>↗</span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 500 }}>Croissance : <span style={{ color: C.gold, fontWeight: 700 }}>{data.growth}</span></span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <span style={{
          width: '12px', height: '12px', borderRadius: '3px',
          background: C.gold, display: 'inline-block'
        }} />
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}>Potentiel de revenus</span>
      </div>

      {/* Chart area */}
      <div style={{ position: 'relative' }}>
        {/* Y-axis labels */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: '30px',
          width: '50px', display: 'flex', flexDirection: 'column-reverse',
          justifyContent: 'space-between'
        }}>
          {yAxisSteps.map((v, i) => (
            <span key={i} style={{
              fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)',
              textAlign: 'right', paddingRight: '8px'
            }}>{formatVal(Math.round(v))}</span>
          ))}
        </div>

        {/* Bars */}
        <div style={{
          marginLeft: '55px', display: 'flex', alignItems: 'flex-end',
          gap: 'clamp(4px, 1vw, 10px)', height: '280px', position: 'relative',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          paddingBottom: '0'
        }}>
          {/* Horizontal grid lines */}
          {[0.25, 0.5, 0.75, 1].map(pct => (
            <div key={pct} style={{
              position: 'absolute', left: 0, right: 0,
              bottom: `${pct * 100}%`,
              borderTop: '1px solid rgba(255,255,255,0.04)'
            }} />
          ))}

          {data.bars.map((val, i) => {
            const heightPct = (val / maxVal) * 100;
            const annotation = data.annotations.find(a => a.month === i);
            return (
              <div key={i} style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', position: 'relative', height: '100%',
                justifyContent: 'flex-end'
              }}>
                {/* Annotation badge */}
                {annotation && (
                  <div style={{
                    position: 'absolute',
                    bottom: `calc(${heightPct}% + 8px)`,
                    background: 'rgba(212, 160, 74, 0.15)',
                    border: '1px solid rgba(212, 160, 74, 0.3)',
                    borderRadius: '6px', padding: '0.2rem 0.45rem',
                    fontSize: '0.6rem', color: C.gold, fontWeight: 600,
                    whiteSpace: 'nowrap', zIndex: 2
                  }}>
                    {annotation.icon && <span style={{ marginRight: '0.2rem' }}>{annotation.icon}</span>}
                    {annotation.text}
                  </div>
                )}
                {/* Bar */}
                <div className="agency-perf-bar" style={{
                  width: '100%', maxWidth: '50px',
                  height: visible ? `${heightPct}%` : '0%',
                  background: `linear-gradient(180deg, ${C.gold}, ${C.goldDark})`,
                  borderRadius: '4px 4px 0 0',
                  transition: `height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.08}s`,
                  position: 'relative'
                }} />
              </div>
            );
          })}
        </div>

        {/* X-axis labels */}
        <div style={{
          marginLeft: '55px', display: 'flex',
          gap: 'clamp(4px, 1vw, 10px)', marginTop: '0.5rem'
        }}>
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} style={{
              flex: 1, textAlign: 'center',
              fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)',
              fontWeight: 500
            }}>M{i + 1}</div>
          ))}
        </div>
      </div>

      {/* Footnote */}
      <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        <p style={{
          color: C.gold, fontSize: '0.7rem', margin: '0 0 0.3rem',
          fontStyle: 'italic', opacity: 0.6
        }}>
          * Projection basée sur la moyenne des résultats de nos créatrices accompagnées (2025–2026)
        </p>
        <p style={{
          color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem', margin: 0
        }}>
          Panel de 10+ créatrices — Les résultats individuels peuvent varier
        </p>
      </div>
    </div>
  );
}

// ─── Main ───
export default function AgencyHome() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 50);
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(h > 0 ? (window.scrollY / h) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    setMobileMenuOpen(false);
    haptic('light');
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const NAV_ITEMS = [
    ['equipe', '\u00c9quipe', '/equipe'],
    ['imperium', 'Imperium', '/imperium'],
  ];

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: C.text, background: C.navyDeep, overflowX: 'hidden' }}>

      {/* Scroll progress bar */}
      <div className="agency-scroll-progress" style={{ width: `${scrollProgress}%` }} aria-hidden="true" />

      {/* Skip to content link */}
      <a href="#approche" style={{
        position: 'absolute', top: '-100px', left: '50%', transform: 'translateX(-50%)',
        background: C.gold, color: C.navyDeep, padding: '0.5rem 1rem',
        borderRadius: '0 0 8px 8px', fontSize: '0.8rem', fontWeight: 600,
        textDecoration: 'none', zIndex: 100000,
        transition: 'top 0.3s ease'
      }}
        onFocus={e => e.currentTarget.style.top = '0'}
        onBlur={e => e.currentTarget.style.top = '-100px'}
      >Aller au contenu principal</a>

      {/* ═══ HEADER ═══ */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        padding: scrolled ? '0 3rem' : '0 3rem',
        background: scrolled ? 'rgba(245, 243, 239, 0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px) saturate(1.2)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(1.2)' : 'none',
        boxShadow: scrolled ? '0 1px 0 rgba(27, 46, 75, 0.08), 0 4px 20px rgba(27, 46, 75, 0.04)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(212, 160, 74, 0.1)' : '1px solid transparent',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: scrolled ? '64px' : '80px'
      }} className="agency-header">
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '0.15rem' }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <span className="agency-logo-name" style={{
            fontFamily: "'Inter', sans-serif", fontSize: '0.95rem', fontWeight: 600,
            color: scrolled ? C.navy : 'rgba(255,255,255,0.9)',
            letterSpacing: '0.22em', textTransform: 'uppercase',
            transition: 'color 0.3s'
          }}>IMPERA</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '16px', height: '1px', background: C.gold }} />
            <span className="agency-logo-sub" style={{
              fontFamily: "'Inter', sans-serif", fontSize: '0.55rem', fontWeight: 500,
              color: C.gold,
              letterSpacing: '0.25em', textTransform: 'uppercase'
            }}>AGENCY</span>
            <span style={{ width: '16px', height: '1px', background: C.gold }} />
          </div>
        </div>

        {/* Desktop nav + CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', animation: 'agencyNavIn 0.6s ease 0.3s both' }} className="agency-desktop-nav">
          <nav style={{
            display: 'flex', alignItems: 'center', gap: '0.25rem',
            background: scrolled ? 'rgba(27, 46, 75, 0.04)' : 'rgba(255, 255, 255, 0.06)',
            borderRadius: '100px', padding: '0.3rem 0.4rem',
            border: scrolled ? '1px solid rgba(27, 46, 75, 0.06)' : '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            {NAV_ITEMS.map(([id, label, href]) => {
              const navStyle = {
                background: 'none', border: 'none', textDecoration: 'none',
                color: scrolled ? C.navy : 'rgba(255,255,255,0.8)',
                fontFamily: "'Inter', sans-serif", fontSize: '0.75rem', fontWeight: 500,
                cursor: 'pointer', padding: '0.45rem 1.1rem',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                transition: 'all 0.25s ease', borderRadius: '100px',
                position: 'relative'
              };
              const hoverIn = (e) => {
                e.currentTarget.style.color = scrolled ? C.navy : '#fff';
                e.currentTarget.style.background = scrolled ? 'rgba(27, 46, 75, 0.06)' : 'rgba(255, 255, 255, 0.1)';
              };
              const hoverOut = (e) => {
                e.currentTarget.style.color = scrolled ? C.navy : 'rgba(255,255,255,0.8)';
                e.currentTarget.style.background = 'none';
              };
              return href ? (
                <Link key={id} to={href} style={navStyle}
                  onMouseEnter={hoverIn} onMouseLeave={hoverOut}
                >{label}</Link>
              ) : (
                <button key={id} onClick={() => scrollTo(id)} style={navStyle}
                  onMouseEnter={hoverIn} onMouseLeave={hoverOut}
                >{label}</button>
              );
            })}
          </nav>

          {/* Separator */}
          <div style={{
            width: '1px', height: '24px',
            background: scrolled ? 'rgba(27, 46, 75, 0.12)' : 'rgba(255, 255, 255, 0.15)'
          }} />

          {/* Contact CTA */}
          <Link to="/contact" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: scrolled ? C.gold : 'rgba(212, 160, 74, 0.15)',
            border: scrolled ? 'none' : `1px solid rgba(212, 160, 74, 0.4)`,
            color: scrolled ? C.navyDeep : C.gold,
            padding: '0.5rem 1.4rem', borderRadius: '100px',
            fontFamily: "'Inter', sans-serif", fontSize: '0.72rem', fontWeight: 600,
            cursor: 'pointer', textDecoration: 'none',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            transition: 'all 0.3s ease',
            boxShadow: scrolled ? '0 2px 8px rgba(212, 160, 74, 0.25)' : 'none'
          }}
            onMouseEnter={e => {
              e.currentTarget.style.background = C.gold;
              e.currentTarget.style.color = C.navyDeep;
              e.currentTarget.style.borderColor = C.gold;
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(212, 160, 74, 0.35)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = scrolled ? C.gold : 'rgba(212, 160, 74, 0.15)';
              e.currentTarget.style.color = scrolled ? C.navyDeep : C.gold;
              e.currentTarget.style.borderColor = scrolled ? C.gold : 'rgba(212, 160, 74, 0.4)';
              e.currentTarget.style.boxShadow = scrolled ? '0 2px 8px rgba(212, 160, 74, 0.25)' : 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Contact
          </Link>

          {/* Connexion CTA */}
          <Link to="/login" className="agency-cta-login" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: scrolled ? C.gold : 'rgba(212, 160, 74, 0.15)',
            border: scrolled ? 'none' : `1px solid rgba(212, 160, 74, 0.4)`,
            color: scrolled ? C.navyDeep : C.gold,
            padding: '0.5rem 1.4rem', borderRadius: '100px',
            fontFamily: "'Inter', sans-serif", fontSize: '0.72rem', fontWeight: 600,
            cursor: 'pointer', textDecoration: 'none',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            transition: 'all 0.3s ease',
            boxShadow: scrolled ? '0 2px 8px rgba(212, 160, 74, 0.25)' : 'none'
          }}
            onMouseEnter={e => {
              e.currentTarget.style.background = C.gold;
              e.currentTarget.style.color = C.navyDeep;
              e.currentTarget.style.borderColor = C.gold;
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(212, 160, 74, 0.35)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = scrolled ? C.gold : 'rgba(212, 160, 74, 0.15)';
              e.currentTarget.style.color = scrolled ? C.navyDeep : C.gold;
              e.currentTarget.style.borderColor = scrolled ? C.gold : 'rgba(212, 160, 74, 0.4)';
              e.currentTarget.style.boxShadow = scrolled ? '0 2px 8px rgba(212, 160, 74, 0.25)' : 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Connexion
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5-5-5-5" />
            </svg>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button className="agency-mobile-menu-btn"
          onClick={() => { setMobileMenuOpen(!mobileMenuOpen); haptic('medium'); }}
          aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={mobileMenuOpen}
          style={{
            display: 'none', background: 'none', border: 'none',
            cursor: 'pointer', padding: '0.5rem',
            transition: 'all 0.3s', zIndex: 1002
          }}
        >
          <AnimatedHamburger isOpen={mobileMenuOpen} color={mobileMenuOpen ? '#fff' : (scrolled ? C.navy : '#fff')} />
        </button>

        {/* Mobile overlay */}
        {mobileMenuOpen && (
          <div role="dialog" aria-label="Menu de navigation" style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: `linear-gradient(170deg, ${C.navy} 0%, ${C.navyDark} 50%, ${C.navyDeep} 100%)`,
            zIndex: 1001,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0',
            animation: 'agencyMenuSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>

            {/* Mobile logo */}
            <div style={{ marginBottom: '3rem', textAlign: 'center', animation: 'agencyMenuItemIn 0.5s ease 0.1s both' }}>
              <span style={{
                fontFamily: "'Inter', sans-serif", fontSize: '0.95rem', fontWeight: 600,
                color: 'rgba(255,255,255,0.6)', letterSpacing: '0.22em', textTransform: 'uppercase',
                display: 'block', marginBottom: '0.25rem'
              }}>IMPERA</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                <span style={{ width: '16px', height: '1px', background: C.gold }} />
                <span style={{
                  fontFamily: "'Inter', sans-serif", fontSize: '0.55rem', fontWeight: 500,
                  color: C.gold, letterSpacing: '0.25em', textTransform: 'uppercase'
                }}>AGENCY</span>
                <span style={{ width: '16px', height: '1px', background: C.gold }} />
              </div>
            </div>

            {NAV_ITEMS.map(([id, label, href], i) => {
              const mobileStyle = {
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', textDecoration: 'none',
                fontFamily: "'Cinzel', serif", fontSize: '1.5rem', fontWeight: 500,
                cursor: 'pointer', letterSpacing: '0.1em',
                padding: '0.75rem 2rem', transition: 'all 0.3s ease', display: 'block',
                animation: `agencyMenuItemIn 0.5s ease ${0.15 + i * 0.08}s both`
              };
              const mHoverIn = e => { e.currentTarget.style.color = C.gold; e.currentTarget.style.letterSpacing = '0.15em'; };
              const mHoverOut = e => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; e.currentTarget.style.letterSpacing = '0.1em'; };
              return href ? (
                <Link key={id} to={href} onClick={() => setMobileMenuOpen(false)} style={mobileStyle}
                  onMouseEnter={mHoverIn} onMouseLeave={mHoverOut}
                >{label}</Link>
              ) : (
                <button key={id} onClick={() => scrollTo(id)} style={mobileStyle}
                  onMouseEnter={mHoverIn} onMouseLeave={mHoverOut}
                >{label}</button>
              );
            })}

            <Link to="/contact" onClick={() => setMobileMenuOpen(false)} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', textDecoration: 'none',
              fontFamily: "'Cinzel', serif", fontSize: '1.5rem', fontWeight: 500,
              cursor: 'pointer', letterSpacing: '0.1em',
              padding: '0.75rem 2rem', transition: 'all 0.3s ease', display: 'block',
              animation: `agencyMenuItemIn 0.5s ease ${0.15 + NAV_ITEMS.length * 0.08}s both`
            }}
              onMouseEnter={e => { e.currentTarget.style.color = C.gold; e.currentTarget.style.letterSpacing = '0.15em'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; e.currentTarget.style.letterSpacing = '0.1em'; }}
            >Contact</Link>

            <Link to="/login" onClick={() => setMobileMenuOpen(false)} style={{
              background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDark} 100%)`,
              color: C.navyDeep,
              padding: '0.85rem 2.5rem', borderRadius: '100px',
              fontFamily: "'Inter', sans-serif", fontWeight: 600, textDecoration: 'none',
              fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase',
              marginTop: '2.5rem',
              boxShadow: '0 4px 20px rgba(212, 160, 74, 0.3)',
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              animation: `agencyMenuItemIn 0.5s ease ${0.23 + NAV_ITEMS.length * 0.08}s both`
            }}>
              Connexion
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5-5-5-5" />
              </svg>
            </Link>
          </div>
        )}
      </header>

      {/* ═══ HERO (dark) ═══ */}
      <section className="agency-hero-section" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        padding: '10rem 3rem 5rem',
        background: `linear-gradient(170deg, ${C.navy} 0%, ${C.navyDark} 60%, ${C.navyDeep} 100%)`,
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Gold floating particles */}
        <GoldParticles />
        {/* Subtle gold radial glow — top right */}
        <div style={{
          position: 'absolute', top: '-5%', right: '-10%',
          width: '800px', height: '800px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(196,136,77,0.05) 0%, transparent 60%)',
          pointerEvents: 'none'
        }} />
        {/* Subtle navy light — bottom left */}
        <div style={{
          position: 'absolute', bottom: '-10%', left: '-5%',
          width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(196,136,77,0.03) 0%, transparent 60%)',
          pointerEvents: 'none'
        }} />

        <div style={{ maxWidth: '900px', position: 'relative', zIndex: 1 }}>
          <h1 className="agency-hero-title" style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 'clamp(2.5rem, 7vw, 5rem)',
            fontWeight: 400, color: 'rgba(255,255,255,0.9)',
            lineHeight: 1.2, margin: '0 0 2.5rem',
            animation: 'agencyFadeInUp 0.8s ease 0.15s both'
          }}>
            Agence{' '}
            <span className="agency-shimmer-text agency-hero-highlight" style={{ color: C.gold, fontStyle: 'italic', fontWeight: 600, display: 'inline-block', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'default' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.textShadow = '0 0 30px rgba(212, 160, 74, 0.4)'; haptic('light'); }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.textShadow = 'none'; }}
            >OnlyFans & Reveal</span>
            <br />pour créatrices{' '}
            <span className="agency-shimmer-text agency-hero-highlight" style={{ color: C.gold, fontStyle: 'italic', fontWeight: 600, display: 'inline-block', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'default' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.textShadow = '0 0 30px rgba(212, 160, 74, 0.4)'; haptic('light'); }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.textShadow = 'none'; }}
            >ambitieuses.</span>
          </h1>

          <p className="agency-hero-subtitle" style={{
            color: 'rgba(255,255,255,0.45)',
            fontSize: 'clamp(1rem, 1.5vw, 1.15rem)',
            lineHeight: 1.9, margin: '0 0 3.5rem', maxWidth: '560px',
            animation: 'agencyFadeInUp 0.8s ease 0.25s both'
          }}>
            Nous aidons des créatrices déjà actives à structurer, optimiser et développer leurs revenus via des systèmes éprouvés et un accompagnement humain.
          </p>

          <div style={{ animation: 'agencyFadeInUp 0.8s ease 0.35s both' }}>
            <CTAButton variant="outline" href="#candidature" onClick={(e) => { e.preventDefault(); scrollTo('candidature'); }}>
              Recevoir mon audit gratuit en 24h
            </CTAButton>
          </div>

          <p style={{
            color: 'rgba(255,255,255,0.25)', fontSize: '0.78rem',
            marginTop: '1.5rem', letterSpacing: '0.05em',
            fontStyle: 'italic',
            animation: 'agencyFadeInUp 0.8s ease 0.45s both'
          }}>
            Analyse confidentielle. Echange sans engagement.
          </p>

          {/* Stats inline — above the fold */}
          <div className="agency-hero-stats" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem',
            marginTop: '3rem', paddingTop: '2rem',
            borderTop: '1px solid rgba(196,136,77,0.12)',
            animation: 'agencyFadeInUp 0.8s ease 0.55s both',
            textAlign: 'center'
          }}>
            {[
              { value: '10+', label: 'Créatrices' },
              { value: '2M\u20AC+', label: 'Revenus générés' },
              { value: '3 ans', label: "D'expertise" }
            ].map(({ value, label }) => (
              <div key={label}>
                <div style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 'clamp(1.2rem, 2.5vw, 1.6rem)',
                  fontWeight: 600, color: C.gold,
                  marginBottom: '0.25rem'
                }}>{value}</div>
                <p style={{
                  color: 'rgba(255,255,255,0.3)', fontSize: '0.62rem',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  margin: 0, fontWeight: 500
                }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Partner badge */}
          <div className="agency-partner-line" style={{
            display: 'inline-flex', alignItems: 'center', gap: '1rem',
            marginTop: '2rem', padding: '0.75rem 1.5rem',
            border: '1px solid rgba(212, 160, 74, 0.15)',
            borderRadius: '2px', background: 'rgba(212, 160, 74, 0.04)',
            animation: 'agencyFadeInUp 0.8s ease 0.65s both'
          }}>
            <span style={{
              fontSize: '0.6rem', fontWeight: 500, color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.2em', textTransform: 'uppercase'
            }}>Partenaire officiel</span>
            <span style={{
              width: '1px', height: '16px', background: 'rgba(212, 160, 74, 0.25)'
            }} />
            <span style={{
              fontFamily: "'Cinzel', serif",
              fontSize: '1rem', fontWeight: 600, color: C.gold,
              letterSpacing: '0.15em'
            }}>REVEAL</span>
          </div>
        </div>
      </section>

      {/* ═══ CONSTAT (marble) ═══ */}
      <section className="agency-constat-section" style={{
        padding: '7rem 3rem',
        background: C.marble,
        position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <Reveal>
            <div style={{
              background: `linear-gradient(160deg, ${C.navyDark}, ${C.navyDeep})`,
              borderRadius: '20px',
              padding: 'clamp(3rem, 6vw, 5rem) clamp(2rem, 5vw, 4rem)',
              position: 'relative', overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(12, 20, 32, 0.25)'
            }}>
              {/* Subtle inner glow */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: '20px',
                background: 'radial-gradient(ellipse at center top, rgba(192,57,43,0.06) 0%, transparent 50%)',
                pointerEvents: 'none'
              }} />

              <p style={{
                color: 'rgba(255,255,255,0.4)', fontSize: 'clamp(0.9rem, 1.3vw, 1.05rem)',
                margin: '0 0 2.5rem', letterSpacing: '0.03em', position: 'relative'
              }}>
                Si votre compte dépend :
              </p>

              <div style={{ margin: '0 0 2.5rem', position: 'relative' }}>
                {['d\'un buzz,', 'd\'un reel qui \u00ab prend \u00bb,', 'ou d\'algorithmes capricieux\u2026'].map((line, i) => (
                  <Reveal key={i} delay={0.1 + i * 0.15}>
                    <p style={{
                      fontFamily: "'Cinzel', serif",
                      fontSize: 'clamp(1.2rem, 2.5vw, 1.65rem)',
                      fontWeight: 400, color: 'rgba(255,255,255,0.85)',
                      margin: '0 0 0.75rem', lineHeight: 1.5
                    }}>{line}</p>
                  </Reveal>
                ))}
              </div>

              <Reveal delay={0.55}>
                <p className="agency-fragile-text" style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 'clamp(1.3rem, 3vw, 1.8rem)',
                  fontWeight: 600, fontStyle: 'italic',
                  color: '#e74c3c',
                  margin: '0 0 2.5rem', lineHeight: 1.4, position: 'relative'
                }}>
                  alors votre revenu reste fragile.
                </p>
              </Reveal>

              <Reveal delay={0.7}>
                <div className="agency-constat-badges" style={{
                  display: 'flex', justifyContent: 'center', gap: '0.75rem',
                  flexWrap: 'wrap', margin: '0 0 3rem', position: 'relative'
                }}>
                  {[
                    { text: 'Shadowban' },
                    { text: 'Signalements' },
                    { text: 'Pics \u2192 chutes \u2192 stress permanent' }
                  ].map(({ text }, i) => (
                    <span key={text} className="agency-badge-pulse" style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.5rem 1rem',
                      background: 'rgba(231, 76, 60, 0.1)',
                      border: '1px solid rgba(231, 76, 60, 0.2)',
                      borderRadius: '6px',
                      color: 'rgba(231, 76, 60, 0.85)',
                      fontSize: '0.78rem', fontWeight: 500,
                      animationDelay: `${i * 0.2}s`
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(231, 76, 60, 0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
                        <polyline points="16 17 22 17 22 11" />
                      </svg> {text}
                    </span>
                  ))}
                </div>
              </Reveal>

              <Reveal delay={0.85}>
                <div style={{
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  paddingTop: '2rem', position: 'relative'
                }}>
                  <p style={{
                    color: 'rgba(255,255,255,0.35)', fontSize: '0.95rem',
                    margin: '0 0 0.5rem', lineHeight: 1.7
                  }}>
                    Ce n'est pas un manque d'effort.
                  </p>
                  <p style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: 'clamp(1rem, 1.8vw, 1.25rem)',
                    fontWeight: 400, color: 'rgba(255,255,255,0.7)',
                    margin: 0, lineHeight: 1.5
                  }}>
                    C'est un manque de{' '}
                    <span className="agency-shimmer-text" style={{ fontStyle: 'italic', fontWeight: 600 }}>système</span>.
                  </p>
                </div>
              </Reveal>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ DEUX CHEMINS (marble) ═══ */}
      <section className="agency-chemins-section" style={{
        padding: '7rem 3rem',
        background: C.white,
        position: 'relative'
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <h2 className="agency-split-title" style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 'clamp(1.6rem, 3.5vw, 2.5rem)',
                fontWeight: 400, color: C.navy,
                margin: '0 0 0.75rem', lineHeight: 1.3
              }}>
                <span className="agency-split-left">Deux</span>{' '}
                <span className="agency-split-right">trajectoires.</span>
              </h2>
              <p style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 'clamp(1rem, 2vw, 1.3rem)',
                fontWeight: 400, color: C.textMuted,
                margin: '0 0 1.25rem', lineHeight: 1.4, fontStyle: 'italic'
              }}>
                Un seul tient dans le temps.
              </p>
              <p style={{
                color: C.textLight, fontSize: '0.9rem',
                maxWidth: '520px', margin: '0 auto', lineHeight: 1.7
              }}>
                Le buzz fait du bruit. La stratégie construit une marque.
              </p>
            </div>
          </Reveal>

          <div className="agency-chemins-grid" style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem',
            position: 'relative'
          }}>
            {/* Card: Approche opportuniste — dark navy */}
            <Reveal delay={0.1} direction="left">
              <ParallaxCard className="agency-chemin-card agency-chemin-bad" style={{
                background: `linear-gradient(160deg, ${C.navyDark}, ${C.navyDeep})`,
                borderRadius: '16px', padding: 'clamp(1.5rem, 3vw, 2.5rem)',
                height: '100%', transition: 'box-shadow 0.4s ease, transform 0.4s ease',
                boxShadow: '0 8px 30px rgba(12, 20, 32, 0.15)',
                border: '1px solid rgba(231,76,60,0.1)',
                position: 'relative', overflow: 'hidden'
              }}>
                {/* Scan line animation */}
                <div className="agency-scan-line" style={{
                  position: 'absolute', left: 0, right: 0, height: '1px',
                  background: 'linear-gradient(90deg, transparent, rgba(231,76,60,0.3), transparent)',
                  pointerEvents: 'none', zIndex: 1
                }} />
                {/* Subtle red glow top-right — flickering */}
                <div className="agency-red-flicker" style={{
                  position: 'absolute', top: '-30%', right: '-20%',
                  width: '250px', height: '250px', borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(231,76,60,0.08) 0%, transparent 70%)',
                  pointerEvents: 'none'
                }} />

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', position: 'relative' }}>
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '50%',
                    background: 'rgba(231, 76, 60, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1rem', flexShrink: 0, color: '#e74c3c'
                  }}>{'\u2198'}</div>
                  <div>
                    <h3 style={{
                      fontFamily: "'Cinzel', serif", fontSize: 'clamp(0.95rem, 1.5vw, 1.15rem)',
                      fontWeight: 600, color: 'rgba(255,255,255,0.9)', margin: '0 0 0.3rem'
                    }}>Approche opportuniste</h3>
                    <p style={{
                      margin: 0, fontSize: '0.7rem', color: 'rgba(231,76,60,0.6)',
                      letterSpacing: '0.06em', fontWeight: 500
                    }}>Buzz • Trash • Sanctions</p>
                  </div>
                </div>

                {/* Animated SVG Graph — declining */}
                <AnimatedGraph
                  points="50,140 95,28 130,75 165,58 205,95 235,82 270,115 300,108 340,138 370,150"
                  dots="95,28 165,58 300,108 370,150"
                  color="#e74c3c"
                  cardBg={C.navyDeep}
                  variant="bad"
                  labels={[
                    { x: 80, y: -2, text: 'Buzz viral', bold: true, tooltip: 'Pic de visibilité éphémère grâce au contenu provocateur' },
                    { x: 180, y: 35, text: 'Contenu trash', tooltip: 'Contenus polémiques pour maintenir l\'engagement' },
                    { x: 330, y: 82, text: 'Ban compte', tooltip: 'Suspension de compte suite aux violations répétées' },
                    { x: 370, y: 125, text: 'Oubli', tooltip: 'L\'audience passe à autre chose, la hype retombe' }
                  ]}
                />

                {/* Stats row with animated counter */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  borderTop: '1px solid rgba(231,76,60,0.1)',
                  paddingTop: '1.25rem', marginBottom: '1.5rem'
                }}>
                  <StatItem icon={'\u2197\u2199'} label="Volatilité" color="#e74c3c" />
                  <AnimatedStat end={-40} suffix="%" label="Revenus" color="#e74c3c" variant="bad" />
                  <StatItem icon={'\u2193'} label="Tendance" color="#e74c3c" />
                </div>

                {/* Summary */}
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                  padding: '1rem', background: 'rgba(231,76,60,0.06)', borderRadius: '10px',
                  marginBottom: '1.25rem', border: '1px solid rgba(231,76,60,0.08)'
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="22 17 13.5 8.5 8.5 13.5 2 7" /><polyline points="16 17 22 17 22 11" /></svg>
                  <div>
                    <p style={{ fontWeight: 600, color: '#e74c3c', fontSize: '0.85rem', margin: '0 0 0.25rem' }}>Revenu imprévisible</p>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', margin: 0, lineHeight: 1.6 }}>
                      {'\u2192'} Érosion lente. Pics éphémères, sanctions, perte de confiance.
                    </p>
                  </div>
                </div>

                {/* Tags — cascade animation */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[
                    { text: 'Shadowban' },
                    { text: 'Suspension' },
                    { text: 'Perte audience' }
                  ].map(({ text }, i) => (
                    <Reveal key={text} delay={0.8 + i * 0.15} direction="up">
                      <span className="agency-tag-bounce" style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.35rem 0.75rem', borderRadius: '20px',
                        background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.25)',
                        color: 'rgba(231,76,60,0.9)', fontSize: '0.72rem', fontWeight: 600
                      }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(231,76,60,0.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="22 17 13.5 8.5 8.5 13.5 2 7" /><polyline points="16 17 22 17 22 11" /></svg> {text}</span>
                    </Reveal>
                  ))}
                </div>
              </ParallaxCard>
            </Reveal>

            {/* Card: Approche structurée — dark navy + gold accents */}
            <Reveal delay={0.25} direction="right">
              <ParallaxCard className="agency-chemin-card agency-chemin-good" style={{
                background: `linear-gradient(160deg, ${C.navyDark}, ${C.navyDeep})`,
                borderRadius: '16px', padding: 'clamp(1.5rem, 3vw, 2.5rem)',
                height: '100%', transition: 'box-shadow 0.4s ease, transform 0.4s ease',
                boxShadow: '0 8px 30px rgba(12, 20, 32, 0.15)',
                position: 'relative', overflow: 'hidden'
              }}>
                {/* Breathing gold border */}
                <div className="agency-gold-breathe-border" style={{
                  position: 'absolute', inset: 0, borderRadius: '16px',
                  border: '1px solid rgba(212, 160, 74, 0.12)',
                  pointerEvents: 'none', zIndex: 1
                }} />
                {/* Subtle gold glow top-right */}
                <div className="agency-gold-glow" style={{
                  position: 'absolute', top: '-30%', right: '-20%',
                  width: '250px', height: '250px', borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(212,160,74,0.08) 0%, transparent 70%)',
                  pointerEvents: 'none'
                }} />

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', position: 'relative' }}>
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '50%',
                    background: 'rgba(212, 160, 74, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1rem', flexShrink: 0, color: C.gold
                  }}>{'\u2197'}</div>
                  <div>
                    <h3 style={{
                      fontFamily: "'Cinzel', serif", fontSize: 'clamp(0.95rem, 1.5vw, 1.15rem)',
                      fontWeight: 600, color: 'rgba(255,255,255,0.9)', margin: '0 0 0.3rem'
                    }}>Approche structurée</h3>
                    <p style={{
                      margin: 0, fontSize: '0.65rem', color: 'rgba(212,160,74,0.6)',
                      letterSpacing: '0.04em', fontWeight: 500
                    }}>Identité claire • Audience qualifiée • Monétisation relationnelle</p>
                  </div>
                </div>

                {/* Animated SVG Graph — growing */}
                <AnimatedGraph
                  points="55,148 130,140 205,118 275,75 345,28"
                  dots="55,148 205,118 275,75 345,28"
                  color={C.gold}
                  cardBg={C.navyDeep}
                  variant="good"
                  labels={[
                    { x: 55, y: 172, text: 'Identité', bold: true, tooltip: 'Définition d\'une identité de marque cohérente' },
                    { x: 205, y: 142, text: 'Buzz viral', tooltip: 'Premier contenu viral qui explose les compteurs' },
                    { x: 275, y: 100, text: 'Communauté', tooltip: 'Construction d\'une audience fidèle et engagée' },
                    { x: 345, y: 5, text: 'Revenus', bold: true, tooltip: 'Revenus récurrents et partenariats long terme' }
                  ]}
                />

                {/* Stats row with animated counter */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  borderTop: `1px solid rgba(212,160,74,0.1)`,
                  paddingTop: '1.25rem', marginBottom: '1.5rem'
                }}>
                  <StatItem icon={'\u2192'} label="Stabilité" color={C.gold} />
                  <AnimatedStat end={180} suffix="%" label="Revenus" color={C.gold} variant="good" />
                  <StatItem icon={'\u2191'} label="Tendance" color={C.gold} />
                </div>

                {/* Summary */}
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                  padding: '1rem', background: 'rgba(212,160,74,0.06)', borderRadius: '10px',
                  marginBottom: '1.25rem', border: '1px solid rgba(212,160,74,0.08)'
                }}>
                  <span style={{ fontSize: '0.85rem', flexShrink: 0, color: C.gold }}>{'\u2726'}</span>
                  <div>
                    <p style={{ fontWeight: 600, color: C.gold, fontSize: '0.85rem', margin: '0 0 0.25rem' }}>Revenu récurrent</p>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem', margin: 0, lineHeight: 1.6 }}>
                      {'\u2192'} Croissance stable. Audience fidèle, partenariats premium.
                    </p>
                  </div>
                </div>

                {/* Tags */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[
                    { icon: '\u2190', text: 'Partenariats' },
                    { icon: '\u2666', text: 'Fidélisation' },
                    { icon: '\u25C8', text: 'Revenus stables' }
                  ].map(({ icon, text }, i) => (
                    <Reveal key={text} delay={0.8 + i * 0.15} direction="up">
                      <span className="agency-tag-bounce" style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.35rem 0.75rem', borderRadius: '20px',
                        background: 'rgba(212,160,74,0.15)', border: '1px solid rgba(212,160,74,0.25)',
                        color: 'rgba(212,160,74,0.9)', fontSize: '0.72rem', fontWeight: 600
                      }}><span style={{ fontSize: '0.6rem' }}>{icon}</span> {text}</span>
                    </Reveal>
                  ))}
                </div>
              </ParallaxCard>
            </Reveal>
          </div>

          {/* Bottom tagline */}
          <Reveal delay={0.4}>
            <div style={{ textAlign: 'center', marginTop: '3.5rem' }}>
              <p style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)',
                fontWeight: 500, fontStyle: 'italic',
                letterSpacing: '0.03em',
                margin: '0 0 1rem',
                color: C.navy
              }}>
                C'est ce{' '}
                <span className="agency-tilt-word agency-shimmer-text" style={{
                  fontWeight: 700, fontSize: '1.15em', position: 'relative'
                }}>basculement</span>
                {' '}que nous opérons.
              </p>
              <div className="agency-tagline-underline" style={{
                width: '80px', height: '2px',
                background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`,
                margin: '0 auto', borderRadius: '1px'
              }} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ NOTRE APPROCHE — 5 piliers ═══ */}
      <section id="approche" style={{ padding: '7rem 3rem', background: C.white, position: 'relative' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <SectionLabel>Notre approche</SectionLabel>
              <h2 style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
                fontWeight: 400, color: C.navy, margin: '0 0 0.75rem'
              }}>
                Notre approche{' '}
                <span style={{ color: C.gold, fontStyle: 'italic', fontWeight: 600 }}>exclusive.</span>
              </h2>
              <p style={{
                color: C.textMuted, fontSize: '0.95rem', margin: 0, lineHeight: 1.7
              }}>5 piliers pour révéler votre potentiel et sécuriser vos revenus</p>
            </div>
          </Reveal>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { num: '01', icon: '\u2666', title: 'Branding', desc: 'Identité claire, positionnement assumé, différenciation.' },
              { num: '02', icon: '\u2699', title: 'Stratégie', desc: 'Plateformes adaptées, gestion du risque, vision long terme.' },
              { num: '03', icon: '\u25A3', title: 'Contenu', desc: 'Formats propriétaires, ligne éditoriale, reconnaissance immédiate.' },
              { num: '04', icon: '\u2666', title: 'Chatting', desc: 'Conversation stratégique, monétisation fine, relation durable.' },
              { num: '05', icon: '\u25CB', title: 'Structure', desc: 'Process clairs, outils propriétaires, exécution fiable.' }
            ].map(({ num, icon, title, desc }, i) => (
              <Reveal key={num} delay={i * 0.1}>
                <div className="agency-pilier-row" style={{
                  display: 'flex', alignItems: 'center', gap: '1.5rem',
                  padding: '1.5rem 2rem',
                  background: C.marble,
                  borderRadius: '12px',
                  border: `1px solid ${C.border}`,
                  transition: 'all 0.3s ease',
                  cursor: 'default'
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(212, 160, 74, 0.3)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(212, 160, 74, 0.08)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = C.border;
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <span style={{
                    fontFamily: "'Cinzel', serif", fontSize: '1.8rem', fontWeight: 700,
                    color: 'rgba(212, 160, 74, 0.2)', flexShrink: 0, minWidth: '50px'
                  }}>{num}</span>
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '50%',
                    background: 'rgba(212, 160, 74, 0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, color: C.gold, fontSize: '0.9rem'
                  }}>{icon}</div>
                  <div>
                    <h3 style={{
                      fontFamily: "'Cinzel', serif", fontSize: '1.05rem', fontWeight: 600,
                      color: C.navy, margin: '0 0 0.3rem'
                    }}>{title}</h3>
                    <p style={{
                      color: C.textMuted, fontSize: '0.85rem', margin: 0, lineHeight: 1.6
                    }}>{desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.6}>
            <p style={{
              textAlign: 'center', marginTop: '3rem',
              color: C.textMuted, fontSize: '0.9rem', lineHeight: 1.7
            }}>
              Chaque levier est pensé pour{' '}
              <span style={{ color: C.gold, fontWeight: 600 }}>maximiser vos revenus</span>
              {' '}et{' '}
              <span style={{ color: C.navy, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: '3px', textDecorationColor: C.gold }}>sécuriser votre compte</span>.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══ NOS FORMULES ═══ */}
      <section id="formules" style={{
        padding: '7rem 3rem',
        background: `linear-gradient(170deg, ${C.navyDark}, ${C.navyDeep})`,
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Subtle gold accent line */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '120px', height: '2px',
          background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`
        }} />

        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <Reveal>
            <p style={{
              fontFamily: "'Cinzel', serif", fontSize: 'clamp(0.65rem, 1vw, 0.8rem)',
              textTransform: 'uppercase', letterSpacing: '0.25em',
              color: C.gold, textAlign: 'center', margin: '0 0 1rem'
            }}>Nos formules</p>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 style={{
              fontFamily: "'Cinzel', serif", fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)',
              fontWeight: 400, color: '#fff', textAlign: 'center',
              margin: '0 0 1rem', lineHeight: 1.3
            }}>
              Choisis <span style={{ color: C.gold, fontStyle: 'italic' }}>ton niveau</span>
            </h2>
          </Reveal>
          <Reveal delay={0.15}>
            <p style={{
              color: 'rgba(255,255,255,0.45)', fontSize: 'clamp(0.85rem, 1.3vw, 1rem)',
              textAlign: 'center', margin: '0 auto 4rem', maxWidth: '550px', lineHeight: 1.7
            }}>
              Tu veux juste un coup de main ou tu veux qu'on prenne les rênes ? À toi de voir.
            </p>
          </Reveal>

          {/* Cards grid */}
          <div className="agency-formules-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.5rem',
            alignItems: 'stretch'
          }}>
            {[
              {
                name: 'Essentiel',
                tagline: 'Ton contenu. Nos chatteurs.',
                description: 'Tu gères ton image, on gère tes DMs. Notre équipe convertit chaque conversation en revenu pendant que tu te concentres sur ce que tu fais de mieux.',
                features: [
                  'Équipe de chatteurs formés, dédiée à ton compte',
                  'Couverture 24h/24, 7j/7',
                  'Dashboard pour suivre tes revenus en temps réel',
                  'Stratégies de conversion éprouvées'
                ],
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                ),
                highlight: false
              },
              {
                name: 'Performance',
                tagline: 'On fait exploser ta visibilité.',
                description: 'Chatting + marketing. On ne se contente pas de répondre aux messages. On attire les bons abonnés, on optimise ton profil et on fait grandir ton audience.',
                features: [
                  'Tout de l\'offre Essentiel',
                  'Stratégie marketing sur mesure',
                  'Acquisition d\'abonnés ciblée',
                  'Gestion de tes réseaux sociaux',
                  'Profil optimisé pour convertir'
                ],
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                    <polyline points="16 7 22 7 22 13" />
                  </svg>
                ),
                highlight: true
              },
              {
                name: 'Clé en main',
                tagline: 'Tu shoot. On fait le reste.',
                description: 'Tu n\'as qu\'une chose à faire : créer du contenu. Marketing, chatting, stratégie, planning... on s\'occupe de tout. Zéro prise de tête.',
                features: [
                  'Tout de l\'offre Performance',
                  'Gestion intégrale de tes comptes',
                  'Direction artistique & planning',
                  'Stratégie de contenu personnalisée',
                  'Toi tu crées, nous on scale'
                ],
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                ),
                highlight: false
              }
            ].map((plan, i) => (
              <Reveal key={plan.name} delay={0.15 + i * 0.15} direction="up">
                <div
                  className="agency-formule-card"
                  onMouseEnter={e => {
                    haptic('light');
                    e.currentTarget.style.transform = 'translateY(-8px)';
                    e.currentTarget.style.boxShadow = plan.highlight
                      ? `0 25px 60px rgba(212, 160, 74, 0.2), 0 0 0 1px ${C.gold}`
                      : '0 25px 60px rgba(0,0,0,0.3)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = plan.highlight
                      ? `0 15px 40px rgba(212, 160, 74, 0.12), 0 0 0 1px rgba(212, 160, 74, 0.4)`
                      : '0 10px 40px rgba(0,0,0,0.15)';
                  }}
                  style={{
                    background: plan.highlight
                      ? `linear-gradient(160deg, rgba(212, 160, 74, 0.08), rgba(27, 46, 75, 0.95))`
                      : `linear-gradient(160deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))`,
                    border: plan.highlight
                      ? `1px solid rgba(212, 160, 74, 0.4)`
                      : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: 'clamp(2rem, 4vw, 3rem) clamp(1.5rem, 3vw, 2rem)',
                    position: 'relative', overflow: 'hidden',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: plan.highlight
                      ? `0 15px 40px rgba(212, 160, 74, 0.12), 0 0 0 1px rgba(212, 160, 74, 0.4)`
                      : '0 10px 40px rgba(0,0,0,0.15)',
                    display: 'flex', flexDirection: 'column', height: '100%',
                    cursor: 'default'
                  }}
                >
                  {/* Popular badge for highlight */}
                  {plan.highlight && (
                    <div style={{
                      position: 'absolute', top: '1rem', right: '1rem',
                      background: `linear-gradient(135deg, ${C.gold}, ${C.goldDark})`,
                      color: C.navyDark, fontSize: '0.6rem', fontWeight: 700,
                      padding: '0.3rem 0.7rem', borderRadius: '20px',
                      textTransform: 'uppercase', letterSpacing: '0.1em'
                    }}>Recommandé</div>
                  )}

                  {/* Icon */}
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '14px',
                    background: plan.highlight ? 'rgba(212, 160, 74, 0.12)' : 'rgba(255,255,255,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 0 1.5rem'
                  }}>
                    {plan.icon}
                  </div>

                  {/* Name */}
                  <h3 style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: 'clamp(1.1rem, 2vw, 1.35rem)',
                    fontWeight: 600,
                    color: plan.highlight ? C.gold : '#fff',
                    margin: '0 0 0.4rem'
                  }}>{plan.name}</h3>

                  {/* Tagline */}
                  <p style={{
                    color: plan.highlight ? 'rgba(212, 160, 74, 0.7)' : 'rgba(255,255,255,0.4)',
                    fontSize: '0.8rem', fontStyle: 'italic',
                    margin: '0 0 1.5rem', letterSpacing: '0.02em'
                  }}>{plan.tagline}</p>

                  {/* Description */}
                  <p style={{
                    color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem',
                    lineHeight: 1.7, margin: '0 0 2rem'
                  }}>{plan.description}</p>

                  {/* Features */}
                  <div style={{ marginTop: 'auto' }}>
                    {plan.features.map((feat, fi) => (
                      <div key={fi} style={{
                        display: 'flex', alignItems: 'center', gap: '0.6rem',
                        padding: '0.5rem 0',
                        borderTop: fi === 0 ? '1px solid rgba(255,255,255,0.06)' : 'none'
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke={plan.highlight ? C.gold : 'rgba(255,255,255,0.35)'}
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span style={{
                          color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem'
                        }}>{feat}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <a
                    href="/equipe#postuler"
                    onClick={() => haptic('medium')}
                    onMouseEnter={e => {
                      haptic('light');
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = plan.highlight
                        ? '0 8px 25px rgba(212, 160, 74, 0.35)'
                        : '0 8px 25px rgba(255,255,255,0.08)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    style={{
                      display: 'block', textAlign: 'center',
                      padding: '0.9rem 1.5rem', marginTop: '2rem',
                      background: plan.highlight
                        ? `linear-gradient(135deg, ${C.gold}, ${C.goldDark})`
                        : 'transparent',
                      border: plan.highlight ? 'none' : '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 0,
                      color: plan.highlight ? C.navyDark : 'rgba(255,255,255,0.7)',
                      fontSize: '0.78rem', fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.12em',
                      textDecoration: 'none',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer'
                    }}
                  >
                    {plan.highlight ? 'Je veux cette formule' : 'Découvrir'}
                  </a>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Bottom note */}
          <Reveal delay={0.7}>
            <p style={{
              textAlign: 'center', color: 'rgba(255,255,255,0.3)',
              fontSize: '0.78rem', margin: '3rem 0 0', fontStyle: 'italic'
            }}>
              Les tarifs sont discutés en privé, selon ton profil et tes objectifs.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══ TÉMOIGNAGES & LÉGITIMITÉ ═══ */}
      <section id="temoignages" className="agency-temoignages-section" style={{
        padding: '7rem 3rem',
        background: `linear-gradient(170deg, ${C.navyDark}, ${C.navyDeep})`
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          {/* Header row: title left, stats right */}
          <Reveal>
            <div className="agency-temoignages-header" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              marginBottom: '3.5rem', gap: '2rem', flexWrap: 'wrap'
            }}>
              <div>
                <SectionLabel dark>Témoignages & Légitimité</SectionLabel>
                <h2 style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
                  fontWeight: 400, color: 'rgba(255,255,255,0.9)',
                  margin: '0', lineHeight: 1.3
                }}>
                  Elles ont fait confiance.<br />
                  <span style={{ color: C.gold, fontWeight: 600 }}>Les résultats parlent.</span>
                </h2>
              </div>
              <div className="agency-temoignages-stats" style={{
                display: 'flex', gap: '1.5rem', alignItems: 'flex-start'
              }}>
                {[
                  { value: '4+', label: 'Années' },
                  { value: '18–54', label: 'Âge profils' },
                  { value: '∞', label: 'Long terme' }
                ].map(({ value, label }) => (
                  <div key={label} style={{
                    border: `1px solid rgba(212, 160, 74, 0.25)`,
                    borderRadius: '10px', padding: '0.8rem 1.2rem',
                    textAlign: 'center', minWidth: '85px'
                  }}>
                    <div style={{
                      fontFamily: "'Cinzel', serif", fontSize: '1.3rem',
                      fontWeight: 600, color: C.gold
                    }}>{value}</div>
                    <div style={{
                      fontSize: '0.6rem', letterSpacing: '0.12em',
                      textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)',
                      marginTop: '0.3rem'
                    }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Testimonial cards */}
          <div className="agency-temoignages-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.5rem'
          }}>
            {[
              {
                name: 'Léa M.',
                text: "J'avais déjà une audience importante. Le problème n'était pas la visibilité, mais la gestion. Mon agence précédente était trop petite pour absorber le volume : réponses tardives, stratégie incohérente, perte de revenus. Chez Impera, j'ai trouvé une structure à la bonne taille, avec une équipe dédiée et des process clairs. Tout est devenu plus fluide, plus stable, plus professionnel.",
                role: 'Influenceuse établie'
              },
              {
                name: 'Camille R.',
                text: "Je ne suis pas influenceuse. Je n'avais pas une grosse audience, mais un vrai potentiel. Mon ancienne agence appliquait une stratégie générique qui ne correspondait ni à mon image ni à ma communauté. Résultat : stagnation. Avec Impera, l'approche est plus fine, plus cohérente, et pensée sur le long terme.",
                role: 'Créatrice non-influenceuse'
              },
              {
                name: 'Sofia L.',
                text: "Mon ancienne agence utilisait des méthodes agressives qui ne fonctionnent plus aujourd'hui. Comptes signalés, contenus supprimés, plusieurs redémarrages à zéro. Ici, la stratégie est plus maîtrisée, plus propre, et surtout durable. On ne cherche pas le coup d'éclat, mais la continuité.",
                role: 'Influenceuse ayant subi bans'
              }
            ].map(({ name, text, role }, i) => (
              <Reveal key={name} delay={i * 0.15}>
                <div className="agency-testimonial-card" style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(212, 160, 74, 0.12)',
                  borderRadius: '14px', padding: '2rem',
                  height: '100%', display: 'flex', flexDirection: 'column',
                  transition: 'all 0.3s ease'
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(212, 160, 74, 0.3)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(212, 160, 74, 0.12)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <span style={{
                      background: 'rgba(212, 160, 74, 0.12)',
                      border: '1px solid rgba(212, 160, 74, 0.2)',
                      borderRadius: '6px', padding: '0.3rem 0.7rem',
                      fontSize: '0.75rem', fontWeight: 600, color: C.gold
                    }}>{name}</span>
                    <span style={{ fontSize: '1.3rem', color: 'rgba(212, 160, 74, 0.2)', fontFamily: "'Cinzel', serif" }}>«</span>
                  </div>
                  <p style={{
                    color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem',
                    lineHeight: 1.8, margin: '0 0 1.5rem', flex: 1,
                    fontStyle: 'italic'
                  }}>
                    « {text} »
                  </p>
                  <p style={{
                    color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem',
                    margin: 0, fontStyle: 'italic'
                  }}>
                    — {role}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PERFORMANCE TYPE ═══ */}
      <section id="performance" className="agency-performance-section" style={{
        padding: '7rem 3rem',
        background: C.navyDeep
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Reveal>
            <SectionLabel dark>Performance type</SectionLabel>
          </Reveal>

          <Reveal delay={0.1}>
            <PerformanceChart />
          </Reveal>
        </div>
      </section>

      {/* ═══ COMMENT ÇA MARCHE ═══ */}
      <section id="process" className="agency-process-section" style={{
        padding: '7rem 3rem',
        background: C.marble,
        position: 'relative'
      }}>
        {/* Decorative diamond divider at top */}
        <div style={{
          position: 'absolute', top: '-1px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}>
          <div style={{ width: '60px', height: '1px', background: `linear-gradient(90deg, transparent, rgba(212,160,74,0.3))` }} />
          <div style={{ width: '10px', height: '10px', background: C.gold, transform: 'rotate(45deg)', opacity: 0.6 }} />
          <div style={{ width: '60px', height: '1px', background: `linear-gradient(90deg, rgba(212,160,74,0.3), transparent)` }} />
        </div>

        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <SectionLabel>Comment ça marche</SectionLabel>
              <h2 style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
                fontWeight: 400, color: C.navy, margin: '0 0 1rem', lineHeight: 1.3
              }}>
                De la prise de contact à{' '}
                <span style={{ color: C.gold, fontStyle: 'italic', fontWeight: 600 }}>l'accompagnement</span>
              </h2>
              <p style={{
                color: C.textMuted, fontSize: '0.95rem', margin: 0, lineHeight: 1.7,
                maxWidth: '550px', marginLeft: 'auto', marginRight: 'auto'
              }}>
                Un processus clair, sans engagement initial. La revue privée est un échange confidentiel, pas un appel commercial.
              </p>
            </div>
          </Reveal>

          {/* 4 steps grid */}
          <div className="agency-steps-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1.25rem', position: 'relative', marginBottom: '3.5rem'
          }}>
            {/* Connecting line behind cards */}
            <div className="agency-steps-line" style={{
              position: 'absolute', top: '50px', left: '12%', right: '12%',
              height: '1px',
              background: `repeating-linear-gradient(90deg, rgba(212,160,74,0.2) 0, rgba(212,160,74,0.2) 6px, transparent 6px, transparent 12px)`,
              zIndex: 0
            }} />

            {[
              { num: '01', icon: '💬', title: 'Premier contact', desc: 'Vous nous contactez via le formulaire. Nous répondons sous 24h.' },
              { num: '02', icon: '🔍', title: 'Revue privée', desc: 'Échange confidentiel pour analyser votre profil, votre potentiel et vos objectifs.' },
              { num: '03', icon: '✓', title: 'Recommandation', desc: 'Si le fit est là, nous vous présentons une stratégie personnalisée et les prochaines étapes.' },
              { num: '04', icon: '🤝', title: 'Onboarding', desc: "Intégration à l'équipe, mise en place des outils, et lancement de la stratégie." }
            ].map(({ num, icon, title, desc }, i) => (
              <Reveal key={num} delay={i * 0.12}>
                <div className="agency-step-card" style={{
                  background: C.white,
                  border: `1px solid ${C.border}`,
                  borderRadius: '14px',
                  padding: '1.8rem 1.5rem',
                  position: 'relative', zIndex: 1,
                  transition: 'all 0.3s ease',
                  height: '100%'
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(212, 160, 74, 0.25)';
                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(27, 46, 75, 0.06)';
                    e.currentTarget.style.transform = 'translateY(-4px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = C.border;
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
                    <span style={{
                      fontFamily: "'Cinzel', serif", fontSize: '2rem', fontWeight: 700,
                      color: 'rgba(212, 160, 74, 0.15)'
                    }}>{num}</span>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '50%',
                      background: 'rgba(212, 160, 74, 0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1rem'
                    }}>{icon}</div>
                  </div>
                  <h3 style={{
                    fontFamily: "'Inter', sans-serif", fontSize: '0.95rem', fontWeight: 700,
                    color: C.navy, margin: '0 0 0.6rem'
                  }}>{title}</h3>
                  <p style={{
                    color: C.textMuted, fontSize: '0.82rem', margin: 0, lineHeight: 1.7
                  }}>{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Mini CTA bar */}
          <Reveal delay={0.5}>
            <div style={{
              background: `linear-gradient(135deg, rgba(212,160,74,0.04), rgba(212,160,74,0.08))`,
              border: `1px solid rgba(212, 160, 74, 0.15)`,
              borderRadius: '14px',
              padding: '1.5rem 2.5rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: '2rem', flexWrap: 'wrap'
            }}>
              <div>
                <p style={{
                  fontFamily: "'Cinzel', serif", fontSize: '1.1rem', fontWeight: 600,
                  color: C.navy, margin: '0 0 0.3rem'
                }}>Prête à commencer ?</p>
                <p style={{
                  color: C.textMuted, fontSize: '0.82rem', margin: 0
                }}>Nous privilégions la pertinence, pas le volume.</p>
              </div>
              <a href="mailto:contact@impera-agency.com?subject=Demande de revue privée" style={{
                background: `linear-gradient(135deg, ${C.gold}, ${C.goldDark})`,
                color: C.white, padding: '0.75rem 1.8rem',
                borderRadius: '8px', textDecoration: 'none',
                fontFamily: "'Inter', sans-serif", fontSize: '0.8rem',
                fontWeight: 600, letterSpacing: '0.05em',
                transition: 'all 0.3s ease', whiteSpace: 'nowrap',
                boxShadow: '0 4px 15px rgba(212, 160, 74, 0.2)'
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 25px rgba(212, 160, 74, 0.3)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(212, 160, 74, 0.2)';
                }}
              >Demander une revue privée</a>
            </div>
          </Reveal>
        </div>

        {/* Decorative diamond divider at bottom */}
        <div style={{
          position: 'absolute', bottom: '-1px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: '0.3rem'
        }}>
          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(212,160,74,0.3)' }} />
          <div style={{
            width: '14px', height: '14px', borderRadius: '50%',
            border: '1px solid rgba(212,160,74,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ width: '6px', height: '6px', background: C.gold, transform: 'rotate(45deg)', opacity: 0.5 }} />
          </div>
          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(212,160,74,0.3)' }} />
        </div>
      </section>

      {/* ═══ NOTRE PROMESSE ═══ */}
      <section className="agency-promesse-section" style={{
        padding: '7rem 3rem',
        background: C.marble,
        position: 'relative'
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          {/* Header */}
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <SectionLabel>Notre promesse</SectionLabel>
              <h2 style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
                fontWeight: 400, color: C.navy, margin: '0', lineHeight: 1.35,
                maxWidth: '700px', marginLeft: 'auto', marginRight: 'auto'
              }}>
                Chez Impera, nous transformons votre présence en ligne en{' '}
                <span style={{ color: C.gold, fontStyle: 'italic', fontWeight: 600 }}>revenus stables et sécurisés.</span>
              </h2>
            </div>
          </Reveal>

          {/* Two-column layout: promises left, mockup right */}
          <div className="agency-promesse-grid" style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '3rem', alignItems: 'center'
          }}>
            {/* Left: 5 promise items */}
            <div className="agency-promesse-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0, overflow: 'hidden' }}>
              {[
                { icon: '👑', text: "Équipe dédiée pour chaque créatrice → suivi personnalisé, pas d'improvisation." },
                { icon: '✧', text: 'Croissance stable et sécurisée → pas de buzz éphémère, pas de comptes bloqués.' },
                { icon: '↗', text: 'Exploitation maximale de votre potentiel → chaque levier de revenus activé.' },
                { icon: '●', text: 'Outils et process propriétaires → tout est coordonné, validé et tracé.' },
                { icon: '◆', text: "Accompagnement exclusif → nous travaillons avec un nombre limité de créatrices, pour garantir attention et résultats." }
              ].map(({ icon, text }, i) => (
                <Reveal key={i} delay={i * 0.1}>
                  <div className="agency-promesse-item" style={{
                    display: 'flex', alignItems: 'flex-start', gap: '1rem',
                    padding: '1.2rem 1.5rem',
                    background: C.white,
                    borderRadius: '12px',
                    border: `1px solid ${C.border}`,
                    transition: 'all 0.3s ease'
                  }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'rgba(212, 160, 74, 0.2)';
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(27, 46, 75, 0.04)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = C.border;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <span style={{
                      color: C.gold, fontSize: '1rem', flexShrink: 0,
                      marginTop: '0.1rem'
                    }}>{icon}</span>
                    <p style={{
                      color: C.textMuted, fontSize: '0.88rem', margin: 0,
                      lineHeight: 1.7
                    }}>{text}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Right: App mockup */}
            <Reveal delay={0.3} direction="right">
              <div style={{
                background: C.white,
                borderRadius: '16px',
                border: `1px solid ${C.border}`,
                boxShadow: '0 20px 60px rgba(27, 46, 75, 0.08)',
                overflow: 'hidden'
              }}>
                {/* Browser chrome */}
                <div style={{
                  padding: '0.75rem 1rem',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f57' }} />
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#febc2e' }} />
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#28c840' }} />
                  </div>
                  <div style={{
                    background: C.marble, borderRadius: '6px',
                    padding: '0.3rem 1rem', fontSize: '0.7rem',
                    color: C.textMuted, flex: 1, textAlign: 'center',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem'
                  }}>
                    <span style={{ fontSize: '0.6rem' }}>🔒</span> app.impera-agency.com
                  </div>
                </div>

                {/* App content */}
                <div style={{ padding: '1.5rem' }}>
                  {/* 3-column board */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '1rem'
                  }}>
                    {/* Réception column */}
                    <div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        marginBottom: '0.75rem'
                      }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: C.navy }}>Réception</span>
                      </div>
                      {/* Card 1 */}
                      <div style={{
                        background: C.marble, borderRadius: '8px', padding: '0.7rem',
                        border: `1px solid ${C.border}`, marginBottom: '0.5rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: `linear-gradient(135deg, ${C.gold}, ${C.goldDark})`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.6rem', color: C.white, fontWeight: 700
                          }}>A</div>
                          <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: C.navy }}>Alice D.</div>
                            <div style={{ fontSize: '0.55rem', color: C.textLight }}>Il y a 2 min</div>
                          </div>
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          fontSize: '0.6rem', color: C.textMuted
                        }}>
                          <span>🎬</span> vlog_paris_final
                          <span style={{ fontSize: '0.5rem', color: C.textLight }}>34 MB · MP4</span>
                        </div>
                      </div>
                      {/* Skeleton cards */}
                      <div style={{
                        background: C.marble, borderRadius: '8px', padding: '0.7rem',
                        border: `1px solid ${C.border}`
                      }}>
                        <div style={{ width: '60%', height: '8px', background: 'rgba(27,46,75,0.06)', borderRadius: '4px', marginBottom: '0.4rem' }} />
                        <div style={{ width: '40%', height: '8px', background: 'rgba(27,46,75,0.04)', borderRadius: '4px' }} />
                      </div>
                    </div>

                    {/* Validation column */}
                    <div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        marginBottom: '0.75rem'
                      }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: C.gold }} />
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: C.navy }}>Validation</span>
                      </div>
                      {/* Active card with message */}
                      <div style={{
                        background: C.marble, borderRadius: '8px', padding: '0.7rem',
                        border: `2px solid rgba(212,160,74,0.3)`, marginBottom: '0.5rem'
                      }}>
                        <div style={{
                          background: C.navy, borderRadius: '8px', padding: '0.6rem',
                          marginBottom: '0.5rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.3rem' }}>
                            <div style={{
                              width: '18px', height: '18px', borderRadius: '50%',
                              background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.5rem', color: C.white, fontWeight: 700
                            }}>M</div>
                            <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.7)' }}>Manager</span>
                          </div>
                          <p style={{
                            fontSize: '0.62rem', color: 'rgba(255,255,255,0.85)',
                            margin: 0, lineHeight: 1.5
                          }}>Peux-tu couper les 3 dernières secondes ?</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <span style={{
                            background: '#22c55e', color: C.white, borderRadius: '5px',
                            padding: '0.2rem 0.5rem', fontSize: '0.58rem', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '0.2rem'
                          }}>✓ Valider</span>
                          <span style={{
                            background: 'rgba(27,46,75,0.06)', color: C.textMuted, borderRadius: '5px',
                            padding: '0.2rem 0.5rem', fontSize: '0.58rem',
                            display: 'flex', alignItems: 'center', gap: '0.2rem'
                          }}>💬 Retour</span>
                        </div>
                      </div>
                      {/* Skeleton */}
                      <div style={{
                        background: C.marble, borderRadius: '8px', padding: '0.7rem',
                        border: `1px solid ${C.border}`
                      }}>
                        <div style={{ width: '70%', height: '8px', background: 'rgba(27,46,75,0.06)', borderRadius: '4px', marginBottom: '0.4rem' }} />
                        <div style={{ width: '50%', height: '8px', background: 'rgba(27,46,75,0.04)', borderRadius: '4px' }} />
                      </div>
                    </div>

                    {/* Publication column */}
                    <div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        marginBottom: '0.75rem'
                      }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: C.navy }}>Publication</span>
                      </div>
                      {/* Schedule cards */}
                      {[
                        { day: 'DIM', num: '14', time: '18:00', label: 'P...', color: '#ef4444' },
                        { day: 'VEN', num: '16', time: '20:00', label: 'Challe...', color: C.gold }
                      ].map(({ day, num, time, label, color }) => (
                        <div key={num} style={{
                          background: C.marble, borderRadius: '8px', padding: '0.6rem',
                          border: `1px solid ${C.border}`, marginBottom: '0.5rem',
                          display: 'flex', alignItems: 'center', gap: '0.6rem'
                        }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.5rem', color: C.textLight, fontWeight: 600 }}>{day}</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: C.navy }}>{num}</div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: color, opacity: 0.8 }} />
                              <span style={{ fontSize: '0.6rem', color: C.textMuted }}>{time}</span>
                            </div>
                            <div style={{ fontSize: '0.62rem', color: C.navy, fontWeight: 500, marginTop: '0.15rem' }}>{label}</div>
                          </div>
                          <div style={{
                            width: '20px', height: '20px', borderRadius: '50%',
                            border: `2px solid #22c55e`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            <span style={{ color: '#22c55e', fontSize: '0.6rem' }}>✓</span>
                          </div>
                        </div>
                      ))}
                      {/* Skeleton */}
                      <div style={{
                        background: C.marble, borderRadius: '8px', padding: '0.6rem',
                        border: `1px solid ${C.border}`
                      }}>
                        <div style={{ width: '55%', height: '8px', background: 'rgba(27,46,75,0.06)', borderRadius: '4px', marginBottom: '0.4rem' }} />
                        <div style={{ width: '35%', height: '8px', background: 'rgba(27,46,75,0.04)', borderRadius: '4px' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* CTA below */}
          <Reveal delay={0.5}>
            <div style={{ textAlign: 'center', marginTop: '4rem' }}>
              <a href="mailto:contact@impera-agency.com?subject=Demande de revue privée" style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.75rem',
                background: `linear-gradient(135deg, ${C.gold}, ${C.goldDark})`,
                color: C.white, padding: '1rem 2.5rem',
                borderRadius: '8px', textDecoration: 'none',
                fontFamily: "'Inter', sans-serif", fontSize: '0.85rem',
                fontWeight: 600, letterSpacing: '0.03em',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 20px rgba(212, 160, 74, 0.25)'
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(212, 160, 74, 0.35)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(212, 160, 74, 0.25)';
                }}
              >
                Demandez votre revue privée <span style={{ fontSize: '1rem' }}>→</span>
              </a>
              <p style={{
                color: C.textLight, fontSize: '0.8rem', marginTop: '1rem',
                fontStyle: 'italic'
              }}>Échange confidentiel et gratuit</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" className="agency-faq-section" style={{
        padding: '7rem 3rem',
        background: `linear-gradient(170deg, ${C.navyDark}, ${C.navyDeep})`
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
              <SectionLabel dark>Questions fréquentes</SectionLabel>
              <h2 style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
                fontWeight: 400, color: 'rgba(255,255,255,0.9)',
                margin: '0', lineHeight: 1.3
              }}>
                Tout ce que vous devez{' '}
                <span style={{ color: C.gold, fontStyle: 'italic', fontWeight: 600 }}>savoir.</span>
              </h2>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div>
              {[
                { q: "Pourquoi rejoindre une agence au lieu de me lancer seule ?", a: "Se lancer seule est possible, mais une agence vous apporte l'expertise, les outils et la structure nécessaires pour accélérer votre croissance tout en sécurisant votre compte. Vous gagnez du temps, évitez les erreurs coûteuses, et accédez à des stratégies éprouvées." },
                { q: "Comment pouvez-vous m'aider à réussir sur OnlyFans ?", a: "Nous prenons en charge la stratégie de contenu, le chatting professionnel, le branding, la gestion des plateformes et l'optimisation des revenus. Chaque créatrice bénéficie d'un plan personnalisé adapté à son profil et ses objectifs." },
                { q: "Dois-je avoir de l'expérience sur les réseaux sociaux ?", a: "Non. Nous accompagnons aussi bien des créatrices débutantes que des influenceuses établies. Notre équipe vous guide à chaque étape, de la création de votre identité à la monétisation." },
                { q: "Quel est l'investissement de temps par jour ?", a: "En moyenne, 1 à 2 heures par jour suffisent pour la création de contenu. Tout le reste — chatting, stratégie, planification — est géré par notre équipe." },
                { q: "Qu'est-ce qu'un manager OnlyFans ?", a: "Un manager OnlyFans est un professionnel qui gère les aspects business de votre compte : stratégie, chatting, optimisation des revenus, protection du compte. C'est votre partenaire de croissance." },
                { q: "Dois-je faire appel à un manager OnlyFans ?", a: "Si vous souhaitez maximiser vos revenus sans y consacrer tout votre temps, oui. Un manager vous permet de vous concentrer sur ce que vous faites le mieux : créer du contenu." },
                { q: "Comment gagner de l'argent avec OnlyFans ?", a: "Les revenus proviennent des abonnements, des messages payants (PPV), des pourboires et des contenus personnalisés. Notre stratégie active tous ces leviers simultanément." },
                { q: "Combien peut-on gagner sur OnlyFans ?", a: "Les revenus varient selon votre profil et votre investissement. Nos créatrices génèrent en moyenne entre 3 000€ et 30 000€ par mois après 6 mois d'accompagnement." },
                { q: "C'est quoi une agence OnlyFans ?", a: "Une agence OnlyFans est une structure professionnelle qui accompagne les créatrices dans la gestion et le développement de leurs comptes. Elle fournit l'expertise, les outils et les ressources humaines nécessaires." },
                { q: "OnlyFans ou MYM : quelle plateforme choisir ?", a: "Chaque plateforme a ses avantages. OnlyFans offre une audience internationale massive, tandis que MYM est plus orienté marché francophone. Nous vous conseillons sur la meilleure stratégie multi-plateforme." }
              ].map(({ q, a }) => (
                <FAQItem key={q} q={q} a={a} dark />
              ))}
            </div>
          </Reveal>

          {/* Link card */}
          <Reveal delay={0.3}>
            <div style={{
              marginTop: '2rem',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(212, 160, 74, 0.15)',
              borderRadius: '12px', padding: '1.2rem 1.5rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              transition: 'all 0.3s ease', cursor: 'pointer'
            }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(212, 160, 74, 0.3)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(212, 160, 74, 0.15)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              }}
              onClick={() => scrollTo('approche')}
            >
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: 600, color: C.gold, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                  OnlyFans & Reveal
                </div>
                <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', fontFamily: "'Cinzel', serif" }}>
                  Découvrez notre agence OnlyFans & Reveal
                </div>
              </div>
              <span style={{ color: C.gold, fontSize: '1.2rem' }}>→</span>
            </div>
          </Reveal>

          {/* Contact link */}
          <Reveal delay={0.4}>
            <p style={{ textAlign: 'center', marginTop: '2rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem' }}>Une autre question ? </span>
              <a href="mailto:contact@impera-agency.com" style={{
                color: C.gold, textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600,
                borderBottom: `1px solid rgba(212,160,74,0.3)`, paddingBottom: '2px',
                transition: 'border-color 0.3s'
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.gold}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(212,160,74,0.3)'}
              >Contactez-nous</a>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══ CTA FINAL — Contact Form (dark) ═══ */}
      <section id="candidature" className="agency-cta-section" style={{
        padding: '7rem 3rem',
        background: C.navyDeep
      }}>
        <Reveal>
        <div style={{ maxWidth: '650px', margin: '0 auto', textAlign: 'center' }}>
          <SectionLabel dark>Contact</SectionLabel>
          <h2 style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
            fontWeight: 400, color: 'rgba(255,255,255,0.9)',
            margin: '0 0 1rem', lineHeight: 1.3
          }}>
            Demande de{' '}
            <span style={{ color: C.gold, fontStyle: 'italic', fontWeight: 600 }}>revue</span>
          </h2>
          <p style={{
            color: 'rgba(255,255,255,0.4)', fontSize: '0.92rem',
            lineHeight: 1.7, margin: '0 0 1.5rem', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto'
          }}>
            Chaque demande est étudiée individuellement afin de vérifier l'adéquation avec notre approche.
          </p>

          {/* Urgency badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            border: `1px solid rgba(212, 160, 74, 0.3)`,
            borderRadius: '8px', padding: '0.6rem 1.2rem',
            marginBottom: '2.5rem'
          }}>
            <span style={{ color: C.gold, fontSize: '0.85rem' }}>⏱</span>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>
              Plus que <span style={{ color: C.gold, fontWeight: 700 }}>2 places</span> ce mois-ci
            </span>
          </div>

          {/* Form */}
          <form onSubmit={e => {
            e.preventDefault();
            haptic('heavy');
            const fd = new FormData(e.target);
            const ig = fd.get('instagram');
            const wa = fd.get('whatsapp');
            window.location.href = `mailto:contact@impera-agency.com?subject=Demande de revue privée&body=Instagram: ${ig}%0AWhatsApp: ${wa}`;
          }} style={{ textAlign: 'left' }}>
            {/* Instagram field */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{
                display: 'block', fontSize: '0.65rem', fontWeight: 600,
                color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em',
                textTransform: 'uppercase', marginBottom: '0.6rem'
              }}>Instagram <span style={{ color: C.gold }}>*</span></label>
              <input name="instagram" type="text" required placeholder="@votre_compte" style={{
                width: '100%', background: 'transparent',
                border: 'none', borderBottom: '1px solid rgba(255,255,255,0.12)',
                padding: '0.8rem 0', color: 'rgba(255,255,255,0.8)',
                fontSize: '0.95rem', fontFamily: "'Inter', sans-serif",
                outline: 'none', transition: 'border-color 0.3s'
              }}
                onFocus={e => e.target.style.borderBottomColor = C.gold}
                onBlur={e => e.target.style.borderBottomColor = 'rgba(255,255,255,0.12)'}
              />
            </div>

            {/* WhatsApp field */}
            <div style={{ marginBottom: '2.5rem' }}>
              <label style={{
                display: 'block', fontSize: '0.65rem', fontWeight: 600,
                color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em',
                textTransform: 'uppercase', marginBottom: '0.6rem'
              }}>WhatsApp <span style={{ color: C.gold }}>*</span></label>
              <input name="whatsapp" type="tel" required placeholder="+33 6 00 00 00 00" style={{
                width: '100%', background: 'transparent',
                border: 'none', borderBottom: '1px solid rgba(255,255,255,0.12)',
                padding: '0.8rem 0', color: 'rgba(255,255,255,0.8)',
                fontSize: '0.95rem', fontFamily: "'Inter', sans-serif",
                outline: 'none', transition: 'border-color 0.3s'
              }}
                onFocus={e => e.target.style.borderBottomColor = C.gold}
                onBlur={e => e.target.style.borderBottomColor = 'rgba(255,255,255,0.12)'}
              />
            </div>

            {/* Submit button */}
            <button type="submit" className="agency-cta-btn" style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
              background: `linear-gradient(135deg, ${C.gold}, ${C.goldDark})`,
              color: C.navyDeep, padding: '1.1rem 2rem',
              borderRadius: '0', border: 'none',
              fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '0.8rem',
              letterSpacing: '0.18em', textTransform: 'uppercase',
              cursor: 'pointer', transition: 'all 0.4s ease',
              boxShadow: '0 4px 20px rgba(196, 136, 77, 0.25)',
              position: 'relative', overflow: 'hidden'
            }}>
              Demander une revue privée <span style={{ fontSize: '1rem' }}>→</span>
            </button>
          </form>

          <p style={{
            color: 'rgba(255,255,255,0.25)', fontSize: '0.78rem',
            marginTop: '1.5rem', letterSpacing: '0.03em', fontStyle: 'italic',
            textAlign: 'center'
          }}>
            Nous travaillons avec un nombre limité de créatrices.
          </p>
        </div>
        </Reveal>
      </section>

      {/* ═══ FOOTER (dark) ═══ */}
      <footer className="agency-footer" style={{
        background: C.navyDeep, padding: '5rem 3rem 2.5rem',
        position: 'relative'
      }}>
        {/* Gold accent line at top */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '60px', height: '1px', background: C.gold
        }} />

        <div className="agency-footer-grid" style={{
          maxWidth: '1100px', margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '3rem', marginBottom: '4rem'
        }}>
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.22em', textTransform: 'uppercase' }}>IMPERA</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '14px', height: '1px', background: C.gold }} />
                <span style={{ fontSize: '0.5rem', fontWeight: 500, color: C.gold, letterSpacing: '0.25em', textTransform: 'uppercase' }}>AGENCY</span>
                <span style={{ width: '14px', height: '1px', background: C.gold }} />
              </div>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem', lineHeight: 1.8, margin: 0, maxWidth: '280px' }}>
              Agence française de management pour créatrices de contenu sur OnlyFans et Reveal.
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: '0.65rem', fontWeight: 600, color: C.gold, letterSpacing: '0.2em', margin: '0 0 1.5rem', textTransform: 'uppercase' }}>Navigation</h4>
            {[['equipe', 'Équipe', '/equipe'], ['imperium', 'Imperium'], ['process', 'Comment ça marche'], ['faq', 'FAQ'], ['candidature', 'Postuler']].map(([id, label, href]) => (
              href ? (
                <Link key={id} to={href} style={{
                  display: 'block', textDecoration: 'none',
                  color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem',
                  padding: '0.35rem 0', transition: 'color 0.3s',
                  fontFamily: "'Inter', sans-serif", letterSpacing: '0.02em'
                }}
                  onMouseEnter={e => e.target.style.color = C.gold}
                  onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.3)'}
                >{label}</Link>
              ) : (
                <button key={id} onClick={() => scrollTo(id)} style={{
                  display: 'block', background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem',
                  cursor: 'pointer', padding: '0.35rem 0', transition: 'color 0.3s',
                  fontFamily: "'Inter', sans-serif", letterSpacing: '0.02em'
                }}
                  onMouseEnter={e => e.target.style.color = C.gold}
                  onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.3)'}
                >{label}</button>
              )
            ))}
          </div>

          <div>
            <h4 style={{ fontSize: '0.65rem', fontWeight: 600, color: C.gold, letterSpacing: '0.2em', margin: '0 0 1.5rem', textTransform: 'uppercase' }}>Nous contacter</h4>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <a href="mailto:contact@impera-agency.com" title="Email" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '40px', height: '40px', borderRadius: '50%',
                border: '1px solid rgba(212, 160, 74, 0.2)',
                color: 'rgba(255,255,255,0.4)', textDecoration: 'none',
                transition: 'all 0.3s ease'
              }}
                onMouseEnter={e => { e.currentTarget.style.color = C.gold; e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.background = 'rgba(212, 160, 74, 0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = 'rgba(212, 160, 74, 0.2)'; e.currentTarget.style.background = 'transparent'; }}
              ><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></a>
              <a href="https://instagram.com/impera_agency" target="_blank" rel="noopener noreferrer" title="Instagram" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '40px', height: '40px', borderRadius: '50%',
                border: '1px solid rgba(212, 160, 74, 0.2)',
                color: 'rgba(255,255,255,0.4)', textDecoration: 'none',
                transition: 'all 0.3s ease'
              }}
                onMouseEnter={e => { e.currentTarget.style.color = C.gold; e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.background = 'rgba(212, 160, 74, 0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = 'rgba(212, 160, 74, 0.2)'; e.currentTarget.style.background = 'transparent'; }}
              ><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg></a>
            </div>
          </div>

        </div>

        <div style={{
          borderTop: '1px solid rgba(196,136,77,0.08)', paddingTop: '2rem',
          textAlign: 'center'
        }}>
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.72rem', margin: '0 0 0.5rem', letterSpacing: '0.05em' }}>
            © {new Date().getFullYear()} Impera Agency. Tous droits réservés.
          </p>
          <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.68rem', margin: '0 0 0.4rem' }}>
            France
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
            <Link to="/mentions-legales" style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = C.gold} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.2)'}>Mentions légales</Link>
            <Link to="/confidentialite" style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = C.gold} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.2)'}>Politique de confidentialité</Link>
          </div>
        </div>
      </footer>

      {/* ═══ STYLES ═══ */}
      <style>{`
        @keyframes agencyFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes agencyFadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes agencyMenuSlideIn {
          from { opacity: 0; clip-path: circle(0% at top right); }
          to { opacity: 1; clip-path: circle(150% at top right); }
        }
        @keyframes agencyMenuItemIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes agencyNavIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Gold shimmer sweep on hero text */
        .agency-shimmer-text {
          position: relative;
          background: linear-gradient(
            120deg,
            ${C.gold} 0%,
            ${C.gold} 40%,
            #f0d48a 50%,
            ${C.gold} 60%,
            ${C.gold} 100%
          );
          background-size: 200% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: agencyShimmer 4s ease-in-out infinite;
        }

        @keyframes agencyShimmer {
          0%, 100% { background-position: 100% center; }
          50% { background-position: 0% center; }
        }

        /* CTA shine sweep */
        .agency-cta-btn::before {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 60%; height: 100%;
          background: linear-gradient(
            120deg,
            transparent 0%,
            rgba(255, 255, 255, 0.15) 50%,
            transparent 100%
          );
          animation: agencyCtaShine 4s ease-in-out infinite;
        }

        @keyframes agencyCtaShine {
          0%, 70%, 100% { left: -100%; }
          85% { left: 150%; }
        }

        /* Badge subtle pulse */
        .agency-badge-pulse {
          animation: agencyBadgePulse 3s ease-in-out infinite;
        }
        @keyframes agencyBadgePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(192, 57, 43, 0); }
          50% { box-shadow: 0 0 12px 0 rgba(192, 57, 43, 0.08); }
        }

        /* Fragile text shake on hover */
        .agency-fragile-text {
          transition: transform 0.3s ease;
        }
        .agency-fragile-text:hover {
          animation: agencyShake 0.4s ease;
        }
        @keyframes agencyShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }

        /* ── Chaos card effects ── */
        .agency-scan-line {
          animation: agencyScanLine 4s ease-in-out infinite;
        }
        @keyframes agencyScanLine {
          0%, 100% { top: -2px; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          95% { top: 100%; opacity: 0; }
        }

        .agency-red-flicker {
          animation: agencyRedFlicker 3s ease-in-out infinite;
        }
        @keyframes agencyRedFlicker {
          0%, 100% { opacity: 1; }
          30% { opacity: 0.4; }
          50% { opacity: 1; }
          70% { opacity: 0.6; }
          85% { opacity: 1; }
        }

        /* Graph line glow — chaos (flicker) */
        .agency-graph-line-bad {
          animation: agencyLineFlicker 2.5s ease-in-out infinite 2s;
        }
        @keyframes agencyLineFlicker {
          0%, 100% { opacity: 0.15; }
          30% { opacity: 0.08; }
          60% { opacity: 0.2; }
          80% { opacity: 0.1; }
        }

        /* ── Structure card effects ── */
        .agency-gold-breathe-border {
          animation: agencyGoldBreathe 4s ease-in-out infinite;
        }
        @keyframes agencyGoldBreathe {
          0%, 100% { border-color: rgba(212, 160, 74, 0.1); box-shadow: 0 0 0 0 rgba(212,160,74,0); }
          50% { border-color: rgba(212, 160, 74, 0.25); box-shadow: 0 0 20px 0 rgba(212,160,74,0.05); }
        }

        .agency-gold-glow {
          animation: agencyGoldGlow 5s ease-in-out infinite;
        }
        @keyframes agencyGoldGlow {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        /* Graph line glow — structure (steady pulse) */
        .agency-graph-line-good {
          animation: agencyLineGlow 3s ease-in-out infinite 2s;
        }
        @keyframes agencyLineGlow {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.25; }
        }

        /* Sequential dot pulse — flash one after another */
        .agency-dot-pulse {
          animation: agencyDotPulse 3s ease-in-out infinite;
        }
        @keyframes agencyDotPulse {
          0%, 100% { opacity: 0; r: 14; }
          15% { opacity: 0.35; r: 18; }
          30% { opacity: 0; r: 14; }
        }

        /* Permanent strong glow for last dot (Oubli / Revenus) */
        .agency-dot-permanent {
          animation: agencyDotPermanent 2s ease-in-out infinite;
        }
        @keyframes agencyDotPermanent {
          0%, 100% { opacity: 0.4; r: 18; }
          50% { opacity: 0.65; r: 24; }
        }

        /* Tooltip fade in */
        @keyframes agencyTooltipIn {
          from { opacity: 0; transform: translateX(-50%) translateY(4px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        /* Tagline underline draw */
        .agency-tagline-underline {
          animation: agencyUnderlineDraw 1.5s ease-out 0.8s both;
        }
        @keyframes agencyUnderlineDraw {
          from { width: 0; }
          to { width: 80px; }
        }

        /* Chemin cards hover */
        .agency-chemin-bad:hover {
          box-shadow: 0 20px 50px rgba(12, 20, 32, 0.4), 0 0 40px rgba(231, 76, 60, 0.08) !important;
          transform: translateY(-6px);
          border-color: rgba(231, 76, 60, 0.2) !important;
        }
        .agency-chemin-good:hover {
          box-shadow: 0 20px 50px rgba(12, 20, 32, 0.4), 0 0 40px rgba(212, 160, 74, 0.12) !important;
          transform: translateY(-6px);
        }

        /* ── Counter animations ── */
        .agency-counter-shake {
          animation: agencyCounterShake 0.5s ease 1.6s both;
        }
        @keyframes agencyCounterShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-3px) rotate(-1deg); }
          40% { transform: translateX(3px) rotate(1deg); }
          60% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }

        .agency-counter-glow {
          animation: agencyCounterGlow 0.8s ease 1.6s both;
        }
        @keyframes agencyCounterGlow {
          0% { text-shadow: none; }
          50% { text-shadow: 0 0 20px rgba(212, 160, 74, 0.5), 0 0 40px rgba(212, 160, 74, 0.2); }
          100% { text-shadow: 0 0 8px rgba(212, 160, 74, 0.15); }
        }

        /* ── Split title color flash ── */
        .agency-split-left {
          animation: agencySplitRed 2s ease 0.3s both;
        }
        @keyframes agencySplitRed {
          0%, 100% { color: inherit; }
          25% { color: rgba(231, 76, 60, 0.7); }
          50% { color: inherit; }
        }
        .agency-split-right {
          animation: agencySplitGold 2s ease 0.3s both;
        }
        @keyframes agencySplitGold {
          0%, 100% { color: inherit; }
          25% { color: rgba(212, 160, 74, 0.7); }
          50% { color: inherit; }
        }

        /* ── Section label line draw ── */
        .agency-label-line {
          animation: agencyLineDraw 0.8s ease-out 0.2s both;
          transform-origin: left;
        }
        @keyframes agencyLineDraw {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }

        /* ── Basculement tilt ── */
        .agency-tilt-word {
          display: inline-block;
          animation: agencyTilt 3s ease-in-out infinite;
        }
        @keyframes agencyTilt {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-2deg); }
          75% { transform: rotate(2deg); }
        }

        /* ── Tag bounce ── */
        .agency-tag-bounce {
          animation: agencyTagBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes agencyTagBounce {
          from { transform: scale(0.8) translateY(8px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }

        /* CTA hover glow */
        .agency-cta-btn:hover {
          box-shadow: 0 0 30px rgba(212, 160, 74, 0.2) !important;
          transform: translateY(-1px);
        }

        /* CTA press feedback */
        .agency-cta-btn:active {
          transform: scale(0.97) !important;
          transition: transform 0.1s ease !important;
        }

        /* Focus indicators for accessibility */
        .agency-cta-btn:focus-visible,
        .agency-faq-btn:focus-visible,
        button:focus-visible {
          outline: 2px solid ${C.gold} !important;
          outline-offset: 3px !important;
        }
        input:focus-visible {
          outline: none;
          border-bottom-color: ${C.gold} !important;
        }

        /* Card press feedback */
        .agency-step-card:active,
        .agency-pilier-row:active,
        .agency-testimonial-card:active,
        .agency-promesse-item:active {
          transform: scale(0.98) !important;
          transition: transform 0.1s ease !important;
        }

        /* Smooth number counter animation */
        @keyframes agencyCountUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Performance bar hover */
        .agency-perf-bar:hover {
          filter: brightness(1.15);
          transition: filter 0.2s ease !important;
        }

        /* FAQ button press */
        .agency-faq-btn:active {
          transform: scale(0.99) !important;
          transition: transform 0.1s ease !important;
        }

        /* Scroll progress indicator */
        .agency-scroll-progress {
          position: fixed;
          top: 0;
          left: 0;
          height: 2px;
          background: linear-gradient(90deg, ${C.gold}, ${C.goldDark});
          z-index: 10001;
          transition: width 0.1s linear;
        }

        /* Smooth section transitions */
        .agency-promesse-section,
        .agency-temoignages-section,
        .agency-performance-section,
        .agency-faq-section,
        .agency-process-section {
          position: relative;
        }

        /* Reduce motion for users who prefer it */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        /* ── Tablet (641px–1024px) ── */
        @media (max-width: 1024px) and (min-width: 641px) {
          .agency-hero-section {
            padding: 9rem 2.5rem 5rem !important;
          }
          .agency-hero-title {
            font-size: clamp(2.2rem, 5vw, 3.5rem) !important;
          }
          .agency-section {
            padding: 5rem 2rem !important;
          }
          .agency-chemins-grid {
            gap: 1rem !important;
          }
          .agency-chemin-card {
            padding: clamp(1.2rem, 2.5vw, 2rem) !important;
          }
          .agency-graph-container > div {
            font-size: 0.58rem !important;
            padding: 0.22rem 0.5rem !important;
          }
          .agency-footer-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 2.5rem !important;
          }
          .agency-cta-btn {
            padding: 1rem 2rem !important;
            font-size: 0.75rem !important;
          }
          .agency-temoignages-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .agency-temoignages-section {
            padding: 5rem 2rem !important;
          }
          .agency-performance-section {
            padding: 5rem 2rem !important;
          }
          .agency-perf-tabs {
            gap: 0.5rem !important;
          }
          .agency-steps-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .agency-steps-line {
            display: none !important;
          }
          .agency-process-section {
            padding: 5rem 2rem !important;
          }
          .agency-promesse-grid {
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 2rem !important;
          }
          .agency-promesse-section {
            padding: 5rem 2rem !important;
          }
        }

        /* ── Mobile + small tablet nav (≤900px) ── */
        @media (max-width: 900px) {
          .agency-desktop-nav { display: none !important; }
          .agency-mobile-menu-btn { display: block !important; }
        }
        /* ── Mobile (≤640px) ── */
        @media (max-width: 640px) {

          /* Hero mobile */
          .agency-hero-section {
            padding: 8rem 1.5rem 4rem !important;
            min-height: 90vh !important;
          }
          .agency-hero-title {
            font-size: 2rem !important;
            margin-bottom: 1.5rem !important;
          }
          .agency-hero-subtitle {
            font-size: 0.95rem !important;
            margin-bottom: 2.5rem !important;
          }
          .agency-cta-btn {
            padding: 0.9rem 1.5rem !important;
            font-size: 0.7rem !important;
            letter-spacing: 0.12em !important;
            width: 100%;
            justify-content: center;
          }
          .agency-hero-gold-line {
            margin-bottom: 2rem !important;
          }
          .agency-partner-line {
            margin-top: 3rem !important;
            padding-top: 1.5rem !important;
          }

          /* Sections mobile */
          .agency-section {
            padding: 4rem 1.5rem !important;
          }
          .agency-section-heading {
            font-size: 1.5rem !important;
          }

          /* Promesse items mobile text fix */
          .agency-promesse-item {
            word-break: break-word !important;
            overflow: hidden !important;
            max-width: 100% !important;
            min-width: 0 !important;
            padding: 1rem 1.2rem !important;
            gap: 0.75rem !important;
            box-sizing: border-box !important;
          }
          .agency-promesse-item p {
            min-width: 0 !important;
            overflow-wrap: break-word !important;
          }

          /* CTA final mobile */
          .agency-cta-section {
            padding: 4rem 1.5rem !important;
          }
          .agency-cta-section h2 {
            font-size: 1.5rem !important;
          }

          /* Constat mobile */
          .agency-constat-section {
            padding: 4rem 1.25rem !important;
          }
          .agency-constat-badges {
            flex-direction: column !important;
            align-items: center !important;
          }

          /* Hero stats mobile */
          .agency-hero-stats {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 1rem !important;
          }

          /* Chemins mobile */
          .agency-chemins-section {
            padding: 4rem 1.25rem !important;
          }
          .agency-chemins-grid {
            grid-template-columns: 1fr !important;
            gap: 1.25rem !important;
          }
          .agency-graph-container > div {
            font-size: 0.55rem !important;
            padding: 0.2rem 0.45rem !important;
            transform: translate(-50%, -70%) !important;
          }

          /* Formules mobile */
          .agency-formules-grid {
            grid-template-columns: 1fr !important;
            max-width: 400px !important;
            margin: 0 auto !important;
          }

          /* Témoignages mobile */
          .agency-temoignages-section {
            padding: 4rem 1.25rem !important;
          }
          .agency-temoignages-header {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .agency-temoignages-stats {
            gap: 0.75rem !important;
          }
          .agency-temoignages-stats > div {
            padding: 0.5rem 0.8rem !important;
            min-width: 70px !important;
          }
          .agency-temoignages-grid {
            grid-template-columns: 1fr !important;
            gap: 1rem !important;
          }

          /* Performance mobile */
          .agency-performance-section {
            padding: 4rem 1.25rem !important;
          }
          .agency-perf-tabs {
            gap: 0.4rem !important;
          }
          .agency-perf-tabs button {
            padding: 0.4rem 0.7rem !important;
            font-size: 0.7rem !important;
          }

          /* FAQ mobile */
          .agency-faq-section {
            padding: 4rem 1.25rem !important;
          }

          /* Promesse mobile */
          .agency-promesse-section {
            padding: 4rem 1.25rem !important;
          }
          .agency-promesse-grid {
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 2rem !important;
            overflow: hidden !important;
          }

          /* Process mobile */
          .agency-process-section {
            padding: 4rem 1.25rem !important;
          }
          .agency-steps-grid {
            grid-template-columns: 1fr !important;
            gap: 1rem !important;
          }
          .agency-steps-line {
            display: none !important;
          }

          /* Footer mobile */
          .agency-footer {
            padding: 3rem 1.5rem 2rem !important;
          }
          .agency-footer-grid {
            grid-template-columns: 1fr !important;
            gap: 2rem !important;
          }

          /* Header mobile */
          .agency-header {
            padding-left: 1.25rem !important;
            padding-right: 1.25rem !important;
          }
          .agency-logo-name {
            font-size: 0.8rem !important;
          }
          .agency-logo-sub {
            font-size: 0.45rem !important;
          }
        }
        @media (min-width: 901px) {
          .agency-mobile-menu-btn { display: none !important; }
        }
      `}</style>
    </div>
  );
}
