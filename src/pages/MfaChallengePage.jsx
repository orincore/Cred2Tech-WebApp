import React, { useState, useEffect, useRef, useCallback } from 'react';
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

const METHOD_LABEL = { TOTP: 'Authenticator App', EMAIL_OTP: 'Email Code', MOBILE_OTP: 'Text Message' };
const RESEND_COOLDOWN_S = 30;

const MfaChallengePage = () => {
  const { verifyMfaChallenge, devBypassMfaChallenge, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useTheme();

  const { challengeToken, methods = [], recoveryOptions = {}, from } = location.state || {};
  // Visibility is driven purely by the backend's live NODE_ENV (see the
  // identical pattern on MfaSetupPage.jsx) — deliberately not additionally
  // gated by import.meta.env.DEV, so this build-independent and reflects
  // whatever the deployed backend's NODE_ENV actually is. The backend's own
  // bypass endpoints (devBypassChallenge/devBypassMfa) independently
  // re-check NODE_ENV themselves regardless of this flag, so this only ever
  // controls whether the button is *shown*, never whether the bypass itself
  // is honored server-side.
  const [backendDevBypassAvailable, setBackendDevBypassAvailable] = useState(false);
  useEffect(() => {
    mfaApi.getDevBypassStatus()
      .then((data) => setBackendDevBypassAvailable(!!data.available))
      .catch(() => setBackendDevBypassAvailable(false));
  }, []);
  const devBypassAvailable = backendDevBypassAvailable;

  const [mode, setMode] = useState(() => (methods.includes('TOTP') ? 'TOTP' : methods[0] || 'EMAIL_OTP'));
  const [showRecovery, setShowRecovery] = useState(false);
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | sending | verifying | error
  const [error, setError] = useState('');
  const [maskedDestination, setMaskedDestination] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { document.title = 'Cred2Tech | Verify it\'s you'; }, []);
  useEffect(() => { inputRef.current?.focus(); }, [mode]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = useCallback(async (method) => {
    setStatus('sending');
    setError('');
    try {
      const data = method === 'MOBILE_OTP'
        ? await mfaApi.challengeSendMobileOtp(challengeToken)
        : await mfaApi.challengeSendEmailOtp(challengeToken);
      setMaskedDestination(data.maskedEmail || data.maskedMobile || '');
      setCooldown(RESEND_COOLDOWN_S);
      setOtpSent(true);
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(getErrorMessage(err));
    }
  }, [challengeToken]);

  // No longer auto-sends on entering an OTP-based mode — switching between
  // methods (e.g. checking what Email Code looks like, then going back to
  // the authenticator app) used to fire off a real OTP every single time,
  // which is unnecessary noise/cost. Sending is now an explicit user action
  // (the "Send OTP" button below) — this effect just resets state for the
  // newly-selected mode.
  useEffect(() => {
    setCode('');
    setOtpSent(false);
    setMaskedDestination('');
    setCooldown(0);
  }, [mode]);

  if (!challengeToken) return <Navigate to="/login" replace />;
  if (isAuthenticated) return <Navigate to="/" replace />;

  const redirectTarget = from ? `${from.pathname}${from.search || ''}${from.hash || ''}` : '/';

  const handleVerify = async () => {
    if (isOtpMode && !otpSent) { setError('Send a code first.'); return; }
    if (!code.trim()) { setError('Enter the code to continue.'); return; }
    setStatus('verifying');
    setError('');
    try {
      await verifyMfaChallenge({ challengeToken, method: mode, code: code.trim(), trustDevice });
      toast.success('Signed in successfully.');
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      setStatus('error');
      const msg = getErrorMessage(err);
      setError(msg);
      toast.error(msg);
    }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleVerify(); };

  const devBypass = async () => {
    setStatus('verifying'); setError('');
    try {
      await devBypassMfaChallenge(challengeToken);
      toast.success('MFA bypassed (dev mode).');
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      setStatus('error');
      setError(getErrorMessage(err));
    }
  };

  const isOtpMode = mode === 'EMAIL_OTP' || mode === 'MOBILE_OTP';
  const isBackupMode = mode === 'BACKUP_CODE';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#ffffff] dark:bg-[#0a1628] font-sans px-6 py-10">
      <div className="hidden md:flex absolute top-6 right-6 z-50"><ThemeToggle /></div>

      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo size="large" /></div>

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-[26px] text-indigo-600 dark:text-indigo-400">
              {isBackupMode ? 'key' : 'verified_user'}
            </span>
          </div>
          <h1 className="text-[24px] md:text-[28px] font-bold text-[#0a1628] dark:text-[#e6edf7] tracking-tight mb-2">
            Verify it's you
          </h1>
          <p className="text-[#0a1628]/70 dark:text-[#e6edf7]/70 text-[14px]">
            {isBackupMode
              ? 'Enter one of your saved backup codes.'
              : mode === 'TOTP'
                ? 'Enter the 6-digit code from your authenticator app.'
                : otpSent
                  ? `Enter the code sent to ${maskedDestination || (mode === 'MOBILE_OTP' ? 'your phone' : 'your email')}.`
                  : `Click "Send OTP" to get a code by ${mode === 'MOBILE_OTP' ? 'text message' : 'email'}.`}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-5 text-xs font-medium bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
            <span className="material-symbols-outlined text-[15px]">error</span>
            {error}
          </div>
        )}

        {/* Method switcher */}
        {methods.length > 1 && !showRecovery && (
          <div className="flex gap-2 mb-6">
            {methods.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2 text-[13px] font-semibold border transition-colors cursor-pointer ${
                  mode === m
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-transparent border-gray-200 dark:border-gray-700 text-[#0a1628] dark:text-[#e6edf7]'
                }`}
              >
                {METHOD_LABEL[m]}
              </button>
            ))}
          </div>
        )}

        {isBackupMode ? (
          <div className="flex items-center justify-center pb-3 mb-2 border-b border-gray-200 dark:border-gray-700 focus-within:border-indigo-600 dark:focus-within:border-indigo-400 transition-colors">
            <input
              ref={inputRef}
              type="text"
              autoComplete="one-time-code"
              maxLength={11}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''));
                setError('');
              }}
              onKeyDown={handleKeyDown}
              placeholder="XXXXX-XXXXX"
              className="w-full bg-transparent border-0 outline-none text-center text-[#0a1628] dark:text-[#e6edf7] text-[22px] font-bold tracking-[0.4em] p-0 focus:ring-0 placeholder-gray-400 dark:placeholder-gray-600"
            />
          </div>
        ) : (
          <div className="mb-2">
            <OtpInput
              key={`${mode}-${otpSent}`}
              length={6}
              value={code}
              disabled={isOtpMode && !otpSent}
              onChange={(v) => { setCode(v); setError(''); }}
              onEnter={handleVerify}
            />
          </div>
        )}

        {isOtpMode && !otpSent && (
          <div className="mb-6">
            <button
              type="button"
              disabled={status === 'sending'}
              onClick={() => sendCode(mode)}
              className="w-full py-2.5 text-[13px] font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 disabled:opacity-50 cursor-pointer"
            >
              {status === 'sending' ? 'Sending…' : `Send OTP by ${mode === 'MOBILE_OTP' ? 'text message' : 'email'}`}
            </button>
          </div>
        )}
        {isOtpMode && otpSent && (
          <div className="flex justify-between items-center text-[12px] mb-6 px-1">
            <span className="text-[#0a1628]/50 dark:text-[#e6edf7]/50">Code valid for 10 minutes</span>
            <button
              type="button"
              disabled={cooldown > 0 || status === 'sending'}
              onClick={() => sendCode(mode)}
              className="font-semibold text-indigo-600 dark:text-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed bg-transparent border-0 cursor-pointer"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
          </div>
        )}
        {!isOtpMode && <div className="mb-6" />}

        <label className="flex items-center gap-2 mb-5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
            className="w-4 h-4 accent-indigo-600 cursor-pointer"
          />
          <span className="text-[13px] font-medium text-[#0a1628] dark:text-[#e6edf7]">
            Trust this device for 30 days
          </span>
        </label>

        <TravelingBorderButton onClick={handleVerify} disabled={status === 'verifying'} className="w-full py-3.5 text-[15px] rounded-[10px]">
          {status === 'verifying' ? (
            <div className="flex justify-center items-center w-full h-full">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          ) : 'Verify & Continue'}
        </TravelingBorderButton>

        {devBypassAvailable && (
          <button
            type="button"
            onClick={devBypass}
            disabled={status === 'verifying'}
            className="w-full mt-4 py-2.5 border border-dashed border-amber-400 dark:border-amber-600 text-[12px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 disabled:opacity-60 cursor-pointer"
          >
            Skip MFA (dev only)
          </button>
        )}

        <div className="mt-6 text-center">
          {!showRecovery ? (
            <button
              type="button"
              onClick={() => { setShowRecovery(true); setMode('BACKUP_CODE'); setError(''); }}
              className="text-[13px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline bg-transparent border-0 cursor-pointer"
            >
              Having trouble? Use a backup code
            </button>
          ) : (
            <div className="flex flex-col gap-2 items-center">
              <button
                type="button"
                onClick={() => { setShowRecovery(false); setMode(methods.includes('TOTP') ? 'TOTP' : methods[0]); setError(''); }}
                className="text-[13px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline bg-transparent border-0 cursor-pointer"
              >
                Back to normal sign-in
              </button>
              {recoveryOptions.mobileOtp && mode !== 'MOBILE_OTP' && (
                <button
                  type="button"
                  onClick={() => { setMode('MOBILE_OTP'); setError(''); }}
                  className="text-[13px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline bg-transparent border-0 cursor-pointer"
                >
                  Text me a code instead
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MfaChallengePage;
