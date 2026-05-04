import React from 'react';

const LoadingSpinner = ({ size = 24, color = 'var(--primary)', fullPage = false }) => {
  const spinner = (
    <div
      style={{
        width: size,
        height: size,
        border: `${Math.max(2, size / 10)}px solid ${color}30`,
        borderTop: `${Math.max(2, size / 10)}px solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        flexShrink: 0,
      }}
    />
  );

  if (fullPage) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: '300px',
        gap: 16,
      }}>
        {spinner}
        <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>Loading…</span>
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner;
