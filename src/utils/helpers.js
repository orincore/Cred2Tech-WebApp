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

// Normalize a name to title case - first letter of each word capitalized, rest
// lowercase. PAN/GST vendor responses come back ALL CAPS ("ADARSH BHIKAJI
// SURADKAR"); this makes every name display consistently as "Adarsh Bhikaji
// Suradkar" instead.
export const toTitleCase = (str) => {
  if (!str) return str;
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
};

// A GST *trade* name is not safe to display. When a business holds only a
// provisional GST registration the vendor returns a Temporary Reference Number
// in the trade/legal name fields instead of a real name — which is how strings
// like "272400510227TRN" end up on screen. The PAN controller guards against
// this now, but customer rows written before that guard still carry TRN values
// in `business_name` (which is itself derived trade-name-first).
//
// So: never trust a trade-derived name, and screen whatever is used for TRN
// artifacts. `business_name` stays as a last resort because for a lot of
// records it is a perfectly good manually-entered name (business_name_source
// === 'MANUAL').
const TRN_ARTIFACT_RE = /\d{6,}\s*TRN\s*$/i;

export const isUsableEntityName = (value) => {
  const name = String(value ?? '').trim();
  if (!name) return false;
  if (TRN_ARTIFACT_RE.test(name)) return false; // e.g. "272400510227TRN"
  if (/^\d+$/.test(name)) return false;         // a bare registration number is not a name
  return true;
};

/**
 * The one place that decides which name represents a customer on screen.
 *
 * Order: the plain KYC identity field first (user-entered, always reliable),
 * then the GST *legal* name, then the PAN holder name, and only then
 * `business_name`. Putting proprietor_name first preserves what the case
 * header, MSME dashboard and case wizard already did — this only changes what
 * happens when it is empty, which is exactly where the TRN was showing.
 *
 * @param {object|null} customer - a customer (or any object carrying these fields)
 * @param {string} fallback - returned when nothing usable exists
 */
export const resolveEntityName = (customer, fallback = '') => {
  if (!customer) return fallback;
  return [
    customer.proprietor_name,
    customer.legal_business_name,
    customer.pan_holder_name,
    customer.business_name,
  ].find(isUsableEntityName) || fallback;
};

// Common acronyms in status/stage codes that should stay uppercase when humanized
// (e.g. ESR_GENERATED -> "ESR Generated", not "Esr Generated").
const STATUS_LABEL_ACRONYMS = new Set([
  'ESR', 'KYC', 'GST', 'PAN', 'CIBIL', 'ROI', 'LTV', 'FOIR', 'DBR', 'CA',
  'NWM', 'LIP', 'GRP', 'ITR', 'AA', 'OTP', 'PDD', 'DSA', 'MSME', 'EMI',
]);

// The DSA-facing case pipeline label set (see CustomersListPage's own copy of
// this same mapping) — some CaseStage values get DSA-jargon labels that don't
// match generic Title-Case formatting (e.g. ESR_GENERATED -> "Login Done",
// APPROVED -> "Sanctioned"), so MSME-facing pages must use this exact mapping
// too rather than formatStatusLabel alone, or the same case shows two
// different-looking statuses depending on which side is viewing it.
export const CASE_STAGE_LABELS = {
  LEAD_CREATED: 'Lead Created',
  DATA_COLLECTION: 'Data Pulled',
  LEAD_SENT_TO_LENDER: 'Lead Sent',
  ESR_GENERATED: 'Login Done',
  APPROVED: 'Sanctioned',
  DISBURSED: 'Disbursed',
  PARTLY_DISBURSED: 'Partly Disbursed',
  CLOSED: 'Closed',
  REJECTED: 'Rejected',
  DRAFT: 'Draft',
};

// Renders raw backend enum values (SCREAMING_SNAKE_CASE stage/status codes like
// "ESR_GENERATED", "LEAD_SENT_TO_LENDER") as clean, spaced, title-cased labels.
// Leaves already-readable text (e.g. values that aren't all-caps-with-underscores)
// untouched so it's safe to run on anything without double-processing labels
// that already went through an explicit STAGE_LABELS map.
export const formatStatusLabel = (value) => {
  if (value === null || value === undefined) return value;
  const str = String(value);
  if (!/^[A-Z0-9]+(_[A-Z0-9]+)*$/.test(str)) return str;
  return str
    .split('_')
    .filter(Boolean)
    .map((w) => (STATUS_LABEL_ACRONYMS.has(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(' ');
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
