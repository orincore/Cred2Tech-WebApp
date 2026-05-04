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
};

// Role options for the Create User form (role_id mapped to internal name)
export const ROLE_OPTIONS = [
  { label: 'Super Admin', value: 'SUPER_ADMIN' },
  { label: 'Cred2Tech Member', value: 'CRED2TECH_MEMBER' },
  { label: 'DSA Admin', value: 'DSA_ADMIN' },
  { label: 'DSA Member', value: 'DSA_MEMBER' },
];

export const TENANT_TYPES = ['CRED2TECH', 'DSA'];

// Hierarchy levels used by employees
export const HIERARCHY_LEVELS = ['L1', 'L2', 'L3', 'L4'];

// User status options
export const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
