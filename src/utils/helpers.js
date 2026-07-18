// Format ISO date string to readable local date/time
export const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const formatDateTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Truncate a string with ellipsis
export const truncate = (str, max = 30) => {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '…' : str;
};

// Get initials from a full name
export const getInitials = (name = '') => {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
};

// Build a display-friendly hierarchy path
export const formatHierarchyPath = (path) => {
  if (!path || path === '/') return 'Root';
  return path.replace(/^\//, '').replace(/\/$/, '').split('/').join(' → ');
};

// Format a rupee amount compactly (Cr / L / K), matching Indian numbering
export const formatCompactINR = (amount) => {
  const n = Number(amount) || 0;
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
};

// Get the error message from an axios error
export const getErrorMessage = (error) => {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    'An unexpected error occurred.'
  );
};
