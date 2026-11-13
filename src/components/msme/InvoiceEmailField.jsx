import React from 'react';

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// The generated address an account gets at OTP signup; it bounces, so it never counts.
const PLACEHOLDER_EMAIL = /@direct\.cred2tech\.local$/i;

/** An error message, or null when the address is usable. Required: blank is an error. */
export const invoiceEmailError = (value) => {
  const email = String(value || '').trim();
  if (!email) return 'Email address is required';
  if (!EMAIL_FORMAT.test(email) || PLACEHOLDER_EMAIL.test(email)) return 'Please enter a valid email address';
  return null;
};

/**
 * Required email input on the MSME payment screens, shown only while the
 * account has no real email yet (signup collects just the mobile number).
 * The server saves it to the account before the order is created, and the
 * GST invoice and Razorpay receipt are sent to it.
 */
const InvoiceEmailField = ({ value, onChange, disabled = false, labelColor = 'var(--on-muted)' }) => {
  // Only flag the format once something is typed; the Pay button is disabled meanwhile.
  const error = String(value || '').trim() ? invoiceEmailError(value) : null;
  return (
    <div style={{ textAlign: 'left', marginTop: 16 }}>
      <label htmlFor="msme-invoice-email" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: labelColor, marginBottom: 6 }}>
        Email address <span style={{ color: 'var(--error)' }}>*</span>
      </label>
      <input
        id="msme-invoice-email"
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="you@company.com"
        required
        disabled={disabled}
        autoComplete="email"
        spellCheck={false}
        style={{
          width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 14,
          borderRadius: 0, background: 'var(--surface)', color: 'var(--on-surface)',
          border: `1px solid ${error ? 'var(--error)' : 'var(--outline)'}`, outline: 'none',
        }}
      />
      {error && <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 4 }}>{error}</div>}
      <div style={{ fontSize: 11, color: labelColor, marginTop: 4, lineHeight: 1.4 }}>
        Please enter the correct email address, as we will use this email for sending invoices to you.
      </div>
    </div>
  );
};

export default InvoiceEmailField;
