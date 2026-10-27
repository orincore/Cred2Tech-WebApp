import React from 'react';
import { ThemeToggle } from './ThemeToggle';
import Logo from './Logo';
import { LanguageSelect } from '../lib/publicLang';

// Shared by the three customer-facing link pages (ConsentPage, GstAuthPage,
// ItrAuthPage): same brand palette, sharp-edged card and dark mode support,
// plus the language dropdown.
export const PageShell = ({ children, langCtx }) => (
  <div className="min-h-screen flex items-center justify-center bg-[#eef4ff] dark:bg-[#0a1628] font-sans px-6 py-10 relative">
    <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
      <LanguageSelect lang={langCtx.lang} setLang={langCtx.setLang} t={langCtx.t} />
      <ThemeToggle />
    </div>
    <div className="w-full max-w-lg mt-8 sm:mt-0">
      <div className="flex justify-center mb-8">
        <Logo size="large" />
      </div>
      <div className="bg-white dark:bg-[#162048] rounded-none shadow-xl border border-[#c7d2fe]/60 dark:border-[#2d3a6c] p-8 md:p-10">
        {children}
      </div>
    </div>
  </div>
);

export const StatusScreen = ({ icon, iconColorClass, title, body, action }) => (
  <div className="text-center">
    <div className={`mx-auto mb-4 w-14 h-14 rounded-full ${iconColorClass} flex items-center justify-center`}>
      <span className="material-symbols-outlined text-[28px]">{icon}</span>
    </div>
    <h1 className="text-[22px] font-bold text-[#0a1628] dark:text-[#e6edf7] mb-2">{title}</h1>
    <p className="text-[#0a1628] dark:text-[#e6edf7] font-medium text-[14px] leading-relaxed mb-2">{body}</p>
    {action}
  </div>
);

export const LoadingBlock = ({ text }) => (
  <div className="flex flex-col items-center justify-center py-8">
    <div className="flex flex-col gap-3 w-full mb-4">
      <div className="skeleton" style={{ height: 14, width: '60%', borderRadius: 0 }} />
      <div className="skeleton" style={{ height: 40, borderRadius: 0 }} />
      <div className="skeleton" style={{ height: 40, borderRadius: 0 }} />
    </div>
    <p className="text-[13px] font-medium text-[#0a1628]/60 dark:text-[#e6edf7]/60">{text}</p>
  </div>
);

export const RequestedByBanner = ({ details, langCtx }) => {
  const { lang, t } = langCtx;
  if (!details?.requested_by_name && !details?.requesting_org) return null;
  return (
    <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[#f6f8ff] dark:bg-[#0f1b3d] border border-[#c7d2fe]/60 dark:border-[#2d3a6c]">
      <span className="material-symbols-outlined text-[16px] text-indigo-600 dark:text-indigo-400">badge</span>
      <p className="text-[12px] font-medium text-[#0a1628] dark:text-[#e6edf7]">
        {t('requestedBy')}{' '}
        <span className="font-bold">{details?.requested_by_name || t('aRepresentative')}</span>
        {details?.requesting_org && (
          <>
            {lang === 'hi' ? ', ' : ' from '}<span className="font-bold">{details.requesting_org}</span>
          </>
        )}
      </p>
    </div>
  );
};

export const ErrorNotice = ({ message }) => (
  <div className="flex items-center gap-2 px-3 py-2.5 mb-5 text-xs font-medium bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
    <span className="material-symbols-outlined text-[15px]">error</span>
    {message}
  </div>
);
