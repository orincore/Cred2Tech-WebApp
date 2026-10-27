import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { consentService } from '../api/consentService';
import { getErrorMessage } from '../utils/helpers';
import TravelingBorderButton from '../components/TravelingBorderButton';
import { PageShell, StatusScreen, LoadingBlock, RequestedByBanner, ErrorNotice } from '../components/PublicLinkShell';
import { useLang, translateDataPoint, requesterLabel } from '../lib/publicLang';

const ConsentPage = () => {
  const [searchParams] = useSearchParams();
  const { token: pathToken } = useParams();
  const token = pathToken || searchParams.get('token');

  const langCtx = useLang();
  const { lang, t } = langCtx;

  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [granted, setGranted] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendNotice, setResendNotice] = useState('');

  useEffect(() => {
    document.title = t('consentPageTitle');
  }, [t]);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    (async () => {
      try {
        const data = await consentService.getPublicDetails(token);
        setDetails(data);
        if (data.status === 'GRANTED') setGranted(true);
      } catch (err) {
        setLoadError(getErrorMessage(err) || '');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleApprove = async () => {
    if (!agreed || otp.trim().length !== 6) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await consentService.approve(token, otp.trim());
      setGranted(true);
    } catch (err) {
      setSubmitError(getErrorMessage(err) || t('consentRecordFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    setSubmitError('');
    setResendNotice('');
    try {
      await consentService.resendOtp(token);
      setResendNotice(t('otpResent'));
      setResendCooldown(30);
    } catch (err) {
      setSubmitError(getErrorMessage(err) || t('resendFailed'));
    } finally {
      setResending(false);
    }
  };

  if (!token) {
    return (
      <PageShell langCtx={langCtx}>
        <StatusScreen
          icon="error"
          iconColorClass="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
          title={t('invalidLinkTitle')}
          body={t('missingTokenSms')}
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
          body={loadError || t('consentLinkInvalid')}
        />
      </PageShell>
    );
  }

  if (granted) {
    return (
      <PageShell langCtx={langCtx}>
        <StatusScreen
          icon="check_circle"
          iconColorClass="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
          title={t('consentApproved')}
          body={t('consentApprovedBody')}
        />
      </PageShell>
    );
  }

  return (
    <PageShell langCtx={langCtx}>
      <h1 className="text-[22px] font-bold text-[#0a1628] dark:text-[#e6edf7] tracking-tight mb-2">
        {t('dataAccessConsent')}
      </h1>

      <RequestedByBanner details={details} langCtx={langCtx} />

      <p className="text-[#0a1628] dark:text-[#e6edf7] font-medium text-[14px] mb-6">
        {requesterLabel(details?.requested_by_name, details?.requesting_org, lang, t)}
        {t('consentIntro')}
        {details?.customer_name ? t('consentFor', { name: details.customer_name }) : ''}.
      </p>

      <div className="bg-[#f6f8ff] dark:bg-[#0f1b3d] border border-[#c7d2fe]/60 dark:border-[#2d3a6c] p-4 mb-6">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#0a1628]/50 dark:text-[#e6edf7]/50 mb-2.5">
          {t('dataRequested')}
        </p>
        <ul className="space-y-2">
          {(details?.data_points || []).map((point) => (
            <li key={point} className="flex items-start gap-2 text-[13px] font-medium text-[#0a1628] dark:text-[#e6edf7]">
              <span className="material-symbols-outlined text-[16px] text-indigo-600 dark:text-indigo-400 mt-0.5">database</span>
              {translateDataPoint(point, t)}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[12px] text-[#0a1628]/60 dark:text-[#e6edf7]/60 leading-relaxed mb-6">
        {t('noDataUnlessApprove')}{' '}
        <a href="https://cred2tech.com" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 underline">
          {t('termsAndPrivacy')}
        </a>{' '}
        {t('beforeConsent')}
      </p>

      {submitError && <ErrorNotice message={submitError} />}

      {resendNotice && !submitError && (
        <div className="flex items-center gap-2 px-3 py-2.5 mb-5 text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">
          <span className="material-symbols-outlined text-[15px]">check_circle</span>
          {resendNotice}
        </div>
      )}

      <label className="flex items-start gap-3 mb-5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-indigo-600 shrink-0 cursor-pointer"
        />
        <span className="text-[13px] font-medium text-[#0a1628] dark:text-[#e6edf7]">
          {t('agreeText', {
            org: details?.requesting_org || t('thisPlatform'),
            person: details?.requested_by_name ? ` (${details.requested_by_name})` : '',
          })}
        </span>
      </label>

      <div className="mb-6">
        <label className="block text-[11px] font-bold uppercase tracking-wide text-[#0a1628]/50 dark:text-[#e6edf7]/50 mb-2">
          {t('enterOtp')}
          {details?.masked_mobile ? t('otpSentTo', { mobile: details.masked_mobile }) : t('otpSentToYourMobile')}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={t('sixDigitCode')}
            className="flex-1 min-w-0 px-3 py-2.5 text-[14px] font-medium tracking-[0.3em] bg-white dark:bg-[#0f1b3d] border border-[#c7d2fe]/60 dark:border-[#2d3a6c] text-[#0a1628] dark:text-[#e6edf7] focus:outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resending || resendCooldown > 0}
            className="shrink-0 px-3 text-[12px] font-bold text-indigo-600 dark:text-indigo-400 border border-[#c7d2fe]/60 dark:border-[#2d3a6c] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {resendCooldown > 0 ? t('resendIn', { s: resendCooldown }) : resending ? t('sending') : t('resendOtp')}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[#0a1628]/50 dark:text-[#e6edf7]/50">
          {t('otpValid')}
        </p>
      </div>

      <TravelingBorderButton
        type="button"
        size="sm"
        disabled={!agreed || otp.length !== 6 || submitting}
        onClick={handleApprove}
        className="w-full rounded-none"
      >
        {submitting ? (
          <div className="flex justify-center items-center w-full h-full">
            <span className="skeleton-inline" style={{ width: 56, height: 10 }} />
          </div>
        ) : (
          <span>{t('submit')}</span>
        )}
      </TravelingBorderButton>
    </PageShell>
  );
};

export default ConsentPage;
