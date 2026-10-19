import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { msmeAuthApi } from '../../api/msmeService';
import { useMsmeAuth } from '../../context/MsmeAuthContext';
import { getErrorMessage } from '../../utils/helpers';
import { ThemeToggle } from '../../components/ThemeToggle';
import Logo from '../../components/Logo';
import TravelingBorderButton from '../../components/TravelingBorderButton';
import OtpInput from '../../components/OtpInput';
import EligibilityMeterArt from '../../components/EligibilityMeterArt';

import { IS_DEV_BUILD } from '../../utils/devBuild';
const stepVariants = {
  enter: (dir) => ({ opacity: 0, x: dir > 0 ? 48 : -48 }),
  center: { opacity: 1, x: 0 },
  exit: (dir) => ({ opacity: 0, x: dir > 0 ? -48 : 48 }),
};

const MsmeLoginPage = () => {
  const { user, login } = useMsmeAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // MsmeProtectedRoute redirects a logged-out deep link here with
  // state.from set to the page the user was trying to reach, send them
  // back there after OTP verification instead of always to the dashboard.
  const redirectTarget = location.state?.from
    ? `${location.state.from.pathname}${location.state.from.search || ''}${location.state.from.hash || ''}`
    : '/msme/dashboard';

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    document.title = 'Cred2Tech | MSME Portal';
  }, []);

  if (user) return <Navigate to={redirectTarget} replace />;

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    if (!mobile || mobile.length !== 10) {
      setApiError('Please enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    setApiError('');
    try {
      const res = await msmeAuthApi.sendOtp(mobile);
      toast.success(res.data.message || 'OTP sent successfully');
      if (IS_DEV_BUILD && res.data.otp) {
        toast(`Dev OTP: ${res.data.otp}`, { icon: '🛠️', duration: 6000 });
      }
      setDirection(1);
      setStep(2);
      setOtp('');
    } catch (err) {
      const msg = getErrorMessage(err);
      setApiError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e?.preventDefault();
    if (!otp || otp.length < 4) {
      setApiError('Please enter a valid OTP');
      return;
    }
    setLoading(true);
    setApiError('');
    try {
      const res = await msmeAuthApi.verifyOtp(mobile, otp);
      login(res.data.user, res.data.token);
      toast.success('Logged in successfully');
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      const msg = getErrorMessage(err);
      setApiError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeNumber = () => {
    setDirection(-1);
    setStep(1);
    setOtp('');
    setApiError('');
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#ffffff] dark:bg-[#0a1628] font-sans overflow-hidden">

      {/* Left Sidebar, hidden below lg, same width as the login and DSA
          register brand panels (lg:w-[42%] lg:max-w-[520px]) so every auth
          screen in the product shares one shell. Flat fill, no gradient,
          no glow orbs; its own eligibility-meter graphic rather than the
          stock Lottie clip the other two screens used to share with it.
          taste-skill-ignore: brand indigo, kept per --keep palette */}
      <div className="hidden lg:flex lg:w-[42%] lg:max-w-[520px] flex-col bg-[#4F46E5] dark:bg-[#1e1b4b] relative overflow-hidden shrink-0">{/* taste-skill-ignore: brand indigo, kept per --keep palette */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.1]" aria-hidden="true">
          <pattern id="msmeDotGrid" width="26" height="26" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.6" fill="#ffffff" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#msmeDotGrid)" />
        </svg>
        <svg className="absolute -bottom-24 -left-28 w-[480px] h-[480px] opacity-[0.07]" viewBox="0 0 480 480" aria-hidden="true">
          <circle cx="240" cy="240" r="238" fill="none" stroke="#ffffff" strokeWidth="1.5" />
          <circle cx="240" cy="240" r="190" fill="none" stroke="#ffffff" strokeWidth="1.5" />
        </svg>

        <div className="relative z-10 p-10 xl:p-14 flex flex-col h-full">
          <Logo size="xlarge" className="brightness-0 invert" />

          <div className="mt-14 xl:mt-20 text-white">
            <h2 className="text-[38px] xl:text-[44px] font-bold leading-[1.08] mb-4">
              Check Your Loan Eligibility
            </h2>
            <p className="text-[16px] leading-relaxed max-w-[360px] text-white/80">
              Discover offers across multiple lenders instantly, without affecting your credit score. Consent-based, secure, and built for your business.
            </p>
            <p className="mt-5 text-[12px] text-white/50">
              Powered by consent-based APIs · Regulatory-compliant · Not a lender
            </p>
          </div>

          <div className="flex-1 flex items-end justify-center pb-6">
            <EligibilityMeterArt className="w-full max-w-[300px]" />
          </div>
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 flex flex-col relative h-screen overflow-y-auto">
        {/* Mobile / tablet header */}
        <div className="flex lg:hidden items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <Logo size="large" />
          <ThemeToggle />
        </div>

        {/* Desktop Theme Toggle, same top-8 right-8 position as the other auth screens */}
        <div className="hidden lg:flex absolute top-8 right-8 z-50">
          <ThemeToggle />
        </div>

        <div className="flex-1 flex flex-col px-6 pt-6 sm:pt-10 pb-10 sm:px-8 lg:px-16 lg:justify-center lg:pt-0 lg:pb-16 max-w-[420px] mx-auto w-full">
          <div className="mb-10">
            <h1 className="text-[28px] md:text-[34px] font-bold text-[#0a1628] dark:text-[#e6edf7] tracking-tight mb-2">
              {step === 1 ? 'Welcome Back' : 'Verify OTP'}
            </h1>
            <p className="text-[#0a1628] dark:text-[#e6edf7] font-medium text-[14px] md:text-[15px]">
              {step === 1
                ? 'Sign in to your Cred2Tech MSME portal'
                : <>Enter the code sent to <span className="font-bold text-[#0a1628] dark:text-[#e6edf7]">+91 ******{mobile.slice(-4)}</span> and your registered email</>}
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

          <AnimatePresence mode="wait" custom={direction} initial={false}>
            {step === 1 ? (
              <motion.form
                key="step-mobile"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                onSubmit={handleSendOtp}
              >
                {/* Mobile */}
                <div className="mb-3">
                  <label className="block text-[12px] text-[#0a1628] dark:text-[#e6edf7] font-semibold mb-1.5">Registered Mobile Number *</label>
                  <div className="flex items-center gap-2 pb-3 border-b border-gray-200 dark:border-gray-700 focus-within:border-indigo-600 dark:focus-within:border-indigo-400 transition-colors">
                    <span className="text-[#0a1628] dark:text-[#e6edf7] text-[15px] font-semibold select-none">+91</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={mobile}
                      onChange={e => { setMobile(e.target.value.replace(/\D/g, '')); setApiError(''); }}
                      onKeyDown={e => { if (e.key === 'Enter') handleSendOtp(e); }}
                      placeholder="Enter 10-digit mobile number"
                      autoFocus
                      className="w-full bg-transparent border-0 outline-none text-[#0a1628] dark:text-[#e6edf7] text-[15px] font-semibold p-0 focus:ring-0 placeholder-gray-400 dark:placeholder-gray-600"
                    />
                  </div>
                </div>
                <p className="text-[12px] text-[#0a1628] dark:text-[#e6edf7] opacity-50 mb-8">
                  OTP will be sent to your registered mobile number.
                </p>

                <TravelingBorderButton
                  type="submit"
                  disabled={loading}
                  solid
                  className="w-full py-3.5 text-[15px] rounded-[10px]"
                >
                  {loading ? (
                    <div className="flex justify-center items-center w-full h-full">
                      <span className="skeleton-inline" style={{ width: 56, height: 10 }} />
                    </div>
                  ) : (
                    <span>Send OTP</span>
                  )}
                </TravelingBorderButton>
              </motion.form>
            ) : (
              <motion.form
                key="step-otp"
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                onSubmit={handleVerifyOtp}
              >
                <div className="flex items-center gap-1.5 mb-8 text-[13px] font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  OTP sent to +91 ******{mobile.slice(-4)} and registered email
                </div>

                {/* OTP */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[12px] text-[#0a1628] dark:text-[#e6edf7] font-semibold">Enter OTP *</label>
                    <button
                      type="button"
                      onClick={handleChangeNumber}
                      className="text-[12px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors bg-transparent border-0 cursor-pointer"
                    >
                      Change Number
                    </button>
                  </div>
                  <OtpInput length={6} value={otp} onChange={(v) => { setOtp(v); setApiError(''); }} onEnter={() => handleVerifyOtp()} />
                </div>

                <p className="text-[11px] text-[#0a1628] dark:text-[#e6edf7] font-medium text-center mb-8">
                  OTP valid for 10 minutes ·{' '}
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading}
                    className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors bg-transparent border-0 cursor-pointer disabled:opacity-50"
                  >
                    Resend OTP
                  </button>
                </p>

                <TravelingBorderButton
                  type="submit"
                  disabled={loading || otp.length < 4}
                  solid
                  className="w-full py-3.5 text-[15px] rounded-[10px]"
                >
                  {loading ? (
                    <div className="flex justify-center items-center w-full h-full">
                      <span className="skeleton-inline" style={{ width: 56, height: 10 }} />
                    </div>
                  ) : (
                    <span>Verify OTP &amp; Login</span>
                  )}
                </TravelingBorderButton>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="mt-10 text-center">
            <p className="text-[12px] text-[#0a1628] dark:text-[#e6edf7] opacity-50 mb-3">
              Platform acts as technology facilitator only. Not a lender or credit institution.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">badge</span>
              Sourcing Partner? Login here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MsmeLoginPage;
