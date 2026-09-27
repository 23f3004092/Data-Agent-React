import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { vb } from '../theme/voiceBox';

const FEATURES = [
  {
    title: 'Live Data Analysis',
    desc: 'Upload CSVs, PDFs, images or scrape any URL — the agent analyses, cleans, and surfaces insights instantly.',
  },
  {
    title: 'Data Storytelling',
    desc: 'Generates cinematic, animated HTML data stories with Plotly charts, pull-quotes, and detective-style narratives.',
  },
  {
    title: 'Multi-turn Memory',
    desc: 'Every session stores the full conversation. Pick up where you left off — the agent remembers context across messages.',
  },
  {
    title: 'Sandpack Studio',
    desc: 'Preview and edit the generated HTML live in-browser using Sandpack — no downloads, no copy-paste.',
  },
  {
    title: 'Isolated File Sandboxing',
    desc: 'Each chat gets its own upload directory. Uploaded files are scoped to their session — no cross-contamination.',
  },
  {
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
    <div style={{ minHeight: '100vh', overflowY: 'auto', overflowX: 'hidden', background: vb.bg, color: vb.textPrimary, fontFamily: vb.ffBody }}>

      {/* NAV */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 40px',
        background: vb.white,
        borderBottom: `2px solid ${vb.black}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z" fill={vb.red} stroke={vb.red} strokeWidth="0.5" strokeLinejoin="round" />
          </svg>
          <span style={{ fontFamily: vb.ffDisplay, fontSize: 22, fontWeight: 400, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
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

      {/* HERO */}
      <section style={{
        position: 'relative', zIndex: 2,
        minHeight: '90vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '80px 24px 60px', textAlign: 'center',
      }}>
        <h1 ref={heroRef} style={{
          fontFamily: vb.ffDisplay,
          fontWeight: 400,
          fontSize: 'clamp(3rem, 8vw, 7rem)',
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
          textTransform: 'uppercase',
          maxWidth: 900, marginBottom: '1.5rem',
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.7s 0.1s ease',
        }}>
          Your AI<br />
          <span style={{ color: vb.red }}>Data Detective</span>
        </h1>

        <p style={{
          fontFamily: vb.ffBody, fontWeight: 400,
          fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
          color: vb.textSecondary, maxWidth: 580, lineHeight: 1.65,
          marginBottom: '2.5rem',
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.7s 0.2s ease',
        }}>
          Scrape the web, analyse files, and generate stunning interactive data stories — all through a single chat interface.
        </p>

        <div style={{
          display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center',
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.7s 0.3s ease',
        }}>
          <button onClick={handleCTA} style={{ ...btnStyle('filled'), fontSize: 14, padding: '14px 32px' }}>
            Start Analysing Free →
          </button>
          <button onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })} style={{ ...btnStyle('secondary'), fontSize: 14, padding: '14px 32px' }}>
            See How It Works
          </button>
        </div>

        {/* Hero visual — mock window */}
        <div style={{
          marginTop: '4rem', width: '100%', maxWidth: 900,
          background: vb.white,
          border: `2px solid ${vb.black}`,
          overflow: 'hidden',
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? 'translateY(0)' : 'translateY(40px)',
          transition: 'all 0.9s 0.4s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderBottom: `2px solid ${vb.borderSubtle}` }}>
            {['#ff5f57', '#febc2e', '#28c840'].map(c => (
              <span key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c, display: 'inline-block' }} />
            ))}
            <span style={{ marginLeft: 12, fontFamily: vb.ffBody, fontSize: 12, color: vb.textSecondary }}>data-agent · studio</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1.6fr', height: 340 }}>
            {/* Sidebar */}
            <div style={{ borderRight: `2px solid ${vb.borderSubtle}`, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontFamily: vb.ffBody, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: vb.textTertiary, padding: '4px 6px', marginBottom: 4 }}>Sessions</div>
              {['IPL 2024 Analysis', 'Global GDP Story', 'Stock Scrape'].map((t, i) => (
                <div key={t} style={{ padding: '8px 10px', fontSize: 12, fontFamily: vb.ffBody, color: i === 0 ? vb.black : vb.textSecondary, background: i === 0 ? vb.surface : 'transparent', borderLeft: `3px solid ${i === 0 ? vb.red : 'transparent'}` }}>{t}</div>
              ))}
            </div>
            {/* Chat */}
            <div style={{ borderRight: `2px solid ${vb.borderSubtle}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'hidden' }}>
              <div style={{ fontFamily: vb.ffBody, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: vb.textTertiary, marginBottom: 4 }}>Chat</div>
              <div style={{ padding: '8px 10px', fontSize: 11, lineHeight: 1.5, fontFamily: vb.ffBody, background: vb.black, color: vb.white, alignSelf: 'flex-end', maxWidth: '90%' }}>
                Scrape IPL 2024 stats and generate a data story
              </div>
              <AgentTrace />
            </div>
            {/* Preview */}
            <div style={{ background: vb.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', border: `3px solid ${vb.borderSubtle}`, borderTopColor: vb.red, animation: 'spin 1.1s linear infinite' }} />
              <span style={{ fontFamily: vb.ffBody, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: vb.textSecondary }}>Rendering Story…</span>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ position: 'relative', zIndex: 2, padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <SectionLabel>Capabilities</SectionLabel>
        <h2 style={{ fontFamily: vb.ffDisplay, fontWeight: 400, fontSize: 'clamp(2rem, 4vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: '3rem', maxWidth: 600, lineHeight: 1.1 }}>
          Everything the agent can do
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {FEATURES.map((f, i) => (
            <FeatureCard key={i} title={f.title} desc={f.desc} delay={i * 60} />
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{ position: 'relative', zIndex: 2, padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <SectionLabel>Process</SectionLabel>
        <h2 style={{ fontFamily: vb.ffDisplay, fontWeight: 400, fontSize: 'clamp(2rem, 4vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: '3rem', maxWidth: 600, lineHeight: 1.1 }}>
          How it works
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {HOW.map((h, i) => (
            <div key={i} style={{ padding: '28px 24px', background: vb.white, border: `2px solid ${vb.borderSubtle}`, position: 'relative', overflow: 'hidden' }}>
              <span style={{ fontFamily: vb.ffDisplay, fontWeight: 400, fontSize: 56, color: vb.surfaceRaised, position: 'absolute', top: 8, right: 16, lineHeight: 1 }}>{h.step}</span>
              <div style={{ fontFamily: vb.ffBody, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: vb.red, marginBottom: 12 }}>Step {h.step}</div>
              <div style={{ fontFamily: vb.ffBody, fontSize: 20, fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{h.title}</div>
              <div style={{ fontFamily: vb.ffBody, fontSize: 14, color: vb.textSecondary, lineHeight: 1.65 }}>{h.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA BAND */}
      <section style={{
        position: 'relative', zIndex: 2, margin: '40px 24px 80px',
        padding: '60px 40px',
        background: vb.black,
        border: `2px solid ${vb.black}`,
        textAlign: 'center',
        maxWidth: 860, marginLeft: 'auto', marginRight: 'auto',
      }}>
        <h2 style={{ fontFamily: vb.ffDisplay, fontWeight: 400, fontSize: 'clamp(2rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '-0.02em', color: vb.white, marginBottom: '1rem', lineHeight: 1.1 }}>
          Ready to investigate<br />your data?
        </h2>
        <p style={{ fontFamily: vb.ffBody, fontSize: 16, color: vb.textTertiary, marginBottom: '2rem', lineHeight: 1.65 }}>
          Free to use. No setup. Just describe what you want — the agent handles the rest.
        </p>
        <button onClick={handleCTA} style={{ ...btnStyle('filled'), fontSize: 14, padding: '14px 40px', background: vb.red, borderColor: vb.red }}>
          {user ? 'Open Studio →' : 'Get Started Free →'}
        </button>
      </section>

      {/* FOOTER */}
      <footer style={{ position: 'relative', zIndex: 2, borderTop: `2px solid ${vb.black}`, padding: '28px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z" fill={vb.red} stroke={vb.red} strokeWidth="0.5" strokeLinejoin="round" />
          </svg>
          <span style={{ fontFamily: vb.ffDisplay, fontSize: 15, fontWeight: 400, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>Data Agent</span>
        </div>
        <span style={{ fontFamily: vb.ffBody, fontSize: 12, color: vb.textSecondary }}>Built with FastAPI · SQLite · LangChain · React</span>
      </footer>
    </div>
  );
}

function btnStyle(variant) {
  const base = {
    fontFamily: vb.ffBody, fontWeight: 700, fontSize: 13,
    letterSpacing: '0.06em', textTransform: 'uppercase',
    borderRadius: 0, padding: '8px 20px', cursor: 'pointer',
    transition: 'all 0.15s',
  };
  if (variant === 'filled') return { ...base, background: vb.black, color: vb.white, border: `2px solid ${vb.black}` };
  if (variant === 'secondary') return { ...base, background: 'transparent', color: vb.black, border: `2px solid ${vb.black}` };
  return { ...base, background: 'transparent', color: vb.black, border: 'none' };
}

function SectionLabel({ children }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      fontFamily: vb.ffBody, fontWeight: 700, fontSize: 11,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      color: vb.red, marginBottom: '1rem',
    }}>
      <span style={{ width: 20, height: 2, background: vb.red, display: 'inline-block' }} />
      {children}
    </div>
  );
}

const TRACE_STEPS = [
  { tag: 'Analyzing', label: 'Parsing user query', color: vb.red },
  { tag: 'Scraping', label: 'Fetching espncricinfo.com', color: vb.black },
  { tag: 'Cleaning', label: '320 match rows · 18 fields normalised', color: vb.textSecondary },
  { tag: 'EDA', label: 'Top scorers · win-rate heatmap', color: vb.red },
  { tag: 'Coding', label: 'Generating detective-theme HTML', color: vb.black },
];

function AgentTrace() {
  return (
    <div style={{
      background: vb.surface,
      border: `2px solid ${vb.borderSubtle}`,
      padding: '10px 12px',
      fontFamily: vb.ffMono,
      fontSize: 10, lineHeight: 1.6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${vb.borderSubtle}` }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: vb.success, display: 'inline-block' }} />
        <span style={{ color: vb.textSecondary, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: vb.ffBody, fontWeight: 700 }}>Agent · Running</span>
      </div>

      {TRACE_STEPS.map((s, i) => {
        const isLast = i === TRACE_STEPS.length - 1;
        return (
          <div key={i} style={{ display: 'flex', gap: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16, flexShrink: 0 }}>
              <div style={{ width: 1, height: 10, background: vb.borderSubtle, marginTop: i === 0 ? 4 : 0 }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              {!isLast && <div style={{ width: 1, flex: 1, background: vb.borderSubtle, minHeight: 8 }} />}
            </div>
            <div style={{ paddingLeft: 8, paddingBottom: isLast ? 0 : 6, paddingTop: 0 }}>
              <span style={{
                display: 'inline-block', padding: '1px 6px',
                background: `${vb.white}`, border: `1px solid ${vb.borderSubtle}`,
                color: s.color, fontSize: 9, fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                fontFamily: vb.ffBody, marginRight: 6,
              }}>{s.tag}</span>
              <span style={{ color: vb.textSecondary, fontSize: 10 }}>{s.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FeatureCard({ title, desc, delay }) {
  const [vis, setVis] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true); }, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} style={{
      padding: '24px', background: vb.white,
      border: `2px solid ${vis ? vb.black : vb.borderSubtle}`,
      transition: `opacity 0.5s ${delay}ms ease, transform 0.5s ${delay}ms ease, border-color 0.3s ease`,
      opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : 'translateY(20px)',
    }}>
      <div style={{ color: vb.red, marginBottom: 14 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </div>
      <div style={{ fontFamily: vb.ffBody, fontSize: 17, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: vb.ffBody, fontSize: 14, color: vb.textSecondary, lineHeight: 1.65 }}>{desc}</div>
    </div>
  );
}
