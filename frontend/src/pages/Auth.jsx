import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { vb } from '../theme/voiceBox';
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
    padding: '12px 14px',
    background: vb.white,
    border: `2px solid ${focused === name ? vb.black : vb.borderMedium}`,
    borderRadius: 0,
    fontFamily: vb.ffBody,
    fontSize: 14,
    fontWeight: 400,
    color: vb.textPrimary,
    outline: 'none',
    transition: 'border-color 0.15s',
    boxShadow: focused === name ? `0 0 0 2px ${vb.white}, 0 0 0 4px ${vb.black}` : 'none',
  });

  return (
    <div style={{
      position: 'relative',
      height: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
      background: vb.bg,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '2rem', animation: 'slideUp 0.4s ease both' }}>
        <BoltIcon size={32} />
        <span style={{
          fontFamily: vb.ffDisplay,
          fontSize: 32,
          fontWeight: 400,
          letterSpacing: '-0.02em',
          textTransform: 'uppercase',
          color: vb.black,
        }}>
          Data Agent
        </span>
      </div>

      <div style={{
        width: '100%',
        maxWidth: 420,
        background: vb.white,
        border: `2px solid ${vb.black}`,
        padding: '2.5rem',
        animation: 'slideUp 0.4s 0.1s ease both',
      }}>
        <div style={{
          display: 'flex',
          borderBottom: `2px solid ${vb.borderSubtle}`,
          marginBottom: '1.5rem',
        }}>
          {['Sign In', 'Sign Up'].map((label, i) => {
            const active = i === 0 ? isLogin : !isLogin;
            return (
              <button key={label}
                onClick={() => { setIsLogin(i === 0); setError(''); setSuccess(''); }}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? `3px solid ${vb.red}` : '3px solid transparent',
                  fontFamily: vb.ffBody,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: active ? vb.black : vb.textTertiary,
                  cursor: 'pointer',
                  transition: 'color 0.15s',
                  marginBottom: '-2px',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{
            padding: '10px 14px', marginBottom: '1.5rem',
            background: '#FEF2F2',
            border: `2px solid ${vb.error}`,
            color: vb.error,
            fontFamily: vb.ffBody, fontSize: 13, fontWeight: 500,
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            padding: '10px 14px', marginBottom: '1.5rem',
            background: '#F0FDF4',
            border: `2px solid ${vb.success}`,
            color: vb.success,
            fontFamily: vb.ffBody, fontSize: 13, fontWeight: 500,
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
              fontFamily: vb.ffBody, fontSize: 12, fontWeight: 700,
              color: vb.black, textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>Username</label>
            <input
              type="text" required value={username}
              onChange={e => setUsername(e.target.value)}
              onFocus={() => setFocused('username')}
              onBlur={() => setFocused('')}
              placeholder="Enter username"
              style={inputStyle('username')}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
              fontFamily: vb.ffBody, fontSize: 12, fontWeight: 700,
              color: vb.black, textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>Password</label>
            <input
              type="password" required value={password}
              onChange={e => setPassword(e.target.value)}
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
              background: loading ? vb.surfaceRaised : vb.black,
              color: loading ? vb.textTertiary : vb.white,
              border: `2px solid ${loading ? vb.borderMedium : vb.black}`,
              borderRadius: 0,
              fontFamily: vb.ffBody, fontSize: 13, fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
            onMouseEnter={e => { if (!loading) { e.target.style.background = vb.red; e.target.style.borderColor = vb.red; } }}
            onMouseLeave={e => { if (!loading) { e.target.style.background = vb.black; e.target.style.borderColor = vb.black; } }}
          >
            {loading && (
              <span style={{
                width: 14, height: 14, borderRadius: '50%',
                border: '2px solid currentColor', borderTopColor: 'transparent',
                animation: 'spin 0.7s linear infinite', display: 'inline-block',
              }} />
            )}
            {loading ? 'Please wait…' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>
      </div>
    </div>
  );
}
