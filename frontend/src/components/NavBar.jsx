import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { thunderPalette } from '../theme/thunderTheme';

const GRID_CSS = `
  html, body, #root {
    height: 100% !important;
    min-height: 100vh !important;
  }
`;

// Bolt logo SVG
export function BoltIcon({ size = 24, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: 'boltFlicker 4s ease-in-out infinite', ...style }}>
      <path
        d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"
        fill={thunderPalette.accent}
        stroke={thunderPalette.accent}
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
      borderBottom: `1px solid ${thunderPalette.line}`,
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
          fontFamily: thunderPalette.ffHead,
          fontWeight: 800, fontSize: 22,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          color: thunderPalette.white,
        }}>
          Data Agent
        </span>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {user && (
          <>
            <span style={{
              fontFamily: thunderPalette.ffHead, fontSize: 12,
              fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: thunderPalette.mid,
            }}>
              {user.username}
            </span>
            <button
              onClick={handleLogout}
              style={{
                fontFamily: thunderPalette.ffHead, fontWeight: 700,
                fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
                background: 'transparent',
                border: `1px solid rgba(124,58,237,0.35)`,
                color: thunderPalette.accent,
                borderRadius: 4, padding: '6px 14px', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
