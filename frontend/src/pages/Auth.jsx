import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { thunderPalette } from '../theme/thunderTheme';
import { BoltIcon } from '../components/NavBar';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const API_URL = 'http://localhost:8000';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isLogin) {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData,
        });
        if (!res.ok) throw new Error('Invalid username or password');
        const data = await res.json();
        login(data.access_token);
        navigate('/dashboard');
      } else {
        const res = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.detail || 'Registration failed');
        }
        setSuccess('Account created! Please sign in.');
        setIsLogin(true);
        setPassword('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (name) => ({
    width: '100%',
    padding: '12px 16px',
    background: 'rgba(245,244,240,0.04)',
    border: `1px solid ${focused === name ? thunderPalette.accent : thunderPalette.line}`,
    borderRadius: 4,
    color: thunderPalette.white,
    fontFamily: thunderPalette.ffBody,
    fontSize: 15,
    fontWeight: 300,
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: focused === name
      ? `0 0 0 3px rgba(124,58,237,0.12)`
      : 'none',
    caretColor: thunderPalette.accent,
  });

  return (
    <>
      {/* Grid background */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `
          linear-gradient(${thunderPalette.line} 1px, transparent 1px),
          linear-gradient(90deg, ${thunderPalette.line} 1px, transparent 1px)
        `,
        backgroundSize: '64px 64px',
        animation: 'gridFade 1.2s ease both',
      }} />
      <div style={{
        position: 'fixed', top: -120, left: -80, width: 480, height: 480,
        background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{
        position: 'relative', zIndex: 2,
        height: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '3rem', animation: 'slideUp 0.5s ease both' }}>
          <BoltIcon size={32} />
          <span style={{
            fontFamily: thunderPalette.ffHead, fontWeight: 800,
            fontSize: 32, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: thunderPalette.white,
          }}>
            Data Agent
          </span>
        </div>

        {/* Card */}
        <div style={{
          width: '100%', maxWidth: 420,
          background: 'rgba(17,17,17,0.85)',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${thunderPalette.line}`,
          borderRadius: 8,
          padding: '2.5rem',
          animation: 'slideUp 0.5s 0.1s ease both',
          opacity: 0,
        }}>
          {/* Tab switcher */}
          <div style={{
            display: 'flex', borderBottom: `1px solid ${thunderPalette.line}`,
            marginBottom: '2rem',
          }}>
            {['Sign In', 'Sign Up'].map((label, i) => {
              const active = i === 0 ? isLogin : !isLogin;
              return (
                <button key={label}
                  onClick={() => { setIsLogin(i === 0); setError(''); setSuccess(''); }}
                  style={{
                    flex: 1, padding: '10px 0',
                    background: 'transparent', border: 'none',
                    fontFamily: thunderPalette.ffHead, fontWeight: 700,
                    fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: active ? thunderPalette.accent : thunderPalette.mid,
                    borderBottom: `2px solid ${active ? thunderPalette.accent : 'transparent'}`,
                    cursor: 'pointer', transition: 'all 0.2s',
                    marginBottom: -1,
                  }}>
                  {label}
                </button>
              );
            })}
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', marginBottom: '1.5rem',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 4, color: '#f87171',
              fontFamily: thunderPalette.ffBody, fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              padding: '10px 14px', marginBottom: '1.5rem',
              background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)',
              borderRadius: 4, color: thunderPalette.accent,
              fontFamily: thunderPalette.ffBody, fontSize: 13,
            }}>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{
                fontFamily: thunderPalette.ffHead, fontWeight: 700,
                fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: thunderPalette.mid,
              }}>Username</label>
              <input
                type="text" required value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setFocused('username')}
                onBlur={() => setFocused('')}
                placeholder="Enter username"
                style={inputStyle('username')}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{
                fontFamily: thunderPalette.ffHead, fontWeight: 700,
                fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: thunderPalette.mid,
              }}>Password</label>
              <input
                type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused('')}
                placeholder="Enter password"
                style={inputStyle('password')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 8, padding: '13px',
                background: loading ? thunderPalette.grey : thunderPalette.accent,
                color: loading ? thunderPalette.mid : thunderPalette.black,
                border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: thunderPalette.ffHead, fontWeight: 800,
                fontSize: 14, letterSpacing: '0.12em', textTransform: 'uppercase',
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? (
                <span style={{
                  width: 16, height: 16, borderRadius: '50%',
                  border: '2px solid var(--mid)', borderTopColor: 'var(--white)',
                  animation: 'spin 0.7s linear infinite', display: 'inline-block',
                }} />
              ) : null}
              {loading ? 'Please wait…' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
