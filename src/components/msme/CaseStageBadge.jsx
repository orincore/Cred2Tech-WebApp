import React from 'react';
import { CASE_STAGE_LABELS, formatStatusLabel } from '../../utils/helpers';

// One distinct colour per case stage, so a customer can tell where a case is at
// a glance. Hex values (not theme tokens) because each stage needs its own hue;
// the tint is derived from the same colour so it reads in both the light and
// dark theme. No border; corners are squared by the page's `.badge` rule.
export const STAGE_COLORS = {
  DRAFT: '#6b7280',               // grey      - not submitted yet
  LEAD_CREATED: '#2563eb',        // blue      - received
  DATA_COLLECTION: '#0891b2',     // cyan      - data pulled
  INCOME_REVIEWED: '#0d9488',     // teal
  ESR_GENERATED: '#4f46e5',       // indigo    - login done
  LEAD_SENT_TO_LENDER: '#7c3aed', // violet    - with the lender
  IN_REVIEW: '#d97706',           // amber
  APPROVED: '#16a34a',            // green     - sanctioned
  PARTLY_DISBURSED: '#65a30d',    // lime
  DISBURSED: '#059669',           // emerald
  REJECTED: '#dc2626',            // red
  CLOSED: '#64748b',              // slate
};

const CaseStageBadge = ({ stage }) => {
  if (!stage) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
  const color = STAGE_COLORS[stage] || STAGE_COLORS.DRAFT;
  return (
    <span
      className="badge"
      style={{ color, backgroundColor: `${color}1f`, border: 'none' }}
    >
      {CASE_STAGE_LABELS[stage] || formatStatusLabel(stage)}
    </span>
  );
};

export default CaseStageBadge;
