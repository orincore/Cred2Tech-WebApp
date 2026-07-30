import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../components/ThemeToggle';
import Logo from '../components/Logo';
import TravelingBorderButton from '../components/TravelingBorderButton';

const NotFoundPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Cred2Tech | Page Not Found';
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#eef4ff] dark:bg-[#0a1628] font-sans px-6 py-10 relative">
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo size="large" />
        </div>

        <div className="bg-white dark:bg-[#162048] rounded-2xl shadow-xl border border-[#c7d2fe]/60 dark:border-[#2d3a6c] p-8 md:p-10 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-[28px]">explore_off</span>
          </div>

          <h1 className="text-[42px] font-bold text-indigo-600 dark:text-indigo-400 tracking-tight leading-none mb-2">404</h1>
          <p className="text-[20px] font-bold text-[#0a1628] dark:text-[#e6edf7] mb-2">Page not found</p>
          <p className="text-[#0a1628] dark:text-[#e6edf7] font-medium text-[14px] leading-relaxed mb-8">
            The page you're looking for doesn't exist or has been moved. Double-check the URL, or head back to a page that does.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 py-3.5 text-[15px] font-semibold rounded-[10px] border border-gray-200 dark:border-gray-700 text-[#0a1628] dark:text-[#e6edf7] bg-transparent hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              Go Back
            </button>
            <TravelingBorderButton onClick={() => navigate('/')} solid className="flex-1 py-3.5 text-[15px] rounded-[10px] justify-center">
              <span>Go to Dashboard</span>
            </TravelingBorderButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
