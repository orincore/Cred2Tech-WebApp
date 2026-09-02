import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useCasePullStatus } from '../../hooks/useCasePullStatus';
import PullStatusTracker from '../ui/PullStatusTracker';

const LIVE_PHASES = ['QUEUED', 'AWAITING_CUSTOMER', 'PROCESSING', 'GENERATING_REPORT', 'FINALIZING'];

const dismissedKey = (caseId) => `itr_pull_banner_dismissed_${caseId}`;

const readDismissedTotal = (caseId) => {
  if (!caseId) return null;
  const raw = localStorage.getItem(dismissedKey(caseId));
  return raw != null ? Number(raw) : null;
};

/**
 * Case-wide, step-independent ITR pull status — same shape and mount point
 * as GstPullStatusBanner (right below GstPullStatusBanner in
 * AddCustomerWizardPage), so a pending/processing ITR pull — whether the DSA
 * entered credentials directly or the customer authorised it via an emailed
 * link (see itrAuthLink.service.js) — stays visible no matter which of the
 * wizard's steps the borrower/DSA is currently on. Driven by the same live
 * snapshot ItrAnalyticsForm uses (useCasePullStatus → snapshot.itr.overall).
 */
const ItrPullStatusBanner = ({ caseId }) => {
  const { snapshot } = useCasePullStatus(caseId);
  const overall = snapshot?.itr?.overall;

  const [dismissedAtTotal, setDismissedAtTotal] = useState(() => readDismissedTotal(caseId));
  useEffect(() => {
    setDismissedAtTotal(readDismissedTotal(caseId));
  }, [caseId]);

  const dismissed = overall != null && dismissedAtTotal === overall.total;

  const handleDismiss = () => {
    if (!overall) return;
    setDismissedAtTotal(overall.total);
    if (caseId) {
      try { localStorage.setItem(dismissedKey(caseId), String(overall.total)); } catch { /* ignore quota/privacy errors */ }
    }
  };

  if (!overall || overall.total === 0 || overall.phase === 'NOT_STARTED' || dismissed) return null;

  const isDone = overall.phase === 'COMPLETED';
  const isFailed = overall.phase === 'FAILED';
  const isLive = LIVE_PHASES.includes(overall.phase);

  return (
    <div
      style={{
        padding: '12px 20px',
        marginBottom: 20,
        border: `1px solid ${isDone ? 'var(--success)' : isFailed ? 'var(--error)' : 'var(--warning)'}`,
        background: isDone ? 'var(--success-bg)' : isFailed ? 'var(--error-bg)' : 'var(--warning-bg)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: '1 1 280px', minWidth: 0 }}>
        <PullStatusTracker
          variant="panel"
          phase={overall.phase}
          label={isDone ? 'ITR data pulled' : isFailed ? 'ITR pull failed' : (overall.label || 'Pulling ITR data…')}
          progress={overall.progress}
        />
      </div>
      {/* Only a completed or failed pull can be dismissed — a live one stays
          on screen so it can't be closed away mid-pull and forgotten. */}
      {!isLive && (
        <button
          type="button"
          onClick={handleDismiss}
          className="btn btn-ghost btn-icon"
          title="Dismiss"
          style={{ flexShrink: 0, color: isDone ? 'var(--success)' : 'var(--error)' }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

export default ItrPullStatusBanner;
