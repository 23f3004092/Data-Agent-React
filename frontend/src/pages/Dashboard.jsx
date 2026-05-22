import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { SandpackProvider, SandpackLayout, SandpackCodeEditor, SandpackPreview } from '@codesandbox/sandpack-react';
import { apiFetch, getAccessToken } from '../api/client';
import { useAuth } from '../context/AuthContext';
import NavBar, { BoltIcon } from '../components/NavBar';
import QueryInputPage from '../components/QueryInputPage';
import { thunderPalette } from '../theme/thunderTheme';

const panelStyle = {
  display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0,
  height: '100%', background: '#111',
  border: `1px solid ${thunderPalette.line}`,
  borderRadius: 6, overflow: 'hidden',
};

const panelHeaderStyle = {
  flexShrink: 0, display: 'flex', alignItems: 'center',
  justifyContent: 'space-between', padding: '10px 14px',
  borderBottom: `1px solid ${thunderPalette.line}`,
  fontFamily: thunderPalette.ffHead, fontSize: 11, fontWeight: 700,
  letterSpacing: '0.12em', textTransform: 'uppercase', color: thunderPalette.mid,
};

const buildingFiles = {
  '/index.html': `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Awaiting Analysis</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Inter, system-ui, sans-serif; background: #050816; color: white; height: 100vh; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    .build-screen { position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
      background: radial-gradient(circle at top left, rgba(124,58,237,0.14), transparent 30%), radial-gradient(circle at bottom right, rgba(99,102,241,0.1), transparent 35%), #050816; }
    .background-glow { position:absolute; border-radius:999px; filter:blur(120px); opacity:0.4; }
    .glow-1 { width:320px; height:320px; background:#7c3aed; top:-80px; left:-60px; }
    .glow-2 { width:280px; height:280px; background:#6366f1; bottom:-100px; right:-60px; }
    .build-card { position:relative; z-index:2; width:92%; max-width:480px; padding:3.5rem 2.5rem;
      border-radius:16px; background:rgba(15,23,42,0.72); backdrop-filter:blur(24px);
      border:1px solid rgba(255,255,255,0.08); text-align:center; }
    .loader-ring { width:80px; height:80px; margin:0 auto 2rem; border-radius:50%;
      border:3px solid rgba(255,255,255,0.08); border-top-color:#7c3aed; border-right-color:#a78bfa;
      display:flex; align-items:center; justify-content:center; animation:spin 1.1s linear infinite; }
    .loader-core { width:44px; height:44px; border-radius:50%; background:radial-gradient(circle,#7c3aed,#5b21b6); box-shadow:0 0 25px rgba(124,58,237,0.5); }
    .build-card h1 { font-size:1.9rem; font-weight:700; margin-bottom:0.75rem; letter-spacing:-0.02em; }
    .build-card p { color:#94a3b8; font-size:0.95rem; line-height:1.7; margin-bottom:2rem; }
    .progress-bar { width:100%; height:8px; background:rgba(255,255,255,0.08); border-radius:999px; overflow:hidden; }
    .progress-fill { width:40%; height:100%; border-radius:inherit; background:linear-gradient(to right,#7c3aed,#a78bfa); animation:loading 1.8s ease-in-out infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    @keyframes loading { 0%{transform:translateX(-120%);width:35%} 50%{width:55%} 100%{transform:translateX(320%);width:35%} }
  </style>
</head>
<body>
  <div class="build-screen">
    <div class="background-glow glow-1"></div>
    <div class="background-glow glow-2"></div>
    <div class="build-card">
      <div class="loader-ring"><div class="loader-core"></div></div>
      <h1>Awaiting Analysis</h1>
      <p>Send a message to the agent to begin generating your data story.</p>
      <div class="progress-bar"><div class="progress-fill"></div></div>
    </div>
  </div>
</body>
</html>`,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { chatId: chatIdParam } = useParams();
  const { user, logout } = useAuth();

  // Chat list
  const [chats, setChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Derive activeChat from URL param
  const activeChat = chats.find(c => String(c.id) === String(chatIdParam)) || null;

  // Chat messages
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);

  // Sandpack
  const [sandpackFiles, setSandpackFiles] = useState(buildingFiles);
  const [selectedFile, setSelectedFile] = useState('/index.html');
  const [activeTab, setActiveTab] = useState('preview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sandpackWidth, setSandpackWidth] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  // Live trace
  const [traceSteps, setTraceSteps] = useState([]);

  // Pending submission when navigating from landing page
  const [pendingSubmission, setPendingSubmission] = useState(null);

  // Fullscreen preview mode state
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const padding = 24; // 12px left + 12px right padding
      const sidebarWidth = sidebarOpen ? 260 : 48;
      const spacing = 12 + 16; // gap after sidebar (12) + resizer width (16)
      const maxAllowedWidth = containerRect.width - padding - sidebarWidth - spacing;
      
      const containerRight = containerRect.right - 12; // minus container padding
      const rawSandpackWidth = containerRight - e.clientX;
      
      const minWidth = 250;
      const maxWidth = maxAllowedWidth - 250; // leave at least 250px for Chat Panel
      
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, rawSandpackWidth));
      setSandpackWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, sidebarOpen]);

  // Load chat list on mount
  useEffect(() => {
    fetchChats();
  }, []);

  // Redirect invalid chatIds to dashboard
  useEffect(() => {
    if (!loadingChats && chatIdParam) {
      const exists = chats.some(c => String(c.id) === String(chatIdParam));
      if (!exists) {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [loadingChats, chatIdParam, chats, navigate]);

  // When URL chatId changes — reset everything and load that chat
  useEffect(() => {
    if (chatIdParam) {
      setSandpackFiles(buildingFiles);
      setMessages([]);
      setTraceSteps([]);
      setActiveTab('preview');
      fetchMessages(Number(chatIdParam));
    } else {
      // /dashboard with no id — clear everything
      setSandpackFiles(buildingFiles);
      setMessages([]);
      setLoadingMessages(false);
    }
  }, [chatIdParam]);

  // Process pending submission once chat is ready
  useEffect(() => {
    if (pendingSubmission && activeChat && messages.length === 0) {
      const submitData = pendingSubmission;
      setPendingSubmission(null);
      // Trigger the send with the pending data
      const e = { preventDefault: () => {} };
      handleSend(e, submitData);
    }
  }, [pendingSubmission, activeChat, messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const fetchChats = async () => {
    try {
      setLoadingChats(true);
      const res = await apiFetch('/chats');
      if (res.status === 401) { logout(); navigate('/login'); return; }
      const data = await res.json();
      const sorted = Array.isArray(data) ? data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) : [];
      setChats(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingChats(false);
    }
  };

  const fetchMessages = async (chatId) => {
    try {
      setLoadingMessages(true);
      const res = await apiFetch(`/chats/${chatId}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data);

      // Restore the last generated HTML for THIS chat only
      const lastHtml = [...data]
        .reverse()
        .filter(m => m.role === 'assistant')
        .map(m => { try { return JSON.parse(m.content); } catch { return {}; } })
        .find(p => p.html_code);

      if (lastHtml) {
        setSandpackFiles(buildSandpackFiles(lastHtml.html_code, lastHtml.files_data));
      }
      // If no HTML in this chat, buildingFiles stays (set above in useEffect)
    } catch (e) { console.error(e); } finally {
      setLoadingMessages(false);
    }
  };

  const buildSandpackFiles = (htmlCode, filesData = {}) => {
    const files = {
      '/index.html': htmlCode || '',
    };
    if (filesData) {
      Object.entries(filesData).forEach(([filename, content]) => {
        const cleanName = filename.startsWith('/') ? filename : `/${filename}`;
        files[cleanName] = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      });
    }
    return files;
  };

  const createNewChat = () => {
    // Prevent creating a new chat if we are already on an empty chat (no messages or no chatIdParam)
    if (!chatIdParam || messages.length === 0) {
      return;
    }
    navigate('/dashboard');
  };

  const handleSend = async (e, submitData = null) => {
    if (submitData) {
      // Called from QueryInputPage
      e = { preventDefault: () => {} };
      e.preventDefault();
      const { prompt, file: uploadedFile } = submitData;
      if (!prompt.trim() && !uploadedFile) return;
      if (!activeChat) return;
      
      setLoading(true);
      setTraceSteps([]);

      try {
        let finalPrompt = prompt.trim();
        
        if (uploadedFile) {
          const fd = new FormData();
          fd.append('file', uploadedFile);
          await fetch(`http://localhost:8000/chats/${activeChat.id}/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${getAccessToken()}` },
            body: fd,
          });
          finalPrompt = `I have uploaded a file named: ${uploadedFile.name}. ${prompt}`;
        }

        // Continue with streaming...
        const tempId = Date.now();
        const tempMsg = { id: tempId, role: 'user', content: JSON.stringify({ text: finalPrompt }), created_at: new Date().toISOString() };
        setMessages(prev => [...prev, tempMsg]);

        const res = await fetch(`http://localhost:8000/chats/${activeChat.id}/message/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({ content: finalPrompt }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`Server error: ${res.status}`);
        }

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let   buffer  = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split('\n\n');
          buffer = parts.pop();

          for (const part of parts) {
            for (const line of part.split('\n')) {
              if (!line.startsWith('data: ')) continue;
              let event;
              try { event = JSON.parse(line.slice(6)); } catch { continue; }

              if (event.type === 'trace') {
                setTraceSteps(prev => [...prev, { tag: event.tag, label: event.label, color: event.color }]);
              } else if (event.type === 'done') {
                const assistantMsg = event.message;
                setMessages(prev => [
                  ...prev.filter(m => m.id !== tempId),
                  tempMsg,
                  assistantMsg,
                ]);
                try {
                  const parsed = JSON.parse(assistantMsg.content);
                  if (parsed.html_code) {
                    setSandpackFiles(buildSandpackFiles(parsed.html_code, parsed.files_data));
                    setActiveTab('preview');
                  }
                } catch { /* no html */ }
              }
            }
          }
        }
      } catch (err) {
        console.error('Stream error:', err);
      } finally {
        setLoading(false);
        setTraceSteps([]);
      }
    } else {
      // Original logic for regular send
      e.preventDefault();
      if (!input.trim() && !file) return;
      if (!activeChat) return;
      setLoading(true);
      setTraceSteps([]);

      let prompt = input.trim();
      setInput('');

      try {
        // Upload file first if present
        if (file) {
          const fd = new FormData();
          fd.append('file', file);
          await fetch(`http://localhost:8000/chats/${activeChat.id}/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${getAccessToken()}` },
            body: fd,
          });
          prompt = `I have uploaded a file named: ${file.name}. ${prompt}`;
          setFile(null);
        }

        // Optimistic user message bubble
        const tempId = Date.now();
        const tempMsg = { id: tempId, role: 'user', content: JSON.stringify({ text: prompt }), created_at: new Date().toISOString() };
        setMessages(prev => [...prev, tempMsg]);

        // --- Streaming fetch ---
        const res = await fetch(`http://localhost:8000/chats/${activeChat.id}/message/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({ content: prompt }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`Server error: ${res.status}`);
        }

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let   buffer  = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE lines are separated by double newlines
          const parts = buffer.split('\n\n');
          buffer = parts.pop(); // keep incomplete last chunk

          for (const part of parts) {
            for (const line of part.split('\n')) {
              if (!line.startsWith('data: ')) continue;
              let event;
              try { event = JSON.parse(line.slice(6)); } catch { continue; }

              if (event.type === 'trace') {
                setTraceSteps(prev => [...prev, { tag: event.tag, label: event.label, color: event.color }]);
              } else if (event.type === 'done') {
                const assistantMsg = event.message;
                setMessages(prev => [
                  ...prev.filter(m => m.id !== tempId),
                  tempMsg,
                  assistantMsg,
                ]);
                // Update Sandpack if HTML was generated
                try {
                  const parsed = JSON.parse(assistantMsg.content);
                  if (parsed.html_code) {
                    setSandpackFiles(buildSandpackFiles(parsed.html_code, parsed.files_data));
                    setActiveTab('preview');
                  }
                } catch { /* no html */ }
              }
            }
          }
        }
      } catch (err) {
        console.error('Stream error:', err);
      } finally {
        setLoading(false);
        setTraceSteps([]);
      }
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!loading) handleSend(e);
    }
  };

  const handleLogout = () => { logout(); navigate('/'); };

  const sandpackKey = useMemo(() => JSON.stringify(Object.keys(sandpackFiles)), [sandpackFiles]);

  // (Sidebar and navbar remain visible at all times; empty state is rendered inside the workspace area)

  return (
    <>
      {isDragging && (
        <div style={{
          position: 'fixed',
          inset: 0,
          cursor: 'col-resize',
          zIndex: 9999,
          background: 'transparent',
        }} />
      )}
      {/* Grid bg */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `linear-gradient(${thunderPalette.line} 1px, transparent 1px), linear-gradient(90deg, ${thunderPalette.line} 1px, transparent 1px)`,
        backgroundSize: '64px 64px', animation: 'gridFade 1.2s ease both',
      }} />
      <div style={{
        position: 'fixed', top: -120, left: -80, width: 480, height: 480,
        background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 2, height: '100vh', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Nav */}
        <nav style={{
          flexShrink: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '12px 20px',
          borderBottom: `1px solid ${thunderPalette.line}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BoltIcon size={24} />
            <span style={{ fontFamily: thunderPalette.ffHead, fontWeight: 800, fontSize: 20, letterSpacing: '0.06em', textTransform: 'uppercase', color: thunderPalette.white }}>
              Data Agent
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {user && (
              <span style={{ fontFamily: thunderPalette.ffHead, fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: thunderPalette.mid }}>
                {user.username}
              </span>
            )}
            <button onClick={handleLogout} style={{
              fontFamily: thunderPalette.ffHead, fontWeight: 700, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
              background: 'transparent', border: `1px solid rgba(124,58,237,0.4)`, color: thunderPalette.accent,
              borderRadius: 4, padding: '6px 14px', cursor: 'pointer',
            }}>Logout</button>
          </div>
        </nav>

        {/* Workspace */}
        <div 
          ref={containerRef}
          style={{
            flex: 1, minHeight: 0, display: 'flex',
            flexDirection: 'row', padding: 12, overflow: 'hidden',
            height: 'calc(100vh - 57px)',
            position: 'relative',
          }}
        >

          {/* Sidebar — Chat list */}
          <aside style={{ 
            ...panelStyle, 
            width: sidebarOpen ? '260px' : '48px', 
            marginRight: 12,
            transition: 'width 0.25s ease', 
            overflow: 'hidden',
            flexShrink: 0
          }}>
            {/* Header with collapse toggle */}
            <div style={{ ...panelHeaderStyle, cursor: 'pointer', userSelect: 'none', justifyContent: 'space-between' }}
              onClick={() => setSidebarOpen(o => !o)}
            >
              {sidebarOpen
                ? <span style={{ color: thunderPalette.accentL }}>Sessions</span>
                : null
              }
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={thunderPalette.accentL} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{
                  flexShrink: 0,
                  transform: sidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)',
                  transition: 'transform 0.25s ease',
                  margin: sidebarOpen ? '0' : '0 auto',
                }}
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </div>

            {/* Content — hidden when collapsed */}
            {sidebarOpen && (
              <>
                <div style={{ padding: '10px 8px' }}>
                  <button
                    onClick={createNewChat}
                    style={{
                      width: '100%', padding: '9px 0', background: 'rgba(124,58,237,0.12)',
                      border: `1px solid rgba(124,58,237,0.3)`, borderRadius: 4, cursor: 'pointer',
                      fontFamily: thunderPalette.ffHead, fontWeight: 700, fontSize: 12,
                      letterSpacing: '0.1em', textTransform: 'uppercase', color: thunderPalette.accentL,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'background 0.2s',
                    }}
                  >
                    + New Analysis
                  </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 8px 8px' }}>
                  {chats.map(chat => (
                    <button
                      key={chat.id}
                      onClick={() => navigate(`/dashboard/${chat.id}`)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '10px 12px',
                        background: String(chat.id) === String(chatIdParam) ? 'rgba(124,58,237,0.12)' : 'transparent',
                        border: `1px solid ${String(chat.id) === String(chatIdParam) ? 'rgba(124,58,237,0.3)' : 'transparent'}`,
                        borderRadius: 4, cursor: 'pointer',
                        fontFamily: thunderPalette.ffBody, fontSize: 13,
                        color: String(chat.id) === String(chatIdParam) ? thunderPalette.white : thunderPalette.mid,
                        borderLeft: String(chat.id) === String(chatIdParam) ? `2px solid ${thunderPalette.accent}` : '2px solid transparent',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        transition: 'all 0.15s',
                      }}
                    >
                      {chat.title}
                    </button>
                  ))}
                  {chats.length === 0 && (
                    <p style={{ fontFamily: thunderPalette.ffBody, fontSize: 12, color: thunderPalette.mid, padding: '8px 4px', lineHeight: 1.6 }}>
                      No sessions yet. Click "New Analysis" to start.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* When collapsed — show a + button to quickly create new chat */}
            {!sidebarOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '10px 0' }}>
                <button
                  onClick={createNewChat}
                  title="New Analysis"
                  style={{
                    width: 32, height: 32, borderRadius: 4, cursor: 'pointer',
                    background: 'rgba(124,58,237,0.12)', border: `1px solid rgba(124,58,237,0.3)`,
                    color: thunderPalette.accentL, fontSize: 18, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >+</button>
              </div>
            )}
          </aside>

          {/* Main Content Area: loading state, empty state (QueryInputPage) or active chat panels */}
          {(loadingChats || (chatIdParam && loadingMessages && !pendingSubmission)) ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: '#111', borderRadius: 6, border: `1px solid ${thunderPalette.line}`, height: '100%'
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                border: `3px solid rgba(255,255,255,0.06)`, borderTopColor: thunderPalette.accent,
                animation: 'spin 1.1s linear infinite', marginBottom: 16
              }} />
              <span style={{ fontFamily: thunderPalette.ffHead, fontSize: 13, color: thunderPalette.mid, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Loading Session...
              </span>
            </div>
          ) : (!chatIdParam || (activeChat && messages.length === 0 && !pendingSubmission)) ? (
            <QueryInputPage
              onSubmit={async (data) => {
                if (!chatIdParam) {
                  try {
                    const res = await apiFetch('/chats', {
                      method: 'POST',
                      body: JSON.stringify({ title: `Analysis ${chats.length + 1}` }),
                    });
                    if (!res.ok) return;
                    const newChat = await res.json();
                    setChats(prev => [newChat, ...prev]);
                    setPendingSubmission(data);
                    navigate(`/dashboard/${newChat.id}`, { replace: true });
                  } catch (e) { console.error(e); }
                } else {
                  handleSend(null, data);
                }
              }}
              loading={loading}
              activeChat={activeChat}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'row', flex: 1, minWidth: 0, height: '100%' }}>
                {/* Chat Panel */}
              <div style={{ ...panelStyle, flex: 1, minWidth: 250 }}>
                <div style={panelHeaderStyle}>
                  <span style={{ color: thunderPalette.accentL }}>Chat</span>
                  {activeChat && <span style={{ fontSize: 10, color: thunderPalette.mid }}>{activeChat.title}</span>}
                </div>

                {/* Messages */}
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {!activeChat && (
                    <p style={{ fontFamily: thunderPalette.ffBody, fontSize: 13, color: thunderPalette.mid, lineHeight: 1.6 }}>
                      Select or create a session to begin.
                    </p>
                  )}
                  {messages.map((msg, i) => {
                    let displayText = msg.content;
                    try {
                      const parsed = JSON.parse(msg.content);
                      displayText = parsed.text || parsed.simple_response || msg.content;
                    } catch {}
                    return (
                      <div
                        key={i}
                        style={{
                          alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                          maxWidth: '92%',
                          padding: '10px 12px',
                          borderRadius: 6,
                          fontFamily: thunderPalette.ffBody,
                          fontSize: 13, lineHeight: 1.55,
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          background: msg.role === 'user' ? 'rgba(124,58,237,0.12)' : 'rgba(245,244,240,0.06)',
                          border: `1px solid ${msg.role === 'user' ? 'rgba(124,58,237,0.25)' : 'rgba(245,244,240,0.08)'}`,
                          color: thunderPalette.white,
                          animation: 'fadeIn 0.3s ease',
                        }}
                      >
                        <span style={{ fontFamily: thunderPalette.ffHead, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: msg.role === 'user' ? thunderPalette.accentL : thunderPalette.mid, display: 'block', marginBottom: 4 }}>
                          {msg.role === 'user' ? 'You' : 'Agent'}
                        </span>
                        {displayText}
                      </div>
                    );
                  })}
                  {loading && traceSteps.length === 0 && (
                    <div style={{
                      alignSelf: 'flex-start', padding: '10px 14px',
                      borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8,
                      border: `1px dashed rgba(124,58,237,0.35)`,
                      background: 'rgba(124,58,237,0.04)',
                      fontFamily: thunderPalette.ffBody, fontSize: 12, color: thunderPalette.mid,
                    }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid rgba(124,58,237,0.4)`, borderTopColor: thunderPalette.accent, animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                      Connecting to agent…
                    </div>
                  )}
                  {loading && traceSteps.length > 0 && (
                    <LiveTraceLog steps={traceSteps} />
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                {activeChat && (
                  <div style={{ flexShrink: 0, padding: '10px 12px 12px', borderTop: `1px solid ${thunderPalette.line}` }}>
                    {file && (
                      <div style={{ fontFamily: thunderPalette.ffBody, fontSize: 11, color: thunderPalette.accentL, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{file.name}</span>
                        <button
                          onClick={() => setFile(null)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#f87171',
                            cursor: 'pointer',
                            padding: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'opacity 0.2s',
                          }}
                          onMouseEnter={e => e.target.style.opacity = '0.7'}
                          onMouseLeave={e => e.target.style.opacity = '1'}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    )}
                    <div style={{
                      border: `1px solid ${composerFocused ? thunderPalette.accent : 'rgba(245,244,240,0.12)'}`,
                      borderRadius: 6, transition: 'border-color 0.2s, box-shadow 0.2s',
                      boxShadow: composerFocused ? `0 0 0 3px rgba(124,58,237,0.12), inset 0 1px 0 rgba(255,255,255,0.04)` : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                    }}>
                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onFocus={() => setComposerFocused(true)}
                        onBlur={() => setComposerFocused(false)}
                        onKeyDown={onKeyDown}
                        disabled={loading}
                        placeholder="Describe your data analysis or story..."
                        rows={2}
                        style={{
                          width: '100%', background: 'transparent', border: 'none', outline: 'none',
                          padding: '10px 12px', fontSize: 13, color: thunderPalette.white,
                          fontFamily: thunderPalette.ffBody, fontWeight: 300, resize: 'none',
                          lineHeight: 1.55, caretColor: thunderPalette.accent, minHeight: 48, maxHeight: 160, overflowY: 'auto',
                        }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <input type="file" onChange={e => setFile(e.target.files[0])} style={{ display: 'none' }} />
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={thunderPalette.mid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" title="Attach file" style={{ display: 'block', transition: 'stroke 0.2s' }}>
                              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                            </svg>
                          </label>
                          <span style={{ fontFamily: thunderPalette.ffBody, fontSize: 11, color: thunderPalette.mid }}>⌘↵ to send</span>
                        </div>
                        <button
                          onClick={handleSend}
                          disabled={(!input.trim() && !file) || loading}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: (input.trim() || file) && !loading ? thunderPalette.accent : thunderPalette.grey,
                            color: (input.trim() || file) && !loading ? '#fff' : thunderPalette.mid,
                            border: 'none', borderRadius: 4, padding: '8px 16px',
                            fontFamily: thunderPalette.ffHead, fontWeight: 800, fontSize: 12,
                            letterSpacing: '0.08em', textTransform: 'uppercase',
                            cursor: (input.trim() || file) && !loading ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s',
                          }}
                        >
                          {loading ? (
                            <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--mid)', borderTopColor: 'var(--white)', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                          ) : (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z" />
                            </svg>
                          )}
                          {loading ? 'Running' : 'Send'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Resizer */}
              <div
                onMouseDown={handleMouseDown}
                className={`resizer-bar ${isDragging ? 'dragging' : ''}`}
              />

              {/* Sandpack Panel */}
              <section style={{ 
                ...panelStyle,
                width: sandpackWidth ? `${sandpackWidth}px` : 'auto',
                flex: sandpackWidth ? 'none' : 2,
                flexShrink: 0,
                minWidth: 250,
              }}>
                {/* Tab Header */}
                <div style={{ ...panelHeaderStyle, padding: 0 }}>
                  <div style={{ display: 'flex', height: '100%' }}>
                    {['preview', 'code'].map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                          background: activeTab === tab ? 'rgba(245,244,240,0.06)' : 'transparent',
                          color: activeTab === tab ? thunderPalette.accentL : thunderPalette.mid,
                          border: 'none', borderRight: `1px solid ${thunderPalette.line}`,
                          padding: '10px 20px', fontFamily: thunderPalette.ffHead,
                          fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                          cursor: 'pointer', transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        {tab === 'preview' ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            Preview
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="16 18 22 12 16 6" />
                              <polyline points="8 6 2 12 8 18" />
                            </svg>
                            Code
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 14 }}>
                    {activeChat && messages.some(m => {
                      try {
                        const parsed = JSON.parse(m.content);
                        return !!parsed.html_code;
                      } catch {
                        return false;
                      }
                    }) && (
                      <button
                        onClick={() => setIsFullscreenPreview(true)}
                        style={{
                          background: 'rgba(124,58,237,0.12)',
                          border: '1px solid rgba(124,58,237,0.3)',
                          borderRadius: 4,
                          color: thunderPalette.accentL,
                          fontFamily: thunderPalette.ffHead,
                          fontWeight: 700,
                          fontSize: 10,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="15 3 21 3 21 9" />
                          <polyline points="9 21 3 21 3 15" />
                          <line x1="21" y1="3" x2="14" y2="10" />
                          <line x1="3" y1="21" x2="10" y2="14" />
                        </svg>
                        Full Screen
                      </button>
                    )}
                    <span style={{ fontFamily: thunderPalette.ffBody, fontSize: 11, color: thunderPalette.mid }}>
                      Sandpack Studio
                    </span>
                  </div>
                </div>

                {/* Sandpack content — fills remaining panel height */}
                <div style={{
                  flex: 1,
                  minHeight: 0,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}>
                  <SandpackProvider
                    key={sandpackKey}
                    template="static"
                    files={sandpackFiles}
                    theme="dark"
                    options={{ autorun: true }}
                  >
                    {isFullscreenPreview && (
                      <div style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10000,
                        background: '#050816',
                        display: 'flex',
                        flexDirection: 'column',
                      }}>
                        {/* Floating close/exit button */}
                        <div style={{
                          position: 'absolute',
                          top: 20,
                          right: 20,
                          zIndex: 10001,
                        }}>
                          <button
                            onClick={() => setIsFullscreenPreview(false)}
                            style={{
                              background: 'rgba(17,17,17,0.85)',
                              backdropFilter: 'blur(12px)',
                              border: `1px solid ${thunderPalette.line}`,
                              color: thunderPalette.white,
                              fontFamily: thunderPalette.ffHead,
                              fontWeight: 700,
                              fontSize: 12,
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase',
                              borderRadius: 4,
                              padding: '8px 16px',
                              cursor: 'pointer',
                              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                            Exit Fullscreen
                          </button>
                        </div>

                        {/* Fullscreen Sandpack Preview */}
                        <div style={{ flex: 1, height: '100%', width: '100%' }}>
                          <SandpackPreview
                            showRefreshButton={false}
                            showOpenInCodeSandbox={false}
                            style={{ width: '100%', height: '100%', border: 'none' }}
                          />
                        </div>
                      </div>
                    )}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      flex: 1,
                      minHeight: 0,
                      height: '100%',
                    }}>
                      {activeTab === 'code' && (
                        <SandpackCodeEditor
                          showLineNumbers
                          showTabs
                          wrapContent
                          style={{ flex: 1, minHeight: 0, height: '100%', fontSize: 12, overflowY: 'auto' }}
                        />
                      )}
                      {activeTab === 'preview' && (
                        <SandpackPreview
                          showRefreshButton={false}
                          showOpenInCodeSandbox={false}
                          style={{ flex: 1, minHeight: 0, height: '100%', width: '100%' }}
                        />
                      )}
                    </div>
                  </SandpackProvider>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      <style>{`
        html, body, #root { height: 100% !important; min-height: 100vh !important; overflow: hidden !important; }
        
        /* Resizer Bar */
        .resizer-bar {
          width: 16px;
          cursor: col-resize;
          display: flex;
          align-items: center;
          justify-content: center;
          user-select: none;
          flex-shrink: 0;
          z-index: 10;
        }
        .resizer-bar::after {
          content: '';
          width: 2px;
          height: 40px;
          background: rgba(255, 255, 255, 0.12);
          border-radius: 1px;
          transition: all 0.2s ease;
        }
        .resizer-bar:hover::after {
          background: ${thunderPalette.accent};
          height: 80px;
          box-shadow: 0 0 8px ${thunderPalette.accent};
        }
        .resizer-bar.dragging::after {
          background: ${thunderPalette.accentL};
          height: 100%;
          box-shadow: 0 0 12px ${thunderPalette.accentL};
        }

        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes gridFade{ from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse   { 0%,100% { opacity: 1; box-shadow: 0 0 6px #34d399; } 50% { opacity: 0.5; box-shadow: 0 0 14px #34d399; } }
        /* ── Sandpack full-height fixes ── */

        /* Limit to data-sandpack-root under our panel section to prevent layout pollution/collapse */
        section [data-sandpack-root],
        section .sp-wrapper {
          display: flex !important;
          flex-direction: column !important;
          flex: 1 1 0% !important;
          min-height: 0 !important;
          height: 100% !important;
        }
        /* Code editor — scrollable */
        .sp-code-editor,
        .sp-editor-container,
        .sp-cm {
          flex: 1 1 0% !important;
          min-height: 0 !important;
          height: 100% !important;
          overflow: auto !important;
        }
        .sp-cm .cm-editor,
        .sp-cm .cm-scroller {
          height: 100% !important;
          overflow: auto !important;
        }
        /* Preview — full stretch */
        .sp-preview {
          flex: 1 1 0% !important;
          min-height: 0 !important;
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
        }
        .sp-preview-container {
          flex: 1 1 0% !important;
          min-height: 0 !important;
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
        }
        .sp-preview-iframe {
          flex: 1 1 0% !important;
          min-height: 0 !important;
          height: 100% !important;
          width: 100% !important;
          border: none !important;
        }

        /* Scrollbars */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(245,244,240,0.12); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(124,58,237,0.45); }
      `}</style>
    </>
  );
}

/* ─── Live Trace Log ─────────────────────────────────────────── */
function LiveTraceLog({ steps }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [steps]);

  return (
    <div style={{
      alignSelf: 'flex-start', width: '96%',
      background: 'rgba(10,10,10,0.75)',
      border: `1px solid rgba(124,58,237,0.22)`,
      borderRadius: 6, padding: '10px 12px',
      fontFamily: "'Fira Code','Courier New',monospace",
      fontSize: 11, lineHeight: 1.6,
      animation: 'fadeIn 0.25s ease',
    }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', display: 'inline-block', boxShadow: '0 0 7px #34d399', animation: 'pulse 1.2s ease-in-out infinite' }} />
        <span style={{ fontFamily: thunderPalette.ffHead, fontWeight: 700, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#888' }}>Agent · Running</span>
      </div>

      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        return (
          <div key={i} style={{ display: 'flex', gap: 0 }}>
            {/* tree line */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16, flexShrink: 0 }}>
              <div style={{ width: 1, height: i === 0 ? 8 : 6, background: 'rgba(124,58,237,0.3)' }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: isLast ? '#fff' : s.color, flexShrink: 0, boxShadow: isLast ? `0 0 6px #fff` : `0 0 5px ${s.color}`, transition: 'background 0.3s' }} />
              {!isLast && <div style={{ width: 1, flex: 1, background: 'rgba(124,58,237,0.3)', minHeight: 6 }} />}
            </div>
            {/* content */}
            <div style={{ paddingLeft: 8, paddingBottom: isLast ? 0 : 5, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-block', padding: '1px 7px', borderRadius: 3,
                background: `${s.color}18`, border: `1px solid ${s.color}40`,
                color: s.color, fontSize: 9, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                fontFamily: thunderPalette.ffHead,
              }}>{s.tag}</span>
              <span style={{ color: '#c0c0c0', fontSize: 10, wordBreak: 'break-all' }}>{s.label}</span>
              {isLast && <span style={{ width: 7, height: 7, borderRadius: '50%', border: `1.5px solid rgba(255,255,255,0.25)`, borderTopColor: '#fff', animation: 'spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 }} />}
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
