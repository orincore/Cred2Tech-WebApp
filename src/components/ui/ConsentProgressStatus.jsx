import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, ShieldCheck, Send } from 'lucide-react';

// Same breathing-dots language as PullingIndicator, but the label itself
// advances through what "Request Consent" is actually doing server-side
// (identityVerification.service.js: PAN/GST -> simple-PAN fallback -> BEFISC
// Profile Advance mobile lookup -> create + send the OTP) instead of sitting
// on one static "Sending…" for the whole ~20-90s the vendor chain can take —
// that static label is exactly what read as "stuck" even though it was still
// working. There's no live push from the server for these intermediate
// steps (it's one HTTP request, not a progress stream), so this advances on
// a timer and holds on the last stage rather than looping — a slow PAN/GST
// lookup (its own vendor timeout is up to 60s) should never look like it
// restarted from scratch.
const STAGES = [
  { icon: Smartphone, label: 'Checking mobile number…' },
  { icon: ShieldCheck, label: 'Verifying PAN ownership…' },
  { icon: Send, label: 'Sending consent link…' },
];
const STAGE_INTERVAL_MS = 2600;

const ConsentProgressStatus = ({ active = true, color = 'var(--warning)', style }) => {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setStageIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, STAGES.length - 1));
    }, STAGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active]);

  if (!active) return null;

  const { icon: Icon, label } = STAGES[stageIndex];

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color, fontWeight: 500, ...style }}>
      <span style={{ display: 'inline-flex', gap: 3 }}>
        {[0, 0.15, 0.3].map((delay, i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay }}
            style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }}
          />
        ))}
      </span>
      <AnimatePresence mode="wait">
        <motion.span
          key={stageIndex}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
        >
          <Icon size={13} />
          {label}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

export default ConsentProgressStatus;
