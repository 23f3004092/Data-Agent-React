import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { thunderPalette } from '../theme/thunderTheme';

const P = thunderPalette;

/* ─── tiny reusable components ─── */
function BoltSVG({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: 'boltFlicker 4s ease-in-out infinite', flexShrink: 0 }}>
      <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"
        fill={P.accent} stroke={P.accent} strokeWidth="0.5" strokeLinejoin="round" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: 'Live Data Analysis',
    desc: 'Upload CSVs, PDFs, images or scrape any URL — the agent analyses, cleans, and surfaces insights instantly.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
    title: 'Data Storytelling',
    desc: 'Generates cinematic, animated HTML data stories with Plotly charts, pull-quotes, and detective-style narratives.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
    title: 'Multi-turn Memory',
    desc: 'Every session stores the full conversation. Pick up where you left off — the agent remembers context across messages.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
    title: 'Sandpack Studio',
    desc: 'Preview and edit the generated HTML live in-browser using Sandpack — no downloads, no copy-paste.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
    title: 'Isolated File Sandboxing',
    desc: 'Each chat gets its own upload directory. Uploaded files are scoped to their session — no cross-contamination.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: 'JWT Authentication',
    desc: 'Secure user accounts, bcrypt-hashed passwords, and 7-day JWT tokens — your data, your sessions.',
  },
];

const HOW = [
  { step: '01', title: 'Create an account', desc: 'Sign up in seconds — no credit card, no email verification.' },
  { step: '02', title: 'Start a new session', desc: 'Hit "New Analysis", describe your data task or paste a URL.' },
  { step: '03', title: 'Let the agent work', desc: 'The AI scrapes, analyses, and generates a full HTML data story.' },
  { step: '04', title: 'Iterate & download', desc: 'Refine in the chat, preview live in Sandpack, download the HTML.' },
];

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [heroVisible, setHeroVisible] = useState(false);
  const heroRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleCTA = () => {
    if (user) navigate('/dashboard');
    else navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', overflowY: 'auto', overflowX: 'hidden', background: P.black, color: P.white, fontFamily: P.ffBody }}>

      {/* ── grid bg ── */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `linear-gradient(${P.line} 1px,transparent 1px),linear-gradient(90deg,${P.line} 1px,transparent 1px)`,
        backgroundSize: '64px 64px', animation: 'gridFade 1.2s ease both',
      }} />
      <div style={{ position: 'fixed', top: -140, right: -80, width: 560, height: 560, background: 'radial-gradient(circle,rgba(124,58,237,0.18) 0%,transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: -120, left: -60, width: 420, height: 420, background: 'radial-gradient(circle,rgba(167,139,250,0.1) 0%,transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 40px',
        background: 'rgba(10,10,10,0.75)', backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${P.line}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BoltSVG size={26} />
          <span style={{ fontFamily: P.ffHead, fontWeight: 800, fontSize: 22, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Data Agent
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user ? (
            <button onClick={() => navigate('/dashboard')} style={btnStyle('filled')}>
              Open Studio →
            </button>
          ) : (
            <>
              <button onClick={() => navigate('/login')} style={btnStyle('ghost')}>Sign In</button>
              <button onClick={() => navigate('/login')} style={btnStyle('filled')}>Get Started</button>
            </>
          )}
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        position: 'relative', zIndex: 2,
        minHeight: '90vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '80px 24px 60px', textAlign: 'center',
      }}>

        {/* Headline */}
        <h1 ref={heroRef} style={{
          fontFamily: P.ffHead, fontWeight: 900, fontSize: 'clamp(3rem,8vw,7rem)',
          lineHeight: 0.92, letterSpacing: '-0.01em', textTransform: 'uppercase',
          maxWidth: 900, marginBottom: '1.5rem',
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.7s 0.1s ease',
        }}>
          Your AI<br />
          <span style={{
            background: `linear-gradient(135deg, ${P.accent}, ${P.accentL})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Data Detective</span>
        </h1>

        {/* Sub */}
        <p style={{
          fontFamily: P.ffBody, fontWeight: 300, fontSize: 'clamp(1rem,2.5vw,1.3rem)',
          color: P.mid, maxWidth: 580, lineHeight: 1.7,
          marginBottom: '2.5rem',
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.7s 0.2s ease',
        }}>
          Scrape the web, analyse files, and generate stunning interactive data stories — all through a single chat interface.
        </p>

        {/* CTAs */}
        <div style={{
          display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center',
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.7s 0.3s ease',
        }}>
          <button onClick={handleCTA} style={{
            ...btnStyle('filled'), fontSize: 15, padding: '14px 36px',
            boxShadow: `0 0 32px rgba(124,58,237,0.35)`,
          }}>
            Start Analysing Free →
          </button>
          <button onClick={() => document.getElementById('how').scrollIntoView({ behavior: 'smooth' })} style={{ ...btnStyle('ghost'), fontSize: 15, padding: '14px 36px' }}>
            See How It Works
          </button>
        </div>

        {/* Hero visual — mock window */}
        <div style={{
          marginTop: '5rem', width: '100%', maxWidth: 900,
          background: 'rgba(17,17,17,0.8)', backdropFilter: 'blur(12px)',
          border: `1px solid ${P.line}`, borderRadius: 12,
          overflow: 'hidden',
          boxShadow: `0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.15)`,
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? 'translateY(0) perspective(1000px) rotateX(0deg)' : 'translateY(40px) perspective(1000px) rotateX(4deg)',
          transition: 'all 0.9s 0.4s ease',
        }}>
          {/* Window chrome */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderBottom: `1px solid ${P.line}` }}>
            {['#ff5f57','#febc2e','#28c840'].map(c => (
              <span key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c, display: 'inline-block' }} />
            ))}
            <span style={{ marginLeft: 12, fontFamily: P.ffBody, fontSize: 12, color: P.mid }}>data-agent · studio</span>
          </div>
          {/* Fake 3-panel */}
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1.6fr', height: 340 }}>
            {/* Sidebar */}
            <div style={{ borderRight: `1px solid ${P.line}`, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontFamily: P.ffHead, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: P.mid, padding: '4px 6px', marginBottom: 4 }}>Sessions</div>
              {['IPL 2024 Analysis','Global GDP Story','Stock Scrape'].map((t, i) => (
                <div key={t} style={{ padding: '8px 10px', borderRadius: 4, fontSize: 12, fontFamily: P.ffBody, color: i === 0 ? P.white : P.mid, background: i === 0 ? 'rgba(124,58,237,0.15)' : 'transparent', borderLeft: `2px solid ${i === 0 ? P.accent : 'transparent'}` }}>{t}</div>
              ))}
            </div>
            {/* Chat */}
            <div style={{ borderRight: `1px solid ${P.line}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'hidden' }}>
              <div style={{ fontFamily: P.ffHead, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: P.mid, marginBottom: 4 }}>Chat</div>
              {/* User message */}
              <div style={{ padding: '8px 10px', borderRadius: 6, fontSize: 11, lineHeight: 1.5, fontFamily: P.ffBody, background: 'rgba(124,58,237,0.12)', border: `1px solid rgba(124,58,237,0.25)`, color: P.white, alignSelf: 'flex-end', maxWidth: '90%' }}>
                Scrape IPL 2024 stats and generate a data story
              </div>
              {/* Agent trace tree */}
              <AgentTrace />
            </div>
            {/* Preview */}
            <div style={{ background: '#050816', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', border: `3px solid rgba(255,255,255,0.06)`, borderTopColor: P.accent, animation: 'spin 1.1s linear infinite' }} />
              <span style={{ fontFamily: P.ffHead, fontSize: 12, color: P.mid, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Rendering Story…</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ position: 'relative', zIndex: 2, padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <SectionLabel>Capabilities</SectionLabel>
        <h2 style={{ fontFamily: P.ffHead, fontWeight: 800, fontSize: 'clamp(2rem,4vw,3.5rem)', textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: '3rem', maxWidth: 600 }}>
          Everything the agent can do
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {FEATURES.map((f, i) => (
            <FeatureCard key={i} icon={f.icon} title={f.title} desc={f.desc} delay={i * 60} />
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ position: 'relative', zIndex: 2, padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <SectionLabel>Process</SectionLabel>
        <h2 style={{ fontFamily: P.ffHead, fontWeight: 800, fontSize: 'clamp(2rem,4vw,3.5rem)', textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: '3rem' }}>
          How it works
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
          {HOW.map((h, i) => (
            <div key={i} style={{ padding: '28px 24px', background: 'rgba(17,17,17,0.6)', border: `1px solid ${P.line}`, borderRadius: 8, position: 'relative', overflow: 'hidden' }}>
              <span style={{ fontFamily: P.ffHead, fontWeight: 900, fontSize: 56, color: 'rgba(124,58,237,0.12)', position: 'absolute', top: 8, right: 16, lineHeight: 1 }}>{h.step}</span>
              <div style={{ fontFamily: P.ffHead, fontWeight: 700, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: P.accentL, marginBottom: 12 }}>Step {h.step}</div>
              <div style={{ fontFamily: P.ffHead, fontWeight: 700, fontSize: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{h.title}</div>
              <div style={{ fontFamily: P.ffBody, fontSize: 14, color: P.mid, lineHeight: 1.65 }}>{h.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA BAND ── */}
      <section style={{
        position: 'relative', zIndex: 2, margin: '40px 24px 80px',
        padding: '60px 40px', borderRadius: 12, textAlign: 'center',
        background: `linear-gradient(135deg, rgba(124,58,237,0.2), rgba(167,139,250,0.08))`,
        border: `1px solid rgba(124,58,237,0.25)`,
        maxWidth: 860, marginLeft: 'auto', marginRight: 'auto',
      }}>
        <h2 style={{ fontFamily: P.ffHead, fontWeight: 900, fontSize: 'clamp(2rem,5vw,3.5rem)', textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: '1rem' }}>
          Ready to investigate<br />your data?
        </h2>
        <p style={{ fontFamily: P.ffBody, fontSize: 16, color: P.mid, marginBottom: '2rem', lineHeight: 1.7 }}>
          Free to use. No setup. Just describe what you want — the agent handles the rest.
        </p>
        <button onClick={handleCTA} style={{
          ...btnStyle('filled'), fontSize: 16, padding: '15px 44px',
          boxShadow: `0 0 48px rgba(124,58,237,0.4)`,
        }}>
          {user ? 'Open Studio →' : 'Get Started Free →'}
        </button>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ position: 'relative', zIndex: 2, borderTop: `1px solid ${P.line}`, padding: '28px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BoltSVG size={18} />
          <span style={{ fontFamily: P.ffHead, fontWeight: 800, fontSize: 15, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Data Agent</span>
        </div>
        <span style={{ fontFamily: P.ffBody, fontSize: 12, color: P.mid }}>Built with FastAPI · SQLite · LangChain · React</span>
      </footer>

      <style>{`
        @keyframes boltFlicker { 0%,90%,100%{opacity:1} 93%{opacity:0.4} 96%{opacity:1} 98%{opacity:0.6} }
        @keyframes gridFade { from{opacity:0} to{opacity:1} }
        @keyframes spin { to{transform:rotate(360deg)} }
        html, body { overflow-x: hidden; }
      `}</style>
    </div>
  );
}

/* ─── helpers ─── */
function btnStyle(variant) {
  const base = {
    fontFamily: thunderPalette.ffHead, fontWeight: 700, fontSize: 13,
    letterSpacing: '0.1em', textTransform: 'uppercase',
    borderRadius: 4, padding: '8px 20px', cursor: 'pointer',
    transition: 'all 0.2s',
  };
  if (variant === 'filled') return { ...base, background: thunderPalette.accent, color: '#fff', border: 'none' };
  return { ...base, background: 'transparent', color: thunderPalette.mid, border: `1px solid ${thunderPalette.line}` };
}

function SectionLabel({ children }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      fontFamily: thunderPalette.ffHead, fontWeight: 700, fontSize: 11,
      letterSpacing: '0.16em', textTransform: 'uppercase',
      color: thunderPalette.accentL, marginBottom: '1rem',
    }}>
      <span style={{ width: 20, height: 1, background: thunderPalette.accentL, display: 'inline-block' }} />
      {children}
    </div>
  );
}

const TRACE_STEPS = [
  { tag: 'Analyzing', label: 'Parsing user query', color: '#a78bfa' },
  { tag: 'Scraping',  label: 'Fetching espncricinfo.com', color: '#60a5fa' },
  { tag: 'Cleaning',  label: '320 match rows · 18 fields normalised', color: '#34d399' },
  { tag: 'EDA',       label: 'Top scorers · win-rate heatmap', color: '#fbbf24' },
  { tag: 'Coding',    label: 'Generating detective-theme HTML', color: '#f472b6' },
];

function AgentTrace() {
  return (
    <div style={{
      background: 'rgba(10,10,10,0.7)',
      border: `1px solid rgba(124,58,237,0.2)`,
      borderRadius: 6, padding: '10px 12px',
      fontFamily: "'Fira Code', 'Courier New', monospace",
      fontSize: 10, lineHeight: 1.6,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block', boxShadow: '0 0 6px #34d399' }} />
        <span style={{ color: '#888', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: thunderPalette.ffHead, fontWeight: 700 }}>Agent · Running</span>
      </div>

      {TRACE_STEPS.map((s, i) => {
        const isLast = i === TRACE_STEPS.length - 1;
        return (
          <div key={i} style={{ display: 'flex', gap: 0 }}>
            {/* Tree connector column */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16, flexShrink: 0 }}>
              <div style={{ width: 1, height: 10, background: 'rgba(124,58,237,0.3)', marginTop: i === 0 ? 4 : 0 }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0, boxShadow: `0 0 5px ${s.color}` }} />
              {!isLast && <div style={{ width: 1, flex: 1, background: 'rgba(124,58,237,0.3)', minHeight: 8 }} />}
            </div>
            {/* Content */}
            <div style={{ paddingLeft: 8, paddingBottom: isLast ? 0 : 6, paddingTop: 0 }}>
              <span style={{
                display: 'inline-block', padding: '1px 6px', borderRadius: 3,
                background: `${s.color}18`, border: `1px solid ${s.color}40`,
                color: s.color, fontSize: 9, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                fontFamily: thunderPalette.ffHead, marginRight: 6,
              }}>{s.tag}</span>
              <span style={{ color: '#c4c4c4', fontSize: 10 }}>{s.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FeatureCard({ icon, title, desc, delay }) {
  const [vis, setVis] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{
      padding: '24px', background: 'rgba(17,17,17,0.6)',
      border: `1px solid ${thunderPalette.line}`, borderRadius: 8,
      transition: `opacity 0.5s ${delay}ms ease, transform 0.5s ${delay}ms ease`,
      opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : 'translateY(20px)',
    }}>
      <div style={{ color: thunderPalette.accentL, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontFamily: thunderPalette.ffHead, fontWeight: 700, fontSize: 17, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: thunderPalette.ffBody, fontSize: 14, color: thunderPalette.mid, lineHeight: 1.65 }}>{desc}</div>
    </div>
  );
}
