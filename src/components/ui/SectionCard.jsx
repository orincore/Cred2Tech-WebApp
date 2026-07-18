import React from 'react';
import { motion } from 'framer-motion';

// Bordered, elevated panel used for every table/list section on the
// dashboard. Replaces the repeated hand-rolled "header row + body" div.
const SectionCard = ({ title, subtitle, actions, children, delay = 0, className = '' }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
    style={{
      background: 'var(--surface)',
      border: '1px solid var(--outline)',
      borderRadius: 0,
      overflow: 'hidden',
    }}
  >
    {(title || actions) && (
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--outline)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          {title && <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--on-surface)', margin: 0 }}>{title}</h3>}
          {subtitle && <p style={{ fontSize: 12, color: 'var(--on-muted)', marginTop: 2, marginBottom: 0 }}>{subtitle}</p>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>}
      </div>
    )}
    {children}
  </motion.div>
);

export default SectionCard;
