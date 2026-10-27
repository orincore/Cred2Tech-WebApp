import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { gstAuthLinkService } from '../api/gstAuthLinkService';
import { getErrorMessage } from '../utils/helpers';
import TravelingBorderButton from '../components/TravelingBorderButton';
import { PageShell, StatusScreen, LoadingBlock, RequestedByBanner, ErrorNotice } from '../components/PublicLinkShell';
import { useLang, requesterLabel } from '../lib/publicLang';

const GstAuthPage = () => {
  const [searchParams] = useSearchParams();
  const { token: pathToken } = useParams();
  const token = pathToken || searchParams.get('token');

  const langCtx = useLang();
  const { lang, t } = langCtx;

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
    document.title = t('gstPageTitle');
  }, [t]);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    (async () => {
      try {
        const data = await gstAuthLinkService.getPublicDetails(token);
        setDetails(data);
        if (data.status === 'AUTHORIZED') setAuthorized(true);
        if (data.status === 'OTP_PENDING') setOtpPending(true);
      } catch (err) {
        setLoadError(getErrorMessage(err) || '');
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
      const message = getErrorMessage(err) || t('submitFailed');
      // Signzy only knows whether this GSTIN's portal login actually
      // supports OTP once we try it — there's no way to check ahead of time,
      // so on an OTP-mode failure point the customer at the only real
      // alternative instead of leaving them stuck.
      setSubmitError(authType === 'OTP' ? t('gstOtpFallback', { message }) : message);
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
      setOtpError(getErrorMessage(err) || t('otpSubmitFailed'));
    } finally {
      setSubmittingOtp(false);
    }
  };

  if (!token) {
    return (
      <PageShell langCtx={langCtx}>
        <StatusScreen
          icon="error"
          iconColorClass="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
          title={t('invalidLinkTitle')}
          body={t('missingTokenEmail')}
        />
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell langCtx={langCtx}>
        <LoadingBlock text={t('loadingRequest')} />
      </PageShell>
    );
  }

  if (loadError) {
    return (
      <PageShell langCtx={langCtx}>
        <StatusScreen
          icon="error"
          iconColorClass="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
          title={t('linkNotAvailable')}
          body={loadError || t('linkInvalidOrExpired')}
        />
      </PageShell>
    );
  }

  if (authorized) {
    return (
      <PageShell langCtx={langCtx}>
        <StatusScreen
          icon="check_circle"
          iconColorClass="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
          title={t('authorisationSubmitted')}
          body={t('gstSubmittedBody')}
        />
      </PageShell>
    );
  }

  if (otpPending) {
    return (
      <PageShell langCtx={langCtx}>
        <h1 className="text-[22px] font-bold text-[#0a1628] dark:text-[#e6edf7] tracking-tight mb-2">
          {t('enterYourOtp')}
        </h1>
        <p className="text-[#0a1628] dark:text-[#e6edf7] font-medium text-[14px] mb-6">
          {t('gstOtpSentBody', { gstin: details?.gstin || t('thisGstin') })}
        </p>

        {otpError && <ErrorNotice message={otpError} />}

        <div className="mb-6">
          <label className="block text-[11px] font-bold uppercase tracking-wide text-[#0a1628]/50 dark:text-[#e6edf7]/50 mb-2">
            OTP
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder={t('enterOtpPh')}
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
              <span className="skeleton-inline" style={{ width: 56, height: 10 }} />
            </div>
          ) : (
            <span>{t('submitOtp')}</span>
          )}
        </TravelingBorderButton>
      </PageShell>
    );
  }

  if (details?.status === 'REVOKED') {
    return (
      <PageShell langCtx={langCtx}>
        <StatusScreen
          icon="block"
          iconColorClass="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
          title={t('requestRevoked')}
          body={t('revokedBody', {
            by: details?.requested_by_name ? t('revokedBy', { name: details.requested_by_name }) : '',
            what: t('gstWhat'),
          })}
        />
      </PageShell>
    );
  }

  if (details?.status === 'EXPIRED') {
    return (
      <PageShell langCtx={langCtx}>
        <StatusScreen
          icon="schedule"
          iconColorClass="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
          title={t('linkExpired')}
          body={t('linkExpiredBody')}
        />
      </PageShell>
    );
  }

  const who = details?.customer_name
    ? (lang === 'hi' ? ` ${details.customer_name} के` : ` ${details.customer_name}'s`)
    : '';

  return (
    <PageShell langCtx={langCtx}>
      <h1 className="text-[22px] font-bold text-[#0a1628] dark:text-[#e6edf7] tracking-tight mb-2">
        {t('gstHeading')}
      </h1>

      <RequestedByBanner details={details} langCtx={langCtx} />

      <p className="text-[#0a1628] dark:text-[#e6edf7] font-medium text-[14px] mb-6">
        {requesterLabel(details?.requested_by_name, details?.requesting_org, lang, t)}{' '}
        {t('gstIntro', { who, gstin: details?.gstin || '—' })}
      </p>

      <p className="text-[12px] text-[#0a1628]/60 dark:text-[#e6edf7]/60 leading-relaxed mb-6">
        {t('gstNothingAccessed')} {t('termsReviewAt')}{' '}
        <a href="https://cred2tech.com" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 underline">
          cred2tech.com
        </a>.
      </p>

      {submitError && <ErrorNotice message={submitError} />}

      {/* Not every GSTIN's GST-portal login has OTP enabled — the only way to
          find out is to try (see the OTP error guidance in handleSubmit), so
          this is a choice up front rather than a capability we can detect. */}
      <div className="mb-5 inline-flex p-0.5 bg-[#f6f8ff] dark:bg-[#0f1b3d] border border-[#c7d2fe]/60 dark:border-[#2d3a6c]">
        {[
          { value: 'PASSWORD', label: t('optPassword') },
          { value: 'OTP', label: t('optOtp') },
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
          {t('gstUsername')}
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t('gstUsernamePh')}
          autoComplete="off"
          // Same defensive opt-out of mobile-keyboard text transforms as the
          // password field below, in case this username is itself
          // case-sensitive on the GST portal.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          disabled={submitting}
          className="w-full px-3 py-2.5 text-[14px] font-medium bg-white dark:bg-[#0f1b3d] border border-[#c7d2fe]/60 dark:border-[#2d3a6c] text-[#0a1628] dark:text-[#e6edf7] focus:outline-none focus:border-indigo-500 disabled:opacity-60"
        />
      </div>

      {authType === 'PASSWORD' ? (
        <div className="mb-6">
          <label className="block text-[11px] font-bold uppercase tracking-wide text-[#0a1628]/50 dark:text-[#e6edf7]/50 mb-2">
            {t('gstPassword')}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('portalPassword')}
              autoComplete="new-password"
              // Explicit opt-out of mobile-keyboard text transforms — see
              // ItrAuthPage.jsx's identical fix: some mobile keyboards
              // autocapitalize/autocorrect this field once it's shown as
              // type="text" via the eye toggle, which makes a correct
              // (case-sensitive) portal password fail on every attempt.
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              disabled={submitting}
              className="w-full px-3 py-2.5 pr-10 text-[14px] font-medium bg-white dark:bg-[#0f1b3d] border border-[#c7d2fe]/60 dark:border-[#2d3a6c] text-[#0a1628] dark:text-[#e6edf7] focus:outline-none focus:border-indigo-500 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              tabIndex={-1}
              aria-label={showPassword ? t('hidePassword') : t('showPassword')}
              className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-[#0a1628]/50 dark:text-[#e6edf7]/50 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              <span className="material-symbols-outlined text-[18px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[#0a1628]/50 dark:text-[#e6edf7]/50">
            {t('gstPasswordNote')}
          </p>
        </div>
      ) : (
        <div className="mb-6">
          <p className="text-[11px] text-[#0a1628]/50 dark:text-[#e6edf7]/50">
            {t('gstOtpNote')}
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
            <span className="skeleton-inline" style={{ width: 56, height: 10 }} />
          </div>
        ) : (
          <span>{t('authorise')}</span>
        )}
      </TravelingBorderButton>
    </PageShell>
  );
};

export default GstAuthPage;
