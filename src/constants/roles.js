// Role definitions with display names and styling
export const ROLES = {
  SUPER_ADMIN: {
    name: 'Super Admin',
    color: 'var(--role-super-admin)',
    bg: 'var(--role-super-admin-bg)',
    description: 'Platform super administrator with full access',
  },
  CRED2TECH_MEMBER: {
    name: 'Cred2Tech Member',
    color: 'var(--role-cred2tech)',
    bg: 'var(--role-cred2tech-bg)',
    description: 'Internal platform team member',
  },
  // display `name`/`description` say "Sourcing Partner" per the DSA->Sourcing
  // Partner UI rebrand — the `value`/object key (DSA_ADMIN etc.) stays as the
  // internal role identifier throughout the backend/DB and must never change.
  DSA_ADMIN: {
    name: 'Sourcing Partner Admin',
    color: 'var(--role-dsa-admin)',
    bg: 'var(--role-dsa-admin-bg)',
    description: 'Sourcing Partner administrator',
  },
  DSA_MEMBER: {
    name: 'Sourcing Partner Member',
    color: 'var(--role-dsa-member)',
    bg: 'var(--role-dsa-member-bg)',
    description: 'Field employee within a Sourcing Partner hierarchy',
  },
  SUB_DSA: {
    name: 'Sub-Sourcing Partner',
    color: 'var(--role-partner)',
    bg: 'var(--role-partner-bg)',
    description: 'External referral partner working under a Sourcing Partner',
  },
};

// Role options for the Create User form (role_id mapped to internal name)
export const ROLE_OPTIONS = [
  { label: 'Super Admin', value: 'SUPER_ADMIN' },
  { label: 'Cred2Tech Member', value: 'CRED2TECH_MEMBER' },
  { label: 'Sourcing Partner Admin', value: 'DSA_ADMIN' },
  { label: 'Sourcing Partner Member', value: 'DSA_MEMBER' },
  { label: 'Sub-Sourcing Partner', value: 'SUB_DSA' },
];

// Roles allowed on the main dashboard ("/"). Kept in sync with the "/" route's
// allowedRoles in AppRouter so UnauthorizedPage's auto-redirect never loops.
export const DASHBOARD_ROLES = ['SUPER_ADMIN', 'DSA_ADMIN', 'DSA_MEMBER', 'SUB_DSA', 'DSA', 'ADMIN', 'CRED2TECH_MEMBER'];

export const TENANT_TYPES = ['CRED2TECH', 'DSA'];

// Display-only label for a tenant `type` value — the stored/filtered value
// itself stays 'DSA' (backend enum, query params, etc.); only the on-screen
// text is rebranded to "Sourcing Partner". Anything not in this map (e.g.
// 'CRED2TECH') renders as its raw value, unchanged.
const TENANT_TYPE_LABELS = { DSA: 'Sourcing Partner' };
export const formatTenantType = (type) => TENANT_TYPE_LABELS[type] || type;

// Display label for any role value (DSA_ADMIN, MSME_CUSTOMER, ...). Prefers
// the curated ROLES map above (so DSA_ADMIN/DSA_MEMBER/SUB_DSA always show
// their Sourcing-Partner names); anything not in that map — MSME_CUSTOMER
// today — falls back to a generic underscore-aware title-case instead of
// utils/helpers.js#toTitleCase, which doesn't split on '_' and would render
// enum values like "Dsa_admin"/"Msme_customer" verbatim.
export const roleLabel = (roleName) => {
  if (!roleName) return roleName;
  if (ROLES[roleName]) return ROLES[roleName].name;
  return roleName
    .toLowerCase()
    .split('_')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
};

// The submit-feedback flow is for MSME/DSA submitters, not the Cred2Tech
// admins who receive and manage those submissions (they get the full
// ticket-management panel instead — see NAV_ITEMS' 'admin-tickets' entry).
// Shared between AppLayout (floating button for MSME) and Sidebar (inline
// trigger next to the logo for DSA roles) so the two stay in sync.
export const FEEDBACK_SUBMITTER_ROLES = ['MSME_CUSTOMER', 'DSA_ADMIN', 'DSA_MEMBER', 'SUB_DSA'];

// First-time-visit onboarding overlay (see components/tour/PageTour.jsx) —
// a spotlighted walkthrough that auto-plays the first time one of these
// roles lands on a page that mounts it, then never again (per browser, per
// user, per screen) once "Next" is walked to the end or "Skip" is clicked.
// Deliberately DSA-only, same shape as FEEDBACK_SUBMITTER_ROLES above but a
// narrower list — SUB_DSA/DSA_MEMBER/DSA_ADMIN only, not MSME_CUSTOMER (the
// MSME portal has its own separate onboarding flow) and not SUPER_ADMIN/
// CRED2TECH_MEMBER (internal staff, not the audience this feature is for).
export const DSA_TOUR_ROLES = ['DSA_ADMIN', 'DSA_MEMBER', 'SUB_DSA'];

// Hierarchy levels used by employees
export const HIERARCHY_LEVELS = ['L1', 'L2', 'L3', 'L4'];

// User status options
export const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
