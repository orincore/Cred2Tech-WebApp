import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SearchX, ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import Logo from '../components/Logo';

/** Expanding, fading sonar rings behind the icon — same "still active, not
    dead" treatment OfflineOverlay uses behind its WifiOff icon, reused here
    so every full-screen app-shell state (offline, 404, ...) reads as one
    family instead of each page inventing its own look. */
const RadarRings = ({ color }) => (
  <>
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="notfound-radar-ring"
        style={{ borderColor: color, animationDelay: `${i * 0.9}s` }}
      />
    ))}
  </>
);

// Design intentionally mirrors OfflineOverlay.jsx (the app's other full-screen
// shell state) exactly: same bg/card/border colors, sharp (unrounded) card,
// same heading/body type scale, same solid-indigo sharp-corner button, same
// framer-motion entrance. Kept as one visual family rather than a bespoke
// error-page look.
const NotFoundPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Cred2Tech | Page Not Found';
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#eef4ff] dark:bg-[#0a1628] font-sans px-6 py-10 relative">
      <style>{`
        @keyframes notfound-radar-ping {
          0% { transform: scale(0.4); opacity: 0.55; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .notfound-radar-ring {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          border: 1.5px solid;
          animation: notfound-radar-ping 2.7s cubic-bezier(0.2, 0.6, 0.4, 1) infinite;
        }
      `}</style>

      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="flex justify-center mb-8">
          <Logo size="large" />
        </div>

        <div className="bg-white dark:bg-[#162048] shadow-xl border border-[#c7d2fe]/60 dark:border-[#2d3a6c] p-8 md:p-10 text-center">
          <div className="relative mx-auto mb-6 w-20 h-20 flex items-center justify-center">
            <RadarRings color="#4f46e5" />
            <div className="relative w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-[#4f46e5] dark:text-[#818CF8] flex items-center justify-center">
              <SearchX size={28} />
            </div>
          </div>

          <h1 className="text-[22px] font-bold text-[#0a1628] dark:text-[#e6edf7] mb-2">
            Page Not Found
          </h1>
          <p className="text-[13px] font-medium text-[#0a1628]/70 dark:text-[#e6edf7]/70 leading-relaxed mb-6">
            The page you're looking for doesn't exist or has been moved. Double-check
            the URL, or head back to a page that does.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 text-[13px] font-bold text-[#0a1628] dark:text-[#e6edf7] border border-[#c7d2fe]/60 dark:border-[#2d3a6c] hover:bg-black/[0.03] dark:hover:bg-white/5 transition-colors"
            >
              <ArrowLeft size={14} />
              Go Back
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-full sm:w-auto px-5 py-2.5 text-[13px] font-bold text-white bg-[#4f46e5] hover:bg-[#4338ca] transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFoundPage;
