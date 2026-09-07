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
  DSA_ADMIN: {
    name: 'DSA Admin',
    color: 'var(--role-dsa-admin)',
    bg: 'var(--role-dsa-admin-bg)',
    description: 'Direct Selling Agent administrator',
  },
  DSA_MEMBER: {
    name: 'DSA Member',
    color: 'var(--role-dsa-member)',
    bg: 'var(--role-dsa-member-bg)',
    description: 'Field employee within a DSA hierarchy',
  },
  SUB_DSA: {
    name: 'Sub-DSA Partner',
    color: 'var(--role-partner)',
    bg: 'var(--role-partner-bg)',
    description: 'External referral partner working under a DSA',
  },
};

// Role options for the Create User form (role_id mapped to internal name)
export const ROLE_OPTIONS = [
  { label: 'Super Admin', value: 'SUPER_ADMIN' },
  { label: 'Cred2Tech Member', value: 'CRED2TECH_MEMBER' },
  { label: 'DSA Admin', value: 'DSA_ADMIN' },
  { label: 'DSA Member', value: 'DSA_MEMBER' },
  { label: 'Sub-DSA Partner', value: 'SUB_DSA' },
];

// Roles allowed on the main dashboard ("/"). Kept in sync with the "/" route's
// allowedRoles in AppRouter so UnauthorizedPage's auto-redirect never loops.
export const DASHBOARD_ROLES = ['SUPER_ADMIN', 'DSA_ADMIN', 'DSA_MEMBER', 'SUB_DSA', 'DSA', 'ADMIN', 'CRED2TECH_MEMBER'];

export const TENANT_TYPES = ['CRED2TECH', 'DSA'];

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
