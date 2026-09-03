import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useCasePullStatus } from '../../hooks/useCasePullStatus';
import PullStatusTracker from '../ui/PullStatusTracker';

const LIVE_PHASES = ['QUEUED', 'AWAITING_CUSTOMER', 'PROCESSING', 'GENERATING_REPORT', 'FINALIZING'];
// A completed/failed pull auto-hides after this long, so it doesn't sit on
// screen indefinitely once the DSA has had a chance to notice it.
const AUTO_HIDE_MS = 5 * 60 * 1000;

const seenKey = (caseId) => `gst_pull_banner_seen_${caseId}`;

const readSeen = (caseId) => {
  if (!caseId) return null;
  try {
    const raw = localStorage.getItem(seenKey(caseId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeSeen = (caseId, total) => {
  if (!caseId) return;
  try { localStorage.setItem(seenKey(caseId), JSON.stringify({ total, shownAt: Date.now() })); } catch { /* ignore quota/privacy errors */ }
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
 *
 * Once a pull for a given `total` reaches a terminal state (done or
 * failed), it is a strictly one-time notification: it's marked "seen" in
 * localStorage the instant it first displays — not just when the DSA closes
 * it — so even a page refresh a second later won't bring it back. While
 * still on screen for that one viewing, it auto-hides after 5 minutes, or
 * sooner if closed manually. A later, genuinely new pull (a different
 * `total`) gets its own fresh one-time showing.
 */
const GstPullStatusBanner = ({ caseId }) => {
  const { snapshot } = useCasePullStatus(caseId);
  const overall = snapshot?.gst?.overall;

  // Snapshot of whatever was already marked "seen" as of this mount —
  // deliberately never updated again for the rest of this component's
  // lifetime (the marking effect below writes straight to localStorage, not
  // to this state), so persisting a fresh seen-mark while this banner is
  // actively on screen doesn't immediately hide itself. It only prevents
  // the *next* mount (a refresh, or navigating back into this case) from
  // showing it again.
  const [persistedSeen, setPersistedSeen] = useState(() => readSeen(caseId));
  useEffect(() => {
    setPersistedSeen(readSeen(caseId));
  }, [caseId]);

  const alreadySeenBefore = overall != null && persistedSeen?.total === overall.total;

  const isDone = overall?.phase === 'COMPLETED';
  const isFailed = overall?.phase === 'FAILED';
  const isLive = overall ? LIVE_PHASES.includes(overall.phase) : false;

  const [autoHidden, setAutoHidden] = useState(false);
  // A new pull (different total) always gets a fresh showing, regardless of
  // whether a previous pull's banner was auto-hidden or closed.
  useEffect(() => {
    setAutoHidden(false);
  }, [overall?.total]);

  // The moment a pull reaches a terminal state for the first time (i.e. it
  // wasn't already marked seen from an earlier mount), record that it has
  // now been shown and arm the 5-minute auto-hide.
  useEffect(() => {
    if (!overall || isLive || alreadySeenBefore) return;
    writeSeen(caseId, overall.total);
    const timer = setTimeout(() => setAutoHidden(true), AUTO_HIDE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, overall?.total, isLive, alreadySeenBefore]);

  const handleDismiss = () => {
    if (!overall) return;
    writeSeen(caseId, overall.total);
    setAutoHidden(true);
  };

  if (!overall || overall.total === 0 || overall.phase === 'NOT_STARTED') return null;
  if (alreadySeenBefore || autoHidden) return null;

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
