import React, { useRef, useEffect, useState } from 'react';
import { vb } from '../theme/voiceBox';
import { BoltIcon } from './NavBar';

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
      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 700, textAlign: 'center' }}>

        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: '1rem' }}>
            <BoltIcon size={40} />
          </div>
          <h1 style={{
            fontFamily: vb.ffDisplay,
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            color: vb.black,
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            lineHeight: 1.05,
          }}>
            Data Agent
          </h1>
          <p style={{
            fontFamily: vb.ffBody,
            fontSize: 16,
            fontWeight: 400,
            color: vb.textSecondary,
            lineHeight: 1.65,
          }}>
            {activeChat ? 'Continue analyzing…' : 'Upload data, ask questions, get insights.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{
          display: 'flex', flexDirection: 'column', gap: '1rem',
          background: vb.white,
          border: `2px solid ${vb.black}`,
          padding: '2rem',
        }}>
          {file && (
            <div style={{
              padding: '10px 14px',
              background: vb.surface,
              border: `2px solid ${vb.borderSubtle}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontFamily: vb.ffBody, fontSize: 14, color: vb.textPrimary,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                  <polyline points="13 2 13 9 20 9" />
                </svg>
                <span>{file.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                style={{
                  background: 'none', border: 'none', color: vb.textTertiary,
                  cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={onKeyDown}
            placeholder="Describe your analysis task… (Ctrl+Enter to send)"
            style={{
              width: '100%', minHeight: 80, maxHeight: 120,
              padding: '12px 14px', fontFamily: vb.ffBody, fontSize: 14,
              fontWeight: 400,
              background: vb.white,
              border: `2px solid ${focused ? vb.black : vb.borderMedium}`,
              color: vb.textPrimary,
              borderRadius: 0,
              outline: 'none',
              resize: 'none',
              lineHeight: 1.65,
              transition: 'border-color 0.15s',
            }}
          />

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                flex: 'none',
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 14px',
                fontFamily: vb.ffBody, fontSize: 12, fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                background: 'transparent',
                border: `2px solid ${vb.black}`,
                color: vb.black,
                borderRadius: 0,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.target.style.background = vb.black; e.target.style.color = vb.white; }}
              onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = vb.black; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(45deg)' }}>
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              Attach
              <input
                ref={fileInputRef}
                type="file"
                onChange={e => setFile(e.target.files?.[0] || null)}
                style={{ display: 'none' }}
                accept=".csv,.pdf,.json,.xlsx,.txt,.png,.jpg,.jpeg"
              />
            </button>

            <button
              type="submit"
              disabled={loading || (!input.trim() && !file)}
              style={{
                flex: 1,
                padding: '11px 16px',
                fontFamily: vb.ffBody, fontSize: 13, fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                background: (input.trim() || file) && !loading ? vb.black : vb.surfaceRaised,
                color: (input.trim() || file) && !loading ? vb.white : vb.textTertiary,
                border: `2px solid ${(input.trim() || file) && !loading ? vb.black : vb.borderMedium}`,
                borderRadius: 0,
                cursor: (input.trim() || file) && !loading ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
              onMouseEnter={e => {
                if ((input.trim() || file) && !loading) {
                  e.target.style.background = vb.red;
                  e.target.style.borderColor = vb.red;
                }
              }}
              onMouseLeave={e => {
                if ((input.trim() || file) && !loading) {
                  e.target.style.background = vb.black;
                  e.target.style.borderColor = vb.black;
                }
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid currentColor', borderTopColor: 'transparent',
                    animation: 'spin 0.7s linear infinite', display: 'inline-block',
                  }} />
                  Analyzing…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16346272 C3.34915502,0.9 2.40734225,0.9 1.77946707,1.4429026 C0.994623095,2.10604706 0.837654326,3.0486314 1.15159189,3.99021575 L3.03521743,10.4312088 C3.03521743,10.5883061 3.34915502,10.7454035 3.50612381,10.7454035 L16.6915026,11.5308905 C16.6915026,11.5308905 17.1624089,11.5308905 17.1624089,12.0041827 C17.1624089,12.4774748 16.6915026,12.4744748 16.6915026,12.4744748 Z" />
                  </svg>
                  Start Analysis
                </>
              )}
            </button>
          </div>
        </form>

        <div style={{
          marginTop: '2rem',
          fontFamily: vb.ffBody, fontSize: 13,
          color: vb.textTertiary, lineHeight: 1.6,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <p style={{ margin: 0 }}>
            <strong style={{ color: vb.textSecondary }}>Tip:</strong> Upload CSVs, PDFs, images, or describe a URL to analyze
          </p>
        </div>
      </div>
    </div>
  );
}
