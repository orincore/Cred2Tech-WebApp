import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Smartphone, ShieldCheck, X, Minimize2, Maximize2, Send, AlertTriangle } from 'lucide-react';
import { caseService } from '../api/caseService';
import ConfirmModal from './ui/ConfirmModal';
import PullingIndicator from './ui/PullingIndicator';

// Bureau-linked number + customer consent, shown on the Bureau page.
//
// Appears when the bureau has no record for the mobile number entered on Stage 1. The user enters the number that
// IS linked with the bureau; the server asks the bureau again and, if a report exists, HOLDS it and sends a consent
// request to that number. The report is released only after the number's owner approves. This component only
// displays what the server reports and sends the user's actions; it enforces nothing itself, so closing the tab,
// refreshing, or logging out and in shows the same state again (it lives in the database, valid for 24 hours).
//
// Stage 1's mobile number is never shown for editing here and is never changed by anything on this popup.

const errMessage = (e, fallback) => e?.response?.data?.error || fallback;

/** Whole seconds from now until an ISO time (0 if it is in the past or missing). */
const secondsUntil = (iso) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000)) : 0);

function timeLeft(expiresAt, now) {
  const ms = new Date(expiresAt).getTime() - now;
  if (!(ms > 0)) return 'expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

/**
 * @param caseId      the case
 * @param item        one entry of GET /verification/bureau/contact/:caseId/state (phase NEEDS_NUMBER | WAITING_CONSENT)
 * @param moreCount   how many other applicants are also waiting (shown as a hint)
 * @param onChanged   ask the page to re-read the state from the server
 * @param onApproved  the user (a direct customer) approved inline; the page should refresh the report
 * @param onCancelled the request was cancelled by the user
 */
const BureauContactConsentModal = ({ caseId, item, moreCount = 0, onChanged, onApproved, onCancelled }) => {
  const [minimized, setMinimized] = useState(false);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [now, setNow] = useState(Date.now());

  // A different request (new id/phase) starts from a clean form, and is shown expanded.
  useEffect(() => {
    setMobile(''); setOtp(''); setError(''); setMinimized(false);
  }, [item?.id, item?.phase]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Seconds until "Resend" may be used again (the server tells when; it enforces the limit too). Ticks every
  // second only while there is a wait, so an idle popup costs nothing.
  const [resendLeft, setResendLeft] = useState(() => secondsUntil(item?.resend_available_at));
  useEffect(() => {
    const compute = () => secondsUntil(item?.resend_available_at);
    setResendLeft(compute());
    if (compute() <= 0) return undefined;
    const t = setInterval(() => {
      const left = compute();
      setResendLeft(left);
      if (left <= 0) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [item?.id, item?.resend_available_at]);

  if (!item) return null;

  const waiting = item.phase === 'WAITING_CONSENT';
  const self = item.mode === 'SELF';
  const name = item.applicant_name || 'the applicant';

  // The customer approved and the report is being saved (a few seconds). Nothing to do but wait; the page reloads
  // itself with the report and the download button when the server says it is really done.
  if (item.phase === 'RELEASING') {
    return (
      <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Fetching the bureau report">
        <div className="modal-box" onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 42, height: 42, background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldCheck size={20} color="var(--success)" />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>Customer approved</h2>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
            The consent was approved. Fetching and saving the bureau report for <strong>{name}</strong>. This takes a few seconds.
          </p>
          <PullingIndicator label="Saving the report…" />
        </div>
      </div>
    );
  }

  const submitNumber = async (e) => {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      const out = await caseService.submitBureauNumber(caseId, item.applicant_id, mobile);
      toast.success(self ? 'A code was sent to that number.' : 'Consent request sent to that number.');
      if (out?.dev_otp) console.info('[dev] bureau consent OTP:', out.dev_otp);
      await onChanged?.();
    } catch (err) {
      const data = err?.response?.data;
      // "No record" again: stay on this step and say so; the server tells how many tries are left today.
      setError(
        data?.code === 'BUREAU_NO_RECORD' && data?.attempts_left != null
          ? `${data.error} (${data.attempts_left} ${data.attempts_left === 1 ? 'try' : 'tries'} left today)`
          : errMessage(err, 'Could not check that number. Please try again.')
      );
      if (data?.code === 'BUREAU_CONSENT_PENDING') await onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e) => {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      await caseService.approveBureauConsentSelf(caseId, item.id, otp);
      await onChanged?.();
      await onApproved?.();
    } catch (err) {
      setError(errMessage(err, 'That code could not be verified. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    setBusy(true);
    try {
      await caseService.resendBureauConsent(caseId, item.id);
      toast.success(self ? 'A new code was sent.' : 'A new consent message was sent.');
      await onChanged?.();
    } catch (err) {
      // The server says exactly how long to wait; re-read the state too so the button's countdown matches it.
      setError(errMessage(err, 'Could not send the message again. Please try again shortly.'));
      if (err?.response?.data?.code === 'RESEND_COOLDOWN') await onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await caseService.cancelBureauConsent(caseId, item.id);
      setConfirmCancel(false);
      toast(waiting ? 'Bureau consent request cancelled.' : 'Bureau pull skipped for now.');
      // Tell the page it was this user's own cancel BEFORE it re-reads state, so it does not report an unexplained end.
      onCancelled?.();
      await onChanged?.();
    } catch (err) {
      setConfirmCancel(false);
      toast.error(errMessage(err, 'Could not cancel the request.'));
    } finally {
      setBusy(false);
    }
  };

  // Minimized: a small bar that keeps the request alive in the background while the user works elsewhere.
  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        aria-label="Open the bureau consent request"
        style={{
          position: 'fixed', right: 20, bottom: 20, zIndex: 900, display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--outline)',
          boxShadow: 'var(--shadow-lg)', cursor: 'pointer', color: 'var(--text-primary)', maxWidth: 'calc(100vw - 40px)',
        }}
      >
        {waiting ? <PullingIndicator label="" /> : <Smartphone size={16} color="var(--warning)" />}
        <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'left' }}>
          {waiting ? 'Waiting for the customer’s consent' : 'Bureau number needed'}
          <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
            {name}{waiting && item.expires_at ? ` · ${timeLeft(item.expires_at, now)}` : ''}
          </span>
        </span>
        <Maximize2 size={14} />
      </button>
    );
  }

  return (
    <>
      <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Bureau consent">
        <div className="modal-box" onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, background: 'var(--warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {waiting ? <ShieldCheck size={20} color="var(--warning)" /> : <Smartphone size={20} color="var(--warning)" />}
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}>
                {waiting ? 'Waiting for the customer’s consent' : 'Enter the bureau-linked mobile number'}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-ghost btn-icon" onClick={() => setMinimized(true)} aria-label="Minimize" title="Minimize — it keeps running in the background">
                <Minimize2 size={16} />
              </button>
            </div>
          </div>

          {!waiting && (
            <form onSubmit={submitNumber}>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                The credit bureau has no record for the mobile number entered on Stage 1 for <strong>{name}</strong>.
                Enter the mobile number that is <strong>linked with the credit bureau</strong>. A consent message is sent to that number,
                and the bureau report is shown only after the customer approves it.
              </p>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label" htmlFor="bureau-contact-mobile">Mobile number linked with the bureau</label>
                <input
                  id="bureau-contact-mobile"
                  className="form-control"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="9820012345"
                  maxLength={14}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/[^\d+\s-]/g, ''))}
                  disabled={busy}
                  autoFocus
                />
              </div>
              {error && (
                <div className="notice notice-error" style={{ marginBottom: 12 }}>
                  <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}
              <p style={{ fontSize: 12, color: 'var(--text-tertiary, var(--text-secondary))', marginBottom: 20 }}>
                The mobile number on Stage 1 is not changed.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-ghost" onClick={cancel} disabled={busy}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={busy || mobile.replace(/\D/g, '').length < 10}>
                  {busy ? 'Checking…' : 'Check & send consent'}
                </button>
              </div>
            </form>
          )}

          {waiting && (
            <div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
                {self ? (
                  <>A code was sent to <strong>{item.masked_mobile}</strong>, the mobile number linked with your bureau record. Enter it to approve and see your report.</>
                ) : (
                  <>A consent link and code were sent by SMS to <strong>{item.masked_mobile}</strong>, the mobile number linked with the bureau, for <strong>{name}</strong>.
                  The bureau report is shown here only after the customer approves.</>
                )}
              </p>

              {!self && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--primary-subtle)', marginBottom: 14 }}>
                  <PullingIndicator label="Waiting for approval…" />
                </div>
              )}

              {self && (
                <form onSubmit={verifyOtp} style={{ marginBottom: 12 }}>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label" htmlFor="bureau-contact-otp">Code sent to {item.masked_mobile}</label>
                    <input
                      id="bureau-contact-otp"
                      className="form-control"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="6-digit code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      disabled={busy}
                      autoFocus
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={busy || otp.length !== 6} style={{ width: '100%', justifyContent: 'center' }}>
                    {busy ? 'Verifying…' : 'Approve & show my report'}
                  </button>
                </form>
              )}

              {error && (
                <div className="notice notice-error" style={{ marginBottom: 12 }}>
                  <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 18 }}>
                {item.expires_at ? `This request stays active for 24 hours (${timeLeft(item.expires_at, now)}). ` : ''}
                You can minimize this and keep working, or close the page: it will still be here when you come back.
              </p>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-ghost" onClick={resend} disabled={busy || resendLeft > 0}
                  title={resendLeft > 0 ? 'You can send it again shortly. The earlier link stops working when you do.' : 'Send it again (the earlier link stops working)'}>
                  <Send size={14} /> {self ? 'Resend code' : 'Resend SMS'}
                  {resendLeft > 0 && ` in ${Math.floor(resendLeft / 60)}:${String(resendLeft % 60).padStart(2, '0')}`}
                </button>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setMinimized(true)} disabled={busy}>Minimize</button>
                  <button type="button" className="btn btn-danger" onClick={() => setConfirmCancel(true)} disabled={busy}>
                    <X size={14} /> Cancel request
                  </button>
                </div>
              </div>
            </div>
          )}

          {moreCount > 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 14 }}>
              {moreCount} more applicant{moreCount > 1 ? 's' : ''} also need{moreCount > 1 ? '' : 's'} a bureau consent; they appear next.
            </p>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={cancel}
        isLoading={busy}
        danger={false}
        title="Cancel this consent request?"
        message="The customer will no longer be able to approve it, and the bureau data that was fetched is discarded. You can start again with the pull button."
        confirmLabel="Cancel request"
        cancelLabel="Keep waiting"
      />
    </>
  );
};

export default BureauContactConsentModal;
