import React from 'react';
import { motion } from 'framer-motion';

// Card wrapper for the app's legacy `.card` token family (--text-primary,
// --bg-elevated, --border, --primary from index.css) — the icon+title header
// with optional gradient tint and right-aligned badge/action repeats across
// the case-journey pages (Product & Property, Income Summary, Bureau &
// Obligations, ESR); this consolidates that pattern in one place.
const Panel = ({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  headerRight,
  accentColor,
  bodyPadding = 24,
  delay = 0,
  hoverable = false,
  className = '',
  style,
  children,
}) => {
  const color = iconColor || accentColor || 'var(--primary)';

  return (
    <motion.div
      className={`card ${className}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={hoverable ? { y: -3, borderColor: color } : undefined}
      style={{ borderRadius: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', ...style }}
    >
      {title && (
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            background: accentColor ? `linear-gradient(135deg, ${accentColor}14, transparent)` : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {Icon && <Icon size={18} color={color} style={{ flexShrink: 0 }} />}
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: accentColor || 'var(--text-primary)', overflowWrap: 'break-word' }}>{title}</h3>
              {subtitle && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0', overflowWrap: 'break-word' }}>{subtitle}</p>}
            </div>
          </div>
          {headerRight && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>{headerRight}</div>}
        </div>
      )}
      <div style={{ padding: bodyPadding, display: 'flex', flexDirection: 'column', flex: 1 }}>{children}</div>
    </motion.div>
  );
};

export default Panel;
