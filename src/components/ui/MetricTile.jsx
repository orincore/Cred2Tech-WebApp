import React from 'react';
import { motion } from 'framer-motion';

// Small "label + big value" tile repeated across the case-journey pages —
// plain inline (footer strips, per-applicant summary bars) or boxed (grid
// summaries like Total Obligation / ESR snapshot).
const MetricTile = ({ label, value, color = 'var(--text-primary)', icon: Icon, boxed = false, highlight = false, size = 'md', delay = 0 }) => {
  const valueFontSize = size === 'lg' ? 22 : size === 'sm' ? 15 : 18;

  const content = (
    <>
      <div
        style={{
          fontSize: boxed ? 10 : 11,
          color: highlight ? color : 'var(--text-tertiary)',
          fontWeight: highlight ? 700 : boxed ? 600 : 400,
          textTransform: boxed ? 'uppercase' : 'none',
          letterSpacing: boxed ? '0.5px' : 'normal',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: boxed ? 6 : 0,
        }}
      >
        {Icon && <Icon size={11} />}
        {label}
      </div>
      <div style={{ fontSize: valueFontSize, fontWeight: 800, color, marginTop: boxed ? 0 : 2 }}>{value}</div>
    </>
  );

  const motionProps = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] },
  };

  if (!boxed) return <motion.div {...motionProps}>{content}</motion.div>;

  return (
    <motion.div
      {...motionProps}
      style={{
        background: highlight ? `${color}14` : 'var(--bg-elevated)',
        border: `1px solid ${highlight ? color : 'var(--border)'}`,
        borderRadius: 0,
        padding: size === 'lg' ? 16 : 12,
        textAlign: size === 'lg' ? 'center' : 'left',
      }}
    >
      {content}
    </motion.div>
  );
};

export default MetricTile;
