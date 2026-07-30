import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axiosInstance';
import { getErrorMessage } from '../utils/helpers';
import { ThemeToggle } from '../components/ThemeToggle';
import Logo from '../components/Logo';
import TravelingBorderButton from '../components/TravelingBorderButton';

const PageShell = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center bg-[#eef4ff] dark:bg-[#0a1628] font-sans px-6 py-10 relative">
    <div className="absolute top-6 right-6 z-50">
      <ThemeToggle />
    </div>
    <div className="w-full max-w-md">
      <div className="flex justify-center mb-8">
        <Logo size="large" />
      </div>
      <div className="bg-white dark:bg-[#162048] rounded-2xl shadow-xl border border-[#c7d2fe]/60 dark:border-[#2d3a6c] p-8 md:p-10">
        {children}
      </div>
    </div>
  </div>
);

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    document.title = 'Cred2Tech | Reset Password';
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;

    if (password.length < 8) {
      setApiError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setApiError('Passwords do not match.');
      return;
    }

    setApiError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      toast.success('Password successfully reset. You can now log in.');
      navigate('/login');
    } catch (err) {
      setApiError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <PageShell>
        <div className="text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-[28px]">error</span>
          </div>
          <h1 className="text-[22px] font-bold text-[#0a1628] dark:text-[#e6edf7] mb-2">Invalid Link</h1>
          <p className="text-[#0a1628] dark:text-[#e6edf7] font-medium text-[14px] leading-relaxed mb-6">
            This password reset link is invalid or missing its token. Please request a new one.
          </p>
          <button
            type="button"
            onClick={() => navigate('/forgot-password')}
            className="text-[13px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer bg-transparent border-0"
          >
            Request a new link
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <h1 className="text-[24px] font-bold text-[#0a1628] dark:text-[#e6edf7] tracking-tight mb-2">
        Set New Password
      </h1>
      <p className="text-[#0a1628] dark:text-[#e6edf7] font-medium text-[14px] mb-8">
        Please enter your new password below.
      </p>

      {apiError && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-6 text-xs font-medium bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
          <span className="material-symbols-outlined text-[15px]">error</span>
          {apiError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-8 mb-8">
          <div className="relative">
            <label className="block text-[12px] text-[#0a1628] dark:text-[#e6edf7] font-semibold mb-1.5">New Password *</label>
            <div className="relative flex items-center pb-3 border-b border-gray-200 dark:border-gray-700 focus-within:border-indigo-600 dark:focus-within:border-indigo-400 transition-colors">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setApiError(''); }}
                placeholder="At least 8 characters"
                autoFocus
                className="w-full bg-transparent border-0 outline-none text-[#0a1628] dark:text-[#e6edf7] text-[15px] font-semibold p-0 pr-8 focus:ring-0 placeholder-gray-400 dark:placeholder-gray-600"
              />
              <button
                onClick={() => setShowPwd(p => !p)}
                type="button"
                className="absolute right-0 text-[#0a1628] dark:text-[#e6edf7] hover:text-indigo-600 transition-colors bg-transparent border-0 flex cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">{showPwd ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[12px] text-[#0a1628] dark:text-[#e6edf7] font-semibold mb-1.5">Confirm Password *</label>
            <div className="flex items-center pb-3 border-b border-gray-200 dark:border-gray-700 focus-within:border-indigo-600 dark:focus-within:border-indigo-400 transition-colors">
              <input
                type={showPwd ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setApiError(''); }}
                placeholder="Confirm your new password"
                className="w-full bg-transparent border-0 outline-none text-[#0a1628] dark:text-[#e6edf7] text-[15px] font-semibold p-0 focus:ring-0 placeholder-gray-400 dark:placeholder-gray-600"
              />
            </div>
          </div>
        </div>

        <TravelingBorderButton type="submit" disabled={loading} className="w-full py-3.5 text-[15px] rounded-[10px]">
          {loading ? (
            <div className="flex justify-center items-center w-full h-full">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          ) : (
            <span>Reset Password</span>
          )}
        </TravelingBorderButton>
      </form>
    </PageShell>
  );
};

export default ResetPasswordPage;
