import React from 'react';

// Shown instead of the app when an organisation address is unknown, suspended, or could not be loaded.
// Deliberately neutral: no Cred2Tech name or logo (this is someone else's address), and no way into the main app.
const OrgUnavailable = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
    <div style={{ maxWidth: 420, textAlign: 'center', color: '#0f172a' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>This site is unavailable</h1>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: '#475569', margin: '0 0 20px' }}>
        We could not load this page. Please check the address, or try again in a few minutes.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{ padding: '10px 20px', fontSize: 14, fontWeight: 600, color: '#fff', background: '#0f172a', border: 0, borderRadius: 8, cursor: 'pointer' }}
      >
        Try again
      </button>
    </div>
  </div>
);

export default OrgUnavailable;
