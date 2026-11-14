import React from 'react';

// Small shared pieces for the white-label screens, built on the app's own colour tokens (light and dark mode follow them).
export const TONES = {
  success: { fg: 'var(--success)', bg: 'var(--success-bg)' },
  error:   { fg: 'var(--error)',   bg: 'var(--error-bg)' },
  warning: { fg: 'var(--warning-dark, var(--warning))', bg: 'var(--warning-bg)' },
  info:    { fg: 'var(--info)',    bg: 'var(--info-bg)' },
  neutral: { fg: 'var(--text-tertiary)', bg: 'var(--bg-elevated)' },
};

export const Pill = ({ tone = 'neutral', children, title }) => {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.03em', background: t.bg, color: t.fg, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
};

export const Field = ({ label, hint, error, required, children, htmlFor }) => (
  <div className="form-group" style={{ marginBottom: 14 }}>
    {label && <label className="form-label" htmlFor={htmlFor}>{label}{required && <span className="required">*</span>}</label>}
    {children}
    {hint && !error && <span className="form-hint">{hint}</span>}
    {error && <span role="alert" style={{ display: 'block', marginTop: 4, fontSize: 12, color: 'var(--error)' }}>{error}</span>}
  </div>
);

export const Card = ({ title, subtitle, actions, children, style, bodyStyle }) => (
  <section style={{ background: 'var(--surface)', border: '1px solid var(--outline)', ...style }}>
    {(title || actions) && (
      <header style={{ padding: '14px 18px', borderBottom: '1px solid var(--outline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          {title && <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--on-surface)' }}>{title}</h3>}
          {subtitle && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--on-muted)' }}>{subtitle}</p>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
      </header>
    )}
    <div style={{ padding: 18, ...bodyStyle }}>{children}</div>
  </section>
);

export const Grid = ({ cols = 2, gap = 16, children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${cols === 3 ? 200 : 260}px, 1fr))`, columnGap: gap }}>{children}</div>
);

// Same page chrome as the other admin pages: a header bar (icon, title, subtitle, actions), optional tabs, a scrolling body.
// The white-label components use short names (--on-surface, --on-muted, --outline, --surface, --bg); they are mapped
// here, once, onto the app's real theme tokens so light and dark mode both follow the existing design system.
const TOKEN_ALIASES = {
  '--on-surface': 'var(--text-primary)', '--on-muted': 'var(--text-tertiary)', '--outline': 'var(--border)',
  '--surface': 'var(--bg-surface)', '--bg': 'var(--bg-base)',
};
export const PageFrame = ({ icon: Icon, title, subtitle, actions, tabs, tab, onTab, back, children }) => (
  <div style={{ ...TOKEN_ALIASES, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--outline)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, background: 'var(--bg-elevated)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {back}
        {Icon && <Icon size={18} color="var(--primary)" />}
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--on-surface)' }}>{title}</h1>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--on-muted)', margin: '2px 0 0 0' }}>{subtitle}</div>}
        </div>
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>}
    </div>
    {tabs && (
      <div role="tablist" style={{ padding: '10px 20px 0', borderBottom: '1px solid var(--outline)', background: 'var(--bg)', display: 'flex', gap: 4, overflowX: 'auto' }}>
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => onTab(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: 'transparent', border: 'none', whiteSpace: 'nowrap',
              borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent', color: tab === t.id ? 'var(--primary)' : 'var(--on-muted)' }}>
            {t.icon && <t.icon size={13} />} {t.label}
          </button>
        ))}
      </div>
    )}
    <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>{children}</div>
  </div>
);
