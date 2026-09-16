import React from 'react';
import { ShieldAlert, X, Smartphone, UserCheck } from 'lucide-react';

/**
 * Blocking popup for the anti-impersonation check's own rejection (backend:
 * identityVerification.service.js#verifyConsentMobileOwnership, surfaced as
 * a 403 from POST /consent/request) — replaces a toast for this specific
 * error since it's a security-relevant stop, not a routine failure, and
 * needs enough room to actually explain why the mobile number was rejected
 * and what to do about it, not just flash past in a corner.
 */
const ConsentIdentityMismatchModal = ({ isOpen, onClose, message, pan }) => {
  if (!isOpen) return null;

  const steps = [
    { icon: Smartphone, text: "Confirm the mobile number directly with the customer — it must be the number registered to their own PAN." },
    { icon: UserCheck, text: 'Update the mobile number above, then click "Request Consent" again.' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42,
              borderRadius: '50%',
              background: 'var(--error-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <ShieldAlert size={20} color="var(--error)" />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>Mobile number doesn't match this PAN</h2>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
          {message || `We could not verify that this mobile number is registered to PAN ${pan || ''}. For security, consent can only be sent to the PAN holder's own mobile number — this prevents someone else from approving consent on their behalf.`}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {steps.map(({ icon: Icon, text }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)',
              }}>
                {i + 1}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 3 }}>
                <Icon size={15} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{text}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
};

export default ConsentIdentityMismatchModal;
