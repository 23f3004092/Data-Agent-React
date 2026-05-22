import React, { useRef, useEffect, useState } from 'react';
import { thunderPalette } from '../theme/thunderTheme';
import { BoltIcon } from './NavBar';

const P = thunderPalette;

// Icon components
function FileIcon({ size = 18, color = P.mid }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  );
}

function CloseIcon({ size = 16, color = P.mid }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SendIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} strokeWidth="0">
      <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16346272 C3.34915502,0.9 2.40734225,0.9 1.77946707,1.4429026 C0.994623095,2.10604706 0.837654326,3.0486314 1.15159189,3.99021575 L3.03521743,10.4312088 C3.03521743,10.5883061 3.34915502,10.7454035 3.50612381,10.7454035 L16.6915026,11.5308905 C16.6915026,11.5308905 17.1624089,11.5308905 17.1624089,12.0041827 C17.1624089,12.4774748 16.6915026,12.4744748 16.6915026,12.4744748 Z" />
    </svg>
  );
}

function LightBulbIcon({ size = 18, color = P.mid }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function QueryInputPage({ onSubmit, loading = false, activeChat = null }) {
  const [input, setInput] = useState('');
  const [file, setFile] = useState(null);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() && !file) return;
    onSubmit({ prompt: input.trim(), file });
    setInput('');
    setFile(null);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!loading) handleSubmit(e);
    }
  };

  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '2rem',
      position: 'relative', overflowY: 'auto', zIndex: 2,
    }}>
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 700, textAlign: 'center' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: '1rem' }}>
            <BoltIcon size={40} />
          </div>
          <h1 style={{
            fontFamily: P.ffHead, fontWeight: 800, fontSize: 36,
            letterSpacing: '0.06em', color: P.white, marginBottom: '0.5rem',
            textTransform: 'uppercase',
          }}>
            Data Agent
          </h1>
          <p style={{
            fontFamily: P.ffBody, fontSize: 15, color: P.mid, lineHeight: 1.6,
          }}>
            {activeChat ? `Continue analyzing...` : `Upload data, ask questions, get insights.`}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{
          display: 'flex', flexDirection: 'column', gap: '1rem',
          background: 'rgba(17,17,17,0.8)',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${P.line}`,
          borderRadius: 12, padding: '2rem',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}>
          
          {/* File display */}
          {file && (
            <div style={{
              padding: '10px 12px', background: 'rgba(124,58,237,0.1)',
              border: `1px solid rgba(124,58,237,0.3)`, borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontFamily: P.ffBody, fontSize: 13, color: P.accentL,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileIcon size={16} color={P.accentL} />
                <span>{file.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                style={{
                  background: 'transparent', border: 'none', color: P.mid,
                  cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => e.target.style.color = '#f87171'}
                onMouseLeave={(e) => e.target.style.color = P.mid}
              >
                <CloseIcon size={14} color="currentColor" />
              </button>
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={onKeyDown}
            placeholder="Describe your analysis task... (Ctrl+Enter to send)"
            style={{
              width: '100%', minHeight: 80, maxHeight: 120,
              padding: '12px 14px', fontFamily: P.ffBody, fontSize: 14,
              background: 'rgba(245,244,240,0.04)',
              border: `1px solid ${focused ? P.accent : P.line}`,
              borderRadius: 6, color: P.white, resize: 'none',
              outline: 'none', caretColor: P.accent,
              transition: 'border-color 0.2s, box-shadow 0.2s',
              boxShadow: focused ? `0 0 0 3px rgba(124,58,237,0.15)` : 'none',
            }}
          />

          {/* File + Submit buttons */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <label style={{
              flex: 'none', cursor: 'pointer',
              padding: '10px 14px', background: 'rgba(124,58,237,0.08)',
              border: `1px solid rgba(124,58,237,0.25)`, borderRadius: 6,
              fontFamily: P.ffHead, fontSize: 12, fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: P.accentL, transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(45deg)' }}>
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              Attach
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                style={{ display: 'none' }}
                accept=".csv,.pdf,.json,.xlsx,.txt,.png,.jpg,.jpeg"
              />
            </label>

            <button
              type="submit"
              disabled={loading || (!input.trim() && !file)}
              style={{
                flex: 1, padding: '11px 16px',
                fontFamily: P.ffHead, fontWeight: 700, fontSize: 13,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                background: loading || (!input.trim() && !file) ? P.grey : P.accent,
                color: loading || (!input.trim() && !file) ? P.mid : P.white,
                border: 'none', borderRadius: 6, cursor: loading || (!input.trim() && !file) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid currentColor', borderTopColor: 'transparent',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  Analyzing...
                </>
              ) : (
                <>
                  <SendIcon size={14} color="currentColor" />
                  Start Analysis
                </>
              )}
            </button>
          </div>

        </form>

        {/* Footer hint */}
        <div style={{
          marginTop: '2.5rem', fontFamily: P.ffBody, fontSize: 13,
          color: P.mid, lineHeight: 1.6, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 8,
        }}>
          <LightBulbIcon size={16} color={P.mid} />
          <p style={{ margin: 0 }}>
            <strong>Tip:</strong> Upload CSVs, PDFs, images, or describe a URL to analyze
          </p>
        </div>
      </div>
    </div>
  );
}
