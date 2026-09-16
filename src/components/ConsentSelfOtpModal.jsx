import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Database } from 'lucide-react';

/**
 * Direct MSME self-service consent popup — shows the same "what data will
 * be requested" content the link-based ConsentPage.jsx shows a DSA-sent
 * customer, but inline on the same page with an OTP entry, since the
 * person consenting here is the one already logged in. No link is ever
 * sent for this flow (see AddCustomerWizardPage's handleRequestConsentSelf/
 * handleRequestCoapplicantConsentSelf) — this modal is the entire
 * approval UI.
 */
const ConsentSelfOtpModal = ({ isOpen, dataPoints, maskedMobile, submitting, error, resending, resendCooldown, onSubmit, onResend, onClose }) => {
  const [otp, setOtp] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!isOpen) { setOtp(''); setCooldown(0); }
  }, [isOpen]);

  useEffect(() => {
    if (resendCooldown > 0) setCooldown(resendCooldown);
  }, [resendCooldown]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'var(--primary-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <ShieldCheck size={19} color="var(--primary)" />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Grant Data Access Consent</h2>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: 14, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-tertiary)', marginBottom: 10 }}>
            The following data will be requested
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(dataPoints || []).map((point) => (
              <div key={point} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-primary)' }}>
                <Database size={14} color="var(--primary)" style={{ marginTop: 2, flexShrink: 0 }} />
                {point}
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
          Nothing will be pulled from any of the above sources unless you confirm below by entering the OTP sent to your mobile number.
        </p>

        {error && (
          <div style={{ padding: '10px 12px', background: 'var(--error-bg)', border: '1px solid var(--error)', color: 'var(--error)', fontSize: 12.5, fontWeight: 500, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-tertiary)', marginBottom: 8 }}>
          Enter OTP{maskedMobile ? ` sent to ${maskedMobile}` : ' sent to your mobile number'}
        </label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit code"
            className="form-control"
            style={{ flex: 1, letterSpacing: '0.3em', fontWeight: 600 }}
            autoFocus
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onResend}
            disabled={resending || cooldown > 0}
            style={{ whiteSpace: 'nowrap' }}
          >
            {cooldown > 0 ? `Resend (${cooldown}s)` : resending ? 'Sending…' : 'Resend OTP'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 20 }}>
          The code is valid for 10 minutes.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={otp.length !== 6 || submitting}
            onClick={() => onSubmit(otp)}
          >
            {submitting ? 'Verifying…' : 'Submit & Grant Consent'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsentSelfOtpModal;
