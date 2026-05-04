import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import AppLayout from '../layouts/AppLayout';
import ProtectedRoute from './ProtectedRoute';
import LoadingSpinner from '../components/ui/LoadingSpinner';

// Lazy-load pages for better performance
const LoginPage = lazy(() => import('../pages/LoginPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const UsersListPage = lazy(() => import('../pages/UsersListPage'));
const UserDetailPage = lazy(() => import('../pages/UserDetailPage'));
const CreateUserPage = lazy(() => import('../pages/CreateUserPage'));
const CreateTenantPage = lazy(() => import('../pages/CreateTenantPage'));
const TenantsListPage = lazy(() => import('../pages/TenantsListPage'));
const EditUserPage = lazy(() => import('../pages/EditUserPage'));
const HierarchyPage = lazy(() => import('../pages/HierarchyPage'));
const UnauthorizedPage = lazy(() => import('../pages/UnauthorizedPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));
const DSARegisterPage = lazy(() => import('../pages/DSARegisterPage'));
const CustomersListPage = lazy(() => import('../pages/CustomersListPage'));
const AddCustomerWizardPage = lazy(() => import('../pages/AddCustomerWizardPage'));
const CustomerProfilePage = lazy(() => import('../pages/CustomerProfilePage'));
const SuperadminPricingPage = lazy(() => import('../pages/SuperadminPricingPage'));
const SuperadminWalletManager = lazy(() => import('../pages/SuperadminWalletManager'));
const SuperadminWalletDetail = lazy(() => import('../pages/SuperadminWalletDetail'));
const SuperadminApiLogsPage = lazy(() => import('../pages/SuperadminApiLogsPage'));
const VendorManagementPage = lazy(() => import('../pages/VendorManagementPage'));
const LenderConfigPage = lazy(() => import('../pages/LenderConfigPage'));
const IncomeSummaryPage = lazy(() => import('../pages/IncomeSummaryPage'));
const BureauObligationsPage = lazy(() => import('../pages/BureauObligationsPage'));
const EsrPage = lazy(() => import('../pages/EsrPage'));
const ProposalPage = lazy(() => import('../pages/ProposalPage'));
const DSALenderContactsPage = lazy(() => import('../pages/DSALenderContactsPage'));

const PageLoader = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <LoadingSpinner size={40} fullPage />
  </div>
);

const AppRouter = () => (
  <BrowserRouter>
    <AuthProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register-dsa" element={<DSARegisterPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Protected */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/users" element={<UsersListPage />} />
            <Route
              path="/users/create"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'DSA_ADMIN', 'CRED2TECH_MEMBER']}>
                  <CreateUserPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tenants/create"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <CreateTenantPage />
                </ProtectedRoute>
              }
            />
            <Route path="/users/:id" element={<UserDetailPage />} />
            <Route path="/users/:id/edit" element={<EditUserPage />} />
            <Route
              path="/tenants"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <TenantsListPage />
                </ProtectedRoute>
              }
            />
            <Route path="/hierarchy" element={<HierarchyPage />} />

            {/* Superadmin Dashboards */}
            <Route path="/admin/vendors" element={
               <ProtectedRoute allowedRoles={['SUPER_ADMIN']}><VendorManagementPage /></ProtectedRoute>
            } />
            <Route path="/admin/pricing" element={
               <ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SuperadminPricingPage /></ProtectedRoute>
            } />
            <Route path="/admin/wallets" element={
               <ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SuperadminWalletManager /></ProtectedRoute>
            } />
            <Route path="/admin/wallets/:dsaId" element={
               <ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SuperadminWalletDetail /></ProtectedRoute>
            } />
            <Route path="/admin/logs" element={
               <ProtectedRoute allowedRoles={['SUPER_ADMIN']}><SuperadminApiLogsPage /></ProtectedRoute>
            } />
            <Route path="/admin/lenders" element={
               <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'CRED2TECH_MEMBER']}><LenderConfigPage /></ProtectedRoute>
            } />

            {/* Customers Pipeline / Wizard */}
            <Route
              path="/customers"
              element={
                <ProtectedRoute allowedRoles={['DSA_ADMIN', 'DSA_MEMBER']}>
                  <CustomersListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/add"
              element={
                <ProtectedRoute allowedRoles={['DSA_ADMIN', 'DSA_MEMBER']}>
                  <AddCustomerWizardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:customer_id"
              element={
                <ProtectedRoute allowedRoles={['DSA_ADMIN', 'DSA_MEMBER', 'SUPER_ADMIN']}>
                  <CustomerProfilePage />
                </ProtectedRoute>
              }
            />

            {/* Phase 1 — Onboarding continuation pages */}
            <Route
              path="/cases/:id/income-summary"
              element={
                <ProtectedRoute allowedRoles={['DSA_ADMIN', 'DSA_MEMBER', 'SUPER_ADMIN']}>
                  <IncomeSummaryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cases/:id/bureau-obligations"
              element={
                <ProtectedRoute allowedRoles={['DSA_ADMIN', 'DSA_MEMBER', 'SUPER_ADMIN']}>
                  <BureauObligationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cases/:id/esr"
              element={
                <ProtectedRoute allowedRoles={['DSA_ADMIN', 'DSA_MEMBER', 'SUPER_ADMIN']}>
                  <EsrPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cases/:id/proposals/:pid"
              element={
                <ProtectedRoute allowedRoles={['DSA_ADMIN', 'DSA_MEMBER', 'SUPER_ADMIN']}>
                  <ProposalPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/lender-contacts"
              element={
                <ProtectedRoute allowedRoles={['DSA_ADMIN']}>
                  <DSALenderContactsPage />
                </ProtectedRoute>
              }
            />


          </Route>

          {/* Fallbacks */}
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  </BrowserRouter>
);

export default AppRouter;
