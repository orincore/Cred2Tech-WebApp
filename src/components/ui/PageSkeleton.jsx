import React from 'react';
import Skeleton from './Skeleton';

// Full-viewport loading state shown before the app shell itself exists yet
// (route-Suspense while a lazy page chunk downloads, ProtectedRoute's
// session-token validation) — deliberately just Skeleton's static shimmer,
// no spinning-circle animation, so it reads as "the page is materializing"
// rather than "something is spinning." Kept generic (no real layout to
// mirror at this point — no route has matched yet) rather than a spinner +
// caption, matching the sharp-cornered skeleton treatment every section-
// level loading state in the app already uses.
const PageSkeleton = () => (
  <div style={{ minHeight: '100dvh', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <Skeleton width={40} height={40} />
      <Skeleton width={160} height={16} />
    </div>
    <Skeleton height={72} />
    <Skeleton height={220} />
    <Skeleton height={220} />
  </div>
);

export default PageSkeleton;
