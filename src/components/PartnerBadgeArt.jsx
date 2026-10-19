import React from 'react';

// A flat, custom-drawn graphic for the DSA registration brand panel: a
// business becoming a verified Sourcing Partner, drawn as a credential
// badge rather than a loan file (that motif belongs to the login screen).
// No stock art, no gradients, no shadows.
const PartnerBadgeArt = ({ className = '' }) => (
  <svg viewBox="0 0 400 320" className={className} fill="none" aria-hidden="true">
    <rect x="50" y="96" width="220" height="166" rx="20" fill="#ffffff" fillOpacity="0.14" transform="rotate(-9 160 179)" />
    <rect x="72" y="70" width="220" height="166" rx="20" fill="#ffffff" fillOpacity="0.24" transform="rotate(5 182 153)" />

    <rect x="58" y="46" width="244" height="192" rx="20" fill="#ffffff" />

    {/* Avatar placeholder + name/role lines */}
    <circle cx="100" cy="92" r="22" fill="#E0E7FF" />
    <path d="M86 100c3-6 9-9 14-9s11 3 14 9" stroke="#A5B4FC" strokeWidth="3" strokeLinecap="round" fill="none" />
    <rect x="134" y="82" width="110" height="10" rx="5" fill="#0a1628" fillOpacity="0.75" />
    <rect x="134" y="99" width="72" height="8" rx="4" fill="#E0E7FF" />

    {/* Partner ID stripe */}
    <rect x="90" y="150" width="180" height="1.5" fill="#EDEFFD" />
    <rect x="90" y="168" width="2.5" height="28" fill="#1f1147" />
    <rect x="96" y="168" width="4.5" height="28" fill="#1f1147" />
    <rect x="104" y="168" width="2.5" height="28" fill="#1f1147" />
    <rect x="111" y="168" width="6" height="28" fill="#1f1147" />
    <rect x="121" y="168" width="2.5" height="28" fill="#1f1147" />
    <rect x="128" y="168" width="4.5" height="28" fill="#1f1147" />
    <rect x="137" y="168" width="2.5" height="28" fill="#1f1147" />
    <rect x="144" y="168" width="6" height="28" fill="#1f1147" />
    <rect x="154" y="168" width="2.5" height="28" fill="#1f1147" />
    <rect x="161" y="168" width="4.5" height="28" fill="#1f1147" />
    <rect x="170" y="168" width="2.5" height="28" fill="#1f1147" />
    <rect x="177" y="168" width="6" height="28" fill="#1f1147" />
    <rect x="187" y="168" width="2.5" height="28" fill="#1f1147" />
    <rect x="194" y="168" width="4.5" height="28" fill="#1f1147" />
    <rect x="203" y="168" width="2.5" height="28" fill="#1f1147" />
    <rect x="90" y="204" width="113" height="7" rx="3.5" fill="#E0E7FF" />

    {/* Verified ribbon seal */}
    <circle cx="278" cy="62" r="23" fill="#4F46E5" stroke="#ffffff" strokeWidth="4" /> {/* taste-skill-ignore: brand indigo */}
    <path d="M268 62.5l6.5 6.5L289 54" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M264 80l-6 16 14-6 14 6-6-16" fill="#4F46E5" /> {/* taste-skill-ignore: brand indigo */}

    <line x1="82" y1="276" x2="286" y2="276" stroke="#ffffff" strokeOpacity="0.32" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
    <circle cx="82" cy="276" r="5" fill="#ffffff" fillOpacity="0.4" />
    <circle cx="184" cy="276" r="5" fill="#ffffff" fillOpacity="0.65" />
    <circle cx="286" cy="276" r="6.5" fill="#ffffff" />
  </svg>
);

export default PartnerBadgeArt;
