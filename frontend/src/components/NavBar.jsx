import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { vb } from '../theme/voiceBox';

export function BoltIcon({ size = 24, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      <path
        d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"
        fill={vb.red}
        stroke={vb.red}
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function NavBar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={{
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 24px',
      borderBottom: `2px solid ${vb.black}`,
      background: vb.white,
      zIndex: 10,
    }}>
      <button
        type="button"
        onClick={() => navigate('/')}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        <BoltIcon />
        <span style={{
          fontFamily: vb.ffDisplay,
          fontSize: 22,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          color: vb.black,
        }}>
          Data Agent
        </span>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {user && (
          <>
            <span style={{
              fontFamily: vb.ffBody,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: vb.textSecondary,
            }}>
              {user.username}
            </span>
            <button
              onClick={handleLogout}
              style={{
                fontFamily: vb.ffBody,
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                background: 'transparent',
                border: `2px solid ${vb.black}`,
                color: vb.black,
                borderRadius: 0,
                padding: '6px 14px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.target.style.background = vb.black; e.target.style.color = vb.white; }}
              onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = vb.black; }}
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
