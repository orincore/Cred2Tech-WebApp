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
    { icon: Smartphone, accent: 'var(--info)', accentBg: 'var(--info-bg)', text: "Confirm the mobile number directly with the customer. It must be the number registered to their own PAN." },
    { icon: UserCheck, accent: 'var(--success)', accentBg: 'var(--success-bg)', text: 'Update the mobile number above, then click "Request Consent" again.' },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44,
              borderRadius: '50%',
              background: 'var(--error-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <ShieldAlert size={22} color="var(--error)" />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>Mobile number doesn't match this PAN</h2>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close" style={{ flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 22, lineHeight: 1.6 }}>
          {message || `We could not verify that this mobile number is registered to PAN ${pan || ''}. For security, consent can only be sent to the PAN holder's own mobile number, so someone else cannot approve consent on their behalf.`}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          {steps.map(({ icon: Icon, accent, accentBg, text }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: accentBg, border: `1px solid ${accent}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={16} color={accent} />
              </div>
              <span style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{text}</span>
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
