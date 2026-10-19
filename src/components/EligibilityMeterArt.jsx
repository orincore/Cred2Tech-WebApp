import React from 'react';

// A flat, custom-drawn graphic for the MSME OTP login brand panel: a phone
// showing the eligibility read-out the product promises ("check across
// multiple lenders instantly"), drawn as its own composition rather than
// reusing the login or DSA registration screens' artwork. No stock art,
// no gradients, no shadows.
const EligibilityMeterArt = ({ className = '' }) => (
  <svg viewBox="0 0 400 320" className={className} fill="none" aria-hidden="true">
    <rect x="130" y="38" width="140" height="244" rx="26" fill="#ffffff" />
    <rect x="184" y="50" width="32" height="6" rx="3" fill="#E0E7FF" />

    <path d="M144 175A56 56 0 0 1 172 126.5" stroke="#E0E7FF" strokeWidth="14" strokeLinecap="round" />
    <path d="M172 126.5A56 56 0 0 1 228 126.5" stroke="#C7D2FE" strokeWidth="14" strokeLinecap="round" />
    <path d="M228 126.5A56 56 0 0 1 256 175" stroke="#4F46E5" strokeWidth="14" strokeLinecap="round" /> {/* taste-skill-ignore: brand indigo */}

    <line x1="200" y1="175" x2="226" y2="144" stroke="#1f1147" strokeWidth="4" strokeLinecap="round" />
    <circle cx="200" cy="175" r="6" fill="#1f1147" />

    <rect x="156" y="222" width="88" height="8" rx="4" fill="#E0E7FF" />
    <rect x="166" y="238" width="68" height="8" rx="4" fill="#E0E7FF" />
    <rect x="176" y="254" width="48" height="8" rx="4" fill="#4F46E5" /> {/* taste-skill-ignore: brand indigo */}

    <circle cx="278" cy="62" r="23" fill="#4F46E5" stroke="#ffffff" strokeWidth="4" /> {/* taste-skill-ignore: brand indigo */}
    <path d="M268 62.5l6.5 6.5L289 54" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default EligibilityMeterArt;
