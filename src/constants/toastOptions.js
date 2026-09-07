// Shared react-hot-toast config (see layouts/AppLayout.jsx and MsmeLayout.jsx)
// — sharp corners (no borderRadius, matching the rest of this app's custom
// UI) and the app's own CSS-variable palette instead of the library's
// default plain-white box, so a toast reads correctly in both light and
// dark mode and actually looks like it belongs to this app.
const baseStyle = {
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 0,
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  border: '1px solid var(--outline)',
  borderLeft: '3px solid var(--outline)',
  boxShadow: 'var(--shadow-lg)',
  padding: '12px 16px',
};

export const TOAST_OPTIONS = {
  duration: 4000,
  style: baseStyle,
  success: {
    style: { ...baseStyle, borderLeftColor: 'var(--success)' },
    iconTheme: { primary: 'var(--success)', secondary: 'var(--success-bg)' },
  },
  error: {
    style: { ...baseStyle, borderLeftColor: 'var(--error)' },
    iconTheme: { primary: 'var(--error)', secondary: 'var(--error-bg)' },
  },
  loading: {
    style: { ...baseStyle, borderLeftColor: 'var(--primary)' },
    iconTheme: { primary: 'var(--primary)', secondary: 'var(--surface)' },
  },
  notification: {
    style: { ...baseStyle, borderLeftColor: 'var(--primary)' },
  },
};
