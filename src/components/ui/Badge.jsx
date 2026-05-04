import React from 'react';
import { ROLES } from '../../constants/roles';

const Badge = ({ type = 'role', value, className = '' }) => {
  if (!value) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;

  let color, bg, label;

  if (type === 'role') {
    const role = ROLES[value] || {};
    color = role.color || 'var(--text-secondary)';
    bg = role.bg || 'var(--bg-elevated)';
    label = role.name || value;
  } else if (type === 'status') {
    if (value === 'ACTIVE') {
      color = 'var(--success)'; bg = 'var(--success-bg)'; label = 'Active';
    } else {
      color = 'var(--text-tertiary)'; bg = 'var(--bg-elevated)'; label = 'Inactive';
    }
  } else if (type === 'level') {
    color = 'var(--info)'; bg = 'var(--info-bg)'; label = value;
  } else {
    color = 'var(--text-secondary)'; bg = 'var(--bg-elevated)'; label = value;
  }

  return (
    <span
      className={`badge ${className}`}
      style={{ color, backgroundColor: bg, border: `1px solid ${color}22` }}
    >
      {label}
    </span>
  );
};

export default Badge;
