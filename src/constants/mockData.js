// Mock data for fallback / demo states when backend is unavailable

export const MOCK_USERS = [
  {
    id: 1,
    name: 'Super Admin',
    email: 'admin@platform.com',
    mobile: '9900001111',
    role: { id: 1, name: 'ADMIN' },
    role_id: 1,
    dsa_id: null,
    hierarchy_level: null,
    manager_id: null,
    hierarchy_path: '/',
    status: 'ACTIVE',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'DSA Administrator',
    email: 'admin@dsacompany.com',
    mobile: '9900002222',
    role: { id: 2, name: 'DSA' },
    role_id: 2,
    dsa_id: 1,
    dsa: { id: 1, name: 'Test DSA Company', email: 'dsa@company.com' },
    hierarchy_level: null,
    manager_id: null,
    hierarchy_path: '/',
    status: 'ACTIVE',
    created_at: '2025-01-02T00:00:00.000Z',
  },
  {
    id: 3,
    name: 'L1 Manager',
    email: 'manager_l1@dsacompany.com',
    mobile: '9900003333',
    role: { id: 3, name: 'EMPLOYEE' },
    role_id: 3,
    dsa_id: 1,
    dsa: { id: 1, name: 'Test DSA Company', email: 'dsa@company.com' },
    hierarchy_level: 'L1',
    manager_id: null,
    hierarchy_path: '/3/',
    status: 'ACTIVE',
    created_at: '2025-01-03T00:00:00.000Z',
  },
  {
    id: 4,
    name: 'L2 Employee',
    email: 'employee_l2@dsacompany.com',
    mobile: '9900004444',
    role: { id: 3, name: 'EMPLOYEE' },
    role_id: 3,
    dsa_id: 1,
    dsa: { id: 1, name: 'Test DSA Company', email: 'dsa@company.com' },
    hierarchy_level: 'L2',
    manager_id: 3,
    hierarchy_path: '/3/4/',
    status: 'ACTIVE',
    created_at: '2025-01-04T00:00:00.000Z',
  },
];

export const MOCK_DSA_ACCOUNTS = [
  { id: 1, name: 'Test DSA Company', email: 'dsa@company.com', mobile: '1234567890', status: 'ACTIVE' },
];

export const MOCK_TENANTS = [
  {
    id: 'TEN-001',
    name: 'Cred2Tech Platform',
    type: 'INTERNAL',
    status: 'ACTIVE',
    created_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'TEN-002',
    name: 'Sample DSA Partner',
    type: 'DSA',
    status: 'ACTIVE',
    created_at: '2025-01-02T00:00:00.000Z',
  }
];
