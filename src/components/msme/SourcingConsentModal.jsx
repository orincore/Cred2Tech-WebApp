import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Share2 } from 'lucide-react';

/**
 * Direct MSME step 7 consent popup: authorises Cred2Tech to share the
 * customer's data with a sourcing partner and to allocate the case to one.
 * Purely presentational - the wording comes from the server (so what is
 * shown is what gets recorded) and nothing is saved until the customer ticks
 * the box and presses the accept button, which calls onAccept.
 */
const SourcingConsentModal = ({ isOpen, points, submitting, error, onAccept, onClose }) => {
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!isOpen) setAgreed(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const close = () => { if (!submitting) onClose(); };

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <ShieldCheck size={19} color="var(--primary)" />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Authorise Data Sharing</h2>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={close} aria-label="Close" disabled={submitting}>
            <X size={18} />
          </button>
        </div>

        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: 14, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-tertiary)', marginBottom: 10 }}>
            By submitting, you authorise Cred2Tech to
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(points || []).map((point) => (
              <div key={point} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                <Share2 size={14} color="var(--primary)" style={{ marginTop: 3, flexShrink: 0 }} />
                {point}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 12px', background: 'var(--error-bg)', border: '1px solid var(--error)', color: 'var(--error)', fontSize: 12.5, fontWeight: 500, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 20, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            disabled={submitting}
            style={{ marginTop: 3, flexShrink: 0 }}
          />
          I have read the above and authorise Cred2Tech to share my data with a sourcing partner and allocate my application to one.
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-ghost" onClick={close} disabled={submitting}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={!agreed || submitting} onClick={onAccept}>
            {submitting ? 'Submitting…' : 'I Agree & Submit'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SourcingConsentModal;
