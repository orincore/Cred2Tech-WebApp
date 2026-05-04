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
} from 'lucide-react';

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
    id: 'admin-wallets',
    label: 'Wallet Management',
    path: '/admin/wallets',
    icon: Briefcase,
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

  // DSA_ADMIN Views
  {
    id: 'dsa-dashboard',
    label: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    roles: ['DSA_ADMIN'],
  },
  {
    id: 'dsa-team',
    label: 'Team Management',
    path: '/users',
    icon: Users,
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
    id: 'dsa-pipeline',
    label: 'Pipeline & Customers',
    path: '/customers',
    icon: Briefcase,
    roles: ['DSA_ADMIN', 'DSA_MEMBER'],
  },
  {
    id: 'dsa-create-user',
    label: 'Create User',
    path: '/users/create',
    icon: UserPlus,
    roles: ['DSA_ADMIN'],
  },
  {
    id: 'dsa-lender-contacts',
    label: 'Lender Contacts',
    path: '/settings/lender-contacts',
    icon: Mail,
    roles: ['DSA_ADMIN'],
  },



  // DSA_MEMBER / Shared Views
  {
    id: 'profile',
    label: 'My Profile',
    path: '/profile',
    icon: User,
    roles: ['SUPER_ADMIN', 'DSA_ADMIN', 'DSA_MEMBER', 'CRED2TECH_MEMBER'],
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
