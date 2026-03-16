import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// ─── Colors (same as AgencyHome / TeamPage) ───
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
function SectionLabel({ children }) {
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

// ─── CTA Button style (shared) ───
const ctaStyle = (isOutline = false) => ({
  display: 'inline-flex', alignItems: 'center', gap: '0.75rem',
  background: isOutline ? 'transparent' : `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDark} 100%)`,
  color: isOutline ? C.gold : C.navyDeep,
  border: isOutline ? `1px solid ${C.gold}` : 'none',
  padding: '1.1rem 2.8rem', borderRadius: 0,
  fontFamily: "'Inter', sans-serif", fontSize: '0.8rem', fontWeight: 600,
  letterSpacing: '0.18em', textTransform: 'uppercase',
  cursor: 'pointer', textDecoration: 'none',
  boxShadow: isOutline ? 'none' : '0 4px 20px rgba(196, 136, 77, 0.25)',
  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
});
const ctaHoverIn = (e, isOutline = false) => {
  e.currentTarget.style.transform = 'translateY(-2px)';
  e.currentTarget.style.boxShadow = isOutline
    ? '0 4px 20px rgba(196, 136, 77, 0.25)'
    : '0 8px 30px rgba(196, 136, 77, 0.35)';
  if (isOutline) {
    e.currentTarget.style.background = `linear-gradient(135deg, ${C.gold} 0%, ${C.goldDark} 100%)`;
    e.currentTarget.style.color = C.navyDeep;
  }
};
const ctaHoverOut = (e, isOutline = false) => {
  e.currentTarget.style.transform = 'translateY(0)';
  e.currentTarget.style.boxShadow = isOutline ? 'none' : '0 4px 20px rgba(196, 136, 77, 0.25)';
  if (isOutline) {
    e.currentTarget.style.background = 'transparent';
    e.currentTarget.style.color = C.gold;
  }
};

// ─── Arrow icon ───
const ArrowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
);

// ─── Features data ───
const FEATURES = [
  { icon: '📊', title: 'Dashboard temps réel', desc: 'Visualise tes revenus, tes ventes et ta progression en un coup d\'œil. Fini les tableurs Excel et les approximations.' },
  { icon: '💰', title: 'Suivi des ventes', desc: 'Chaque vente est enregistrée automatiquement. Tu sais exactement combien tu génères, par plateforme et par modèle.' },
  { icon: '📅', title: 'Planning intelligent', desc: 'Consulte ton planning en temps réel, gère tes shifts et évite les conflits. Tout est synchronisé avec l\'équipe.' },
  { icon: '🧾', title: 'Facturation automatique', desc: 'Tes factures sont générées automatiquement chaque mois. Télécharge-les en PDF, prêtes pour ta comptabilité.' },
  { icon: '📈', title: 'Performance & stats', desc: 'Analyse tes performances par période, compare tes résultats et identifie tes points forts pour progresser.' },
  { icon: '💬', title: 'Communication simplifiée', desc: 'Reste connecté·e avec l\'équipe. Notifications, mises à jour et objectifs : tout est centralisé dans ton espace.' },
];

const STEPS = [
  { num: '01', title: 'Rejoins l\'agence', desc: 'Postule via notre page Équipe. Si ton profil correspond, tu intègres l\'équipe Impera et tu reçois tes accès.' },
  { num: '02', title: 'Accède à ton espace', desc: 'Connecte-toi à Imperium depuis n\'importe quel appareil. Ton dashboard personnel t\'attend avec toutes tes données.' },
  { num: '03', title: 'Pilote ta croissance', desc: 'Suis tes ventes, consulte ton planning, télécharge tes factures. Tout ce dont tu as besoin pour performer.' },
];

const ADVANTAGES = [
  { icon: '🔍', title: 'Transparence totale', desc: 'Chaque euro généré, chaque commission, chaque paiement : tout est visible et vérifiable à tout moment.' },
  { icon: '⚡', title: 'Données en temps réel', desc: 'Pas d\'attente. Tes ventes apparaissent instantanément, ton dashboard se met à jour en continu.' },
  { icon: '🔒', title: 'Sécurité renforcée', desc: 'Authentification sécurisée, données chiffrées, accès personnel protégé. Tes informations restent privées.' },
  { icon: '📱', title: 'Mobile-first', desc: 'Imperium s\'adapte à tous les écrans. Gère ta carrière depuis ton téléphone, ta tablette ou ton ordinateur.' },
  { icon: '🤝', title: 'Support dédié', desc: 'Une question ? L\'équipe Impera est là pour t\'accompagner. Tu n\'es jamais seul·e dans ta progression.' },
  { icon: '🚀', title: 'Construit pour toi', desc: 'Imperium a été conçu spécifiquement pour les chatteurs et modèles. Chaque fonctionnalité répond à un vrai besoin.' },
];

// ═══════════════════════════════════════════════
// IMPERIUM PAGE
// ═══════════════════════════════════════════════
export default function ImperiumPage() {
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
    ['equipe', 'Équipe', '/equipe'],
    ['imperium', 'Imperium'],
  ];

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: C.text, background: C.navyDeep, overflowX: 'hidden' }}>

      {/* Scroll progress bar */}
      <div className="imp-scroll-progress" style={{ width: `${scrollProgress}%` }} aria-hidden="true" />

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
      }} className="imp-header">
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '0.15rem', textDecoration: 'none' }}>
          <span className="imp-logo-name" style={{
            fontFamily: "'Inter', sans-serif", fontSize: '0.95rem', fontWeight: 600,
            color: scrolled ? C.navy : 'rgba(255,255,255,0.9)',
            letterSpacing: '0.22em', textTransform: 'uppercase', transition: 'color 0.3s'
          }}>IMPERA</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '16px', height: '1px', background: C.gold }} />
            <span className="imp-logo-sub" style={{
              fontFamily: "'Inter', sans-serif", fontSize: '0.55rem', fontWeight: 500,
              color: C.gold, letterSpacing: '0.25em', textTransform: 'uppercase'
            }}>AGENCY</span>
            <span style={{ width: '16px', height: '1px', background: C.gold }} />
          </div>
        </Link>

        {/* Desktop nav + CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', animation: 'impNavIn 0.6s ease 0.3s both' }} className="imp-desktop-nav">
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
              return href ? (
                <Link key={id} to={href} style={navStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>{label}</Link>
              ) : (
                <button key={id} onClick={() => scrollTo(id)} style={navStyle} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>{label}</button>
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

          <Link to="/login" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            background: scrolled ? C.gold : 'rgba(212, 160, 74, 0.15)',
            border: scrolled ? 'none' : '1px solid rgba(212, 160, 74, 0.4)',
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
        <button className="imp-mobile-menu-btn" onClick={() => { setMobileMenuOpen(!mobileMenuOpen); haptic('medium'); }}
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
            animation: 'impMenuSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <div style={{ marginBottom: '3rem', textAlign: 'center', animation: 'impMenuItemIn 0.5s ease 0.1s both' }}>
              <span style={{
                fontFamily: "'Inter', sans-serif", fontSize: '0.95rem', fontWeight: 600,
                color: 'rgba(255,255,255,0.6)', letterSpacing: '0.22em', textTransform: 'uppercase',
                display: 'block', marginBottom: '0.25rem'
              }}>IMPERA</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                <span style={{ width: '16px', height: '1px', background: C.gold }} />
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.55rem', fontWeight: 500, color: C.gold, letterSpacing: '0.25em', textTransform: 'uppercase' }}>AGENCY</span>
                <span style={{ width: '16px', height: '1px', background: C.gold }} />
              </div>
            </div>

            {/* Accueil link in mobile */}
            <Link to="/" onClick={() => setMobileMenuOpen(false)} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', textDecoration: 'none',
              fontFamily: "'Cinzel', serif", fontSize: '1.5rem', fontWeight: 500,
              cursor: 'pointer', letterSpacing: '0.1em',
              padding: '0.75rem 2rem', transition: 'all 0.3s ease', display: 'block',
              animation: 'impMenuItemIn 0.5s ease 0.15s both'
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
                animation: `impMenuItemIn 0.5s ease ${0.23 + i * 0.08}s both`
              };
              const mHoverIn = e => { e.currentTarget.style.color = C.gold; e.currentTarget.style.letterSpacing = '0.15em'; };
              const mHoverOut = e => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; e.currentTarget.style.letterSpacing = '0.1em'; };
              return href ? (
                <Link key={id} to={href} onClick={() => setMobileMenuOpen(false)} style={mobileStyle} onMouseEnter={mHoverIn} onMouseLeave={mHoverOut}>{label}</Link>
              ) : (
                <button key={id} onClick={() => scrollTo(id)} style={mobileStyle} onMouseEnter={mHoverIn} onMouseLeave={mHoverOut}>{label}</button>
              );
            })}

            <Link to="/contact" onClick={() => setMobileMenuOpen(false)} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', textDecoration: 'none',
              fontFamily: "'Cinzel', serif", fontSize: '1.5rem', fontWeight: 500,
              cursor: 'pointer', letterSpacing: '0.1em',
              padding: '0.75rem 2rem', transition: 'all 0.3s ease', display: 'block',
              animation: `impMenuItemIn 0.5s ease ${0.23 + NAV_ITEMS.length * 0.08}s both`
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
              animation: `impMenuItemIn 0.5s ease ${0.31 + NAV_ITEMS.length * 0.08}s both`
            }}>
              Connexion
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5-5-5-5" /></svg>
            </Link>
          </div>
        )}
      </header>

      {/* ═══ HERO ═══ */}
      <section id="imperium" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '10rem 3rem 5rem', textAlign: 'center',
        background: `linear-gradient(170deg, ${C.navy} 0%, ${C.navyDark} 60%, ${C.navyDeep} 100%)`,
        position: 'relative', overflow: 'hidden'
      }} className="imp-hero-section">
        <GoldParticles />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px' }}>
          <div style={{ animation: 'impFadeIn 1s ease 0.1s both' }}>
            <SectionLabel>Plateforme</SectionLabel>
          </div>
          <h1 className="imp-hero-title" style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 'clamp(2.2rem, 6vw, 4rem)',
            fontWeight: 400, color: 'rgba(255,255,255,0.9)',
            lineHeight: 1.2, margin: '1.5rem 0 2rem',
            animation: 'impFadeInUp 0.8s ease 0.2s both'
          }}>
            Imperium<br />
            <span className="imp-shimmer-text" style={{ color: C.gold, fontStyle: 'italic', fontWeight: 600 }}>
              le tableau de bord de ta carrière.
            </span>
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.45)', fontSize: 'clamp(0.95rem, 1.4vw, 1.1rem)',
            lineHeight: 1.8, maxWidth: '600px', margin: '0 auto 3rem',
            animation: 'impFadeInUp 0.8s ease 0.35s both'
          }}>
            Suis tes ventes, consulte ton planning, télécharge tes factures.
            Tout ce dont tu as besoin pour performer, en un seul endroit.
          </p>
          <div style={{ animation: 'impFadeInUp 0.8s ease 0.5s both' }}>
            <Link to="/login" style={ctaStyle(true)}
              onMouseEnter={e => { ctaHoverIn(e, true); haptic('light'); }}
              onMouseLeave={e => ctaHoverOut(e, true)}
            >
              Accéder à Imperium <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ PROBLÈME (light) ═══ */}
      <section style={{
        padding: '7rem 3rem',
        background: C.marble
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <Reveal>
            <SectionLabel>Le constat</SectionLabel>
            <h2 style={{
              fontFamily: "'Cinzel', serif", fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
              fontWeight: 400, color: C.navy, lineHeight: 1.3, margin: '1rem 0 2rem'
            }}>
              Gérer sa carrière sans outil adapté,<br />
              <span style={{ color: C.gold, fontStyle: 'italic' }}>c'est naviguer à l'aveugle.</span>
            </h2>
          </Reveal>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '2rem', marginTop: '3rem'
          }}>
            {[
              { icon: '📋', title: 'Suivi flou', desc: 'Combien as-tu généré ce mois-ci ? Difficile à dire quand tout est éparpillé entre messages et tableurs.' },
              { icon: '🕒', title: 'Planning chaotique', desc: 'Les shifts changent, les conflits s’accumulent. Sans vue claire, tu perds du temps et de l’énergie.' },
              { icon: '📄', title: 'Facturation manuelle', desc: 'Créer ses factures à la main chaque mois, c’est du temps perdu sur des tâches qui devraient être automatisées.' },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <div style={{
                  background: C.white, padding: '2.5rem 2rem', borderRadius: '2px',
                  border: `1px solid ${C.border}`,
                  transition: 'all 0.3s ease'
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212, 160, 74, 0.3)'; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(27, 46, 75, 0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{item.icon}</div>
                  <h3 style={{ fontFamily: "'Cinzel', serif", fontSize: '1rem', fontWeight: 600, color: C.navy, marginBottom: '0.75rem' }}>{item.title}</h3>
                  <p style={{ color: C.textMuted, fontSize: '0.88rem', lineHeight: 1.7, margin: 0 }}>{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES (dark) ═══ */}
      <section style={{
        padding: '7rem 3rem',
        background: `linear-gradient(170deg, ${C.navyDark} 0%, ${C.navyDeep} 100%)`
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <SectionLabel>Fonctionnalités</SectionLabel>
              <h2 style={{
                fontFamily: "'Cinzel', serif", fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
                fontWeight: 400, color: 'rgba(255,255,255,0.9)', lineHeight: 1.3, margin: '1rem 0'
              }}>
                Tout ce qu'il te faut,<br />
                <span style={{ color: C.gold, fontStyle: 'italic' }}>rien de superflu.</span>
              </h2>
            </div>
          </Reveal>
          <div className="imp-features-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.5rem'
          }}>
            {FEATURES.map((f, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  padding: '2.5rem 2rem', borderRadius: '2px',
                  transition: 'all 0.3s ease'
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212, 160, 74, 0.3)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <div style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>{f.icon}</div>
                  <h3 style={{ fontFamily: "'Cinzel', serif", fontSize: '0.95rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: '0.75rem' }}>{f.title}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ COMMENT ÇA MARCHE (light) ═══ */}
      <section style={{
        padding: '7rem 3rem',
        background: C.marble
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <Reveal>
            <SectionLabel>Comment ça marche</SectionLabel>
            <h2 style={{
              fontFamily: "'Cinzel', serif", fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
              fontWeight: 400, color: C.navy, lineHeight: 1.3, margin: '1rem 0 4rem'
            }}>
              Trois étapes vers<br />
              <span style={{ color: C.gold, fontStyle: 'italic' }}>ton espace personnel.</span>
            </h2>
          </Reveal>
          <div className="imp-steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3rem' }}>
            {STEPS.map((s, i) => (
              <Reveal key={i} delay={i * 0.12}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontFamily: "'Cinzel', serif", fontSize: '2.5rem', fontWeight: 300,
                    color: C.gold, marginBottom: '1.5rem', lineHeight: 1,
                    opacity: 0.6
                  }}>{s.num}</div>
                  <h3 style={{ fontFamily: "'Cinzel', serif", fontSize: '1.05rem', fontWeight: 600, color: C.navy, marginBottom: '0.75rem' }}>{s.title}</h3>
                  <p style={{ color: C.textMuted, fontSize: '0.88rem', lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
                  {i < STEPS.length - 1 && (
                    <div className="imp-step-arrow" style={{
                      position: 'absolute', right: '-1.5rem', top: '50%', transform: 'translateY(-50%)',
                      color: C.gold, fontSize: '1.2rem', opacity: 0.4
                    }}>→</div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ AVANTAGES (dark) ═══ */}
      <section style={{
        padding: '7rem 3rem',
        background: `linear-gradient(170deg, ${C.navyDark} 0%, ${C.navyDeep} 100%)`
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <Reveal>
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
              <SectionLabel>Pourquoi Imperium</SectionLabel>
              <h2 style={{
                fontFamily: "'Cinzel', serif", fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
                fontWeight: 400, color: 'rgba(255,255,255,0.9)', lineHeight: 1.3, margin: '1rem 0'
              }}>
                Conçu pour ceux qui veulent<br />
                <span style={{ color: C.gold, fontStyle: 'italic' }}>aller plus loin.</span>
              </h2>
            </div>
          </Reveal>
          <div className="imp-advantages-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem'
          }}>
            {ADVANTAGES.map((a, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  padding: '2rem 1.75rem', borderRadius: '2px',
                  transition: 'all 0.3s ease'
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212, 160, 74, 0.3)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>{a.icon}</div>
                  <h3 style={{ fontFamily: "'Cinzel', serif", fontSize: '0.9rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: '0.5rem' }}>{a.title}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', lineHeight: 1.7, margin: 0 }}>{a.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA FINAL (light) ═══ */}
      <section style={{
        padding: '7rem 3rem',
        background: C.marble, textAlign: 'center'
      }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <Reveal>
            <SectionLabel>Passer à l'action</SectionLabel>
            <h2 style={{
              fontFamily: "'Cinzel', serif", fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
              fontWeight: 400, color: C.navy, lineHeight: 1.3, margin: '1rem 0 1.5rem'
            }}>
              Prêt·e à passer au<br />
              <span style={{ color: C.gold, fontStyle: 'italic' }}>niveau supérieur ?</span>
            </h2>
            <p style={{
              color: C.textMuted, fontSize: '1rem', lineHeight: 1.8,
              maxWidth: '550px', margin: '0 auto 3rem'
            }}>
              Déjà membre ? Connecte-toi à ton espace.
              Pas encore dans l'équipe ? Rejoins-nous.
            </p>
            <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/login" style={ctaStyle()}
                onMouseEnter={e => { ctaHoverIn(e); haptic('light'); }}
                onMouseLeave={e => ctaHoverOut(e)}
              >
                Se connecter <ArrowIcon />
              </Link>
              <Link to="/equipe" style={ctaStyle(true)}
                onMouseEnter={e => { ctaHoverIn(e, true); haptic('light'); }}
                onMouseLeave={e => ctaHoverOut(e, true)}
              >
                Postuler
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{
        padding: '4rem 3rem 2rem',
        background: C.navyDeep,
        borderTop: '1px solid rgba(212, 160, 74, 0.1)'
      }} className="imp-footer">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div className="imp-footer-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '3rem', marginBottom: '3rem'
          }}>
            {/* Col 1: Logo */}
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
                Imperium est notre plateforme interne de gestion.
              </p>
            </div>

            {/* Col 2: Navigation */}
            <div>
              <h4 style={{ fontFamily: "'Cinzel', serif", fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '1rem' }}>Navigation</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Link to="/" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = C.gold} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.4)'}>Accueil</Link>
                <Link to="/equipe" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = C.gold} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.4)'}>Équipe</Link>
                <Link to="/imperium" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = C.gold} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.4)'}>Imperium</Link>
                <Link to="/login" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = C.gold} onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.4)'}>Connexion</Link>
              </div>
            </div>

            {/* Col 3: Contact */}
            <div>
              <h4 style={{ fontFamily: "'Cinzel', serif", fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '1rem' }}>Nous contacter</h4>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <a href="mailto:contact@impera-agency.com" title="Email" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(212, 160, 74, 0.2)', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', transition: 'all 0.3s ease' }} onMouseEnter={e => { e.currentTarget.style.color = C.gold; e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.background = 'rgba(212, 160, 74, 0.08)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = 'rgba(212, 160, 74, 0.2)'; e.currentTarget.style.background = 'transparent'; }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></a>
                <a href="https://instagram.com/impera_agency" target="_blank" rel="noopener noreferrer" title="Instagram" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(212, 160, 74, 0.2)', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', transition: 'all 0.3s ease' }} onMouseEnter={e => { e.currentTarget.style.color = C.gold; e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.background = 'rgba(212, 160, 74, 0.08)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = 'rgba(212, 160, 74, 0.2)'; e.currentTarget.style.background = 'transparent'; }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg></a>
              </div>
            </div>
          </div>

          {/* Copyright */}
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
        @keyframes impFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes impFadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes impMenuSlideIn {
          from { opacity: 0; clip-path: circle(0% at top right); }
          to { opacity: 1; clip-path: circle(150% at top right); }
        }
        @keyframes impMenuItemIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes impNavIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .imp-shimmer-text {
          position: relative;
          background: linear-gradient(120deg, ${C.gold} 0%, ${C.gold} 40%, #f0d48a 50%, ${C.gold} 60%, ${C.gold} 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: impShimmer 4s ease-in-out infinite;
        }

        @keyframes impShimmer {
          0%, 100% { background-position: 100% center; }
          50% { background-position: -100% center; }
        }

        .imp-scroll-progress {
          position: fixed;
          top: 0;
          left: 0;
          height: 2px;
          background: linear-gradient(90deg, ${C.gold}, ${C.goldDark});
          z-index: 10000;
          transition: width 0.1s linear;
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        /* Nav responsiveness */
        @media (max-width: 900px) {
          .imp-desktop-nav { display: none !important; }
          .imp-mobile-menu-btn { display: block !important; }
        }
        @media (min-width: 901px) {
          .imp-mobile-menu-btn { display: none !important; }
        }

        /* Tablet */
        @media (max-width: 1024px) and (min-width: 641px) {
          .imp-hero-section { padding: 9rem 2.5rem 5rem !important; }
          .imp-features-grid, .imp-advantages-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .imp-steps-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .imp-footer-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 2.5rem !important; }
        }

        /* Mobile */
        @media (max-width: 640px) {
          .imp-hero-section {
            padding: 8rem 1.5rem 4rem !important;
            min-height: 90vh !important;
          }
          .imp-hero-title {
            font-size: 1.8rem !important;
            margin-bottom: 1.5rem !important;
          }
          .imp-features-grid,
          .imp-advantages-grid {
            grid-template-columns: 1fr !important;
          }
          .imp-steps-grid {
            grid-template-columns: 1fr !important;
            gap: 2rem !important;
          }
          .imp-step-arrow {
            display: none !important;
          }
          .imp-header {
            padding-left: 1.25rem !important;
            padding-right: 1.25rem !important;
          }
          .imp-logo-name { font-size: 0.8rem !important; }
          .imp-logo-sub { font-size: 0.45rem !important; }
          .imp-footer {
            padding: 3rem 1.5rem 2rem !important;
          }
          .imp-footer-grid {
            grid-template-columns: 1fr !important;
            gap: 2rem !important;
          }
        }
      `}</style>
    </div>
  );
}
