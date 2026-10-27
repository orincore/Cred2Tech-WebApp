import React, { useState, useEffect } from 'react';
import { ShieldCheck, X } from 'lucide-react';

const heading = { fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '16px 0 8px' };
const paragraph = { fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 };
const list = { margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, lineHeight: 1.55, color: 'var(--text-primary)' };
const linkStyle = { color: 'var(--primary)', fontWeight: 600 };

/**
 * Direct MSME step 7 consent popup: the customer agrees to Cred2Tech sharing
 * their details with a Sourcing Partner and assigning their case to one, for the
 * lender(s) they chose. Presentational only - every word, the lender names and
 * the list of data to be shared come from the server (the same text is stored
 * with the acceptance), and nothing is saved until the customer ticks the box
 * and presses "Agree and Proceed", which calls onAccept.
 *
 * The box starts unticked and is reset each time the popup opens: a pre-ticked
 * box is not valid consent.
 */
const SourcingConsentModal = ({ isOpen, content, submitting, error, onAccept, onClose }) => {
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!isOpen) setAgreed(false);
  }, [isOpen]);

  if (!isOpen || !content) return null;

  const close = () => { if (!submitting) onClose(); };

  return (
    <div className="modal-overlay" onClick={close}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={content.title}
        style={{ maxWidth: 560, width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', borderRadius: 0 }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldCheck size={19} color="var(--primary)" />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0 0', lineHeight: 1.35 }}>{content.title}</h2>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={close} aria-label="Close" disabled={submitting} style={{ borderRadius: 0, flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        {/* The text is long; only this part scrolls so the checkbox and buttons stay in view. */}
        <div style={{ overflowY: 'auto', minHeight: 0, paddingRight: 4 }}>
          <p style={paragraph}>{content.intro}</p>

          <div style={heading}>{content.shareHeading}</div>
          <ul style={list}>
            {content.dataShared.map((line) => <li key={line}>{line}</li>)}
          </ul>

          <p style={{ ...paragraph, marginTop: 16 }}>{content.why}</p>

          <div style={heading}>{content.notesHeading}</div>
          <ul style={list}>
            {content.notes.map((line) => <li key={line}>{line}</li>)}
          </ul>

          <p style={{ ...paragraph, marginTop: 16 }}>
            For more details, see our{' '}
            <a href={content.links.privacyPolicy} target="_blank" rel="noreferrer" style={linkStyle}>Privacy Policy</a>
            {' '}and{' '}
            <a href={content.links.termsOfUse} target="_blank" rel="noreferrer" style={linkStyle}>Terms of Use</a>.
          </p>
        </div>

        {error && (
          <div style={{ padding: '10px 12px', background: 'var(--error-bg)', border: '1px solid var(--error)', color: 'var(--error)', fontSize: 12.5, fontWeight: 500, marginTop: 14 }}>
            {error}
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, margin: '16px 0 18px', cursor: 'pointer', fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            disabled={submitting}
            style={{ marginTop: 3, flexShrink: 0 }}
          />
          {content.checkbox}
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-ghost" style={{ borderRadius: 0 }} onClick={close} disabled={submitting}>Cancel</button>
          <button type="button" className="btn btn-primary" style={{ borderRadius: 0 }} disabled={!agreed || submitting} onClick={onAccept}>
            {submitting ? 'Submitting…' : 'Agree and Proceed'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SourcingConsentModal;
