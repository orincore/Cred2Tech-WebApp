import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { motion, animate } from 'framer-motion';

// Small pill showing a trend vs. the previous period.
const TrendBadge = ({ pct, count }) => {
  const value = Number(pct);
  const isUp = value > 0;
  const isDown = value < 0;
  const color = isUp ? 'var(--success)' : isDown ? 'var(--error)' : 'var(--on-muted)';
  const bg = isUp ? 'var(--success-bg)' : isDown ? 'var(--error-bg)' : 'var(--surface-low)';
  const Icon = isUp ? ArrowUp : isDown ? ArrowDown : Minus;

  if (Number.isNaN(value)) return null;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '2px 7px',
        borderRadius: 0,
        background: bg,
        color,
        fontSize: 11,
        fontWeight: 700,
      }}
      title={typeof count === 'number' ? `${count >= 0 ? '+' : ''}${count} vs previous period` : undefined}
    >
      <Icon size={11} strokeWidth={3} />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
};

export default TrendBadge;

// Animates a numeric value counting up from its previous value whenever it
// changes. Shared by every KPI tile in both dashboard views.
export const AnimatedNumber = ({ value, format = (n) => Math.round(n).toLocaleString('en-IN') }) => {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const target = Number(value) || 0;
    const controls = animate(prevValue.current, target, {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    });
    prevValue.current = target;
    return () => controls.stop();
  }, [value]);

  return <motion.span>{format(display)}</motion.span>;
};
