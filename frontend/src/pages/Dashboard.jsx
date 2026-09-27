import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { SandpackProvider, SandpackLayout, SandpackCodeEditor, SandpackPreview } from '@codesandbox/sandpack-react';
import { apiFetch, getAccessToken } from '../api/client';
import { useAuth } from '../context/AuthContext';
import NavBar, { BoltIcon } from '../components/NavBar';
import QueryInputPage from '../components/QueryInputPage';
import { vb } from '../theme/voiceBox';

const buildingFiles = {
  '/index.html': `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Awaiting Analysis</title>
  <link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Work Sans, system-ui, sans-serif; background: #FAFAFA; color: #0A0A0A; height: 100vh; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    .build-screen { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; background: #FAFAFA; }
    .build-card { position:relative; z-index:2; width:92%; max-width:480px; padding:3.5rem 2.5rem; border: 2px solid #0A0A0A; text-align:center; background: #FAFAFA; }
    .loader-ring { width:80px; height:80px; margin:0 auto 2rem; border-radius:50%; border:3px solid #E5E5E5; border-top-color: #EF4444; display:flex; align-items:center; justify-content:center; animation:spin 1.1s linear infinite; }
    .loader-core { width:44px; height:44px; border-radius:50%; background:#0A0A0A; }
    .build-card h1 { font-family: 'Archivo Black', sans-serif; font-size:1.9rem; font-weight:400; margin-bottom:0.75rem; letter-spacing:-0.02em; }
    .build-card p { color:#525252; font-size:0.95rem; line-height:1.65; margin-bottom:2rem; }
    .progress-bar { width:100%; height:8px; background:#E5E5E5; overflow:hidden; }
    .progress-fill { width:40%; height:100%; background:#EF4444; animation:loading 1.8s ease-in-out infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    @keyframes loading { 0%{transform:translateX(-120%);width:35%} 50%{width:55%} 100%{transform:translateX(320%);width:35%} }
  </style>
</head>
<body>
  <div class="build-screen">
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

// ─── VoiceBox Panel Styles ───────────────────────────────────

const panelStyle = {
  display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0,
  height: '100%', background: vb.white,
  border: `2px solid ${vb.borderSubtle}`,
  borderRadius: 0, overflow: 'hidden',
};

const panelHeaderStyle = {
  flexShrink: 0, display: 'flex', alignItems: 'center',
  justifyContent: 'space-between', padding: '10px 14px',
  borderBottom: `2px solid ${vb.borderSubtle}`,
  fontFamily: vb.ffBody, fontSize: 11, fontWeight: 700,
  letterSpacing: '0.1em', textTransform: 'uppercase', color: vb.textSecondary,
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
      const padding = 24;
      const sidebarWidth = sidebarOpen ? 260 : 48;
      const spacing = 12 + 16;
      const maxAllowedWidth = containerRect.width - padding - sidebarWidth - spacing;

      const containerRight = containerRect.right - 12;
      const rawSandpackWidth = containerRight - e.clientX;

      const minWidth = 250;
      const maxWidth = maxAllowedWidth - 250;

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

      const lastHtml = [...data]
        .reverse()
        .filter(m => m.role === 'assistant')
        .map(m => { try { return JSON.parse(m.content); } catch { return {}; } })
        .find(p => p.html_code);

      if (lastHtml) {
        setSandpackFiles(buildSandpackFiles(lastHtml.html_code, lastHtml.files_data));
      }
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
    if (!chatIdParam || messages.length === 0) {
      return;
    }
    navigate('/dashboard');
  };

  const handleSend = async (e, submitData = null) => {
    if (submitData) {
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
      e.preventDefault();
      if (!input.trim() && !file) return;
      if (!activeChat) return;
      setLoading(true);
      setTraceSteps([]);

      let prompt = input.trim();
      setInput('');

      try {
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

        const tempId = Date.now();
        const tempMsg = { id: tempId, role: 'user', content: JSON.stringify({ text: prompt }), created_at: new Date().toISOString() };
        setMessages(prev => [...prev, tempMsg]);

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

  return (
    <>
      {isDragging && (
        <div style={{
          position: 'fixed', inset: 0, cursor: 'col-resize',
          zIndex: 9999, background: 'transparent',
        }} />
      )}

      <div style={{ position: 'relative', zIndex: 2, height: '100vh', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Nav */}
        <nav style={{
          flexShrink: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '12px 20px',
          borderBottom: `2px solid ${vb.black}`,
          background: vb.white,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BoltIcon size={24} />
            <span style={{ fontFamily: vb.ffDisplay, fontWeight: 400, fontSize: 20, letterSpacing: '-0.02em', textTransform: 'uppercase', color: vb.black }}>
              Data Agent
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {user && (
              <span style={{ fontFamily: vb.ffBody, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: vb.textSecondary }}>
                {user.username}
              </span>
            )}
            <button onClick={handleLogout} style={{
              fontFamily: vb.ffBody, fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
              background: 'transparent', border: `2px solid ${vb.black}`, color: vb.black,
              borderRadius: 0, padding: '6px 14px', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.target.style.background = vb.black; e.target.style.color = vb.white; }}
              onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = vb.black; }}
            >Logout</button>
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
            transition: 'width 0.2s ease',
            overflow: 'hidden',
            flexShrink: 0,
            border: 'none',
            borderRight: `2px solid ${vb.borderSubtle}`,
          }}>
            <div style={{ ...panelHeaderStyle, cursor: 'pointer', userSelect: 'none', justifyContent: 'space-between' }}
              onClick={() => setSidebarOpen(o => !o)}
            >
              {sidebarOpen
                ? <span style={{ color: vb.red }}>Sessions</span>
                : null
              }
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={vb.red} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{
                  flexShrink: 0,
                  transform: sidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)',
                  transition: 'transform 0.2s ease',
                  margin: sidebarOpen ? '0' : '0 auto',
                }}
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </div>

            {sidebarOpen && (
              <>
                <div style={{ padding: '10px 8px' }}>
                  <button
                    onClick={createNewChat}
                    style={{
                      width: '100%', padding: '9px 0', background: vb.black,
                      border: `2px solid ${vb.black}`, borderRadius: 0, cursor: 'pointer',
                      fontFamily: vb.ffBody, fontWeight: 700, fontSize: 12,
                      letterSpacing: '0.08em', textTransform: 'uppercase', color: vb.white,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { e.target.style.background = vb.red; e.target.style.borderColor = vb.red; }}
                    onMouseLeave={e => { e.target.style.background = vb.black; e.target.style.borderColor = vb.black; }}
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
                        background: String(chat.id) === String(chatIdParam) ? vb.black : 'transparent',
                        border: 'none',
                        borderLeft: `3px solid ${String(chat.id) === String(chatIdParam) ? vb.red : 'transparent'}`,
                        borderRadius: 0, cursor: 'pointer',
                        fontFamily: vb.ffBody, fontSize: 13, fontWeight: 400,
                        color: String(chat.id) === String(chatIdParam) ? vb.white : vb.textPrimary,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        transition: 'all 0.15s',
                      }}
                    >
                      {chat.title}
                    </button>
                  ))}
                  {chats.length === 0 && (
                    <p style={{ fontFamily: vb.ffBody, fontSize: 12, color: vb.textTertiary, padding: '8px 4px', lineHeight: 1.6 }}>
                      No sessions yet. Click "New Analysis" to start.
                    </p>
                  )}
                </div>
              </>
            )}

            {!sidebarOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '10px 0' }}>
                <button
                  onClick={createNewChat}
                  title="New Analysis"
                  style={{
                    width: 32, height: 32, borderRadius: 0, cursor: 'pointer',
                    background: vb.black, border: `2px solid ${vb.black}`,
                    color: vb.white, fontSize: 18, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >+</button>
              </div>
            )}
          </aside>

          {/* Main Content Area */}
          {(loadingChats || (chatIdParam && loadingMessages && !pendingSubmission)) ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: vb.white, border: `2px solid ${vb.borderSubtle}`, height: '100%'
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                border: `3px solid ${vb.borderSubtle}`, borderTopColor: vb.red,
                animation: 'spin 1.1s linear infinite', marginBottom: 16
              }} />
              <span style={{ fontFamily: vb.ffBody, fontSize: 12, fontWeight: 700, color: vb.textSecondary, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Loading Session…
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
              <div style={{ ...panelStyle, flex: 1, minWidth: 250, border: 'none', borderRight: `2px solid ${vb.borderSubtle}` }}>
                <div style={panelHeaderStyle}>
                  <span style={{ color: vb.red }}>Chat</span>
                  {activeChat && <span style={{ fontSize: 10, color: vb.textTertiary }}>{activeChat.title}</span>}
                </div>

                {/* Messages */}
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {!activeChat && (
                    <p style={{ fontFamily: vb.ffBody, fontSize: 13, color: vb.textTertiary, lineHeight: 1.6 }}>
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
                          borderRadius: 0,
                          fontFamily: vb.ffBody,
                          fontSize: 13, lineHeight: 1.65,
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          background: msg.role === 'user' ? vb.black : vb.white,
                          border: msg.role === 'user' ? `2px solid ${vb.black}` : `2px solid ${vb.borderSubtle}`,
                          color: msg.role === 'user' ? vb.white : vb.textPrimary,
                          animation: 'fadeIn 0.3s ease',
                        }}
                      >
                        <span style={{
                          fontFamily: vb.ffBody, fontSize: 10, fontWeight: 700,
                          letterSpacing: '0.08em', textTransform: 'uppercase',
                          color: msg.role === 'user' ? vb.red : vb.textTertiary,
                          display: 'block', marginBottom: 4,
                        }}>
                          {msg.role === 'user' ? 'You' : 'Agent'}
                        </span>
                        {displayText}
                      </div>
                    );
                  })}
                  {loading && traceSteps.length === 0 && (
                    <div style={{
                      alignSelf: 'flex-start', padding: '10px 14px',
                      borderRadius: 0, display: 'flex', alignItems: 'center', gap: 8,
                      border: `2px dashed ${vb.borderMedium}`,
                      background: vb.surface,
                      fontFamily: vb.ffBody, fontSize: 12, color: vb.textSecondary,
                    }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${vb.borderMedium}`, borderTopColor: vb.red, animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
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
                  <div style={{ flexShrink: 0, padding: '10px 12px 12px', borderTop: `2px solid ${vb.borderSubtle}` }}>
                    {file && (
                      <div style={{ fontFamily: vb.ffBody, fontSize: 11, color: vb.textSecondary, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{file.name}</span>
                        <button
                          onClick={() => setFile(null)}
                          style={{
                            background: 'none', border: 'none', color: vb.textTertiary,
                            cursor: 'pointer', padding: 2, display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            transition: 'color 0.15s',
                          }}
                          onMouseEnter={e => e.target.style.color = vb.red}
                          onMouseLeave={e => e.target.style.color = vb.textTertiary}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    )}
                    <div style={{
                      border: `2px solid ${composerFocused ? vb.black : vb.borderMedium}`,
                      borderRadius: 0, transition: 'border-color 0.15s',
                      boxShadow: composerFocused ? `0 0 0 2px ${vb.white}, 0 0 0 4px ${vb.black}` : 'none',
                    }}>
                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onFocus={() => setComposerFocused(true)}
                        onBlur={() => setComposerFocused(false)}
                        onKeyDown={onKeyDown}
                        disabled={loading}
                        placeholder="Describe your data analysis or story…"
                        rows={2}
                        style={{
                          width: '100%', background: 'transparent', border: 'none', outline: 'none',
                          padding: '10px 12px', fontSize: 13, color: vb.textPrimary,
                          fontFamily: vb.ffBody, fontWeight: 400, resize: 'none',
                          lineHeight: 1.65, minHeight: 48, maxHeight: 160, overflowY: 'auto',
                        }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <input type="file" onChange={e => setFile(e.target.files[0])} style={{ display: 'none' }} />
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={vb.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" title="Attach file" style={{ display: 'block', transition: 'stroke 0.15s' }}>
                              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                            </svg>
                          </label>
                          <span style={{ fontFamily: vb.ffBody, fontSize: 11, color: vb.textTertiary }}>Ctrl+Enter to send</span>
                        </div>
                        <button
                          onClick={handleSend}
                          disabled={(!input.trim() && !file) || loading}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: (input.trim() || file) && !loading ? vb.black : vb.surfaceRaised,
                            color: (input.trim() || file) && !loading ? vb.white : vb.textTertiary,
                            border: `2px solid ${(input.trim() || file) && !loading ? vb.black : vb.borderMedium}`,
                            borderRadius: 0, padding: '8px 16px',
                            fontFamily: vb.ffBody, fontWeight: 700, fontSize: 12,
                            letterSpacing: '0.06em', textTransform: 'uppercase',
                            cursor: (input.trim() || file) && !loading ? 'pointer' : 'not-allowed',
                            transition: 'all 0.15s',
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
                            <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
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
                border: 'none',
                borderLeft: `2px solid ${vb.borderSubtle}`,
              }}>
                {/* Tab Header */}
                <div style={{ ...panelHeaderStyle, padding: 0 }}>
                  <div style={{ display: 'flex', height: '100%' }}>
                    {['preview', 'code'].map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                          background: activeTab === tab ? vb.surface : 'transparent',
                          color: activeTab === tab ? vb.black : vb.textTertiary,
                          border: 'none',
                          borderBottom: activeTab === tab ? `3px solid ${vb.red}` : '3px solid transparent',
                          padding: '10px 20px', fontFamily: vb.ffBody,
                          fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                          cursor: 'pointer', transition: 'all 0.15s',
                          display: 'flex', alignItems: 'center',
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
                          background: vb.black,
                          border: `2px solid ${vb.black}`,
                          borderRadius: 0,
                          color: vb.white,
                          fontFamily: vb.ffBody,
                          fontWeight: 700,
                          fontSize: 10,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          padding: '4px 10px',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                        onMouseEnter={e => { e.target.style.background = vb.red; e.target.style.borderColor = vb.red; }}
                        onMouseLeave={e => { e.target.style.background = vb.black; e.target.style.borderColor = vb.black; }}
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
                    <span style={{ fontFamily: vb.ffBody, fontSize: 11, color: vb.textTertiary }}>
                      Sandpack Studio
                    </span>
                  </div>
                </div>

                {/* Sandpack content */}
                <div style={{
                  flex: 1, minHeight: 0, minWidth: 0,
                  display: 'flex', flexDirection: 'column',
                  overflow: 'hidden',
                }}>
                  <SandpackProvider
                    key={sandpackKey}
                    template="static"
                    files={sandpackFiles}
                    theme="light"
                    options={{ autorun: true }}
                  >
                    {isFullscreenPreview && (
                      <div style={{
                        position: 'fixed', inset: 0, zIndex: 10000,
                        background: vb.bg,
                        display: 'flex', flexDirection: 'column',
                      }}>
                        <div style={{
                          position: 'absolute', top: 20, right: 20, zIndex: 10001,
                        }}>
                          <button
                            onClick={() => setIsFullscreenPreview(false)}
                            style={{
                              background: vb.white,
                              border: `2px solid ${vb.black}`,
                              color: vb.black,
                              fontFamily: vb.ffBody,
                              fontWeight: 700,
                              fontSize: 12,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              borderRadius: 0,
                              padding: '8px 16px',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                            }}
                            onMouseEnter={e => { e.target.style.background = vb.black; e.target.style.color = vb.white; }}
                            onMouseLeave={e => { e.target.style.background = vb.white; e.target.style.color = vb.black; }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                            Exit Fullscreen
                          </button>
                        </div>

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
                      display: 'flex', flexDirection: 'column',
                      flex: 1, minHeight: 0, height: '100%',
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
          background: #E5E5E5;
          transition: all 0.15s ease;
        }
        .resizer-bar:hover::after {
          background: #EF4444;
          height: 80px;
        }
        .resizer-bar.dragging::after {
          background: #EF4444;
          height: 100%;
        }

        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }

        section [data-sandpack-root],
        section .sp-wrapper {
          display: flex !important;
          flex-direction: column !important;
          flex: 1 1 0% !important;
          min-height: 0 !important;
          height: 100% !important;
        }
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

        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #D4D4D4; }
        ::-webkit-scrollbar-thumb:hover { background: #EF4444; }
      `}</style>
    </>
  );
}

/* Live Trace Log — VoiceBox style */
function LiveTraceLog({ steps }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [steps]);

  return (
    <div style={{
      alignSelf: 'flex-start', width: '96%',
      background: vb.surface,
      border: `2px solid ${vb.borderSubtle}`,
      padding: '10px 12px',
      fontFamily: vb.ffMono,
      fontSize: 11, lineHeight: 1.6,
      animation: 'fadeIn 0.25s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${vb.borderSubtle}` }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: vb.red, display: 'inline-block', animation: 'pulse 1.2s ease-in-out infinite' }} />
        <span style={{ fontFamily: vb.ffBody, fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: vb.textSecondary }}>Agent · Running</span>
      </div>

      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        return (
          <div key={i} style={{ display: 'flex', gap: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16, flexShrink: 0 }}>
              <div style={{ width: 1, height: i === 0 ? 8 : 6, background: vb.borderSubtle }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: isLast ? vb.red : vb.black, flexShrink: 0, transition: 'background 0.3s' }} />
              {!isLast && <div style={{ width: 1, flex: 1, background: vb.borderSubtle, minHeight: 6 }} />}
            </div>
            <div style={{ paddingLeft: 8, paddingBottom: isLast ? 0 : 6, paddingTop: 0 }}>
              <span style={{
                display: 'inline-block', padding: '1px 6px',
                background: vb.white, border: `1px solid ${vb.borderSubtle}`,
                color: vb.textPrimary, fontSize: 9, fontWeight: 700,
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
