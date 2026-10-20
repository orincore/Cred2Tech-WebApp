import React from 'react';
import { motion } from 'framer-motion';

// Single animated asset for the auth brand panel — purely visual, no
// numbers or text claims (nothing that could be read as a real stat): a
// loan application document being scanned and approved, looping. Flat,
// no gradient/shadow, brand indigo + white, matching the panel's house
// style — a different composition from LoanJourneyArt (one large centered
// document instead of a stacked-card fan), not just a reskin of it.
const SCAN_DURATION = 2.2;

const LoginScanApproval = ({ className = '' }) => (
  <svg viewBox="0 0 320 320" className={className} fill="none" aria-hidden="true">
    {/* Document */}
    <rect x="80" y="40" width="160" height="208" rx="16" fill="#ffffff" />
    <rect x="106" y="78" width="100" height="9" rx="4.5" fill="#E0E7FF" />
    <rect x="106" y="100" width="76" height="9" rx="4.5" fill="#E0E7FF" />
    <rect x="106" y="122" width="88" height="9" rx="4.5" fill="#E0E7FF" />
    <rect x="106" y="152" width="108" height="9" rx="4.5" fill="#E0E7FF" />
    <rect x="106" y="174" width="60" height="9" rx="4.5" fill="#E0E7FF" />

    {/* Scan line sweeping down the document, looping */}
    <motion.g
      initial={{ y: 40 }}
      animate={{ y: [40, 248, 40] }}
      transition={{ duration: SCAN_DURATION, repeat: Infinity, ease: 'easeInOut', times: [0, 0.55, 1] }}
    >
      <rect x="80" y="0" width="160" height="3" rx="1.5" fill="#4F46E5" /> {/* taste-skill-ignore: brand indigo, kept per --keep palette */}
      <rect x="80" y="0" width="160" height="26" fill="url(#scanGlow)" />
    </motion.g>
    <defs>
      <linearGradient id="scanGlow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4F46E5" stopOpacity="0.22" /> {/* taste-skill-ignore: brand indigo */}
        <stop offset="1" stopColor="#4F46E5" stopOpacity="0" /> {/* taste-skill-ignore: brand indigo */}
      </linearGradient>
    </defs>

    {/* Document border, flat, no shadow */}
    <rect x="80" y="40" width="160" height="208" rx="16" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.5" />

    {/* Approval seal — scales in once per scan cycle, timed to the scan line's pass */}
    <motion.g
      style={{ transformOrigin: '160px 232px' }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: [0, 0, 1.15, 1, 1, 0], opacity: [0, 0, 1, 1, 1, 0] }}
      transition={{ duration: SCAN_DURATION, repeat: Infinity, ease: 'easeInOut', times: [0, 0.5, 0.62, 0.72, 0.94, 1] }}
    >
      <circle cx="160" cy="232" r="30" fill="#4F46E5" stroke="#ffffff" strokeWidth="5" /> {/* taste-skill-ignore: brand indigo */}
      <path d="M146 232.5l9 9L176 220" stroke="#ffffff" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
    </motion.g>

    {/* Ambient floating dots, flat */}
    <motion.circle
      cx="60" cy="90" r="4" fill="#ffffff" fillOpacity="0.4"
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.circle
      cx="266" cy="140" r="5" fill="#ffffff" fillOpacity="0.3"
      animate={{ y: [0, 12, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
    />
    <motion.circle
      cx="52" cy="210" r="3.5" fill="#ffffff" fillOpacity="0.5"
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
    />
  </svg>
);

export default LoginScanApproval;
