import React from 'react';
import { motion } from 'framer-motion';

// One row of a horizontal bar: label, count, and a %-width fill.
// Shared visual primitive for the DSA "Stage Summary" grid and the
// Platform "Customer Funnel" — same shape, different data.
const StageBar = ({ label, count, pct = 0, suffix, color = 'var(--primary)', delay = 0 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--on-surface)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', flexShrink: 0 }}>
        {count?.toLocaleString?.('en-IN') ?? count}
        {suffix && <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--on-muted)', marginLeft: 4 }}>{suffix}</span>}
      </span>
    </div>
    <div
      style={{
        height: 8,
        borderRadius: 0,
        background: 'var(--surface-low)',
        overflow: 'hidden',
      }}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
        style={{ height: '100%', borderRadius: 0, background: color }}
      />
    </div>
  </div>
);

export default StageBar;
