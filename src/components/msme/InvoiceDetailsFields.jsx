import React from 'react';

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// What an account gets at OTP signup: "Customer_<mobile>" and "<mobile>@direct.cred2tech.local".
// Neither is the customer's: the address bounces and the name must not go on an invoice.
const PLACEHOLDER_EMAIL = /@direct\.cred2tech\.local$/i;
const PLACEHOLDER_NAME = /^Customer_/i;

const cleanName = (value) => String(value || '').trim().replace(/\s+/g, ' ');

/** An error message, or null when usable. Required: blank is an error. Mirrors the server's rule. */
export const invoiceNameError = (value) => {
  const name = cleanName(value);
  if (!name) return 'Name is required';
  if (PLACEHOLDER_NAME.test(name)) return 'Please enter your real name';
  if (name.length < 2 || name.length > 100) return 'Please enter a name between 2 and 100 characters';
  if (!/\p{L}/u.test(name)) return 'Please enter a valid name';
  if (/[<>{}\\]/.test(name)) return 'The name contains characters that are not allowed';
  return null;
};

/** An error message, or null when usable. Required: blank is an error. */
export const invoiceEmailError = (value) => {
  const email = String(value || '').trim();
  if (!email) return 'Email address is required';
  if (!EMAIL_FORMAT.test(email) || PLACEHOLDER_EMAIL.test(email)) return 'Please enter a valid email address';
  return null;
};

/** null when both fields are valid, otherwise the first error. */
export const invoiceDetailsError = (name, email) => invoiceNameError(name) || invoiceEmailError(email);

const inputStyle = (hasError) => ({
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 14,
  borderRadius: 0, background: 'var(--surface)', color: 'var(--on-surface)',
  border: `1px solid ${hasError ? 'var(--error)' : 'var(--outline)'}`, outline: 'none',
});

/**
 * Required name + email on the MSME payment screens, shown while the account
 * still has the signup placeholders (signup collects only the mobile). The
 * server saves both to the profile before the order is created; the name is
 * printed on the GST invoice and the invoice and Razorpay receipt are emailed.
 */
const InvoiceDetailsFields = ({ name, email, onNameChange, onEmailChange, disabled = false, labelColor = 'var(--on-muted)' }) => {
  // Only flag a field once something is typed; Pay stays disabled meanwhile.
  const nameErr = String(name || '').trim() ? invoiceNameError(name) : null;
  const emailErr = String(email || '').trim() ? invoiceEmailError(email) : null;
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: labelColor, marginBottom: 6 };
  return (
    <div style={{ textAlign: 'left', marginTop: 16 }}>
      <label htmlFor="msme-invoice-name" style={labelStyle}>
        Full name <span style={{ color: 'var(--error)' }}>*</span>
      </label>
      <input
        id="msme-invoice-name"
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Name to print on your invoice"
        required
        maxLength={100}
        disabled={disabled}
        autoComplete="name"
        style={inputStyle(!!nameErr)}
      />
      {nameErr && <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 4 }}>{nameErr}</div>}
      <div style={{ fontSize: 11, color: labelColor, marginTop: 4, lineHeight: 1.4 }}>
        This name will be printed on your invoice.
      </div>

      <label htmlFor="msme-invoice-email" style={{ ...labelStyle, marginTop: 14 }}>
        Email address <span style={{ color: 'var(--error)' }}>*</span>
      </label>
      <input
        id="msme-invoice-email"
        type="email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        placeholder="you@company.com"
        required
        disabled={disabled}
        autoComplete="email"
        spellCheck={false}
        style={inputStyle(!!emailErr)}
      />
      {emailErr && <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 4 }}>{emailErr}</div>}
      <div style={{ fontSize: 11, color: labelColor, marginTop: 4, lineHeight: 1.4 }}>
        Please enter the correct email address, as we will use this email for sending invoices to you.
      </div>
    </div>
  );
};

export default InvoiceDetailsFields;
