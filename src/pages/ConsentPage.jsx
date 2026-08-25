import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { consentService } from '../api/consentService';
import { getErrorMessage } from '../utils/helpers';
import { ThemeToggle } from '../components/ThemeToggle';
import Logo from '../components/Logo';
import TravelingBorderButton from '../components/TravelingBorderButton';

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

const ConsentPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    document.title = 'Cred2Tech | Data Consent';
  }, []);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    (async () => {
      try {
        const data = await consentService.getPublicDetails(token);
        setDetails(data);
        if (data.status === 'GRANTED') setGranted(true);
      } catch (err) {
        setLoadError(getErrorMessage(err) || 'This consent link is invalid or has expired.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleApprove = async () => {
    if (!agreed) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await consentService.approve(token);
      setGranted(true);
    } catch (err) {
      setSubmitError(getErrorMessage(err) || 'Failed to record your consent. Please try again.');
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
          body="This consent link is missing its token. Please use the link from your email."
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

  if (granted) {
    return (
      <PageShell>
        <StatusScreen
          icon="check_circle"
          iconColorClass="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
          title="Consent Approved"
          body="Thank you. Your consent has been recorded and the platform will now proceed with your loan application. You can close this page."
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <h1 className="text-[22px] font-bold text-[#0a1628] dark:text-[#e6edf7] tracking-tight mb-2">
        Data Access Consent
      </h1>
      <p className="text-[#0a1628] dark:text-[#e6edf7] font-medium text-[14px] mb-6">
        {details?.requesting_org || 'A lender partner'} on the Cred2Tech platform is requesting your consent to proceed
        {details?.customer_name ? ` with the loan application for ${details.customer_name}` : ' with your loan application'}.
      </p>

      <div className="bg-[#f6f8ff] dark:bg-[#0f1b3d] border border-[#c7d2fe]/60 dark:border-[#2d3a6c] p-4 mb-6">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#0a1628]/50 dark:text-[#e6edf7]/50 mb-2.5">
          The following data will be requested
        </p>
        <ul className="space-y-2">
          {(details?.data_points || []).map((point) => (
            <li key={point} className="flex items-start gap-2 text-[13px] font-medium text-[#0a1628] dark:text-[#e6edf7]">
              <span className="material-symbols-outlined text-[16px] text-indigo-600 dark:text-indigo-400 mt-0.5">database</span>
              {point}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[12px] text-[#0a1628]/60 dark:text-[#e6edf7]/60 leading-relaxed mb-6">
        Nothing will be pulled from any of the above sources unless you explicitly approve this request. You can
        review Cred2Tech's terms of use and privacy policy at{' '}
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

      <label className="flex items-start gap-3 mb-6 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-indigo-600 shrink-0 cursor-pointer"
        />
        <span className="text-[13px] font-medium text-[#0a1628] dark:text-[#e6edf7]">
          I have read and understood what data will be requested, and I agree to allow {details?.requesting_org || 'this platform'} to access it as described above.
        </span>
      </label>

      <TravelingBorderButton
        type="button"
        size="sm"
        disabled={!agreed || submitting}
        onClick={handleApprove}
        className="w-full rounded-none"
      >
        {submitting ? (
          <div className="flex justify-center items-center w-full h-full">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <span>Submit</span>
        )}
      </TravelingBorderButton>
    </PageShell>
  );
};

export default ConsentPage;
