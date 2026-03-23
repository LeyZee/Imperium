import { useState, useEffect, useRef } from 'react';
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
      <span style={{ width: '24px', height: '1px', background: C.gold }} />
      <span style={{
        fontSize: '0.65rem', fontWeight: 600, color: C.gold,
        letterSpacing: '0.2em', textTransform: 'uppercase'
      }}>{children}</span>
      <span style={{ width: '24px', height: '1px', background: C.gold }} />
    </div>
  );
}

// ─── Animated hamburger ───
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

// ─── Haptic ───
function haptic(intensity = 'light') {
  if (!navigator.vibrate) return;
  const patterns = { light: [8], medium: [15], heavy: [25, 30, 25] };
  navigator.vibrate(patterns[intensity] || patterns.light);
}

// ─── Arrow icon ───
const ArrowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
);

// ─── FAQ Data ───
const FAQ_ITEMS = [
  { q: 'Quels sont vos critères de sélection ?', a: 'Nous recherchons des créatrices motivées, avec une présence active sur les réseaux sociaux. L\'engagement et la régularité comptent plus que le nombre d\'abonnés.' },
  { q: 'Combien de temps dure le processus de sélection ?', a: 'Le processus prend en général 24 à 48h. Nous étudions chaque candidature individuellement et vous recontactons rapidement via WhatsApp.' },
  { q: 'Quels services proposez-vous exactement ?', a: 'Nous gérons le chatting, la stratégie de contenu, l\'optimisation des revenus et toute la partie opérationnelle de votre compte OnlyFans et Reveal.' },
  { q: 'Comment fonctionne le modèle économique ?', a: 'Nous travaillons sur un modèle de commission. Vous conservez la majorité de vos revenus, et notre commission couvre l\'ensemble des services fournis.' },
  { q: 'Dois-je être déjà présente sur OnlyFans ?', a: 'Pas nécessairement. Nous accompagnons aussi les créatrices qui souhaitent se lancer. Nous vous aidons à créer et optimiser votre compte dès le départ.' },
  { q: 'Combien de temps dois-je consacrer à mon activité ?', a: 'Cela dépend de vos objectifs. Nous prenons en charge la majorité du travail opérationnel pour que vous puissiez vous concentrer sur la création de contenu.' },
  { q: 'Mes données sont-elles protégées ?', a: 'Absolument. Toutes vos données sont chiffrées et stockées de manière sécurisée. Nous respectons strictement la confidentialité de chaque créatrice.' },
  { q: 'Puis-je arrêter la collaboration à tout moment ?', a: 'Oui, vous êtes libre de mettre fin à la collaboration quand vous le souhaitez. Nous ne pratiquons aucun engagement longue durée.' },
];

// ─── PROCESSUS Data ───
const PROCESS_STEPS = [
  { num: '01', title: 'Candidature', desc: 'Remplissez le formulaire avec vos informations Instagram et WhatsApp.' },
  { num: '02', title: 'Analyse', desc: 'Nous étudions votre profil pour vérifier l\'adéquation avec notre approche.' },
  { num: '03', title: 'Contact', desc: 'Si votre profil correspond, nous vous recontactons sous 48h via WhatsApp.' },
];

// ─── FAQ Accordion Item ───
function FaqItem({ item, isOpen, onToggle }) {
  const contentRef = useRef(null);
  return (
    <div style={{
      borderLeft: `2px solid ${isOpen ? C.gold : 'rgba(212, 160, 74, 0.2)'}`,
      transition: 'border-color 0.3s ease',
      marginBottom: '0.5rem'
    }}>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '1.4rem 1.5rem',
        fontFamily: "'Cinzel', serif", fontSize: 'clamp(0.9rem, 1.5vw, 1.05rem)',
        fontWeight: 500, color: C.navy, textAlign: 'left',
        transition: 'all 0.3s ease'
      }}
        onMouseEnter={e => e.currentTarget.style.color = C.gold}
        onMouseLeave={e => e.currentTarget.style.color = C.navy}
      >
        {item.q}
        <span style={{
          color: C.gold, fontSize: '1.3rem', fontWeight: 300,
          transition: 'transform 0.3s ease',
          transform: isOpen ? 'rotate(45deg)' : 'none',
          flexShrink: 0, marginLeft: '1rem'
        }}>+</span>
      </button>
      <div style={{
        maxHeight: isOpen ? `${contentRef.current?.scrollHeight || 200}px` : '0',
        overflow: 'hidden',
        transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <div ref={contentRef} style={{
          padding: '0 1.5rem 1.4rem',
          color: C.textMuted, fontSize: '0.9rem', lineHeight: 1.8
        }}>
          {item.a}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// CONTACT PAGE
// ═══════════════════════════════════════════════
export default function ContactPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [openFaq, setOpenFaq] = useState(null);
  const [formState, setFormState] = useState('idle'); // idle | sending | sent | error

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 50);
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(h > 0 ? (window.scrollY / h) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const NAV_ITEMS = [
    ['equipe', 'Équipe', '/equipe'],
    ['imperium', 'Imperium', '/imperium'],
  ];

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: C.text, background: C.navyDeep, overflowX: 'hidden' }}>

      {/* Scroll progress bar */}
      <div className="ct-scroll-progress" style={{ width: `${scrollProgress}%` }} aria-hidden="true" />

      {/* ═══ HEADER ═══ */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        padding: '0 3rem',
        background: scrolled ? 'rgba(245, 243, 239, 0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px) saturate(1.2)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(1.2)' : 'none',
        boxShadow: scrolled ? '0 1px 0 rgba(27, 46, 75, 0.08), 0 4px 20px rgba(27, 46, 75, 0.04)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(212, 160, 74, 0.1)' : '1px solid transparent',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: scrolled ? '64px' : '80px'
      }} className="ct-header">
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '0.15rem', textDecoration: 'none' }}>
          <span className="ct-logo-name" style={{
            fontFamily: "'Inter', sans-serif", fontSize: '0.95rem', fontWeight: 600,
            color: scrolled ? C.navy : 'rgba(255,255,255,0.9)',
            letterSpacing: '0.22em', textTransform: 'uppercase', transition: 'color 0.3s'
          }}>IMPERA</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '16px', height: '1px', background: C.gold }} />
            <span className="ct-logo-sub" style={{
              fontFamily: "'Inter', sans-serif", fontSize: '0.55rem', fontWeight: 500,
              color: C.gold, letterSpacing: '0.25em', textTransform: 'uppercase'
            }}>AGENCY</span>
            <span style={{ width: '16px', height: '1px', background: C.gold }} />
          </div>
        </Link>

        {/* Desktop nav + CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', animation: 'ctNavIn 0.6s ease 0.3s both' }} className="ct-desktop-nav">
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
                transition: 'all 0.25s ease', borderRadius: '100px'
              };
              const hoverIn = (e) => {
                e.currentTarget.style.color = scrolled ? C.navy : '#fff';
                e.currentTarget.style.background = scrolled ? 'rgba(27, 46, 75, 0.06)' : 'rgba(255, 255, 255, 0.1)';
              };
              const hoverOut = (e) => {
                e.currentTarget.style.color = scrolled ? C.navy : 'rgba(255,255,255,0.8)';
                e.currentTarget.style.background = 'none';
              };
              return (
                <Link key={id} to={href} style={navStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>{label}</Link>
              );
            })}
          </nav>

          <div style={{ width: '1px', height: '24px', background: scrolled ? 'rgba(27, 46, 75, 0.12)' : 'rgba(255, 255, 255, 0.15)' }} />

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
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(212, 160, 74, 0.35)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = scrolled ? C.gold : 'rgba(212, 160, 74, 0.15)';
              e.currentTarget.style.color = scrolled ? C.navyDeep : C.gold;
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
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(212, 160, 74, 0.35)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = scrolled ? C.gold : 'rgba(212, 160, 74, 0.15)';
              e.currentTarget.style.color = scrolled ? C.navyDeep : C.gold;
              e.currentTarget.style.boxShadow = scrolled ? '0 2px 8px rgba(212, 160, 74, 0.25)' : 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Connexion
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5-5-5-5" /></svg>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button className="ct-mobile-menu-btn" onClick={() => { setMobileMenuOpen(!mobileMenuOpen); haptic('medium'); }}
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
            animation: 'ctMenuSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <div style={{ marginBottom: '3rem', textAlign: 'center', animation: 'ctMenuItemIn 0.5s ease 0.1s both' }}>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.95rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.22em', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>IMPERA</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                <span style={{ width: '16px', height: '1px', background: C.gold }} />
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.55rem', fontWeight: 500, color: C.gold, letterSpacing: '0.25em', textTransform: 'uppercase' }}>AGENCY</span>
                <span style={{ width: '16px', height: '1px', background: C.gold }} />
              </div>
            </div>

            <Link to="/" onClick={() => setMobileMenuOpen(false)} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', textDecoration: 'none',
              fontFamily: "'Cinzel', serif", fontSize: '1.5rem', fontWeight: 500,
              cursor: 'pointer', letterSpacing: '0.1em',
              padding: '0.75rem 2rem', transition: 'all 0.3s ease', display: 'block',
              animation: 'ctMenuItemIn 0.5s ease 0.15s both'
            }}
              onMouseEnter={e => { e.currentTarget.style.color = C.gold; e.currentTarget.style.letterSpacing = '0.15em'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; e.currentTarget.style.letterSpacing = '0.1em'; }}
            >Accueil</Link>

            {NAV_ITEMS.map(([id, label, href], i) => (
              <Link key={id} to={href} onClick={() => setMobileMenuOpen(false)} style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', textDecoration: 'none',
                fontFamily: "'Cinzel', serif", fontSize: '1.5rem', fontWeight: 500,
                cursor: 'pointer', letterSpacing: '0.1em',
                padding: '0.75rem 2rem', transition: 'all 0.3s ease', display: 'block',
                animation: `ctMenuItemIn 0.5s ease ${0.23 + i * 0.08}s both`
              }}
                onMouseEnter={e => { e.currentTarget.style.color = C.gold; e.currentTarget.style.letterSpacing = '0.15em'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; e.currentTarget.style.letterSpacing = '0.1em'; }}
              >{label}</Link>
            ))}

            <Link to="/contact" onClick={() => setMobileMenuOpen(false)} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', textDecoration: 'none',
              fontFamily: "'Cinzel', serif", fontSize: '1.5rem', fontWeight: 500,
              cursor: 'pointer', letterSpacing: '0.1em',
              padding: '0.75rem 2rem', transition: 'all 0.3s ease', display: 'block',
              animation: `ctMenuItemIn 0.5s ease ${0.23 + NAV_ITEMS.length * 0.08}s both`
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
              marginTop: '2.5rem', boxShadow: '0 4px 20px rgba(212, 160, 74, 0.3)',
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              animation: `ctMenuItemIn 0.5s ease ${0.39 + NAV_ITEMS.length * 0.08}s both`
            }}>
              Connexion
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5-5-5-5" /></svg>
            </Link>
          </div>
        )}
      </header>

      {/* ═══ HERO (dark) ═══ */}
      <section style={{
        minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '10rem 3rem 5rem', textAlign: 'center',
        background: `linear-gradient(170deg, ${C.navy} 0%, ${C.navyDark} 60%, ${C.navyDeep} 100%)`,
        position: 'relative', overflow: 'hidden'
      }} className="ct-hero-section">
        <GoldParticles />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px' }}>
          <div style={{ animation: 'ctFadeIn 1s ease 0.1s both' }}>
            <SectionLabel dark>Contact</SectionLabel>
          </div>
          <h1 className="ct-hero-title" style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 400, color: 'rgba(255,255,255,0.9)',
            lineHeight: 1.2, margin: '1.5rem 0 2rem',
            animation: 'ctFadeInUp 0.8s ease 0.2s both'
          }}>
            Demandez votre{' '}
            <span className="ct-shimmer-text" style={{ color: C.gold, fontStyle: 'italic', fontWeight: 600 }}>
              revue privée
            </span>
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.45)', fontSize: 'clamp(0.95rem, 1.4vw, 1.1rem)',
            lineHeight: 1.8, maxWidth: '500px', margin: '0 auto 2.5rem',
            animation: 'ctFadeInUp 0.8s ease 0.35s both'
          }}>
            Chaque demande est étudiée individuellement.
          </p>

          {/* Urgency badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            border: '1px solid rgba(212, 160, 74, 0.3)',
            borderRadius: '8px', padding: '0.6rem 1.2rem',
            animation: 'ctFadeInUp 0.8s ease 0.5s both'
          }}>
            <span style={{ color: C.gold, fontSize: '0.85rem' }}>⏱</span>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>
              Plus que <span style={{ color: C.gold, fontWeight: 700 }}>2 places</span> ce mois-ci
            </span>
          </div>
        </div>
      </section>

      {/* ═══ FORM (light) ═══ */}
      <section style={{
        padding: '5rem 3rem 7rem',
        background: C.marble
      }}>
        <div style={{ maxWidth: '650px', margin: '0 auto' }}>
          <Reveal>
            <div style={{
              background: C.white,
              border: `1px solid ${C.border}`,
              padding: 'clamp(2rem, 5vw, 3.5rem)',
              borderRadius: '2px'
            }}>
              {formState === 'sent' ? (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>&#10003;</div>
                  <h3 style={{ fontFamily: "'Cinzel', serif", fontSize: '1.3rem', color: C.navy, marginBottom: '0.75rem' }}>
                    Demande envoyée
                  </h3>
                  <p style={{ color: C.textMuted, fontSize: '0.9rem', lineHeight: 1.7 }}>
                    Nous avons bien reçu votre demande. Notre équipe vous contactera sous 24h.
                  </p>
                </div>
              ) : (
              <form onSubmit={e => {
                e.preventDefault();
                haptic('heavy');
                setFormState('sending');
                const fd = new FormData(e.target);
                const ig = fd.get('instagram');
                const wa = fd.get('whatsapp');
                const msg = fd.get('message');
                // Send via backend API
                fetch('/api/contact', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                  body: JSON.stringify({ instagram: ig, whatsapp: wa, message: msg })
                }).then(r => {
                  if (r.ok) { setFormState('sent'); haptic('heavy'); }
                  else throw new Error('fail');
                }).catch(() => {
                  // Fallback: open mailto if API not available
                  window.location.href = `mailto:contact@impera-agency.com?subject=Demande de revue privée&body=Instagram: ${ig}%0AWhatsApp: ${wa}${msg ? '%0A%0AMessage: ' + encodeURIComponent(msg) : ''}`;
                  setFormState('sent');
                });
              }}>
                {/* Instagram */}
                <div style={{ marginBottom: '2.5rem' }}>
                  <label style={{
                    display: 'block', fontSize: '0.65rem', fontWeight: 600,
                    color: C.textMuted, letterSpacing: '0.15em',
                    textTransform: 'uppercase', marginBottom: '0.6rem'
                  }}>Instagram <span style={{ color: C.gold }}>*</span></label>
                  <input name="instagram" type="text" required placeholder="@votre_compte" style={{
                    width: '100%', background: 'transparent',
                    border: 'none', borderBottom: `1px solid ${C.border}`,
                    padding: '0.8rem 0', color: C.text,
                    fontSize: '0.95rem', fontFamily: "'Inter', sans-serif",
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
                    fontSize: '0.95rem', fontFamily: "'Inter', sans-serif",
                    outline: 'none', transition: 'border-color 0.3s'
                  }}
                    onFocus={e => e.target.style.borderBottomColor = C.gold}
                    onBlur={e => e.target.style.borderBottomColor = C.border}
                  />
                </div>

                {/* Message */}
                <div style={{ marginBottom: '3rem' }}>
                  <label style={{
                    display: 'block', fontSize: '0.65rem', fontWeight: 600,
                    color: C.textMuted, letterSpacing: '0.15em',
                    textTransform: 'uppercase', marginBottom: '0.6rem'
                  }}>Message <span style={{ color: C.textLight, fontWeight: 400, textTransform: 'none', letterSpacing: '0.02em' }}>(optionnel)</span></label>
                  <textarea name="message" rows={3} placeholder="Parlez-nous de votre profil, vos objectifs, vos questions..." style={{
                    width: '100%', background: 'transparent',
                    border: 'none', borderBottom: `1px solid ${C.border}`,
                    padding: '0.8rem 0', color: C.text,
                    fontSize: '0.95rem', fontFamily: "'Inter', sans-serif",
                    outline: 'none', transition: 'border-color 0.3s',
                    resize: 'vertical', minHeight: '80px'
                  }}
                    onFocus={e => e.target.style.borderBottomColor = C.gold}
                    onBlur={e => e.target.style.borderBottomColor = C.border}
                  />
                </div>

                {/* Submit */}
                <button type="submit" disabled={formState === 'sending'} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                  background: formState === 'sending' ? C.textLight : `linear-gradient(135deg, ${C.gold}, ${C.goldDark})`,
                  color: C.navyDeep, padding: '1.1rem 2rem',
                  borderRadius: 0, border: 'none',
                  fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: '0.8rem',
                  letterSpacing: '0.18em', textTransform: 'uppercase',
                  cursor: formState === 'sending' ? 'wait' : 'pointer', transition: 'all 0.4s ease',
                  boxShadow: '0 4px 20px rgba(196, 136, 77, 0.25)',
                  opacity: formState === 'sending' ? 0.7 : 1
                }}
                  onMouseEnter={e => { if (formState !== 'sending') { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(196, 136, 77, 0.35)'; haptic('light'); }}}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(196, 136, 77, 0.25)'; }}
                >
                  {formState === 'sending' ? 'Envoi en cours...' : 'Demander une revue privée'} {formState !== 'sending' && <ArrowIcon />}
                </button>
              </form>
              )}

              <p style={{
                color: C.textLight, fontSize: '0.78rem',
                marginTop: '1.5rem', letterSpacing: '0.03em', fontStyle: 'italic',
                textAlign: 'center', marginBottom: 0
              }}>
                Nous travaillons avec un nombre limité de créatrices.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ PROCESSUS (dark) ═══ */}
      <section style={{
        padding: '7rem 3rem',
        background: `linear-gradient(170deg, ${C.navyDark} 0%, ${C.navyDeep} 100%)`
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
          <Reveal>
            <SectionLabel dark>Processus</SectionLabel>
            <h2 style={{
              fontFamily: "'Cinzel', serif", fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
              fontWeight: 400, color: 'rgba(255,255,255,0.9)', lineHeight: 1.3, margin: '1rem 0 4rem'
            }}>
              Comment ça{' '}
              <span style={{ color: C.gold, fontStyle: 'italic' }}>fonctionne</span>
            </h2>
          </Reveal>
          <div className="ct-process-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
            {PROCESS_STEPS.map((s, i) => (
              <Reveal key={i} delay={i * 0.12}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '2.5rem 2rem', borderRadius: '2px',
                  textAlign: 'center', transition: 'all 0.3s ease'
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212, 160, 74, 0.3)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <div style={{
                    fontFamily: "'Cinzel', serif", fontSize: '2.5rem', fontWeight: 300,
                    color: C.gold, marginBottom: '1.5rem', lineHeight: 1, opacity: 0.6
                  }}>{s.num}</div>
                  <h3 style={{ fontFamily: "'Cinzel', serif", fontSize: '1.05rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: '0.75rem' }}>{s.title}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem', lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ (light) ═══ */}
      <section style={{
        padding: '7rem 3rem',
        background: C.marble
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Reveal>
            <SectionLabel>Questions fréquentes</SectionLabel>
            <h2 style={{
              fontFamily: "'Cinzel', serif", fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
              fontWeight: 400, color: C.navy, lineHeight: 1.3, margin: '1rem 0 3.5rem',
              textAlign: 'center'
            }}>
              FAQ{' '}
              <span style={{ color: C.gold, fontStyle: 'italic' }}>Créatrices</span>
            </h2>
          </Reveal>

          <div>
            {FAQ_ITEMS.map((item, i) => (
              <Reveal key={i} delay={i * 0.05}>
                <FaqItem
                  item={item}
                  isOpen={openFaq === i}
                  onToggle={() => { setOpenFaq(openFaq === i ? null : i); haptic('light'); }}
                />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{
        padding: '4rem 3rem 2rem',
        background: C.navyDeep,
        borderTop: '1px solid rgba(212, 160, 74, 0.1)'
      }} className="ct-footer">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="ct-footer-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '3rem', marginBottom: '3rem'
          }}>
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>IMPERA</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.15rem' }}>
                  <span style={{ width: '12px', height: '1px', background: C.gold }} />
                  <span style={{ fontSize: '0.45rem', fontWeight: 500, color: C.gold, letterSpacing: '0.2em', textTransform: 'uppercase' }}>AGENCY</span>
                  <span style={{ width: '12px', height: '1px', background: C.gold }} />
                </div>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', lineHeight: 1.7, margin: 0 }}>
                Agence de management pour créatrices OnlyFans & Reveal.
              </p>
            </div>

            <div>
              <h4 style={{ fontFamily: "'Cinzel', serif", fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '1rem' }}>Navigation</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Link to="/" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = C.gold} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.4)'}>Accueil</Link>
                <Link to="/equipe" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = C.gold} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.4)'}>Équipe</Link>
                <Link to="/imperium" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = C.gold} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.4)'}>Imperium</Link>
                <Link to="/login" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = C.gold} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.4)'}>Connexion</Link>
              </div>
            </div>

            <div>
              <h4 style={{ fontFamily: "'Cinzel', serif", fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '1rem' }}>Nous contacter</h4>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <a href="mailto:contact@impera-agency.com" title="Email" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(212, 160, 74, 0.2)', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', transition: 'all 0.3s ease' }} onMouseEnter={e => { e.currentTarget.style.color = C.gold; e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.background = 'rgba(212, 160, 74, 0.08)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = 'rgba(212, 160, 74, 0.2)'; e.currentTarget.style.background = 'transparent'; }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></a>
                <a href="https://instagram.com/impera_agency" target="_blank" rel="noopener noreferrer" title="Instagram" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(212, 160, 74, 0.2)', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', transition: 'all 0.3s ease' }} onMouseEnter={e => { e.currentTarget.style.color = C.gold; e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.background = 'rgba(212, 160, 74, 0.08)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = 'rgba(212, 160, 74, 0.2)'; e.currentTarget.style.background = 'transparent'; }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg></a>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem', textAlign: 'center' }}>
            <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.72rem', margin: '0 0 0.5rem' }}>
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
        </div>
      </footer>

      {/* ═══ STYLES ═══ */}
      <style>{`
        @keyframes ctFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes ctFadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ctMenuSlideIn {
          from { opacity: 0; clip-path: circle(0% at top right); }
          to { opacity: 1; clip-path: circle(150% at top right); }
        }
        @keyframes ctMenuItemIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ctNavIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .ct-shimmer-text {
          position: relative;
          background: linear-gradient(120deg, ${C.gold} 0%, ${C.gold} 40%, #f0d48a 50%, ${C.gold} 60%, ${C.gold} 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: ctShimmer 4s ease-in-out infinite;
        }
        @keyframes ctShimmer {
          0%, 100% { background-position: 100% center; }
          50% { background-position: -100% center; }
        }

        .ct-scroll-progress {
          position: fixed; top: 0; left: 0; height: 2px;
          background: linear-gradient(90deg, ${C.gold}, ${C.goldDark});
          z-index: 10000; transition: width 0.1s linear;
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        @media (max-width: 900px) {
          .ct-desktop-nav { display: none !important; }
          .ct-mobile-menu-btn { display: block !important; }
        }
        @media (min-width: 901px) {
          .ct-mobile-menu-btn { display: none !important; }
        }

        @media (max-width: 640px) {
          .ct-hero-section {
            padding: 8rem 1.5rem 4rem !important;
            min-height: 60vh !important;
          }
          .ct-hero-title {
            font-size: 1.8rem !important;
          }
          .ct-process-grid {
            grid-template-columns: 1fr !important;
            gap: 1rem !important;
          }
          .ct-header {
            padding-left: 1.25rem !important;
            padding-right: 1.25rem !important;
          }
          .ct-logo-name { font-size: 0.8rem !important; }
          .ct-logo-sub { font-size: 0.45rem !important; }
          .ct-footer {
            padding: 3rem 1.5rem 2rem !important;
          }
          .ct-footer-grid {
            grid-template-columns: 1fr !important;
            gap: 2rem !important;
          }
        }

        @media (max-width: 1024px) and (min-width: 641px) {
          .ct-hero-section { padding: 9rem 2.5rem 5rem !important; }
          .ct-process-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .ct-footer-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
