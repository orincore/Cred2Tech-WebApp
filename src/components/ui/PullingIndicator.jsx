import React from 'react';
import { motion } from 'framer-motion';

// Small animated "actively fetching" indicator — three breathing dots — used
// anywhere a background auto-poll is in flight (bureau, GST, ITR, bank
// statement) so the user sees it's working instead of a static "Pending".
const PullingIndicator = ({ label = 'Pulling your information…', color = 'var(--warning)' }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color, fontWeight: 500 }}>
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {[0, 0.15, 0.3].map((delay, i) => (
        <motion.span
          key={i}
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay }}
          style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block' }}
        />
      ))}
    </span>
    {label}
  </span>
);

export default PullingIndicator;
