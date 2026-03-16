import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// ─── Colors (same as AgencyHome) ───
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

// ─── Gold Particles ───
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
    for (let i = 0; i < 35; i++) {
      particles.push({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5, speedY: -(Math.random() * 0.3 + 0.1),
        speedX: (Math.random() - 0.5) * 0.2, opacity: Math.random() * 0.4 + 0.1,
        pulse: Math.random() * Math.PI * 2
      });
    }
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.y += p.speedY; p.x += p.speedX; p.pulse += 0.02;
        const alpha = p.opacity * (0.5 + 0.5 * Math.sin(p.pulse));
        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 160, 74, ${alpha})`; ctx.fill();
      });
      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />;
}

// ─── Section label ───
function SectionLabel({ children, dark }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', marginBottom: '1rem' }}>
      <span style={{ width: '24px', height: '1px', background: C.gold }} className="team-label-line" />
      <span style={{
        fontSize: '0.65rem', fontWeight: 600, color: C.gold,
        letterSpacing: '0.2em', textTransform: 'uppercase'
      }}>{children}</span>
      <span style={{ width: '24px', height: '1px', background: C.gold }} className="team-label-line" />
    </div>
  );
}

// ─── FAQ Item ───
function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef(null);
  return (
    <div style={{
      borderLeft: `2px solid ${open ? C.gold : 'rgba(212, 160, 74, 0.15)'}`,
      transition: 'border-color 0.3s ease',
      marginBottom: '0.5rem'
    }}>
      <button
        className="team-faq-btn"
        onClick={() => { setOpen(!open); haptic('light'); }}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1.4rem 1.5rem', background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: "'Cinzel', serif", fontSize: 'clamp(0.9rem, 1.5vw, 1.05rem)', fontWeight: 500,
          color: 'rgba(255,255,255,0.85)', textAlign: 'left', gap: '1rem',
          transition: 'color 0.3s ease'
        }}
        onMouseEnter={e => e.currentTarget.style.color = C.gold}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.85)'}
      >
        {q}
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
          color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem', lineHeight: 1.8
        }}>
          {a}
        </div>
      </div>
    </div>
  );
}

// ─── Icons ───
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
const CloseIcon = () => (<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>);
const DotIcon = () => (<span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />);

// ─── Haptic ───
function haptic(intensity = 'light') {
  if (!navigator.vibrate) return;
  const patterns = { light: [8], medium: [15], heavy: [25, 30, 25] };
  navigator.vibrate(patterns[intensity] || [8]);
}

// ─── Org chart data (based on real Imperium team) ───
const ORG_CEO = { initials: 'S', name: 'Sacha', role: 'CEO' };

const ORG_DATA = {
  heads: [
    { initials: 'G', name: 'Gilles', role: 'Responsable Chatting' },
    { initials: '?', name: 'On recrute !', role: 'Responsable Marketing', hiring: true },
  ],
  communityManagers: [
    { initials: 'Y', name: 'Yanis', role: 'Community Manager' },
  ],
  chatteurs: [
    { initials: 'AX', name: 'Axel' }, { initials: 'BC', name: 'Big-C' },
    { initials: 'CA', name: 'Carine' }, { initials: 'CH', name: 'Charbel' },
    { initials: 'HE', name: 'Hermine' }, { initials: 'PI', name: 'Pierre' },
    { initials: 'CE', name: 'Célestin' }, { initials: 'MA', name: 'Marie-Ange' },
    { initials: 'JA', name: 'James' }, { initials: 'NA', name: 'Nancia' },
  ],
};

// ─── Org circle component ───
function OrgCircle({ initials, name, role, size = 'md', hiring }) {
  const sizes = { lg: 72, md: 52, sm: 36 };
  const fontSizes = { lg: '1.1rem', md: '0.75rem', sm: '0.6rem' };
  const s = sizes[size];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
      <div style={{
        width: s, height: s, borderRadius: '50%',
        background: hiring ? 'transparent' : `linear-gradient(135deg, rgba(212,160,74,0.15), rgba(212,160,74,0.08))`,
        border: hiring ? `2px dashed rgba(212,160,74,0.4)` : `1.5px solid rgba(212,160,74,0.3)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: fontSizes[size], fontWeight: 600, color: C.gold,
        letterSpacing: '0.05em'
      }}>
        {initials}
      </div>
      <span style={{ fontSize: size === 'sm' ? '0.6rem' : '0.75rem', fontWeight: 500, color: C.text }}>{name}</span>
      {role && <span style={{ fontSize: '0.6rem', color: C.gold, fontWeight: 500 }}>{role}</span>}
    </div>
  );
}

// ─── Org tree (single team, no branches) ───
function OrgTree({ data }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
      {/* Team badge */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          border: `1.5px solid rgba(212,160,74,0.3)`, borderRadius: '20px',
          padding: '0.35rem 0.9rem', fontSize: '0.7rem', fontWeight: 600, color: C.text
        }}>
          <span style={{ fontWeight: 700, color: C.gold }}>FR</span> FRANCE
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          border: `1.5px solid rgba(212,160,74,0.3)`, borderRadius: '20px',
          padding: '0.35rem 0.9rem', fontSize: '0.7rem', fontWeight: 600, color: C.text
        }}>
          <span style={{ fontWeight: 700, color: C.gold }}>{data.heads.length + (data.communityManagers?.length || 0) + data.chatteurs.length + 1}</span> MEMBRES
        </span>
      </div>

      <div style={{ width: 1, height: 20, background: `rgba(212,160,74,0.2)` }} />

      {/* Heads */}
      <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        {data.heads.map(h => (
          <div key={h.name} style={{
            background: C.white, border: `1px solid ${C.border}`,
            borderRadius: '12px', padding: '1rem 1.25rem',
          }}>
            <OrgCircle {...h} size="lg" />
          </div>
        ))}
      </div>

      <div style={{ width: 1, height: 20, background: `rgba(212,160,74,0.2)` }} />

      {/* Community Managers */}
      {data.communityManagers && data.communityManagers.length > 0 && (<>
        <span style={{ fontSize: '0.6rem', fontWeight: 600, color: C.gold, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Community Manager</span>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {data.communityManagers.map(cm => (
            <div key={cm.name} style={{
              background: C.white, border: `1px solid ${C.border}`,
              borderRadius: '12px', padding: '0.75rem 1rem',
            }}>
              <OrgCircle {...cm} size="md" />
            </div>
          ))}
        </div>
        <div style={{ width: 1, height: 20, background: `rgba(212,160,74,0.2)` }} />
      </>)}

      {/* Chatteurs */}
      <span style={{ fontSize: '0.6rem', fontWeight: 600, color: C.gold, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Chatteurs</span>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', maxWidth: '450px' }}>
        {data.chatteurs.map((ch, i) => (
          <OrgCircle key={`${ch.name}-${i}`} {...ch} size="sm" />
        ))}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════
export default function TeamPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [formStatus, setFormStatus] = useState(null); // null | 'sending' | 'sent' | 'error'

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
    ['equipe', '\u00c9quipe'],
    ['imperium', 'Imperium', '/imperium'],
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    haptic('heavy');
    const fd = new FormData(e.target);
    const poste = fd.get('poste');
    const ig = fd.get('instagram');
    const wa = fd.get('whatsapp');
    window.location.href = `mailto:contact@impera-agency.com?subject=Candidature - ${poste}&body=Poste: ${poste}%0AInstagram: ${ig}%0AWhatsApp: ${wa}`;
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: C.text, background: C.navyDeep, overflowX: 'hidden' }}>

      {/* Scroll progress bar */}
      <div className="team-scroll-progress" style={{ width: `${scrollProgress}%` }} aria-hidden="true" />

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
      }} className="team-header">
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '0.15rem', textDecoration: 'none' }}>
          <span className="team-logo-name" style={{
            fontFamily: "'Inter', sans-serif", fontSize: '0.95rem', fontWeight: 600,
            color: scrolled ? C.navy : 'rgba(255,255,255,0.9)',
            letterSpacing: '0.22em', textTransform: 'uppercase', transition: 'color 0.3s'
          }}>IMPERA</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '16px', height: '1px', background: C.gold }} />
            <span className="team-logo-sub" style={{
              fontFamily: "'Inter', sans-serif", fontSize: '0.55rem', fontWeight: 500,
              color: C.gold, letterSpacing: '0.25em', textTransform: 'uppercase'
            }}>AGENCY</span>
            <span style={{ width: '16px', height: '1px', background: C.gold }} />
          </div>
        </Link>

        {/* Desktop nav + CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', animation: 'teamNavIn 0.6s ease 0.3s both' }} className="team-desktop-nav">
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
          <Link to="/login" style={{
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
        <button className="team-mobile-menu-btn" onClick={() => { setMobileMenuOpen(!mobileMenuOpen); haptic('medium'); }}
          aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={mobileMenuOpen}
          style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', transition: 'all 0.3s', zIndex: 1002 }}
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
            animation: 'teamMenuSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>

            {/* Mobile logo */}
            <div style={{ marginBottom: '3rem', textAlign: 'center', animation: 'teamMenuItemIn 0.5s ease 0.1s both' }}>
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

            {/* Accueil link in mobile */}
            <Link to="/" onClick={() => setMobileMenuOpen(false)} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', textDecoration: 'none',
              fontFamily: "'Cinzel', serif", fontSize: '1.5rem', fontWeight: 500,
              cursor: 'pointer', letterSpacing: '0.1em',
              padding: '0.75rem 2rem', transition: 'all 0.3s ease', display: 'block',
              animation: 'teamMenuItemIn 0.5s ease 0.15s both'
            }}
              onMouseEnter={e => { e.currentTarget.style.color = C.gold; e.currentTarget.style.letterSpacing = '0.15em'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; e.currentTarget.style.letterSpacing = '0.1em'; }}
            >Accueil</Link>

            {NAV_ITEMS.map(([id, label, href], i) => {
              const mobileStyle = {
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', textDecoration: 'none',
                fontFamily: "'Cinzel', serif", fontSize: '1.5rem', fontWeight: 500,
                cursor: 'pointer', letterSpacing: '0.1em',
                padding: '0.75rem 2rem', transition: 'all 0.3s ease', display: 'block',
                animation: `teamMenuItemIn 0.5s ease ${0.23 + i * 0.08}s both`
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
              animation: `teamMenuItemIn 0.5s ease ${0.15 + NAV_ITEMS.length * 0.08}s both`
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
              animation: `teamMenuItemIn 0.5s ease ${0.23 + NAV_ITEMS.length * 0.08}s both`
            }}>
              Connexion
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5-5-5-5" />
              </svg>
            </Link>
          </div>
        )}
      </header>

      {/* ═══ HERO ═══ */}
      <section className="team-hero-section" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '10rem 3rem 5rem', textAlign: 'center',
        background: `linear-gradient(170deg, ${C.navy} 0%, ${C.navyDark} 60%, ${C.navyDeep} 100%)`,
        position: 'relative', overflow: 'hidden'
      }}>
        <GoldParticles />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px' }}>
          <div style={{ animation: 'teamFadeIn 1s ease 0.1s both' }}>
            <SectionLabel dark>Équipe & Recrutement</SectionLabel>
          </div>
          <h1 className="team-hero-title" style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 'clamp(2.2rem, 6vw, 4rem)',
            fontWeight: 400, color: 'rgba(255,255,255,0.9)',
            lineHeight: 1.2, margin: '1.5rem 0 2rem',
            animation: 'teamFadeInUp 0.8s ease 0.2s both'
          }}>
            Équipe agence OnlyFans 2026 :<br />
            <span className="team-shimmer-text" style={{ color: C.gold, fontStyle: 'italic', fontWeight: 600 }}>
              rejoins l'élite.
            </span>
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.45)', fontSize: 'clamp(0.95rem, 1.4vw, 1.1rem)',
            lineHeight: 1.8, margin: '0 auto 3rem', maxWidth: '600px',
            animation: 'teamFadeInUp 0.8s ease 0.35s both'
          }}>
            Nous ne recrutons que les profils capables de créer un impact réel sur la croissance de nos créatrices.
          </p>
          <div style={{ animation: 'teamFadeInUp 0.8s ease 0.5s both' }}>
            <button onClick={() => scrollTo('candidature')} className="team-cta-btn" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.75rem',
              background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDark} 100%)`,
              color: C.navyDeep, padding: '1.1rem 2.8rem', borderRadius: '0', border: 'none',
              fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '0.8rem',
              letterSpacing: '0.18em', textTransform: 'uppercase',
              cursor: 'pointer', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 20px rgba(196, 136, 77, 0.25)',
              position: 'relative', overflow: 'hidden'
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(196, 136, 77, 0.35)'; haptic('light'); }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(196, 136, 77, 0.25)'; }}
            >
              Postuler maintenant
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      </section>

      {/* ═══ NOTRE EXPERTISE ═══ */}
      <section id="expertise" style={{ padding: '7rem 3rem', background: C.marble }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <SectionLabel>Notre expertise</SectionLabel>
              <h2 style={{
                fontFamily: "'Cinzel', serif", fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
                fontWeight: 400, color: C.navy, margin: 0, lineHeight: 1.3
              }}>Ce que nous faisons</h2>
            </div>
          </Reveal>

          <div className="team-expertise-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
            {[
              { emoji: '📈', title: 'Acquisition & Funnels', desc: "Générer du trafic qualifié depuis Instagram, TikTok et d'autres canaux." },
              { emoji: '💬', title: 'Chat & Conversion', desc: "Transformer chaque interaction en revenus concrets, avec des scripts et séquences optimisés." },
              { emoji: '🎨', title: 'Branding & Contenu', desc: "Conception de contenus performants, copies, storytelling et assets premium." },
              { emoji: '📊', title: 'Analyse & Optimisation', desc: "Tests A/B, suivi des KPIs et itérations constantes pour scaler les résultats." },
            ].map(({ emoji, title, desc }, i) => (
              <Reveal key={title} delay={i * 0.1}>
                <div className="team-card-hover" style={{
                  background: C.white, border: `1px solid ${C.border}`,
                  borderRadius: '12px', padding: '2rem 1.5rem',
                  transition: 'all 0.3s ease', height: '100%'
                }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>{emoji}</div>
                  <h3 style={{
                    fontFamily: "'Cinzel', serif", fontSize: '1rem', fontWeight: 600,
                    color: C.navy, margin: '0 0 0.75rem'
                  }}>{title}</h3>
                  <p style={{ color: C.textMuted, fontSize: '0.85rem', lineHeight: 1.7, margin: 0 }}>{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ NOS EXIGENCES ═══ */}
      <section style={{
        padding: '7rem 3rem',
        background: `linear-gradient(170deg, ${C.navyDark}, ${C.navyDeep})`
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <SectionLabel dark>Nos exigences</SectionLabel>
              <h2 style={{
                fontFamily: "'Cinzel', serif", fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
                fontWeight: 400, color: 'rgba(255,255,255,0.9)', margin: 0, lineHeight: 1.3
              }}>Profil recherché</h2>
            </div>
          </Reveal>

          <div className="team-exigences-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
            {[
              { emoji: '🎯', title: 'Compétence et précision', desc: "Chaque tâche compte, chaque action influence la performance." },
              { emoji: '⚡', title: 'Polyvalence', desc: "Maîtrise d'au moins un domaine clé (chat, contenu, growth, acquisition, social media)." },
              { emoji: '📊', title: 'Orientation résultats', desc: "On ne juge pas l'effort, seulement l'impact." },
              { emoji: '🏆', title: 'Discipline et responsabilité', desc: "Équipe fixe, dédiée, performance attendue." },
            ].map(({ emoji, title, desc }, i) => (
              <Reveal key={title} delay={i * 0.1}>
                <div style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '12px', padding: '2rem 1.5rem',
                  transition: 'all 0.3s ease', height: '100%'
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212,160,74,0.2)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                >
                  <div style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>{emoji}</div>
                  <h3 style={{
                    fontFamily: "'Inter', sans-serif", fontSize: '1rem', fontWeight: 600,
                    color: 'rgba(255,255,255,0.9)', margin: '0 0 0.75rem'
                  }}>{title}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', lineHeight: 1.7, margin: 0 }}>{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ORGANIGRAMME ═══ */}
      <section id="equipe" style={{ padding: '7rem 3rem', background: C.marble }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ marginBottom: '4rem' }}>
              <SectionLabel>L'équipe</SectionLabel>
              <h2 style={{
                fontFamily: "'Cinzel', serif", fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
                fontWeight: 400, color: C.navy, margin: 0, lineHeight: 1.3
              }}>Notre organigramme</h2>
            </div>
          </Reveal>

          {/* CEO */}
          <Reveal>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
              <div style={{
                background: C.white, border: `1.5px solid rgba(212,160,74,0.3)`,
                borderRadius: '16px', padding: '1.5rem 2rem',
                display: 'flex', flexDirection: 'column', alignItems: 'center'
              }}>
                <OrgCircle {...ORG_CEO} size="lg" />
              </div>
              <div style={{ width: 1, height: 40, background: `rgba(212,160,74,0.2)` }} />
            </div>
          </Reveal>

          {/* Team tree */}
          <Reveal delay={0.2}>
            <OrgTree data={ORG_DATA} />
          </Reveal>
        </div>
      </section>

      {/* ═══ POSTES OUVERTS ═══ */}
      <section id="postes" style={{ padding: '7rem 3rem', background: C.white }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ marginBottom: '4rem' }}>
              <SectionLabel>Postes ouverts</SectionLabel>
              <h2 style={{
                fontFamily: "'Cinzel', serif", fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
                fontWeight: 400, color: C.navy, margin: 0, lineHeight: 1.3
              }}>Nous recrutons</h2>
            </div>
          </Reveal>

          <div className="team-postes-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
            {[
              {
                icon: '💬', title: 'Chatter / Opérateur',
                desc: 'Gestion des conversations et monétisation des abonnés',
                points: ["Excellente maîtrise du français écrit", "Disponibilité flexible (shifts variés)", "Expérience en vente ou relation client appréciée", "Discrétion absolue"]
              },
              {
                icon: '🏢', title: 'Account Manager',
                desc: 'Supervision et coordination des comptes créatrices',
                points: ["Expérience en gestion de projet ou management", "Capacité d'analyse et reporting", "Leadership et communication", "Connaissance du secteur appréciée"]
              },
              {
                icon: '📱', title: 'Social Media Manager',
                desc: "Gestion des réseaux sociaux et stratégie d'acquisition",
                points: ["Maîtrise des plateformes (TikTok, Instagram, Twitter)", "Créativité et sens du viral", "Connaissance des tendances actuelles", "Portfolio apprécié"]
              },
            ].map(({ icon, title, desc, points }, i) => (
              <Reveal key={title} delay={i * 0.1}>
                <div className="team-card-hover" style={{
                  background: C.white, border: `1px solid ${C.border}`,
                  borderRadius: '12px', padding: '2rem 1.75rem',
                  transition: 'all 0.3s ease', height: '100%'
                }}>
                  {/* Icon circle */}
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: `linear-gradient(135deg, rgba(212,160,74,0.15), rgba(212,160,74,0.08))`,
                    border: '1.5px solid rgba(212,160,74,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.3rem', marginBottom: '1.25rem'
                  }}>{icon}</div>

                  <h3 style={{
                    fontFamily: "'Cinzel', serif", fontSize: '1.05rem', fontWeight: 600,
                    color: C.navy, margin: '0 0 0.5rem'
                  }}>{title}</h3>
                  <p style={{ color: C.textMuted, fontSize: '0.85rem', lineHeight: 1.6, margin: '0 0 1.25rem' }}>{desc}</p>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {points.map(p => (
                      <li key={p} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                        marginBottom: '0.5rem', fontSize: '0.82rem', color: C.textMuted, lineHeight: 1.5
                      }}>
                        <span style={{ color: C.gold, fontSize: '0.5rem', marginTop: '0.4rem', flexShrink: 0 }}>●</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ AVANTAGES ═══ */}
      <section style={{
        padding: '7rem 3rem',
        background: `linear-gradient(170deg, ${C.navyDark}, ${C.navyDeep})`
      }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <SectionLabel dark>Avantages</SectionLabel>
              <h2 style={{
                fontFamily: "'Cinzel', serif", fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
                fontWeight: 400, color: 'rgba(255,255,255,0.9)', margin: 0, lineHeight: 1.3
              }}>Pourquoi nous rejoindre</h2>
            </div>
          </Reveal>

          <div className="team-avantages-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
            {[
              { emoji: '🏆', title: 'Les meilleures créatrices', desc: "Travailler avec les meilleures créatrices OnlyFans et MYM." },
              { emoji: '🔐', title: 'Méthodes exclusives', desc: "Systèmes testés et optimisés pour la conversion." },
              { emoji: '▶️', title: 'Environnement pro', desc: "Structure professionnelle où chaque action est mesurable." },
              { emoji: '👥', title: 'Équipe premium', desc: "Équipe stable, dédiée et performante." },
              { emoji: '🎓', title: 'Formation continue', desc: "Exposure aux meilleures pratiques de l'industrie." },
              { emoji: '💰', title: 'Performance récompensée', desc: "Bonus indexés sur les résultats générés." },
            ].map(({ emoji, title, desc }, i) => (
              <Reveal key={title} delay={i * 0.08}>
                <div style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '12px', padding: '1.75rem 1.5rem',
                  transition: 'all 0.3s ease'
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212,160,74,0.2)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>{emoji}</div>
                  <h3 style={{
                    fontFamily: "'Inter', sans-serif", fontSize: '0.95rem', fontWeight: 600,
                    color: 'rgba(255,255,255,0.9)', margin: '0 0 0.5rem'
                  }}>{title}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', lineHeight: 1.6, margin: 0 }}>{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CANDIDATURE ═══ */}
      <section id="candidature" style={{ padding: '7rem 3rem', background: C.marble }}>
        <Reveal>
          <div style={{ maxWidth: '550px', margin: '0 auto', textAlign: 'center' }}>
            <SectionLabel>Candidature</SectionLabel>
            <h2 style={{
              fontFamily: "'Cinzel', serif", fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
              fontWeight: 400, color: C.navy, margin: '0 0 0.75rem', lineHeight: 1.3
            }}>Postuler</h2>
            <p style={{ color: C.textMuted, fontSize: '0.9rem', lineHeight: 1.7, margin: '0 0 2.5rem' }}>
              Chaque candidature est étudiée individuellement.
            </p>

            {/* Form card */}
            <div style={{
              background: C.white, border: `1px solid ${C.border}`,
              borderRadius: '16px', padding: '2.5rem 2rem', textAlign: 'left'
            }}>
              <form onSubmit={handleSubmit}>
                {/* Poste */}
                <div style={{ marginBottom: '2rem' }}>
                  <label style={{
                    display: 'block', fontSize: '0.65rem', fontWeight: 600,
                    color: C.textMuted, letterSpacing: '0.15em',
                    textTransform: 'uppercase', marginBottom: '0.6rem'
                  }}>Poste souhaité <span style={{ color: C.gold }}>*</span></label>
                  <select name="poste" required style={{
                    width: '100%', background: C.white,
                    border: `1px solid ${C.border}`, borderRadius: '6px',
                    padding: '0.75rem 1rem', color: C.text,
                    fontSize: '0.9rem', fontFamily: "'Inter', sans-serif",
                    outline: 'none', cursor: 'pointer',
                    appearance: 'auto'
                  }}>
                    <option value="">Sélectionnez un poste</option>
                    <option value="Chatter / Opérateur">Chatter / Opérateur</option>
                    <option value="Account Manager">Account Manager</option>
                    <option value="Social Media Manager">Social Media Manager</option>
                  </select>
                </div>

                {/* Instagram */}
                <div style={{ marginBottom: '2rem' }}>
                  <label style={{
                    display: 'block', fontSize: '0.65rem', fontWeight: 600,
                    color: C.textMuted, letterSpacing: '0.15em',
                    textTransform: 'uppercase', marginBottom: '0.6rem'
                  }}>Instagram <span style={{ color: C.gold }}>*</span></label>
                  <input name="instagram" type="text" required placeholder="@votre_compte" style={{
                    width: '100%', background: 'transparent',
                    border: 'none', borderBottom: `1px solid ${C.border}`,
                    padding: '0.8rem 0', color: C.text,
                    fontSize: '0.9rem', fontFamily: "'Inter', sans-serif",
                    outline: 'none', transition: 'border-color 0.3s'
                  }}
                    onFocus={e => e.target.style.borderBottomColor = C.gold}
                    onBlur={e => e.target.style.borderBottomColor = C.border}
                  />
                </div>

                {/* WhatsApp */}
                <div style={{ marginBottom: '2.5rem' }}>
                  <label style={{
                    display: 'block', fontSize: '0.65rem', fontWeight: 600,
                    color: C.textMuted, letterSpacing: '0.15em',
                    textTransform: 'uppercase', marginBottom: '0.6rem'
                  }}>WhatsApp <span style={{ color: C.gold }}>*</span></label>
                  <input name="whatsapp" type="tel" required placeholder="+33 6 00 00 00 00" style={{
                    width: '100%', background: 'transparent',
                    border: 'none', borderBottom: `1px solid ${C.border}`,
                    padding: '0.8rem 0', color: C.text,
                    fontSize: '0.9rem', fontFamily: "'Inter', sans-serif",
                    outline: 'none', transition: 'border-color 0.3s'
                  }}
                    onFocus={e => e.target.style.borderBottomColor = C.gold}
                    onBlur={e => e.target.style.borderBottomColor = C.border}
                  />
                </div>

                {/* Submit */}
                <button type="submit" className="team-cta-btn" style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                  background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDark} 100%)`,
                  color: C.navyDeep, padding: '1.1rem 2rem',
                  borderRadius: '0', border: 'none',
                  fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '0.8rem',
                  letterSpacing: '0.18em', textTransform: 'uppercase',
                  cursor: 'pointer', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 4px 20px rgba(196, 136, 77, 0.25)',
                  position: 'relative', overflow: 'hidden'
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(196, 136, 77, 0.35)'; haptic('light'); }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(196, 136, 77, 0.25)'; }}
                >
                  Envoyer ma candidature
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                </button>
              </form>

              <p style={{
                color: C.textLight, fontSize: '0.78rem',
                marginTop: '1.5rem', textAlign: 'center', fontStyle: 'italic'
              }}>
                Toutes les candidatures sont traitées de manière confidentielle.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" style={{
        padding: '7rem 3rem',
        background: `linear-gradient(170deg, ${C.navyDark}, ${C.navyDeep})`
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
              <SectionLabel dark>Questions fréquentes</SectionLabel>
              <h2 style={{
                fontFamily: "'Cinzel', serif", fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
                fontWeight: 400, color: 'rgba(255,255,255,0.9)', margin: 0, lineHeight: 1.3
              }}>FAQ Candidats</h2>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div>
              {[
                { q: "Quel est le processus de recrutement ?", a: "Après réception de votre candidature, nous étudions votre profil sous 48h. Si votre profil correspond, vous êtes invité à un entretien en visio suivi d'une période d'essai de 2 semaines pour évaluer la compatibilité mutuelle." },
                { q: "Faut-il de l'expérience pour postuler ?", a: "Pas nécessairement. Nous valorisons la motivation, la rigueur et la capacité d'apprentissage. Une expérience en vente, relation client ou réseaux sociaux est un plus, mais nous formons nos recrues aux méthodes spécifiques de l'industrie." },
                { q: "Comment fonctionne le modèle ?", a: "Vous êtes rémunéré sur la base de vos performances. Chaque rôle a ses propres KPIs et son système de commission. Plus vous performez, plus vous gagnez. Transparence totale sur les métriques." },
                { q: "Quels sont les horaires de travail ?", a: "Les chatteurs travaillent en shifts de 6h (08h-14h, 14h-20h, 20h-02h, 02h-08h). Les managers et SMMs ont des horaires plus flexibles adaptés à leur périmètre. Le planning est défini à l'avance chaque semaine." },
                { q: "Le travail est-il vraiment 100% remote ?", a: "Oui, 100% à distance. Vous travaillez depuis chez vous avec votre propre ordinateur. Nous utilisons des outils collaboratifs pour la communication et le suivi des performances en temps réel." },
                { q: "Quels outils sont utilisés ?", a: "Telegram pour la communication interne, des dashboards personnalisés pour le suivi des performances, et les plateformes elles-mêmes (OnlyFans, MYM, Reveal). Formation complète fournie à l'onboarding." },
                { q: "Est-ce légal ?", a: "Absolument. L'agence opère dans un cadre légal strict. Le chatting consiste à gérer des conversations professionnelles avec les abonnés des créatrices, dans le respect des conditions d'utilisation des plateformes." },
                { q: "Comment évoluer dans l'équipe ?", a: "Les meilleurs chatteurs peuvent évoluer vers des postes d'Account Manager, puis de Manager d'équipe. L'évolution est basée uniquement sur les performances et le mérite. Plusieurs de nos managers actuels ont commencé comme chatteurs." },
              ].map(({ q, a }) => (
                <FAQItem key={q} q={q} a={a} />
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.3}>
            <p style={{ textAlign: 'center', marginTop: '2rem' }}>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem' }}>Une autre question ? </span>
              <a href="mailto:contact@impera-agency.com" style={{
                color: C.gold, textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600,
                borderBottom: '1px solid rgba(212,160,74,0.3)', paddingBottom: '2px',
                transition: 'border-color 0.3s'
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.gold}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(212,160,74,0.3)'}
              >Contactez-nous</a>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="team-footer" style={{
        background: C.navyDeep, padding: '5rem 3rem 2.5rem', position: 'relative'
      }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '60px', height: '1px', background: C.gold }} />

        <div className="team-footer-grid" style={{
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
            {[['expertise', 'Expertise'], ['equipe', 'Équipe'], ['postes', 'Postes ouverts'], ['candidature', 'Postuler'], ['faq', 'FAQ']].map(([id, label]) => (
              <button key={id} onClick={() => scrollTo(id)} style={{
                display: 'block', background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem',
                cursor: 'pointer', padding: '0.35rem 0', transition: 'color 0.3s',
                fontFamily: "'Inter', sans-serif", letterSpacing: '0.02em'
              }}
                onMouseEnter={e => e.target.style.color = C.gold}
                onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.3)'}
              >{label}</button>
            ))}
          </div>

          <div>
            <h4 style={{ fontSize: '0.65rem', fontWeight: 600, color: C.gold, letterSpacing: '0.2em', margin: '0 0 1.5rem', textTransform: 'uppercase' }}>Nous contacter</h4>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <a href="mailto:contact@impera-agency.com" title="Email" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(212, 160, 74, 0.2)', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', transition: 'all 0.3s ease' }} onMouseEnter={e => { e.currentTarget.style.color = C.gold; e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.background = 'rgba(212, 160, 74, 0.08)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = 'rgba(212, 160, 74, 0.2)'; e.currentTarget.style.background = 'transparent'; }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></a>
              <a href="https://instagram.com/impera_agency" target="_blank" rel="noopener noreferrer" title="Instagram" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(212, 160, 74, 0.2)', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', transition: 'all 0.3s ease' }} onMouseEnter={e => { e.currentTarget.style.color = C.gold; e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.background = 'rgba(212, 160, 74, 0.08)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = 'rgba(212, 160, 74, 0.2)'; e.currentTarget.style.background = 'transparent'; }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg></a>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '0.65rem', fontWeight: 600, color: C.gold, letterSpacing: '0.2em', margin: '0 0 1.5rem', textTransform: 'uppercase' }}>Liens</h4>
            <Link to="/" style={{
              display: 'block', color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem',
              textDecoration: 'none', padding: '0.35rem 0', transition: 'color 0.3s'
            }}
              onMouseEnter={e => e.target.style.color = C.gold}
              onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.3)'}
            >Site principal</Link>
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
        @keyframes teamFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes teamFadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes teamMenuSlideIn {
          from { opacity: 0; clip-path: circle(0% at top right); }
          to { opacity: 1; clip-path: circle(150% at top right); }
        }
        @keyframes teamMenuItemIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes teamNavIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .team-shimmer-text {
          position: relative;
          background: linear-gradient(120deg, ${C.gold} 0%, ${C.gold} 40%, #f0d48a 50%, ${C.gold} 60%, ${C.gold} 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: teamShimmer 4s ease-in-out infinite;
        }
        @keyframes teamShimmer {
          0%, 100% { background-position: 100% center; }
          50% { background-position: 0% center; }
        }

        .team-cta-btn::before {
          content: '';
          position: absolute; top: 0; left: -100%;
          width: 60%; height: 100%;
          background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%);
          animation: teamCtaShine 4s ease-in-out infinite;
        }
        @keyframes teamCtaShine {
          0%, 70%, 100% { left: -100%; }
          85% { left: 150%; }
        }
        .team-cta-btn:hover {
          box-shadow: 0 0 30px rgba(212, 160, 74, 0.2) !important;
          transform: translateY(-1px);
        }
        .team-cta-btn:active {
          transform: scale(0.97) !important;
          transition: transform 0.1s ease !important;
        }

        .team-label-line {
          animation: teamLineDraw 0.8s ease-out 0.2s both;
          transform-origin: left;
        }
        @keyframes teamLineDraw {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }

        .team-scroll-progress {
          position: fixed; top: 0; left: 0; height: 2px;
          background: linear-gradient(90deg, ${C.gold}, ${C.goldDark});
          z-index: 10001; transition: width 0.1s linear;
        }

        .team-card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(27, 46, 75, 0.1) !important;
          border-color: rgba(212,160,74,0.25) !important;
        }

        .team-faq-btn:active {
          transform: scale(0.99) !important;
          transition: transform 0.1s ease !important;
        }

        button:focus-visible,
        .team-cta-btn:focus-visible,
        .team-faq-btn:focus-visible {
          outline: 2px solid ${C.gold} !important;
          outline-offset: 3px !important;
        }
        input:focus-visible, select:focus-visible {
          outline: none;
          border-bottom-color: ${C.gold} !important;
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        /* ── Nav responsiveness ── */
        @media (max-width: 900px) {
          .team-desktop-nav { display: none !important; }
          .team-mobile-menu-btn { display: block !important; }
        }
        @media (min-width: 901px) {
          .team-mobile-menu-btn { display: none !important; }
        }

        /* ── Tablet ── */
        @media (max-width: 1024px) and (min-width: 641px) {
          .team-hero-section { padding: 9rem 2.5rem 5rem !important; }
          .team-expertise-grid, .team-exigences-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .team-postes-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .team-avantages-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .team-footer-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 2.5rem !important; }
        }

        /* ── Mobile ── */
        @media (max-width: 640px) {
          .team-hero-section {
            padding: 8rem 1.5rem 4rem !important;
            min-height: 90vh !important;
          }
          .team-hero-title {
            font-size: 1.8rem !important;
            margin-bottom: 1.5rem !important;
          }
          .team-expertise-grid,
          .team-exigences-grid,
          .team-postes-grid,
          .team-avantages-grid {
            grid-template-columns: 1fr !important;
          }
          .team-org-branches {
            grid-template-columns: 1fr !important;
            gap: 4rem !important;
          }
          .team-header {
            padding-left: 1.25rem !important;
            padding-right: 1.25rem !important;
          }
          .team-logo-name { font-size: 0.8rem !important; }
          .team-logo-sub { font-size: 0.45rem !important; }
          .team-footer {
            padding: 3rem 1.5rem 2rem !important;
          }
          .team-footer-grid {
            grid-template-columns: 1fr !important;
            gap: 2rem !important;
          }
        }
      `}</style>
    </div>
  );
}
