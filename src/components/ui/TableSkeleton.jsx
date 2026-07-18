import React from 'react';

// Generates `rows` skeleton rows of `columns` cells, for the loading state
// of any table/list section on the dashboard.
const TableSkeleton = ({ rows = 4, columns = 4 }) => (
  <div style={{ padding: '4px 20px' }}>
    {Array.from({ length: rows }).map((_, r) => (
      <div
        key={r}
        style={{
          display: 'flex',
          gap: 16,
          padding: '14px 0',
          borderBottom: r < rows - 1 ? '1px solid var(--outline)' : 'none',
        }}
      >
        {Array.from({ length: columns }).map((_, c) => (
          <div
            key={c}
            className="skeleton"
            style={{ height: 14, flex: c === 0 ? 2 : 1, borderRadius: 0 }}
          />
        ))}
      </div>
    ))}
  </div>
);

export default TableSkeleton;
