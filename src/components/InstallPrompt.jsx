import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../branding/brandingStore';

// "Install Cred2Tech" card for phones and small tablets.
//
// - Chrome/Edge/Samsung Internet: uses the browser's own install prompt (the event is captured early by a script
//   in index.html and kept on window.__c2tInstall, because it can fire before React has mounted).
// - iOS (no install API exists): shows the two-step "Share, then Add to Home Screen" instructions instead.
// - Desktop: renders nothing. The browser's own install icon in the address bar covers it, and the desktop UI stays untouched.
// - Never on a white-label organisation's host (the installed app is Cred2Tech's), on customer link pages (consent,
//   ITR/GST authorisation, registration), on sign-in/MFA screens, or to someone who is not signed in.
// - Dismissing snoozes it for 14 days; installing hides it for good.

const DISMISSED_KEY = 'c2t_pwa_install_dismissed_at';
const INSTALLED_KEY = 'c2t_pwa_installed';
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 8000; // let the page, any first-visit tour and the data settle first
const SMALL_SCREEN = '(max-width: 820px)';
const HIDDEN_PREFIXES = ['/login', '/msme/login', '/mfa-', '/forgot-password', '/reset-password', '/SUNBY/', '/c/', '/customer-consent', '/itr-auth', '/gst-auth', '/register-dsa', '/unauthorized'];

const isStandalone = () => {
  try {
    return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches;
  } catch { return false; }
};

const isIos = () => {
  const ua = window.navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
};

const readFlag = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const writeFlag = (key, value) => { try { localStorage.setItem(key, value); } catch { /* private mode: it just may show again */ } };

const snoozed = () => {
  const at = Number(readFlag(DISMISSED_KEY));
  return Number.isFinite(at) && at > 0 && Date.now() - at < SNOOZE_MS;
};

const InstallPrompt = () => {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const brand = useBranding();
  const [deferred, setDeferred] = useState(() => window.__c2tInstall || null);
  const [small, setSmall] = useState(() => window.matchMedia(SMALL_SCREEN).matches);
  const [armed, setArmed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onReady = () => setDeferred(window.__c2tInstall || null);
    const onInstalled = () => { writeFlag(INSTALLED_KEY, '1'); window.__c2tInstall = null; setDeferred(null); setOpen(false); };
    window.addEventListener('c2t-install-ready', onReady);
    window.addEventListener('appinstalled', onInstalled);
    const mq = window.matchMedia(SMALL_SCREEN);
    const onMq = (e) => setSmall(e.matches);
    mq.addEventListener('change', onMq);
    return () => {
      window.removeEventListener('c2t-install-ready', onReady);
      window.removeEventListener('appinstalled', onInstalled);
      mq.removeEventListener('change', onMq);
    };
  }, []);

  const ios = isIos();
  const loggedIn = isAuthenticated || !!readFlag('token');
  const onHiddenRoute = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));
  const canShow = small && !brand.isOrg && loggedIn && !onHiddenRoute && !isStandalone() && readFlag(INSTALLED_KEY) !== '1' && !snoozed() && (!!deferred || ios);

  // Wait a little after the screen becomes eligible, then show once per page session.
  useEffect(() => {
    if (!canShow || armed) return undefined;
    const t = setTimeout(() => setArmed(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [canShow, armed]);

  useEffect(() => { setOpen(armed && canShow); }, [armed, canShow]);

  const dismiss = useCallback(() => { writeFlag(DISMISSED_KEY, String(Date.now())); setOpen(false); setArmed(false); }, []);

  const install = useCallback(async () => {
    const evt = deferred;
    if (!evt) return;
    setOpen(false);
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice && choice.outcome === 'accepted') writeFlag(INSTALLED_KEY, '1');
      else writeFlag(DISMISSED_KEY, String(Date.now()));
    } catch { /* the browser refused to show it twice: nothing more to do */ }
    window.__c2tInstall = null;
    setDeferred(null);
  }, [deferred]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-label="Install Cred2Tech"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-3 z-[350] mx-auto max-w-md rounded-2xl border border-indigo-200 bg-white p-4 shadow-[0_18px_40px_-14px_rgba(10,22,40,0.35)] dark:border-[#2d3a6c] dark:bg-[#162048]"
          style={{ bottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-start gap-3">
            <img src="/icons/icon-48.png" alt="" width="44" height="44" className="h-11 w-11 flex-shrink-0 rounded-xl border border-indigo-100 dark:border-[#2d3a6c]" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-[#0a1628] dark:text-[#e6edf7]">Install Cred2Tech</p>
              {ios && !deferred ? (
                <p className="mt-1 text-[13px] leading-snug text-[#0a1628]/70 dark:text-[#e6edf7]/70">
                  Tap <Share size={14} className="mx-0.5 inline -translate-y-px" aria-label="Share" /> then{' '}
                  <span className="whitespace-nowrap font-medium">Add to Home Screen <SquarePlus size={14} className="inline -translate-y-px" aria-hidden="true" /></span>{' '}
                  to open Cred2Tech like an app.
                </p>
              ) : (
                <p className="mt-1 text-[13px] leading-snug text-[#0a1628]/70 dark:text-[#e6edf7]/70">
                  Add it to your home screen for one-tap, full-screen access that loads faster on slow connections.
                </p>
              )}
            </div>
            <button type="button" onClick={dismiss} aria-label="Not now" className="-mr-1 -mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-[#0a1628]/60 active:scale-95 dark:text-[#e6edf7]/60">
              <X size={18} />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            {deferred ? (
              <button type="button" onClick={install} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0a1628] text-sm font-semibold text-white transition active:translate-y-px active:scale-[0.98] dark:bg-indigo-500">
                <Download size={16} /> Install
              </button>
            ) : (
              <button type="button" onClick={dismiss} className="flex h-11 flex-1 items-center justify-center rounded-xl bg-[#0a1628] text-sm font-semibold text-white transition active:translate-y-px active:scale-[0.98] dark:bg-indigo-500">
                Got it
              </button>
            )}
            {deferred && (
              <button type="button" onClick={dismiss} className="h-11 rounded-xl border border-indigo-200 px-4 text-sm font-medium text-[#0a1628] transition active:scale-[0.98] dark:border-[#2d3a6c] dark:text-[#e6edf7]">
                Not now
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InstallPrompt;
