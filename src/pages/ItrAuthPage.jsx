import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { itrAuthLinkService } from '../api/itrAuthLinkService';
import { getErrorMessage } from '../utils/helpers';
import TravelingBorderButton from '../components/TravelingBorderButton';
import { PageShell, StatusScreen, LoadingBlock, RequestedByBanner, ErrorNotice } from '../components/PublicLinkShell';
import { useLang, requesterLabel } from '../lib/publicLang';

const ItrAuthPage = () => {
  const [searchParams] = useSearchParams();
  const { token: pathToken } = useParams();
  const token = pathToken || searchParams.get('token');

  const langCtx = useLang();
  const { lang, t } = langCtx;

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
    document.title = t('itrPageTitle');
  }, [t]);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    (async () => {
      try {
        const data = await itrAuthLinkService.getPublicDetails(token);
        setDetails(data);
        if (data.status === 'AUTHORIZED') setAuthorized(true);
      } catch (err) {
        setLoadError(getErrorMessage(err) || '');
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
      setSubmitError(getErrorMessage(err) || t('submitFailed'));
    } finally {
      setSubmitting(false);
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
          body={t('itrSubmittedBody')}
        />
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
            what: t('itrWhat'),
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

  const who = lang === 'hi'
    ? (details?.customer_name ? ` ${details.customer_name} के` : ' आपके')
    : (details?.customer_name ? ` ${details.customer_name}'s` : ' your');

  return (
    <PageShell langCtx={langCtx}>
      <h1 className="text-[22px] font-bold text-[#0a1628] dark:text-[#e6edf7] tracking-tight mb-2">
        {t('itrHeading')}
      </h1>

      <RequestedByBanner details={details} langCtx={langCtx} />

      <p className="text-[#0a1628] dark:text-[#e6edf7] font-medium text-[14px] mb-6">
        {requesterLabel(details?.requested_by_name, details?.requesting_org, lang, t)}{' '}
        {t('itrIntro', { who })}
      </p>

      <p className="text-[12px] text-[#0a1628]/60 dark:text-[#e6edf7]/60 leading-relaxed mb-6">
        {t('itrNothingAccessed')} {t('termsReviewAt')}{' '}
        <a href="https://cred2tech.com" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 underline">
          cred2tech.com
        </a>.
      </p>

      {submitError && <ErrorNotice message={submitError} />}

      <div className="mb-5">
        <label className="block text-[11px] font-bold uppercase tracking-wide text-[#0a1628]/50 dark:text-[#e6edf7]/50 mb-2">
          {t('panUsername')}
        </label>
        <input
          type="text"
          value={pan}
          onChange={(e) => setPan(e.target.value.toUpperCase())}
          placeholder="ABCDE1234F"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck="false"
          disabled={submitting}
          className="w-full px-3 py-2.5 text-[14px] font-medium tracking-[0.08em] bg-white dark:bg-[#0f1b3d] border border-[#c7d2fe]/60 dark:border-[#2d3a6c] text-[#0a1628] dark:text-[#e6edf7] focus:outline-none focus:border-indigo-500 disabled:opacity-60"
        />
      </div>

      <div className="mb-6">
        <label className="block text-[11px] font-bold uppercase tracking-wide text-[#0a1628]/50 dark:text-[#e6edf7]/50 mb-2">
          {t('itrPassword')}
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('portalPassword')}
            disabled={submitting}
            // Explicit opt-out of mobile-keyboard text transforms. Without
            // this, some keyboards carry over the all-caps shift state from the
            // PAN field above (which deliberately sets autoCapitalize="characters"),
            // or autocapitalize/autocorrect once this field is shown as
            // type="text" via the eye toggle. A password is case-sensitive, so a
            // silently auto-capitalized first letter makes a correct password
            // fail against the provider on every attempt (reproduced as 8
            // straight provider rejections on one real case).
            // autoComplete="off" because this isn't the customer's account on
            // OUR site — a browser shouldn't suggest an unrelated saved password.
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck="false"
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
          {t('itrPasswordNote')}
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
            <span className="skeleton-inline" style={{ width: 56, height: 10 }} />
          </div>
        ) : (
          <span>{t('authorise')}</span>
        )}
      </TravelingBorderButton>
    </PageShell>
  );
};

export default ItrAuthPage;
