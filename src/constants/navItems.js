import {
  LayoutDashboard,
  Users,
  UserPlus,
  GitBranch,
  User,
  Settings,
  Building,
  BarChart,
  Briefcase,
  Activity,
  Mail,
  Network,
  FolderOpen,
  UserCircle,
  Inbox,
  Wallet,
  ClipboardCheck,
  Target,
  Landmark,
  HandCoins,
  MessageSquare,
  Receipt,
  Trash2,
  Tag,
} from 'lucide-react';

// MSME direct-portal navigation — used by MsmeSidebar, and by the main
// Sidebar when an MSME borrower is on the shared /cases/* journey pages
// (their role matches none of NAV_ITEMS, which would leave the nav blank).
export const MSME_NAV_ITEMS = [
  { id: 'msme-dashboard', label: 'My Dashboard', path: '/msme/dashboard', icon: LayoutDashboard },
  // "Check Eligibility" removed from here — starting a new case now only
  // happens via the payment-gated "New Case" button on /msme/cases (and the
  // dashboard's own empty-state action), not a standing sidebar link.
  { id: 'msme-cases', label: 'My Cases', path: '/msme/cases', icon: FolderOpen },
  { id: 'msme-transactions', label: 'Transactions', path: '/msme/transactions', icon: Receipt },
  // Deliberately NOT under /msme/* — shared with the DSA app's identical
  // route so a link emailed to either audience (see ticket.email.js) always
  // resolves, and AppLayout already renders this sidebar there too (same
  // pattern as /cases/:id).
  { id: 'msme-tickets', label: 'Feedback & Support', path: '/tickets', icon: MessageSquare },
  // Govt Scheme portal is a separate app/domain (own auth) — link out rather
  // than route internally.
  { id: 'msme-govt-schemes', label: 'Govt Scheme Cases', href: 'https://scheme.cred2tech.com/track-applications', icon: Landmark, external: true },
];

export const NAV_ITEMS = [
  // SUPER_ADMIN Views
  {
    id: 'analytics',
    label: 'Platform Analytics',
    path: '/',
    icon: BarChart,
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'tenants',
    label: 'Manage DSAs',
    path: '/tenants',
    icon: Building,
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'vendor-management',
    label: 'Vendor Management',
    path: '/admin/vendors',
    icon: Network,
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'internal-team',
    label: 'Employee Management',
    path: '/users',
    icon: Users,
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'admin-pricing',
    label: 'API Pricing',
    path: '/admin/pricing',
    icon: Settings,
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'admin-promo-codes',
    label: 'Promo Codes',
    path: '/admin/promo-codes',
    icon: Tag,
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'admin-virtual-workspace',
    label: 'Subscription Plans',
    path: '/admin/virtual-workspace',
    icon: LayoutDashboard,
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'admin-wallets',
    label: 'Wallet Management',
    path: '/admin/wallets',
    icon: Briefcase,
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'admin-transactions',
    label: 'Transactions',
    path: '/admin/transactions',
    icon: Receipt,
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'admin-data-purge',
    label: 'Data Purge',
    path: '/admin/purge',
    icon: Trash2,
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'admin-api-logs',
    label: 'API Observability',
    path: '/admin/logs',
    icon: Activity,
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'admin-lenders',
    label: 'Lender Config',
    path: '/admin/lenders',
    icon: Settings,
    roles: ['SUPER_ADMIN', 'CRED2TECH_MEMBER'],
  },
  {
    id: 'admin-msme-cases',
    label: 'Direct MSME Leads',
    path: '/admin/msme-cases',
    icon: Inbox,
    roles: ['SUPER_ADMIN'],
  },
  {
    id: 'admin-tickets',
    label: 'Feedback & Tickets',
    path: '/admin/tickets',
    icon: MessageSquare,
    roles: ['SUPER_ADMIN', 'CRED2TECH_MEMBER'],
    // Static fallback — Sidebar.jsx overrides this with the live unread
    // count fetched from GET /tickets/unread-count before rendering.
  },
  {
    id: 'admin-contact-submissions',
    label: 'Website Leads',
    path: '/admin/contact-submissions',
    icon: Mail,
    roles: ['SUPER_ADMIN', 'CRED2TECH_MEMBER'],
    // Static fallback — Sidebar.jsx overrides this with the combined
    // Contact Requests + Demo Requests unread count before rendering.
  },

  // DSA_ADMIN Views
  {
    id: 'dsa-dashboard',
    label: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    roles: ['DSA_ADMIN', 'SUB_DSA'],
  },
  {
    id: 'dsa-team',
    label: 'Team Management',
    path: '/users',
    icon: Users,
    roles: ['DSA_ADMIN'],
  },
  {
    id: 'dsa-create-user',
    label: 'Create User',
    path: '/users/create',
    icon: UserPlus,
    roles: ['DSA_ADMIN'],
  },
  {
    id: 'dsa-hierarchy',
    label: 'Hierarchy Management',
    path: '/hierarchy',
    icon: GitBranch,
    roles: ['DSA_ADMIN'],
  },
  {
    id: 'organization-profile',
    label: 'Organization Profile',
    path: '/organization',
    icon: Building,
    roles: ['DSA_ADMIN'],
  },
  {
    id: 'dsa-pipeline',
    label: 'Pipeline & Customers',
    path: '/customers',
    icon: Briefcase,
    roles: ['DSA_ADMIN', 'DSA_MEMBER', 'SUB_DSA'],
  },
  {
    id: 'dsa-part-disbursement',
    label: 'Part Disbursement',
    path: '/disbursements/partial',
    icon: Wallet,
    roles: ['DSA_ADMIN', 'DSA_MEMBER'],
  },
  {
    id: 'pdd-management',
    label: 'PDD Management',
    path: '/pdd-management',
    icon: ClipboardCheck,
    roles: ['DSA_ADMIN', 'DSA_MEMBER'],
  },
  {
    id: 'dsa-lender-contacts',
    label: 'Lender Contacts',
    path: '/settings/lender-contacts',
    icon: Mail,
    roles: ['DSA_ADMIN'],
  },
  {
    id: 'lender-commission',
    label: 'Lender Commission',
    path: '/financials/lender-commission',
    icon: Landmark,
    roles: ['DSA_ADMIN'],
  },
  {
    id: 'sales-incentive',
    label: 'Sales Incentive',
    path: '/financials/sales-incentive',
    icon: Target,
    roles: ['DSA_ADMIN', 'DSA_MEMBER'],
  },
  {
    id: 'sub-dsa-payout',
    label: 'Sub DSA Payout',
    path: '/financials/sub-dsa-payout',
    icon: HandCoins,
    roles: ['DSA_ADMIN', 'SUB_DSA'],
  },
  {
    id: 'dsa-wallet',
    label: 'Wallet',
    path: '/wallet',
    icon: Wallet,
    roles: ['DSA_ADMIN', 'DSA_MEMBER', 'SUB_DSA'],
  },
  {
    id: 'my-tickets',
    label: 'Feedback & Support',
    path: '/tickets',
    icon: MessageSquare,
    roles: ['DSA_ADMIN', 'DSA_MEMBER', 'SUB_DSA'],
  },


  // DSA_MEMBER / Shared Views
  {
    id: 'profile',
    label: 'My Profile',
    path: '/profile',
    icon: User,
    roles: ['SUPER_ADMIN', 'DSA_ADMIN', 'DSA_MEMBER', 'CRED2TECH_MEMBER', 'SUB_DSA'],
  },
  {
    id: 'my-manager',
    label: 'My Manager',
    path: '/manager',
    icon: Users,
    roles: ['DSA_MEMBER'],
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: Settings,
    roles: ['SUPER_ADMIN'],
    disabled: true,
    badge: 'Soon',
  },
];

// The nav items Virtual Workspace can actually gate — DSA-role items only
// (SUPER_ADMIN/CRED2TECH_MEMBER nav is never affected by a tenant's VW
// flag, see Sidebar.jsx). Single source of truth shared by every feature-
// list editor (SuperadminPricingPage's Free-tier list, AdminSubscriptionPlansPage's
// per-plan list) so a newly added DSA nav item shows up in all of them
// automatically instead of drifting.
export const DSA_GATABLE_ROLES = ['DSA_ADMIN', 'DSA_MEMBER', 'SUB_DSA'];
export const GATABLE_NAV_ITEMS = NAV_ITEMS.filter((item) => item.roles?.some((r) => DSA_GATABLE_ROLES.includes(r)));
