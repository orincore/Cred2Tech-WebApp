// Route -> tab title map, consumed by <RouteTitle /> in AppRouter.jsx.
//
// This is a Vite SPA: react-router navigation never triggers a document load,
// so the browser tab keeps whatever <title> was last set (index.html's static
// "Cred2Tech | Login") until something explicitly writes document.title. Before
// this map, only 9 of 46 pages did that (mostly the auth screens) — every other
// page (customers, cases, wallet, admin, financials, dashboard...) left the tab
// stuck reading "Cred2Tech | Login" for the entire session after login.
//
// Ordering matters: entries are matched top-to-bottom with react-router's
// matchPath, and the FIRST match wins — this is not react-router's own
// specificity ranking, just a linear scan. Two routes only collide when they
// have the same segment count AND one is a static literal where the other has
// a dynamic :param in that position (e.g. /customers/add vs
// /customers/:customer_id, both 2 segments) — in every such pair, the static
// route is listed first. Routes with a different segment count never collide
// under matchPath's default `end: true`, so their relative order doesn't
// matter.
export const ROUTE_TITLES = [
  // Public
  { path: '/login', title: 'Login' },
  { path: '/forgot-password', title: 'Forgot Password' },
  { path: '/reset-password', title: 'Reset Password' },
  { path: '/register-dsa', title: 'DSA Registration' },
  { path: '/unauthorized', title: 'Unauthorized' },

  // MSME Direct Portal
  { path: '/msme/login', title: 'MSME Portal' },
  { path: '/msme/dashboard', title: 'MSME Dashboard' },
  { path: '/msme/onboarding', title: 'Loan Application' },
  { path: '/msme/cases/:caseId', title: 'Case Status' },
  { path: '/msme/cases', title: 'My Cases' },
  { path: '/msme/profile', title: 'My Profile' },

  // DSA / Admin shell
  { path: '/', title: 'Dashboard' },
  { path: '/profile', title: 'My Profile' },
  { path: '/users/create', title: 'Create User' },
  { path: '/users/:id/edit', title: 'Edit User' },
  { path: '/users/:id/payout-setup', title: 'Sub-DSA Payout Setup' },
  { path: '/users/:id', title: 'User Details' },
  { path: '/users', title: 'Users' },
  { path: '/tenants/create', title: 'Create Tenant' },
  { path: '/tenants', title: 'Tenants' },
  { path: '/hierarchy', title: 'Hierarchy' },

  // Superadmin
  { path: '/admin/vendors', title: 'Vendor Management' },
  { path: '/admin/pricing', title: 'Pricing' },
  { path: '/admin/wallets/:dsaId', title: 'Wallet Details' },
  { path: '/admin/wallets', title: 'Wallets' },
  { path: '/admin/logs', title: 'API Logs' },
  { path: '/admin/lenders', title: 'Lender Configuration' },
  { path: '/admin/msme-cases', title: 'MSME Cases' },
  { path: '/admin/transactions', title: 'Transactions' },

  // Customers / Case journey
  { path: '/customers/add', title: 'New Customer' },
  { path: '/customers/salaried/add', title: 'New Salaried Customer' },
  { path: '/customers/:customer_id', title: 'Customer Profile' },
  { path: '/customers', title: 'Pipeline & Customers' },
  { path: '/cases/:id', title: 'Case Details' },
  { path: '/settings/lender-contacts', title: 'Lender Contacts' },

  // Disbursement / PDD / Financials
  { path: '/disbursements/partial', title: 'Partial Disbursements' },
  { path: '/pdd-management', title: 'PDD Management' },
  { path: '/financials/sales-incentive', title: 'Sales Incentive' },
  { path: '/financials/lender-commission', title: 'Lender Commission' },
  { path: '/financials/sub-dsa-payout', title: 'Sub-DSA Payout' },
  { path: '/wallet', title: 'My Wallet' },

  // Fallbacks — must stay last so nothing above is shadowed by the wildcard.
  { path: '/404', title: 'Not Found' },
  { path: '*', title: 'Not Found' },
];
