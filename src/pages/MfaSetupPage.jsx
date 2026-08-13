import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getErrorMessage } from '../utils/helpers';
import { ThemeToggle } from '../components/ThemeToggle';
import Logo from '../components/Logo';
import TravelingBorderButton from '../components/TravelingBorderButton';
import OtpInput from '../components/OtpInput';
import * as mfaApi from '../api/mfaService';

/**
 * Mandatory MFA setup — reached two ways:
 *  1. Fresh login, no method configured yet: LoginPage navigates here with a
 *     `setupToken` (state) after password success. Uses /auth/mfa/setup/*
 *     (no re-entering the password just typed).
 *  2. An already-authenticated account with a still-valid session token
 *     issued before MFA became mandatory: ProtectedRoute redirects here with
 *     no setupToken. Uses /auth/mfa/manage/* instead, which requires a
 *     step-up password re-entry first (there's no "just logged in" moment to
 *     piggyback on).
 */
const MfaSetupPage = () => {
  const { isAuthenticated, completeMfaSetup, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useTheme();

  const { setupToken, from } = location.state || {};
  const mode = setupToken ? 'fresh' : 'existing';
  // Visibility is driven purely by the backend's live NODE_ENV setting (see
  // mfa.controller.js#devBypassStatus) — deliberately not additionally gated
  // by import.meta.env.DEV, so this shows on any build (including a
  // production bundle) whenever the deployed backend itself isn't running
  // with NODE_ENV=production. The bypass endpoints themselves
  // (setupDevBypass/challengeDevBypass) independently re-check the same
  // NODE_ENV server-side regardless, so this is purely a UI-visibility
  // decision, not a security boundary — that boundary lives in the backend.
  const [backendDevBypassAvailable, setBackendDevBypassAvailable] = useState(false);
  useEffect(() => {
    mfaApi.getDevBypassStatus()
      .then((data) => setBackendDevBypassAvailable(!!data.available))
      .catch(() => setBackendDevBypassAvailable(false));
  }, []);
  const devBypassAvailable = backendDevBypassAvailable;

  const [step, setStep] = useState('choose'); // choose | totp | totp-confirm | email | email-confirm | backup-codes
  const [password, setPassword] = useState('');
  const [passwordConfirmed, setPasswordConfirmed] = useState(mode === 'fresh');
  const [totpData, setTotpData] = useState(null); // { secret, otpauthUrl, qrCodeDataUrl }
  const [code, setCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [backupCodes, setBackupCodes] = useState(null);
  const [savedAck, setSavedAck] = useState(false);
  const [completedMethods, setCompletedMethods] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [pendingCompletion, setPendingCompletion] = useState(null); // holds data.setupComplete payload until backup codes are acked

  useEffect(() => { document.title = 'Cred2Tech | Set up two-factor authentication'; }, []);

  const redirectTarget = useMemo(
    () => (from ? `${from.pathname}${from.search || ''}${from.hash || ''}` : '/'),
    [from],
  );

  if (mode === 'existing' && !isAuthenticated) return <Navigate to="/login" replace />;
  if (mode === 'fresh' && isAuthenticated) return <Navigate to="/" replace />;

  const initTotp = async () => {
    setStatus('loading'); setError('');
    try {
      const data = mode === 'fresh'
        ? await mfaApi.setupTotpInit(setupToken)
        : await mfaApi.manageTotpInit(password);
      setTotpData(data);
      setStep('totp-confirm');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally { setStatus('idle'); }
  };

  const confirmTotp = async () => {
    if (!code.trim()) { setError('Enter the 6-digit code.'); return; }
    setStatus('loading'); setError('');
    try {
      const data = mode === 'fresh'
        ? await mfaApi.setupTotpConfirm(setupToken, { secret: totpData.secret, code: code.trim() })
        : await mfaApi.manageTotpConfirm({ secret: totpData.secret, code: code.trim() });
      onMethodConfirmed('TOTP', data);
    } catch (err) {
      setError(getErrorMessage(err));
      setStatus('idle');
    }
  };

  const initEmail = async () => {
    setStatus('loading'); setError('');
    try {
      const data = mode === 'fresh'
        ? await mfaApi.setupEmailInit(setupToken)
        : await mfaApi.manageEmailInit(password, null);
      setMaskedEmail(data.maskedEmail || '');
      setStep('email-confirm');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally { setStatus('idle'); }
  };

  const confirmEmail = async () => {
    if (!code.trim()) { setError('Enter the 6-digit code.'); return; }
    setStatus('loading'); setError('');
    try {
      const data = mode === 'fresh'
        ? await mfaApi.setupEmailConfirm(setupToken, { code: code.trim() })
        : await mfaApi.manageEmailConfirm({ code: code.trim() });
      onMethodConfirmed('EMAIL_OTP', data);
    } catch (err) {
      setError(getErrorMessage(err));
      setStatus('idle');
    }
  };

  const onMethodConfirmed = (method, data) => {
    setCompletedMethods((prev) => [...prev, method]);
    setCode('');
    setStatus('idle');
    if (mode === 'fresh' && data.setupComplete) setPendingCompletion(data);
    if (data.backupCodes) {
      setBackupCodes(data.backupCodes);
      setStep('backup-codes');
    } else {
      setStep('choose');
      toast.success(`${method === 'TOTP' ? 'Authenticator app' : 'Email verification'} added.`);
    }
  };

  const finish = async () => {
    try {
      if (mode === 'fresh' && pendingCompletion) {
        completeMfaSetup(pendingCompletion);
      } else if (mode === 'existing') {
        await refreshUser();
      }
      toast.success('Two-factor authentication is set up.');
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const devBypass = async () => {
    setStatus('loading'); setError('');
    try {
      if (mode === 'fresh') {
        const data = await mfaApi.setupDevBypass(setupToken);
        completeMfaSetup(data);
      } else {
        await mfaApi.manageDevBypass();
        await refreshUser();
      }
      toast.success('MFA bypassed (dev mode).');
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setStatus('idle');
    }
  };

  const handlePasswordStepUp = (e) => {
    e.preventDefault();
    if (!password) { setError('Enter your password to continue.'); return; }
    setPasswordConfirmed(true);
    setError('');
  };

  const cardShell = (children) => (
    <div className="min-h-screen flex items-center justify-center bg-[#ffffff] dark:bg-[#0a1628] font-sans px-6 py-10">
      <div className="hidden md:flex absolute top-6 right-6 z-50"><ThemeToggle /></div>
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo size="large" /></div>
        {children}
        {devBypassAvailable && (
          <button
            type="button"
            onClick={devBypass}
            disabled={status === 'loading'}
            className="w-full mt-4 py-2.5 border border-dashed border-amber-400 dark:border-amber-600 text-[12px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 disabled:opacity-60 cursor-pointer"
          >
            Skip MFA (dev only)
          </button>
        )}
      </div>
    </div>
  );

  const errorBanner = error && (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-5 text-xs font-medium bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
      <span className="material-symbols-outlined text-[15px]">error</span>
      {error}
    </div>
  );

  // Step-up gate for the "existing session" path — required before either
  // method's init call.
  if (mode === 'existing' && !passwordConfirmed) {
    return cardShell(
      <form onSubmit={handlePasswordStepUp}>
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-[26px] text-indigo-600 dark:text-indigo-400">lock</span>
          </div>
          <h1 className="text-[24px] md:text-[28px] font-bold text-[#0a1628] dark:text-[#e6edf7] tracking-tight mb-2">
            Confirm your password
          </h1>
          <p className="text-[#0a1628]/70 dark:text-[#e6edf7]/70 text-[14px]">
            Two-factor authentication is now required on this account. Re-enter your password to set it up.
          </p>
        </div>
        {errorBanner}
        <div className="flex items-center pb-3 mb-6 border-b border-gray-200 dark:border-gray-700 focus-within:border-indigo-600 dark:focus-within:border-indigo-400 transition-colors">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="Current password"
            className="w-full bg-transparent border-0 outline-none text-[#0a1628] dark:text-[#e6edf7] text-[15px] font-semibold p-0 focus:ring-0 placeholder-gray-400 dark:placeholder-gray-600"
            autoFocus
          />
        </div>
        <TravelingBorderButton onClick={handlePasswordStepUp} className="w-full py-3.5 text-[15px] rounded-[10px]">
          Continue
        </TravelingBorderButton>
      </form>,
    );
  }

  if (step === 'choose') {
    const totpDone = completedMethods.includes('TOTP');
    const emailDone = completedMethods.includes('EMAIL_OTP');
    return cardShell(
      <>
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-[26px] text-indigo-600 dark:text-indigo-400">shield</span>
          </div>
          <h1 className="text-[24px] md:text-[28px] font-bold text-[#0a1628] dark:text-[#e6edf7] tracking-tight mb-2">
            Set up two-factor authentication
          </h1>
          <p className="text-[#0a1628]/70 dark:text-[#e6edf7]/70 text-[14px]">
            This is required for every account. Choose at least one method — you can add the other later from Settings.
          </p>
        </div>
        {errorBanner}
        <div className="space-y-3 mb-6">
          <button
            type="button"
            disabled={totpDone || status === 'loading'}
            onClick={() => { setStep('totp'); initTotp(); }}
            className="w-full flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-left bg-transparent cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px] text-indigo-600 dark:text-indigo-400">qr_code_2</span>
            <div className="flex-1">
              <p className="text-[14px] font-bold text-[#0a1628] dark:text-[#e6edf7]">Authenticator App</p>
              <p className="text-[12px] text-[#0a1628]/60 dark:text-[#e6edf7]/60">Google Authenticator, Authy, 1Password, etc.</p>
            </div>
            {totpDone && <span className="material-symbols-outlined text-[20px] text-emerald-600">check_circle</span>}
          </button>
          <button
            type="button"
            disabled={emailDone || status === 'loading'}
            onClick={() => { setStep('email'); initEmail(); }}
            className="w-full flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-left bg-transparent cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px] text-indigo-600 dark:text-indigo-400">mail</span>
            <div className="flex-1">
              <p className="text-[14px] font-bold text-[#0a1628] dark:text-[#e6edf7]">Email Code</p>
              <p className="text-[12px] text-[#0a1628]/60 dark:text-[#e6edf7]/60">A code sent to your registered email each time.</p>
            </div>
            {emailDone && <span className="material-symbols-outlined text-[20px] text-emerald-600">check_circle</span>}
          </button>
        </div>

        {completedMethods.length > 0 && (
          <TravelingBorderButton onClick={finish} className="w-full py-3.5 text-[15px] rounded-[10px]">
            Continue to dashboard
          </TravelingBorderButton>
        )}
      </>,
    );
  }

  if (step === 'totp-confirm') {
    return cardShell(
      <>
        <div className="mb-6 text-center">
          <h1 className="text-[22px] font-bold text-[#0a1628] dark:text-[#e6edf7] tracking-tight mb-2">Scan the QR code</h1>
          <p className="text-[#0a1628]/70 dark:text-[#e6edf7]/70 text-[13px]">
            Scan with your authenticator app, then enter the 6-digit code it shows.
          </p>
        </div>
        {errorBanner}
        {totpData?.qrCodeDataUrl && (
          <div className="flex justify-center mb-4">
            <img src={totpData.qrCodeDataUrl} alt="TOTP QR code" className="w-44 h-44 border border-gray-200 dark:border-gray-700" />
          </div>
        )}
        {totpData?.secret && (
          <p className="text-center text-[11px] text-[#0a1628]/50 dark:text-[#e6edf7]/50 mb-6 break-all">
            Can't scan? Enter manually: <span className="font-mono font-bold">{totpData.secret}</span>
          </p>
        )}
        <div className="mb-6">
          <OtpInput length={6} value={code} onChange={(v) => { setCode(v); setError(''); }} onEnter={confirmTotp} />
        </div>
        <TravelingBorderButton onClick={confirmTotp} disabled={status === 'loading'} className="w-full py-3.5 text-[15px] rounded-[10px]">
          {status === 'loading' ? <div className="w-5 h-5 mx-auto border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirm & Enable'}
        </TravelingBorderButton>
      </>,
    );
  }

  if (step === 'email-confirm') {
    return cardShell(
      <>
        <div className="mb-6 text-center">
          <h1 className="text-[22px] font-bold text-[#0a1628] dark:text-[#e6edf7] tracking-tight mb-2">Check your email</h1>
          <p className="text-[#0a1628]/70 dark:text-[#e6edf7]/70 text-[13px]">
            Enter the 6-digit code sent to {maskedEmail || 'your email'}.
          </p>
        </div>
        {errorBanner}
        <div className="mb-6">
          <OtpInput length={6} value={code} onChange={(v) => { setCode(v); setError(''); }} onEnter={confirmEmail} />
        </div>
        <TravelingBorderButton onClick={confirmEmail} disabled={status === 'loading'} className="w-full py-3.5 text-[15px] rounded-[10px]">
          {status === 'loading' ? <div className="w-5 h-5 mx-auto border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirm & Enable'}
        </TravelingBorderButton>
      </>,
    );
  }

  if (step === 'backup-codes') {
    return cardShell(
      <>
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-[26px] text-amber-600 dark:text-amber-400">key</span>
          </div>
          <h1 className="text-[22px] font-bold text-[#0a1628] dark:text-[#e6edf7] tracking-tight mb-2">Save your backup codes</h1>
          <p className="text-[#0a1628]/70 dark:text-[#e6edf7]/70 text-[13px]">
            Use one of these if you ever lose access to your authenticator or email. Each code works once.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4 p-4 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700">
          {backupCodes?.map((c) => (
            <span key={c} className="font-mono text-[13px] font-bold text-[#0a1628] dark:text-[#e6edf7] text-center py-1">{c}</span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(backupCodes.join('\n'));
            toast.success('Backup codes copied.');
          }}
          className="w-full mb-6 flex items-center justify-center gap-2 py-2.5 border border-gray-200 dark:border-gray-700 text-[13px] font-semibold text-[#0a1628] dark:text-[#e6edf7] bg-transparent cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">content_copy</span>
          Copy codes
        </button>
        <label className="flex items-start gap-2 mb-6 cursor-pointer">
          <input type="checkbox" checked={savedAck} onChange={(e) => setSavedAck(e.target.checked)} className="mt-0.5" />
          <span className="text-[13px] text-[#0a1628] dark:text-[#e6edf7]">I've saved these backup codes somewhere safe.</span>
        </label>
        <TravelingBorderButton
          onClick={() => { setStep('choose'); setBackupCodes(null); setSavedAck(false); }}
          disabled={!savedAck}
          className="w-full py-3.5 text-[15px] rounded-[10px]"
        >
          Continue
        </TravelingBorderButton>
      </>,
    );
  }

  // Loading placeholder for 'totp'/'email' transitional steps (init in flight)
  return cardShell(
    <div className="flex justify-center py-10">
      <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
    </div>,
  );
};

export default MfaSetupPage;
