import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff, CheckCircle2, RefreshCw } from 'lucide-react';
import Logo from './Logo';

// Same-origin, tiny, and already written by every deploy (see
// deploy-dev.yml's "Write version.json") — a successful fetch of it is a
// real proof of connectivity, unlike navigator.onLine/the browser's
// online/offline events, which only reflect "a network interface exists",
// not "the internet is actually reachable" (e.g. a wifi AP with no uplink).
const PING_URL = '/version.json';
const POLL_INTERVAL_MS = 4000;
const RESTORED_DISPLAY_MS = 1200;

async function verifyReachable() {
  try {
    const opts = { cache: 'no-store' };
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
      opts.signal = AbortSignal.timeout(5000);
    }
    const res = await fetch(`${PING_URL}?_=${Date.now()}`, opts);
    return res.ok;
  } catch {
    return false;
  }
}

/** Three breathing dots — same "still working" language PullStatusTracker's
    WorkingDots already uses elsewhere in the app, reused here so "searching
    for a connection" reads as the same idea as any other live-status wait. */
const SearchingDots = () => (
  <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
    {[0, 0.15, 0.3].map((delay, i) => (
      <motion.span
        key={i}
        animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay }}
        style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }}
      />
    ))}
  </span>
);

/** Expanding, fading sonar rings behind the WifiOff icon — a "searching for
    signal" visual, built from three staggered CSS-keyframe rings rather than
    a static icon so the offline state reads as active, not dead. */
const RadarRings = ({ color }) => (
  <>
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="offline-radar-ring"
        style={{ borderColor: color, animationDelay: `${i * 0.9}s` }}
      />
    ))}
  </>
);

/**
 * Full-screen, theme-matched replacement for the browser's own bare
 * "no internet" error state. Mounted once at the app root (see App.jsx) so
 * it covers every route — the app itself never unmounts underneath it, so
 * the moment real connectivity is confirmed, reloading the current URL is
 * exactly "refresh the page the user was already on."
 *
 * navigator.onLine / the browser's offline event are used only as the fast
 * trigger to show the overlay and to prompt a re-check — the actual
 * "restored" decision always comes from a real fetch (verifyReachable), so
 * a wifi-connected-but-no-uplink situation never falsely reports "back
 * online" only to fail again a moment later.
 */
const OfflineOverlay = () => {
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [justRestored, setJustRestored] = useState(false);
  const [checking, setChecking] = useState(false);
  const pollRef = useRef(null);
  const restoringRef = useRef(false);

  const attemptRestore = useCallback(async () => {
    if (restoringRef.current) return;
    const reachable = await verifyReachable();
    if (reachable) {
      restoringRef.current = true;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      setJustRestored(true);
      setTimeout(() => window.location.reload(), RESTORED_DISPLAY_MS);
    }
  }, []);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => { attemptRestore(); };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [attemptRestore]);

  // While the overlay is up, keep independently re-checking real
  // reachability — a safety net for browsers/situations where the online
  // event never fires even though connectivity has genuinely returned.
  useEffect(() => {
    if (!isOffline || justRestored) return undefined;
    pollRef.current = setInterval(attemptRestore, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isOffline, justRestored, attemptRestore]);

  const handleManualRetry = async () => {
    setChecking(true);
    await attemptRestore();
    setChecking(false);
  };

  if (!isOffline) return null;

  return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="fixed inset-0 z-[100000] flex items-center justify-center bg-[#eef4ff] dark:bg-[#0a1628] px-6"
      >
        <style>{`
          @keyframes offline-radar-ping {
            0% { transform: scale(0.4); opacity: 0.55; }
            100% { transform: scale(2.2); opacity: 0; }
          }
          .offline-radar-ring {
            position: absolute;
            inset: 0;
            border-radius: 9999px;
            border: 1.5px solid;
            animation: offline-radar-ping 2.7s cubic-bezier(0.2, 0.6, 0.4, 1) infinite;
          }
        `}</style>

        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <Logo size="large" />
          </div>

          <div className="bg-white dark:bg-[#162048] shadow-xl border border-[#c7d2fe]/60 dark:border-[#2d3a6c] p-8 md:p-10 text-center">
            <AnimatePresence mode="wait">
              {justRestored ? (
                <motion.div
                  key="restored"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 14, delay: 0.05 }}
                    className="mx-auto mb-5 w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center"
                  >
                    <CheckCircle2 size={32} />
                  </motion.div>
                  <h1 className="text-[22px] font-bold text-[#0a1628] dark:text-[#e6edf7] mb-2">
                    Back Online!
                  </h1>
                  <p className="text-[13px] font-medium text-[#0a1628]/70 dark:text-[#e6edf7]/70 flex items-center justify-center gap-2">
                    <RefreshCw size={14} className="animate-spin" /> Refreshing your page…
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="offline"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="relative mx-auto mb-6 w-20 h-20 flex items-center justify-center">
                    <RadarRings color="#4f46e5" />
                    <div className="relative w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-[#4f46e5] dark:text-[#818CF8] flex items-center justify-center">
                      <WifiOff size={28} />
                    </div>
                  </div>

                  <h1 className="text-[22px] font-bold text-[#0a1628] dark:text-[#e6edf7] mb-2">
                    You're Offline
                  </h1>
                  <p className="text-[13px] font-medium text-[#0a1628]/70 dark:text-[#e6edf7]/70 leading-relaxed mb-6">
                    No internet connection detected. Stay on this page — we'll bring you
                    right back the moment it's restored, no manual refresh needed.
                  </p>

                  <div className="flex items-center justify-center gap-2 text-[#4f46e5] dark:text-[#818CF8] mb-6">
                    <SearchingDots />
                    <span className="text-[12px] font-bold uppercase tracking-wide">
                      Searching for connection
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleManualRetry}
                    disabled={checking}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-bold text-white bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-60 transition-colors"
                  >
                    <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
                    {checking ? 'Checking…' : 'Try Again'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
  );
};

export default OfflineOverlay;
