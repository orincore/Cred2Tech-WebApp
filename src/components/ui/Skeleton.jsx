import React from 'react';

// Sharp-cornered variant of the global `.skeleton` shimmer (index.css) —
// that one hardcodes `border-radius: var(--radius)`, which doesn't match
// this app's house style (borderRadius: 0 everywhere). Reuses the same
// `shimmer` keyframe animation rather than defining a second one.
const Skeleton = ({ width = '100%', height = 14, style = {} }) => (
  <div
    className="skeleton"
    style={{
      width,
      height,
      borderRadius: 0,
      ...style,
    }}
  />
);

export default Skeleton;
