import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useCasePullStatus } from '../../hooks/useCasePullStatus';
import PullStatusTracker from '../ui/PullStatusTracker';

const LIVE_PHASES = ['QUEUED', 'AWAITING_CUSTOMER', 'PROCESSING', 'GENERATING_REPORT', 'FINALIZING'];

const dismissedKey = (caseId) => `gst_pull_banner_dismissed_${caseId}`;

const readDismissedTotal = (caseId) => {
  if (!caseId) return null;
  const raw = localStorage.getItem(dismissedKey(caseId));
  return raw != null ? Number(raw) : null;
};

/**
 * Case-wide, step-independent GST pull status — mounted once at the top of
 * AddCustomerWizardPage (below the stepper, above the step content), so it
 * stays visible no matter which of the 7 steps the borrower/DSA is actually
 * on while a GST pull they kicked off on step 2 keeps running in the
 * background. Driven by the same live snapshot GstAnalyticsForm uses
 * (useCasePullStatus → snapshot.gst.overall), just the case-level aggregate
 * instead of a single request, so it reflects "the case's GST situation"
 * rather than any one journey.
 */
const GstPullStatusBanner = ({ caseId }) => {
  const { snapshot } = useCasePullStatus(caseId);
  const overall = snapshot?.gst?.overall;

  // Dismissing only hides *this* pull's banner — persisted to localStorage so
  // it survives a page refresh, but keyed to the request total so if the
  // total changes afterward (a new pull started, e.g. after "Remove" +
  // re-submit), the banner comes back rather than staying silently hidden
  // forever.
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
          label={isDone ? 'GST data pulled' : isFailed ? 'GST pull failed' : (overall.label || 'Pulling GST data…')}
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

export default GstPullStatusBanner;
