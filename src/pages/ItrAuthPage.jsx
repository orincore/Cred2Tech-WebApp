import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { itrAuthLinkService } from '../api/itrAuthLinkService';
import { getErrorMessage } from '../utils/helpers';
import { ThemeToggle } from '../components/ThemeToggle';
import Logo from '../components/Logo';
import TravelingBorderButton from '../components/TravelingBorderButton';

// Same shell/status-screen shapes as ConsentPage.jsx — this page follows the
// exact same customer-facing theme (brand palette, sharp-edged card, dark
// mode support) so the two link types read as one product, not two.
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

const ItrAuthPage = () => {
  const [searchParams] = useSearchParams();
  const { token: pathToken } = useParams();
  const token = pathToken || searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [pan, setPan] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    document.title = 'Cred2Tech | Authorise ITR Access';
  }, []);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    (async () => {
      try {
        const data = await itrAuthLinkService.getPublicDetails(token);
        setDetails(data);
        if (data.status === 'AUTHORIZED') setAuthorized(true);
      } catch (err) {
        setLoadError(getErrorMessage(err) || 'This link is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const canSubmit = pan.trim().length > 0 && password.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await itrAuthLinkService.submit(token, { pan: pan.trim().toUpperCase(), password });
      setAuthorized(true);
      // Clear credentials from memory immediately — nothing about them is
      // needed again once the submission has succeeded.
      setPassword('');
    } catch (err) {
      setSubmitError(getErrorMessage(err) || 'Failed to submit your authorisation. Please check your details and try again.');
    } finally {
      setSubmitting(false);
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
          body="Thank you. Your ITR portal access has been submitted and your representative will be notified once processing completes. You can close this page."
        />
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
          body={`This request has been revoked${details?.requested_by_name ? ` by ${details.requested_by_name}` : ''}. Please contact your representative if you still need to share your ITR data.`}
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
        Authorise ITR Access
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
        {details?.requesting_org ? ` from ${details.requesting_org}` : ''} is requesting access to your Income Tax
        Return (ITR) filing data to proceed with{details?.customer_name ? ` ${details.customer_name}'s` : ' your'} loan
        application. Enter your Income Tax e-filing PAN/username and portal password below to authorise this securely.
      </p>

      <p className="text-[12px] text-[#0a1628]/60 dark:text-[#e6edf7]/60 leading-relaxed mb-6">
        Nothing will be accessed from the Income Tax portal unless you submit this form yourself. You can review
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

      <div className="mb-5">
        <label className="block text-[11px] font-bold uppercase tracking-wide text-[#0a1628]/50 dark:text-[#e6edf7]/50 mb-2">
          PAN / ITR Username
        </label>
        <input
          type="text"
          value={pan}
          onChange={(e) => setPan(e.target.value.toUpperCase())}
          placeholder="ABCDE1234F"
          autoCapitalize="characters"
          disabled={submitting}
          className="w-full px-3 py-2.5 text-[14px] font-medium tracking-[0.08em] bg-white dark:bg-[#0f1b3d] border border-[#c7d2fe]/60 dark:border-[#2d3a6c] text-[#0a1628] dark:text-[#e6edf7] focus:outline-none focus:border-indigo-500 disabled:opacity-60"
        />
      </div>

      <div className="mb-6">
        <label className="block text-[11px] font-bold uppercase tracking-wide text-[#0a1628]/50 dark:text-[#e6edf7]/50 mb-2">
          ITR Portal Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your portal password"
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
          This is the same password you use to log in to the Income Tax e-filing portal — it is sent directly to the
          portal and is never stored.
        </p>
      </div>

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

export default ItrAuthPage;
