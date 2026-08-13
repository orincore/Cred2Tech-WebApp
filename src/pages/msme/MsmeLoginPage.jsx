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
  // state.from set to the page the user was trying to reach — send them
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
      if (res.data.otp) {
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
    <div className="min-h-screen flex flex-col md:flex-row bg-[#ffffff] dark:bg-[#0a1628] font-sans overflow-hidden">

      {/* Left Sidebar - Hidden on small screens, takes 40% on desktop */}
      <div className="hidden md:flex flex-col w-2/5 max-w-[480px] bg-indigo-600 dark:bg-indigo-900 relative overflow-hidden shrink-0">
        {/* Ambient orbs */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-indigo-400/30 blur-3xl glow-pulse pointer-events-none" />
        <div className="absolute bottom-10 -right-20 w-80 h-80 rounded-full bg-indigo-300/20 blur-3xl glow-pulse-slow pointer-events-none" />

        <div className="p-10 flex flex-col h-full z-10">
          <div className="mb-8">
            <Logo size="xlarge" isDark={false} className="brightness-0 invert" />
          </div>

          <div className="mt-12 text-white">
            
            <h2 className="text-3xl font-bold leading-tight mb-4 hero-h1">
              Check Your Loan Eligibility
            </h2>
            <p className="text-white text-[15px] leading-relaxed opacity-90 hero-p">
              Discover offers across multiple lenders instantly — without affecting your credit score. Consent-based, secure, and built for your business.
            </p>
            <p className="mt-5 text-[12px] text-indigo-200/60 hero-btns">
              Powered by consent-based APIs · Regulatory-compliant · Not a lender
            </p>
          </div>

          <div className="relative mt-auto w-full flex items-center justify-center flex-1">
            <lottie-player
              src="/lottie/into.json"
              background="transparent"
              speed="1"
              loop
              autoplay
              style={{ width: '130%', height: '130%', filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.1))', transform: 'scale(1.2)' }}
              className="relative z-10"
            />
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-indigo-800/50 dark:from-black/40 via-transparent to-transparent pointer-events-none z-20" />
      </div>

      {/* Right Content */}
      <div className="flex-1 flex flex-col relative h-screen overflow-y-auto">
        {/* Mobile Header */}
        <div className="flex md:hidden items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <Logo size="large" />
          <ThemeToggle />
        </div>

        {/* Desktop Theme Toggle */}
        <div className="hidden md:flex absolute top-6 right-6 z-50">
          <ThemeToggle />
        </div>

        <div className="flex-1 flex flex-col px-6 py-8 md:px-16 lg:px-24 justify-center max-w-xl mx-auto w-full">
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
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-6 text-xs font-medium bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
              <span className="material-symbols-outlined text-[15px]">error</span>
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
                {/* Info banner */}
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-8 text-xs font-medium bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300">
                  <span className="material-symbols-outlined text-[15px]">sms</span>
                  OTP will be sent to your registered mobile number and email address
                </div>

                {/* Mobile */}
                <div className="mb-8">
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

                <TravelingBorderButton
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 text-[15px] rounded-[10px]"
                >
                  {loading ? (
                    <div className="flex justify-center items-center w-full h-full">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
                {/* Success banner */}
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-8 text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400">
                  <span className="material-symbols-outlined text-[15px]">check_circle</span>
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
                  className="w-full py-3.5 text-[15px] rounded-[10px]"
                >
                  {loading ? (
                    <div className="flex justify-center items-center w-full h-full">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  ) : (
                    <span>Verify OTP &amp; Login</span>
                  )}
                </TravelingBorderButton>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
            <p className="text-[12px] text-[#0a1628] dark:text-[#e6edf7] font-medium mb-4">
              Platform acts as technology facilitator only. Not a lender or credit institution.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-[10px] border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 text-[14px] font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]">badge</span>
              DSA Partner? Login here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MsmeLoginPage;
