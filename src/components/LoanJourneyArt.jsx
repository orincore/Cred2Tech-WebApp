import React from 'react';

// A flat, custom-drawn graphic for auth brand panels: a loan application
// moving through its stages to approval. Built for Cred2Tech specifically
// (no stock art, no gradients, no shadows), shared by the login and DSA
// registration screens so the brand panel says what the product does
// instead of showing generic clip-art.
const LoanJourneyArt = ({ className = '' }) => (
  <svg viewBox="0 0 400 320" className={className} fill="none" aria-hidden="true">
    <rect x="50" y="96" width="220" height="166" rx="20" fill="#ffffff" fillOpacity="0.14" transform="rotate(-9 160 179)" />
    <rect x="72" y="70" width="220" height="166" rx="20" fill="#ffffff" fillOpacity="0.24" transform="rotate(5 182 153)" />

    <rect x="58" y="46" width="244" height="192" rx="20" fill="#ffffff" />
    <rect x="90" y="92" width="152" height="11" rx="5.5" fill="#E0E7FF" />
    <rect x="90" y="118" width="112" height="11" rx="5.5" fill="#E0E7FF" />
    <rect x="90" y="144" width="132" height="11" rx="5.5" fill="#E0E7FF" />
    <rect x="90" y="184" width="76" height="16" rx="5" fill="#4F46E5" /> {/* taste-skill-ignore: Cred2Tech's own brand indigo, kept per --keep palette */}
    <rect x="176" y="187" width="42" height="10" rx="5" fill="#E0E7FF" />

    <circle cx="278" cy="62" r="23" fill="#4F46E5" stroke="#ffffff" strokeWidth="4" /> {/* taste-skill-ignore: brand indigo */}
    <path d="M268 62.5l6.5 6.5L289 54" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />

    <line x1="82" y1="276" x2="286" y2="276" stroke="#ffffff" strokeOpacity="0.32" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
    <circle cx="82" cy="276" r="5" fill="#ffffff" fillOpacity="0.4" />
    <circle cx="184" cy="276" r="5" fill="#ffffff" fillOpacity="0.65" />
    <circle cx="286" cy="276" r="6.5" fill="#ffffff" />
  </svg>
);

export default LoanJourneyArt;
