import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getErrorMessage } from '../utils/helpers';
import { ThemeToggle } from '../components/ThemeToggle';
import Logo from '../components/Logo';
import TravelingBorderButton from '../components/TravelingBorderButton';
import LoanJourneyArt from '../components/LoanJourneyArt';
import { viewTransitionNavigate } from '../lib/viewTransitionNavigate';

const LoginPage = () => {
  const { login, applyTrustedDeviceLogin, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, mounted } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loginState, setLoginState] = useState('idle');
  const [apiError, setApiError] = useState('');
  const [deviceBlocked, setDeviceBlocked] = useState(false);

  useEffect(() => {
    document.title = 'Cred2Tech | Login';
  }, []);

  // ProtectedRoute redirects unauthenticated visits to a deep link here with
  // state.from set to the page they were trying to reach, send them back
  // there instead of the dashboard so a shared/bookmarked URL still works
  // after the login detour.
  const redirectTarget = location.state?.from
    ? `${location.state.from.pathname}${location.state.from.search || ''}${location.state.from.hash || ''}`
    : '/';

  if (isAuthenticated) return <Navigate to={redirectTarget} replace />;

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setApiError('Email and password are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setApiError('Enter a valid email address.');
      return;
    }
    setLoginState('loading');
    setApiError('');
    try {
      const result = await login(email, password);
      setLoginState('success');
      // Every account now requires MFA. login() never returns a logged-in
      // user directly, UNLESS this exact browser presented a still-valid
      // "trust this device" cookie for this exact account (result.loginComplete),
      // in which case the backend already skipped straight to a real
      // session. Otherwise branch to the setup wizard (first time) or the
      // second-factor challenge (already configured), carrying the original
      // deep-link target through so it still works after the detour.
      if (result.loginComplete) {
        applyTrustedDeviceLogin(result);
        navigate(redirectTarget, { replace: true });
        return;
      }
      if (result.mfaSetupRequired) {
        navigate('/mfa-setup', { replace: true, state: { setupToken: result.setupToken, from: location.state?.from } });
        return;
      }
      navigate('/mfa-challenge', {
        replace: true,
        state: {
          challengeToken: result.challengeToken,
          methods: result.methods,
          recoveryOptions: result.recoveryOptions,
          from: location.state?.from,
        },
      });
    } catch (err) {
      setLoginState('error');
      setTimeout(() => setLoginState('idle'), 1200);
      // Account-owner "Ban Device" (Active Sessions, Profile page) rejects
      // this IP before the password is even checked, the backend flags it
      // with code DEVICE_BLOCKED so this gets its own dedicated popup
      // instead of the plain inline error banner, and never proceeds to a
      // signed-in state.
      if (err?.response?.data?.code === 'DEVICE_BLOCKED') {
        setDeviceBlocked(true);
        return;
      }
      const msg = getErrorMessage(err);
      setApiError(msg);
      toast.error(msg);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="min-h-screen lg:flex font-sans" style={{ background: 'var(--bg-base)' }}>

      {/* Brand panel, large tablets and desktop only. Flat fill, no gradient.
          Colour is Cred2Tech's own brand indigo (var(--primary) across the
          app), kept intentionally rather than swapped for a neutral.
          taste-skill-ignore: brand indigo, not a generated-page default. */}
      <aside className="hidden lg:flex lg:w-[42%] lg:max-w-[520px] relative flex-col shrink-0 overflow-hidden bg-[#4F46E5] dark:bg-[#1e1b4b]">{/* taste-skill-ignore: brand indigo, kept per --keep palette */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.1]" aria-hidden="true">
          <pattern id="loginDotGrid" width="26" height="26" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.6" fill="#ffffff" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#loginDotGrid)" />
        </svg>
        {/* Large flat seal, pure depth through overlap, no blur or gradient */}
        <svg className="absolute -bottom-24 -left-28 w-[480px] h-[480px] opacity-[0.07]" viewBox="0 0 480 480" aria-hidden="true">
          <circle cx="240" cy="240" r="238" fill="none" stroke="#ffffff" strokeWidth="1.5" />
          <circle cx="240" cy="240" r="190" fill="none" stroke="#ffffff" strokeWidth="1.5" />
        </svg>

        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">
          <Logo size="xlarge" className="brightness-0 invert" />

          <div className="mt-14 xl:mt-20">
            <h2 className="text-[38px] xl:text-[44px] font-bold leading-[1.08] mb-4 text-white">
              Welcome Back
            </h2>
            <p className="text-[16px] leading-relaxed max-w-[360px] text-white/80">
              Sign in to manage your fintech pipeline, track applications, and access enterprise-grade analytics seamlessly.
            </p>
          </div>

          <div className="flex-1 flex items-end justify-center pb-6">
            <LoanJourneyArt className="w-full max-w-[380px] xl:max-w-[430px]" />
          </div>
        </div>
      </aside>

      {/* Form column */}
      <div className="flex-1 flex flex-col min-h-screen relative overflow-hidden">
        {/* Large flat seal, echoing the brand panel's mark, anchoring the
            otherwise-empty lower corner with depth instead of a gradient. */}
        <svg className="hidden lg:block absolute -bottom-28 -right-24 w-[420px] h-[420px] opacity-[0.035] pointer-events-none" viewBox="0 0 480 480" aria-hidden="true">
          <circle cx="240" cy="240" r="238" fill="none" stroke="#4F46E5" strokeWidth="1.5" /> {/* taste-skill-ignore: brand indigo watermark */}
          <circle cx="240" cy="240" r="190" fill="none" stroke="#4F46E5" strokeWidth="1.5" /> {/* taste-skill-ignore: brand indigo watermark */}
        </svg>

        {/* Mobile / tablet top bar */}
        <div className="flex lg:hidden items-center justify-between px-5 sm:px-8 h-16 shrink-0">
          <Logo size="medium" />
          <ThemeToggle />
        </div>

        {/* Desktop toggle */}
        <div className="hidden lg:flex absolute top-8 right-8 z-10">
          <ThemeToggle />
        </div>

        <div className="flex-1 flex flex-col px-5 sm:px-8 pt-6 sm:pt-10 pb-10 lg:justify-center lg:pt-0 lg:pb-16">
          <div className="w-full max-w-[400px] mx-auto">
            {/* Login / Register: a DSA partner who landed here by mistake
                switches without a back-and-forth through two separate pages. */}
            <div className="flex justify-center mb-7">
              <div className="inline-flex p-1 rounded-[12px]" style={{ background: 'var(--bg-elevated)' }}>
                <button
                  type="button"
                  aria-current="page"
                  className="px-5 py-2 rounded-[9px] text-[13px] font-semibold transition-colors"
                  style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => viewTransitionNavigate(navigate, '/register-dsa')}
                  className="px-5 py-2 rounded-[9px] text-[13px] font-semibold transition-colors hover:opacity-80"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Register
                </button>
              </div>
            </div>

            <div className="mb-8 lg:mb-10 relative">
              <h1 className="text-[28px] sm:text-[30px] lg:text-[34px] font-bold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
                Sign In
              </h1>
              <p className="text-[14px] sm:text-[15px]" style={{ color: 'var(--text-secondary)' }}>
                Access your secure Cred2Tech portal
              </p>
            </div>

            {/* Error banner */}
            {apiError && (
              <div
                className="flex items-center gap-2 px-3.5 py-3 rounded-[10px] mb-6 text-[13px] font-medium"
                style={{ background: 'var(--error-bg)', color: 'var(--error)' }}
              >
                <span className="material-symbols-outlined text-[16px]">error</span>
                {apiError}
              </div>
            )}

            {/* Form fields, no outer box, the underline carries the field
                to match how every other form in the product is built. */}
            <div className="flex flex-col gap-6 mb-8">
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">
                  Email<span className="required">*</span>
                </label>
                <div className="relative flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] shrink-0" style={{ color: 'var(--text-tertiary)' }}>mail</span>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setApiError(''); }}
                    onKeyDown={handleKeyDown}
                    placeholder="name@company.com"
                    autoComplete="username"
                    className="form-control"
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="flex items-center justify-between">
                  <label className="form-label" htmlFor="login-password">
                    Password<span className="required">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
                    className="text-[13px] font-semibold hover:underline"
                    style={{ color: 'var(--primary)' }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] shrink-0" style={{ color: 'var(--text-tertiary)' }}>lock</span>
                  <input
                    id="login-password"
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setApiError(''); }}
                    onKeyDown={handleKeyDown}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="form-control"
                    style={{ paddingRight: 28 }}
                  />
                  <button
                    onClick={() => setShowPwd(p => !p)}
                    type="button"
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                    className="absolute right-0 top-1/2 -translate-y-1/2 flex hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <span className="material-symbols-outlined text-[18px]">{showPwd ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>
            </div>

            <TravelingBorderButton
              onClick={handleLogin}
              disabled={loginState === 'loading'}
              solid
              className="w-full py-3.5 text-[15px] rounded-[10px]"
            >
              {loginState === 'loading' ? (
                <div className="flex justify-center items-center w-full h-full">
                  <span className="skeleton-inline" style={{ width: 56, height: 10 }} />
                </div>
              ) : loginState === 'success' ? (
                <div className="flex items-center justify-center gap-2 w-full h-full">
                  <span className="material-symbols-outlined text-[18px]">check</span>
                  <span>Access Granted</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 w-full h-full">
                  <span>Sign In</span>
                </div>
              )}
            </TravelingBorderButton>

            <div className="mt-8 text-center">
              {/* "New to the platform? Register as Partner" is now covered by
                  the Login / Register tab above, so it isn't repeated here. */}
              <button
                onClick={() => navigate('/msme/login')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] text-[14px] font-bold transition-colors hover:brightness-95"
                style={{ background: 'var(--primary-subtle)', color: 'var(--primary)' }}
              >
                <span className="material-symbols-outlined text-[17px]">storefront</span>
                MSME Borrower? Login with OTP
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Device blocked popup. Account owner used "Ban Device" on this
          device/IP from Active Sessions (Profile page). Deliberately its own
          modal, not the inline error banner, and never lets sign-in proceed. */}
      {deviceBlocked && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[1000] bg-black/50 px-4"
          style={{ backdropFilter: 'blur(4px)' }}
        >
          <div className="rounded-[20px] shadow-2xl p-8 max-w-[400px] w-full text-center" style={{ background: 'var(--bg-surface)' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: 'var(--error-bg)' }}>
              <span className="material-symbols-outlined text-[32px]" style={{ color: 'var(--error)' }}>block</span>
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              This device is blocked
            </h3>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              This device has been blocked by the account owner.
              If you feel your account has been taken over by somebody else,
              contact us at{' '}
              <a href="mailto:support@cred2tech.com" className="font-semibold hover:underline" style={{ color: 'var(--primary)' }}>
                support@cred2tech.com
              </a>.
            </p>
            <TravelingBorderButton onClick={() => setDeviceBlocked(false)} size="sm" className="w-full">
              OK
            </TravelingBorderButton>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
