import React from 'react';
import { buildTheme, HEX_OK } from './previewTheme';

// A small, honest preview of what the organisation's people will see: the sign-in screen (brand panel, logo or name,
// button) and the header of an email. Uses the SAME colour maths as the real site (branding/brandingCore.js), so a colour
// that would be darkened for legibility is shown darkened here too, with a note.
const BrandingPreview = ({ name, primary, logoLightUrl, logoDarkUrl, tagline, poweredBy, showLoginLogo = true }) => {
  const theme = HEX_OK.test(primary || '') ? buildTheme(primary) : null;
  const colour = theme ? theme.primary : '#4F46E5';
  const panelLogo = logoDarkUrl || logoLightUrl;
  return (
    <div>
      <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--on-muted)' }}>Sign-in screen</p>
      <div style={{ display: 'flex', height: 190, border: '1px solid var(--outline)', overflow: 'hidden', background: 'var(--bg-base, #f8fafc)' }}>
        <div style={{ width: '42%', background: colour, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {showLoginLogo && (panelLogo
            ? <img src={panelLogo} alt="" style={{ height: 26, maxWidth: '100%', objectFit: 'contain', objectPosition: 'left', background: logoDarkUrl ? 'transparent' : '#fff', padding: logoDarkUrl ? 0 : '2px 6px' }} />
            : <span style={{ color: '#fff', fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em' }}>{name || 'Organisation name'}</span>)}
          <span style={{ marginTop: 'auto', color: '#fff', fontWeight: 800, fontSize: 17, lineHeight: 1.1 }}>Welcome Back</span>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9.5, lineHeight: 1.4 }}>{tagline || 'Sign in to manage your pipeline.'}</span>
        </div>
        <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>Sign In</span>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Access your secure {name || 'Organisation'} portal</span>
          <span style={{ height: 8, background: 'var(--bg-elevated)' }} /><span style={{ height: 8, background: 'var(--bg-elevated)' }} />
          <span style={{ alignSelf: 'flex-start', padding: '5px 14px', fontSize: 10, fontWeight: 700, color: '#fff', background: 'var(--text-primary, #0f172a)' }}>Sign In</span>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: colour }}>Forgot password?</span>
          {poweredBy && <span style={{ fontSize: 8.5, color: 'var(--text-tertiary)', marginTop: 4 }}>Powered by <u>Cred2Tech</u></span>}
        </div>
      </div>
      <p style={{ margin: '14px 0 8px', fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--on-muted)' }}>Email header</p>
      <div style={{ background: colour, padding: '12px 16px', borderBottom: `3px solid ${colour}`, display: 'flex', alignItems: 'center' }}>
        {panelLogo
          ? <img src={panelLogo} alt="" style={{ height: 24, maxWidth: 160, objectFit: 'contain', background: logoDarkUrl ? 'transparent' : '#fff', padding: logoDarkUrl ? 0 : '2px 6px' }} />
          : <span style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>{name || 'Organisation name'}</span>}
      </div>
      {theme && theme.adjusted && (
        <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--warning-dark, var(--warning))' }}>
          This colour is too light for white text, so the sites use a slightly darker {theme.primary}.
        </p>
      )}
    </div>
  );
};

export default BrandingPreview;
