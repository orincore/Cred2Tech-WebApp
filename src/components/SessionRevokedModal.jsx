import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import TravelingBorderButton from './TravelingBorderButton';

// Mounted once at the app root (inside AuthProvider + BrowserRouter — see
// AppRouter.jsx). Renders on top of whatever page is already open the
// instant AuthContext's session-liveness poll finds this device's session
// was revoked or banned from elsewhere (Active Sessions, Profile page) —
// deliberately NOT a redirect, so the user sees this instead of the page
// just silently dying under them. A hard page refresh never reaches this
// component at all — that case is handled by axiosInstance's plain silent
// 401 redirect instead (see its own comment).
const SessionRevokedModal = () => {
  const { sessionRevoked, acknowledgeSessionRevoked } = useAuth();
  const navigate = useNavigate();

  const goLogin = () => {
    acknowledgeSessionRevoked();
    navigate('/login', { replace: true });
  };

  const goSignup = () => {
    acknowledgeSessionRevoked();
    navigate('/register-dsa', { replace: true });
  };

  return (
    <AnimatePresence>
      {sessionRevoked && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 flex items-center justify-center z-[2000] bg-black/60"
          style={{ backdropFilter: 'blur(6px)' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="bg-white dark:bg-[#0a1628] rounded-[20px] shadow-2xl p-8 max-w-[420px] w-[90%] text-center border border-gray-100 dark:border-gray-800"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3, ease: 'easeOut' }}
              className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-5"
            >
              <ShieldOff size={32} className="text-red-600" />
            </motion.div>
            <h3 className="text-xl font-bold text-[#0a1628] dark:text-[#e6edf7] mb-2">
              Your session has ended
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-7 leading-relaxed">
              This device's session was revoked from another device or by an administrator.
              Please sign in again to continue.
            </p>
            <div className="flex flex-col gap-3">
              <TravelingBorderButton onClick={goLogin} className="w-full py-3 text-[14px] rounded-[10px]">
                Log In
              </TravelingBorderButton>
              <button
                onClick={goSignup}
                className="w-full py-3 text-[14px] font-bold rounded-[10px] border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer"
              >
                Sign Up
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SessionRevokedModal;
