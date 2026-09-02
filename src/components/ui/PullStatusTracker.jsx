import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * Animated live status for a data pull (GST / ITR / bank statement).
 *
 * Driven entirely by the server snapshot's derived `phase` / `label` /
 * `progress`, which are grounded in real record state — so the bar never
 * advances on a timer while nothing is actually happening.
 *
 * Renders in two shapes:
 *   - `variant="row"` (default) — a compact pill + label, for the per-applicant
 *     rows in the ITR and bank lists.
 *   - `variant="panel"` — pill, label and a progress bar, for the single
 *     full-width GST journey card.
 */

// `bordered` reproduces the outlined pill this UI already used for any
// not-yet-done state, so switching to phases doesn't restyle the rows.
const PHASE_STYLE = {
  NOT_STARTED: { color: 'var(--warning)', bg: 'var(--warning-bg)', text: 'Pending', bordered: true },
  QUEUED: { color: 'var(--warning)', bg: 'var(--warning-bg)', text: 'Queued', bordered: true },
  AWAITING_CUSTOMER: { color: 'var(--warning)', bg: 'var(--warning-bg)', text: 'Action needed', bordered: true },
  PROCESSING: { color: 'var(--warning)', bg: 'var(--warning-bg)', text: 'Processing', bordered: true },
  GENERATING_REPORT: { color: 'var(--warning)', bg: 'var(--warning-bg)', text: 'Generating report', bordered: true },
  FINALIZING: { color: 'var(--warning)', bg: 'var(--warning-bg)', text: 'Finalising', bordered: true },
  COMPLETED: { color: 'var(--success)', bg: 'var(--success-bg)', text: 'Done', bordered: false },
  FAILED: { color: 'var(--error)', bg: 'var(--error-bg)', text: 'Failed', bordered: false },
};

const LIVE_PHASES = ['QUEUED', 'AWAITING_CUSTOMER', 'PROCESSING', 'GENERATING_REPORT', 'FINALIZING'];

/** Three breathing dots — the "server is actively working on this" signal. */
const WorkingDots = ({ color }) => (
  <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
    {[0, 0.15, 0.3].map((delay, i) => (
      <motion.span
        key={i}
        animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay }}
        style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block' }}
      />
    ))}
  </span>
);

const StatusPill = ({ phase, style }) => {
  const isLive = LIVE_PHASES.includes(phase);
  return (
    <span
      style={{
        background: style.bg,
        color: style.color,
        padding: '4px 10px',
        borderRadius: 0,
        fontSize: 12,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        border: style.bordered ? `1px solid ${style.color}` : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {/* AWAITING_CUSTOMER used to get a static Clock icon instead of the
          working-dots animation every other live phase has — looked dead
          rather than "still waiting on something", so it now animates like
          the rest of LIVE_PHASES. */}
      {phase === 'COMPLETED' ? <CheckCircle2 size={13} />
        : phase === 'FAILED' ? <AlertCircle size={13} />
          : isLive ? <WorkingDots color={style.color} /> : null}
      {style.text}
    </span>
  );
};

const PullStatusTracker = ({
  phase = 'NOT_STARTED',
  label = '',
  progress = 0,
  variant = 'row',
  showLabel = true,
}) => {
  const style = PHASE_STYLE[phase] || PHASE_STYLE.NOT_STARTED;
  const isLive = LIVE_PHASES.includes(phase);

  if (variant === 'row') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <StatusPill phase={phase} style={style} />
        {showLabel && label && (
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              style={{ fontSize: 12, color: 'var(--text-tertiary)' }}
            >
              {label}
            </motion.span>
          </AnimatePresence>
        )}
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <StatusPill phase={phase} style={style} />
        {showLabel && label && (
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}
            >
              {label}
            </motion.span>
          </AnimatePresence>
        )}
      </div>

      {phase !== 'NOT_STARTED' && (
        <div
          style={{
            position: 'relative',
            height: 4,
            width: '100%',
            background: 'var(--bg-elevated)',
            overflow: 'hidden',
          }}
        >
          <motion.div
            initial={false}
            animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{ height: '100%', background: style.color }}
          />
          {/* Indeterminate shimmer on top of the real progress — communicates
              "still working" during the long waits between real transitions
              without faking forward movement. */}
          {isLive && (
            <motion.div
              animate={{ x: ['-100%', '400%'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: '25%',
                background: `linear-gradient(90deg, transparent, ${style.color}, transparent)`,
                opacity: 0.45,
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default PullStatusTracker;
