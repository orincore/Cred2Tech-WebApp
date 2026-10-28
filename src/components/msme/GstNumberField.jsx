import React from 'react';

const GSTIN_FORMAT = /^(0[1-9]|[1-2][0-9]|3[0-8])[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CODEPOINTS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Same check-character algorithm as the backend (src/utils/gstin.js) so a typo
// is caught while typing; the server re-validates regardless.
const checkChar = (first14) => {
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const product = CODEPOINTS.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CODEPOINTS[(36 - (sum % 36)) % 36];
};

/** '' when blank (optional), otherwise an error message or null if valid. */
export const gstinError = (value) => {
  const g = String(value || '').trim().toUpperCase();
  if (!g) return null;
  if (g.length < 15) return 'A GST number has 15 characters';
  if (!GSTIN_FORMAT.test(g) || checkChar(g.slice(0, 14)) !== g[14]) return 'This GST number looks incorrect — please check it';
  return null;
};

/**
 * Optional GST number input shown on the MSME payment screens. Leaving it
 * blank is fine; the fee and the 18% GST are the same either way.
 */
const GstNumberField = ({ value, onChange, disabled = false, labelColor = 'var(--on-muted)' }) => {
  const error = gstinError(value);
  return (
    <div style={{ textAlign: 'left', marginTop: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: labelColor, marginBottom: 6 }}>
        GST number <span style={{ fontWeight: 400 }}>(optional — add it if you have one)</span>
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15))}
        placeholder="e.g. 29ABCDE1234F1Z5"
        maxLength={15}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 14, letterSpacing: '0.04em',
          fontFamily: 'monospace', borderRadius: 0, background: 'var(--surface)', color: 'var(--on-surface)',
          border: `1px solid ${error ? 'var(--error)' : 'var(--outline)'}`, outline: 'none',
        }}
      />
      {error && <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 4 }}>{error}</div>}
    </div>
  );
};

export default GstNumberField;
