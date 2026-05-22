// Thunder design tokens — Electric Violet edition
export const thunderPalette = {
  black:   '#0a0a0a',
  white:   '#f5f4f0',
  accent:  '#7c3aed',
  accentL: '#a78bfa',
  accentD: '#5b21b6',
  grey:    '#1a1a1a',
  mid:     '#888888',
  line:    'rgba(245,244,240,0.08)',
  ffHead:  "'Barlow Condensed', sans-serif",
  ffBody:  "'Barlow', sans-serif",
  // keep amber alias so existing refs don't break during migration
  amber:   '#7c3aed',
  amberD:  '#5b21b6',
};

export const thunderTheme = {
  palette: {
    mode: 'dark',
    background: {
      default: '#0a0a0a',
      paper: '#111111',
    },
    primary: {
      main: '#7c3aed',
      dark: '#5b21b6',
      light: '#a78bfa',
      contrastText: '#ffffff',
    },
    text: {
      primary: '#f5f4f0',
      secondary: '#888888',
    },
    divider: 'rgba(245,244,240,0.08)',
  },
  typography: {
    fontFamily: "'Barlow', sans-serif",
    h1: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' },
    h2: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' },
    h6: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.08em' },
    overline: { fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.12em', fontWeight: 700 },
    button: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: '0.1em' },
  },
  shape: { borderRadius: 4 },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#111111',
          border: '1px solid rgba(245,244,240,0.08)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'uppercase',
          borderRadius: 4,
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700,
          letterSpacing: '0.1em',
        },
        containedPrimary: {
        background: '#7c3aed',
        color: '#ffffff',
        '&:hover': { background: '#5b21b6' },
      },  },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
        borderRadius: 4,
        '&.Mui-selected': {
          backgroundColor: 'rgba(124,58,237,0.12)',
          borderLeft: '2px solid #7c3aed',
        },
        '&.Mui-selected:hover': {
          backgroundColor: 'rgba(124,58,237,0.18)',
        },
      },  },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, letterSpacing: '0.08em' },
      },
    },
  },
};
