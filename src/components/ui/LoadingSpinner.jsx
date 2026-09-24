import React from 'react';
import Skeleton from './Skeleton';

// The app has no spinners — every loading state is a skeleton shimmer. This
// component keeps its original name/props (~70 call sites) but renders a
// skeleton instead of a rotating ring:
//   - inline / small (size <= 20, i.e. the "Saving…" slot inside a button):
//     a shimmering bar tinted from currentColor, so it reads on any button.
//   - fullPage: a generic page-shaped skeleton (title + cards).
//   - anything else (the old "centered spinner in a padded box"): a short
//     stack of shimmering rows sized to fill that box.
// Pages with a real layout to mirror should still render their own shaped
// skeleton (see CaseDetailPage / EsrPage / MisReportsPage); this is the
// generic fallback.
const LoadingSpinner = ({ size = 24, color, fullPage = false }) => {
  if (fullPage) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', minHeight: 300, padding: 4 }} role="status" aria-label="Loading">
        <Skeleton width={220} height={24} />
        <Skeleton height={72} />
        <Skeleton height={180} />
        <Skeleton height={180} />
      </div>
    );
  }

  if (size <= 20) {
    return (
      <span
        className="skeleton-inline"
        role="status"
        aria-label="Loading"
        style={{ width: Math.max(28, size * 3), height: Math.max(8, Math.round(size * 0.6)), ...(color && color !== 'currentColor' ? { color } : null) }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 'min(480px, 100%)', margin: '0 auto' }} role="status" aria-label="Loading">
      <Skeleton width="45%" height={16} />
      <Skeleton height={size} />
      <Skeleton height={size} />
    </div>
  );
};

export default LoadingSpinner;
