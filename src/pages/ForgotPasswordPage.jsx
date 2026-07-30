import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosInstance';
import { ThemeToggle } from '../components/ThemeToggle';
import Logo from '../components/Logo';
import TravelingBorderButton from '../components/TravelingBorderButton';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    document.title = 'Cred2Tech | Forgot Password';
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setApiError('Enter a valid email address.');
      return;
    }
    setApiError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
    } catch {
      // Backend always returns 200 to avoid leaking account existence — show success regardless.
    } finally {
      setSent(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#eef4ff] dark:bg-[#0a1628] font-sans px-6 py-10 relative">
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo size="large" />
        </div>

        <div className="bg-white dark:bg-[#162048] rounded-2xl shadow-xl border border-[#c7d2fe]/60 dark:border-[#2d3a6c] p-8 md:p-10">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[28px]">mark_email_read</span>
              </div>
              <h1 className="text-[22px] font-bold text-[#0a1628] dark:text-[#e6edf7] mb-2">Check your inbox</h1>
              <p className="text-[#0a1628] dark:text-[#e6edf7] font-medium text-[14px] leading-relaxed">
                If an account exists for <strong className="text-[#0a1628] dark:text-[#e6edf7]">{email}</strong>, a password reset link has been sent.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-[24px] font-bold text-[#0a1628] dark:text-[#e6edf7] tracking-tight mb-2">
                Forgot Password
              </h1>
              <p className="text-[#0a1628] dark:text-[#e6edf7] font-medium text-[14px] mb-8">
                Enter your registered email and we'll send you a reset link.
              </p>

              {apiError && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-6 text-xs font-medium bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
                  <span className="material-symbols-outlined text-[15px]">error</span>
                  {apiError}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="mb-8">
                  <label className="block text-[12px] text-[#0a1628] dark:text-[#e6edf7] font-semibold mb-1.5">Email *</label>
                  <div className="flex items-center pb-3 border-b border-gray-200 dark:border-gray-700 focus-within:border-indigo-600 dark:focus-within:border-indigo-400 transition-colors">
                    <input
                      type="email"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setApiError(''); }}
                      placeholder="name@company.com"
                      autoFocus
                      className="w-full bg-transparent border-0 outline-none text-[#0a1628] dark:text-[#e6edf7] text-[15px] font-semibold p-0 focus:ring-0 placeholder-gray-400 dark:placeholder-gray-600"
                    />
                  </div>
                </div>

                <TravelingBorderButton type="submit" disabled={loading} className="w-full py-3.5 text-[15px] rounded-[10px]">
                  {loading ? (
                    <div className="flex justify-center items-center w-full h-full">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  ) : (
                    <span>Send Reset Link</span>
                  )}
                </TravelingBorderButton>
              </form>
            </>
          )}

          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-[13px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer bg-transparent border-0 inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[15px]">arrow_back</span>
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
