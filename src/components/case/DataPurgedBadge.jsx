import React from 'react';
import { Lock } from 'lucide-react';

/**
 * Shown wherever a case appears (lists, dashboards, detail page) once its
 * data has been permanently removed for data-retention compliance
 * (backend: Case.data_purged_at, set by
 * Cred2Tech/backend/src/services/purge/dataRetentionPurge.service.js).
 * One shared component reused identically everywhere rather than fit into
 * each page's slightly different native pill styling — this is a
 * compliance-critical indicator, consistency matters more than per-page
 * style-matching here. Reuses the same `.badge` class + CSS-var pattern as
 * `src/components/ui/Badge.jsx`.
 */
const DataPurgedBadge = ({ className = '' }) => (
  <span
    className={`badge ${className}`}
    style={{ color: 'var(--error)', backgroundColor: 'var(--error-bg)', border: '1px solid var(--error)22' }}
    title="This case's data has been permanently purged per data retention policy"
  >
    <Lock size={11} />
    Data Purged
  </span>
);

export default DataPurgedBadge;
