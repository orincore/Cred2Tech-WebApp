import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { gstAuthLinkService } from '../api/gstAuthLinkService';
import { getErrorMessage } from '../utils/helpers';
import { ThemeToggle } from '../components/ThemeToggle';
import Logo from '../components/Logo';
import TravelingBorderButton from '../components/TravelingBorderButton';

// Same shell/status-screen shapes as ConsentPage.jsx/ItrAuthPage.jsx — this
// page follows the exact same customer-facing theme (brand palette,
// sharp-edged card, dark mode support) so all three link types read as one
// product.
const PageShell = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center bg-[#eef4ff] dark:bg-[#0a1628] font-sans px-6 py-10 relative">
    <div className="absolute top-6 right-6 z-50">
      <ThemeToggle />
    </div>
    <div className="w-full max-w-lg">
      <div className="flex justify-center mb-8">
        <Logo size="large" />
      </div>
      <div className="bg-white dark:bg-[#162048] rounded-none shadow-xl border border-[#c7d2fe]/60 dark:border-[#2d3a6c] p-8 md:p-10">
        {children}
      </div>
    </div>
  </div>
);

const StatusScreen = ({ icon, iconColorClass, title, body, action }) => (
  <div className="text-center">
    <div className={`mx-auto mb-4 w-14 h-14 rounded-full ${iconColorClass} flex items-center justify-center`}>
      <span className="material-symbols-outlined text-[28px]">{icon}</span>
    </div>
    <h1 className="text-[22px] font-bold text-[#0a1628] dark:text-[#e6edf7] mb-2">{title}</h1>
    <p className="text-[#0a1628] dark:text-[#e6edf7] font-medium text-[14px] leading-relaxed mb-2">{body}</p>
    {action}
  </div>
);

const GstAuthPage = () => {
  const [searchParams] = useSearchParams();
  const { token: pathToken } = useParams();
  const token = pathToken || searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authType, setAuthType] = useState('PASSWORD');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [authorized, setAuthorized] = useState(false);
  // Set once the initial submission (OTP mode) puts the request into
  // OTP_PENDING — either from this page's own submit, or from the details
  // fetch on load/reload (see the effect below), so a page refresh mid-flow
  // still lands on the OTP step instead of the credentials form again.
  const [otpPending, setOtpPending] = useState(false);
  const [otp, setOtp] = useState('');
  const [submittingOtp, setSubmittingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');

  useEffect(() => {
    document.title = 'Cred2Tech | Authorise GST Access';
  }, []);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    (async () => {
      try {
        const data = await gstAuthLinkService.getPublicDetails(token);
        setDetails(data);
        if (data.status === 'AUTHORIZED') setAuthorized(true);
        if (data.status === 'OTP_PENDING') setOtpPending(true);
      } catch (err) {
        setLoadError(getErrorMessage(err) || 'This link is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const canSubmit = username.trim().length > 0 && (authType === 'OTP' || password.length > 0) && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const result = await gstAuthLinkService.submit(token, { username: username.trim(), password, authType });
      // Clear credentials from memory immediately — nothing about them is
      // needed again, whichever path this takes next.
      setPassword('');
      if (result.status === 'OTP_PENDING') {
        setOtpPending(true);
      } else {
        setAuthorized(true);
      }
    } catch (err) {
      const message = getErrorMessage(err) || 'Failed to submit your authorisation. Please check your details and try again.';
      // Signzy only knows whether this GSTIN's portal login actually
      // supports OTP once we try it — there's no way to check ahead of time,
      // so on an OTP-mode failure point the customer at the only real
      // alternative instead of leaving them stuck.
      setSubmitError(authType === 'OTP'
        ? `${message} If OTP login isn't available for this GSTIN, switch to Password below and try again.`
        : message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitOtp = async () => {
    if (!otp.trim() || submittingOtp) return;
    setSubmittingOtp(true);
    setOtpError('');
    try {
      await gstAuthLinkService.submitOtp(token, otp.trim());
      setAuthorized(true);
      setOtpPending(false);
      setOtp('');
    } catch (err) {
      setOtpError(getErrorMessage(err) || 'Failed to submit OTP. Please check the code and try again.');
    } finally {
      setSubmittingOtp(false);
    }
  };

  if (!token) {
    return (
      <PageShell>
        <StatusScreen
          icon="error"
          iconColorClass="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
          title="Invalid Link"
          body="This link is missing its token. Please use the link from your email."
        />
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mb-4" />
          <p className="text-[13px] font-medium text-[#0a1628]/60 dark:text-[#e6edf7]/60">Loading your request…</p>
        </div>
      </PageShell>
    );
  }

  if (loadError) {
    return (
      <PageShell>
        <StatusScreen
          icon="error"
          iconColorClass="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
          title="Link Not Available"
          body={loadError}
        />
      </PageShell>
    );
  }

  if (authorized) {
    return (
      <PageShell>
        <StatusScreen
          icon="check_circle"
          iconColorClass="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
          title="Authorisation Submitted"
          body="Thank you. Your GST portal access has been submitted and your representative will be notified once processing completes. You can close this page."
        />
      </PageShell>
    );
  }

  if (otpPending) {
    return (
      <PageShell>
        <h1 className="text-[22px] font-bold text-[#0a1628] dark:text-[#e6edf7] tracking-tight mb-2">
          Enter Your OTP
        </h1>
        <p className="text-[#0a1628] dark:text-[#e6edf7] font-medium text-[14px] mb-6">
          The GST portal has sent a one-time password to the mobile number or email registered for{' '}
          <span className="font-bold">{details?.gstin || 'this GSTIN'}</span>. Enter it below to complete your
          authorisation.
        </p>

        {otpError && (
          <div className="flex items-center gap-2 px-3 py-2.5 mb-5 text-xs font-medium bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
            <span className="material-symbols-outlined text-[15px]">error</span>
            {otpError}
          </div>
        )}

        <div className="mb-6">
          <label className="block text-[11px] font-bold uppercase tracking-wide text-[#0a1628]/50 dark:text-[#e6edf7]/50 mb-2">
            OTP
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter OTP"
            maxLength={8}
            autoComplete="one-time-code"
            disabled={submittingOtp}
            className="w-full px-3 py-2.5 text-[14px] font-medium bg-white dark:bg-[#0f1b3d] border border-[#c7d2fe]/60 dark:border-[#2d3a6c] text-[#0a1628] dark:text-[#e6edf7] focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          />
        </div>

        <TravelingBorderButton
          type="button"
          size="sm"
          disabled={!otp.trim() || submittingOtp}
          onClick={handleSubmitOtp}
          className="w-full rounded-none"
        >
          {submittingOtp ? (
            <div className="flex justify-center items-center w-full h-full">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          ) : (
            <span>Submit OTP</span>
          )}
        </TravelingBorderButton>
      </PageShell>
    );
  }

  if (details?.status === 'REVOKED') {
    return (
      <PageShell>
        <StatusScreen
          icon="block"
          iconColorClass="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
          title="Request Revoked"
          body={`This request has been revoked${details?.requested_by_name ? ` by ${details.requested_by_name}` : ''}. Please contact your representative if you still need to share your GST data.`}
        />
      </PageShell>
    );
  }

  if (details?.status === 'EXPIRED') {
    return (
      <PageShell>
        <StatusScreen
          icon="schedule"
          iconColorClass="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
          title="Link Expired"
          body="This link has expired. Please ask your representative to send you a new one."
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <h1 className="text-[22px] font-bold text-[#0a1628] dark:text-[#e6edf7] tracking-tight mb-2">
        Authorise GST Access
      </h1>

      {(details?.requested_by_name || details?.requesting_org) && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[#f6f8ff] dark:bg-[#0f1b3d] border border-[#c7d2fe]/60 dark:border-[#2d3a6c]">
          <span className="material-symbols-outlined text-[16px] text-indigo-600 dark:text-indigo-400">badge</span>
          <p className="text-[12px] font-medium text-[#0a1628] dark:text-[#e6edf7]">
            Requested by{' '}
            <span className="font-bold">{details?.requested_by_name || 'a representative'}</span>
            {details?.requesting_org && (
              <>
                {' '}from <span className="font-bold">{details.requesting_org}</span>
              </>
            )}
          </p>
        </div>
      )}

      <p className="text-[#0a1628] dark:text-[#e6edf7] font-medium text-[14px] mb-6">
        {details?.requested_by_name || 'A representative'}
        {details?.requesting_org ? ` from ${details.requesting_org}` : ''} is requesting access to the GST filing data
        for{details?.customer_name ? ` ${details.customer_name}'s` : ''} GSTIN{' '}
        <span className="font-bold">{details?.gstin || '—'}</span> to proceed with the loan application. Enter your
        GST portal username and password below to authorise this securely.
      </p>

      <p className="text-[12px] text-[#0a1628]/60 dark:text-[#e6edf7]/60 leading-relaxed mb-6">
        Nothing will be accessed from the GST portal unless you submit this form yourself. You can review
        Cred2Tech's terms of use and privacy policy at{' '}
        <a href="https://cred2tech.com" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 underline">
          cred2tech.com
        </a>.
      </p>

      {submitError && (
        <div className="flex items-center gap-2 px-3 py-2.5 mb-5 text-xs font-medium bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
          <span className="material-symbols-outlined text-[15px]">error</span>
          {submitError}
        </div>
      )}

      {/* Not every GSTIN's GST-portal login has OTP enabled — the only way to
          find out is to try (see the OTP error guidance in handleSubmit), so
          this is a choice up front rather than a capability we can detect. */}
      <div className="mb-5 inline-flex p-0.5 bg-[#f6f8ff] dark:bg-[#0f1b3d] border border-[#c7d2fe]/60 dark:border-[#2d3a6c]">
        {[
          { value: 'PASSWORD', label: 'Password' },
          { value: 'OTP', label: 'OTP' },
        ].map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setAuthType(opt.value)}
            disabled={submitting}
            className={`px-3 py-1.5 text-[12px] font-bold transition-colors ${
              authType === opt.value
                ? 'bg-indigo-600 text-white'
                : 'text-[#0a1628]/60 dark:text-[#e6edf7]/60'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="mb-5">
        <label className="block text-[11px] font-bold uppercase tracking-wide text-[#0a1628]/50 dark:text-[#e6edf7]/50 mb-2">
          GST Portal Username
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="GST portal username"
          autoComplete="off"
          disabled={submitting}
          className="w-full px-3 py-2.5 text-[14px] font-medium bg-white dark:bg-[#0f1b3d] border border-[#c7d2fe]/60 dark:border-[#2d3a6c] text-[#0a1628] dark:text-[#e6edf7] focus:outline-none focus:border-indigo-500 disabled:opacity-60"
        />
      </div>

      {authType === 'PASSWORD' ? (
        <div className="mb-6">
          <label className="block text-[11px] font-bold uppercase tracking-wide text-[#0a1628]/50 dark:text-[#e6edf7]/50 mb-2">
            GST Portal Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your portal password"
              autoComplete="new-password"
              disabled={submitting}
              className="w-full px-3 py-2.5 pr-10 text-[14px] font-medium bg-white dark:bg-[#0f1b3d] border border-[#c7d2fe]/60 dark:border-[#2d3a6c] text-[#0a1628] dark:text-[#e6edf7] focus:outline-none focus:border-indigo-500 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-[#0a1628]/50 dark:text-[#e6edf7]/50 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              <span className="material-symbols-outlined text-[18px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[#0a1628]/50 dark:text-[#e6edf7]/50">
            This is the same password you use to log in to the GST portal — it is sent directly to the portal and is
            never stored.
          </p>
        </div>
      ) : (
        <div className="mb-6">
          <p className="text-[11px] text-[#0a1628]/50 dark:text-[#e6edf7]/50">
            After you submit, the GST portal will send an OTP to the mobile/email registered for this username — you'll
            enter it on the next step. If this GSTIN doesn't have OTP login enabled, the request will fail and you'll
            need to switch to Password.
          </p>
        </div>
      )}

      <TravelingBorderButton
        type="button"
        size="sm"
        disabled={!canSubmit}
        onClick={handleSubmit}
        className="w-full rounded-none"
      >
        {submitting ? (
          <div className="flex justify-center items-center w-full h-full">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <span>Authorise</span>
        )}
      </TravelingBorderButton>
    </PageShell>
  );
};

export default GstAuthPage;
