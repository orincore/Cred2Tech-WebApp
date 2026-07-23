import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getErrorMessage } from '../utils/helpers';
import { ThemeToggle } from '../components/ThemeToggle';
import Logo from '../components/Logo';
import TravelingBorderButton from '../components/TravelingBorderButton';

const LoginPage = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { theme, mounted } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loginState, setLoginState] = useState('idle');
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    document.title = 'Cred2Tech | Login';
  }, []);

  if (isAuthenticated) return <Navigate to="/" replace />;

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
      const user = await login(email, password);
      setLoginState('success');
      toast.success(`Welcome back, ${user?.name || 'User'}!`);
      setTimeout(() => navigate('/'), 900);
    } catch (err) {
      setLoginState('error');
      const msg = getErrorMessage(err);
      setApiError(msg);
      toast.error(msg);
      setTimeout(() => setLoginState('idle'), 1200);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#ffffff] dark:bg-[#0a1628] font-sans overflow-hidden">

      {/* Left Sidebar - Hidden on small screens, takes 40% on desktop */}
      <div className="hidden md:flex flex-col w-2/5 max-w-[480px] bg-indigo-600 dark:bg-indigo-900 relative overflow-hidden shrink-0">
        <div className="p-10 flex flex-col h-full z-10">
          <div className="mb-8">
            <Logo size="xlarge" isDark={false} className="brightness-0 invert" />
          </div>

          <div className="mt-12 text-white">
            <h2 className="text-3xl font-bold leading-tight mb-4">
              Welcome Back
            </h2>
            <p className="text-indigo-100 text-[15px] leading-relaxed opacity-90">
              Sign in to manage your fintech pipeline, track applications, and access enterprise-grade analytics seamlessly.
            </p>
          </div>

          <div className="relative mt-auto w-full flex items-center justify-center flex-1">
            <lottie-player
              src="/lottie/data_recolored.json"
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
              Sign In
            </h1>
            <p className="text-[#4a5d73] dark:text-[#94a3b8] text-[14px] md:text-[15px]">
              Access your secure Cred2Tech portal
            </p>
          </div>

          {/* Error banner */}
          {apiError && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-6 text-xs font-medium bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
              <span className="material-symbols-outlined text-[15px]">error</span>
              {apiError}
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-8 mb-8">
            {/* Email */}
            <div>
              <label className="block text-[12px] text-[#4a5d73] dark:text-[#94a3b8] mb-1.5">Email *</label>
              <div className="flex items-center pb-3 border-b border-gray-200 dark:border-gray-700 focus-within:border-indigo-600 dark:focus-within:border-indigo-400 transition-colors">
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setApiError(''); }}
                  onKeyDown={handleKeyDown}
                  placeholder="name@company.com"
                  className="w-full bg-transparent border-0 outline-none text-[#0a1628] dark:text-[#e6edf7] text-[15px] font-semibold p-0 focus:ring-0 placeholder-gray-400 dark:placeholder-gray-600"
                />
              </div>
            </div>

            {/* Password */}
            <div className="relative">
              <label className="block text-[12px] text-[#4a5d73] dark:text-[#94a3b8] mb-1.5">Password *</label>
              <div className="relative flex items-center pb-3 border-b border-gray-200 dark:border-gray-700 focus-within:border-indigo-600 dark:focus-within:border-indigo-400 transition-colors">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setApiError(''); }}
                  onKeyDown={handleKeyDown}
                  placeholder="••••••••"
                  className="w-full bg-transparent border-0 outline-none text-[#0a1628] dark:text-[#e6edf7] text-[15px] font-semibold p-0 pr-8 focus:ring-0 placeholder-gray-400 dark:placeholder-gray-600"
                />
                <button
                  onClick={() => setShowPwd(p => !p)}
                  type="button"
                  className="absolute right-0 text-[#4a5d73] dark:text-[#94a3b8] hover:text-indigo-600 transition-colors bg-transparent border-0 flex cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">{showPwd ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
              <div className="flex justify-end mt-2">
                <button
                  className="text-[13px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors bg-transparent border-0 cursor-pointer"
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                >
                  Forgot password?
                </button>
              </div>
            </div>
          </div>

          <TravelingBorderButton
            onClick={handleLogin}
            disabled={loginState === 'loading'}
            className="w-full py-3.5 text-[15px] rounded-[10px]"
          >
            {loginState === 'loading' ? (
              <div className="flex justify-center items-center w-full h-full">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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

          {/* Trust */}
          <div className="flex items-center justify-center gap-1.5 mt-8 text-[11px] text-[#4a5d73] dark:text-[#94a3b8]">
            <span className="material-symbols-outlined text-[13px] text-indigo-600">lock</span>
            256-bit encryption · Trusted by 10,000+ businesses
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
            <p className="text-[13px] text-[#4a5d73] dark:text-[#94a3b8]">
              New to the platform?
              <button
                className="text-indigo-600 dark:text-indigo-400 font-bold ml-1 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline transition-colors cursor-pointer bg-transparent border-0"
                onClick={() => navigate('/register-dsa')}
              >
                Register as Partner
              </button>
            </p>
            <button
              onClick={() => navigate('/msme/login')}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-[10px] border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 text-[14px] font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px]">storefront</span>
              MSME Borrower? Login with OTP
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
