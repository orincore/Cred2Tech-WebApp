import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import AppLayout from '../layouts/AppLayout';
import ProtectedRoute from './ProtectedRoute';
import RouteTitle from './RouteTitle';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { DASHBOARD_ROLES } from '../constants/roles';

// Lazy-load pages for better performance
const LoginPage = lazy(() => import('../pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('../pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../pages/ResetPasswordPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const UsersListPage = lazy(() => import('../pages/UsersListPage'));
const UserDetailPage = lazy(() => import('../pages/UserDetailPage'));
const CreateUserPage = lazy(() => import('../pages/CreateUserPage'));
const CreateTenantPage = lazy(() => import('../pages/CreateTenantPage'));
const TenantsListPage = lazy(() => import('../pages/TenantsListPage'));
const EditUserPage = lazy(() => import('../pages/EditUserPage'));
const SubDsaPayoutSetupPage = lazy(() => import('../pages/SubDsaPayoutSetupPage'));
const HierarchyPage = lazy(() => import('../pages/HierarchyPage'));
const UnauthorizedPage = lazy(() => import('../pages/UnauthorizedPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));
const DSARegisterPage = lazy(() => import('../pages/DSARegisterPage'));
const CustomersListPage = lazy(() => import('../pages/CustomersListPage'));
const AddCustomerWizardPage = lazy(() => import('../pages/AddCustomerWizardPage'));
const AddSalariedCustomerWizardPage = lazy(() => import('../pages/AddSalariedCustomerWizardPage'));
const CustomerProfilePage = lazy(() => import('../pages/CustomerProfilePage'));
const SuperadminPricingPage = lazy(() => import('../pages/SuperadminPricingPage'));
const SuperadminWalletManager = lazy(() => import('../pages/SuperadminWalletManager'));
const SuperadminWalletDetail = lazy(() => import('../pages/SuperadminWalletDetail'));
const SuperadminApiLogsPage = lazy(() => import('../pages/SuperadminApiLogsPage'));
const VendorManagementPage = lazy(() => import('../pages/VendorManagementPage'));
const LenderConfigPage = lazy(() => import('../pages/LenderConfigPage'));
const CaseDetailPage = lazy(() => import('../pages/CaseDetailPage'));
const DSALenderContactsPage = lazy(() => import('../pages/DSALenderContactsPage'));
const AdminMsmeCasesPage = lazy(() => import('../pages/AdminMsmeCasesPage'));
const PartDisbursementPage = lazy(() => import('../pages/PartDisbursementPage'));
const PddManagementPage = lazy(() => import('../pages/PddManagementPage'));
const SalesIncentivePage = lazy(() => import('../pages/SalesIncentivePage'));
const LenderCommissionPage = lazy(() => import('../pages/LenderCommissionPage'));
const SubDsaPayoutPage = lazy(() => import('../pages/SubDsaPayoutPage'));
const MyWalletPage = lazy(() => import('../pages/MyWalletPage'));
const MyTicketsPage = lazy(() => import('../pages/MyTicketsPage'));
const MyTicketDetailPage = lazy(() => import('../pages/MyTicketDetailPage'));
const AdminTicketsListPage = lazy(() => import('../pages/AdminTicketsListPage'));
const AdminTicketDetailPage = lazy(() => import('../pages/AdminTicketDetailPage'));
const AdminTicketRecipientsPage = lazy(() => import('../pages/AdminTicketRecipientsPage'));
const AdminTransactionsPage = lazy(() => import('../pages/AdminTransactionsPage'));

// MSME Direct Portal
const MsmeLayout = lazy(() => import('../layouts/MsmeLayout'));
const MsmeProtectedRoute = lazy(() => import('./MsmeProtectedRoute'));
const MsmeLoginPage = lazy(() => import('../pages/msme/MsmeLoginPage'));
const MsmeDashboardPage = lazy(() => import('../pages/msme/MsmeDashboardPage'));
const MsmeCasesPage = lazy(() => import('../pages/msme/MsmeCasesPage'));
const MsmeCaseDetailPage = lazy(() => import('../pages/msme/MsmeCaseDetailPage'));
const MsmePaymentGate = lazy(() => import('../components/MsmePaymentGate'));

const PageLoader = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <LoadingSpinner size={40} fullPage />
  </div>
);

const AppRouter = () => (
  <BrowserRouter>
    <AuthProvider>
      <RouteTitle />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/register-dsa" element={<DSARegisterPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* MSME Direct Portal */}
          <Route path="/msme" element={<MsmeLayout />}>
            <Route path="login" element={<MsmeLoginPage />} />
            <Route element={<MsmeProtectedRoute />}>
              <Route path="dashboard" element={<MsmeDashboardPage />} />
              <Route path="onboarding" element={
                <MsmePaymentGate>
                  <AddCustomerWizardPage mode="MSME_SELF_SERVICE" />
                </MsmePaymentGate>
              } />
              <Route path="cases" element={<MsmeCasesPage />} />
              <Route path="cases/:caseId" element={<MsmeCaseDetailPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>
          </Route>

          {/* Protected */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/" element={
              <ProtectedRoute allowedRoles={DASHBOARD_ROLES}>
                <DashboardPage />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'DSA_ADMIN', 'DSA_MEMBER', 'DSA', 'ADMIN', 'CRED2TECH_MEMBER']}>
                <ProfilePage />
              </ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'DSA_ADMIN', 'DSA', 'ADMIN', 'CRED2TECH_MEMBER']}>
                <UsersListPage />
              </ProtectedRoute>
            } />
            <Route
              path="/users/create"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'DSA_ADMIN', 'DSA', 'ADMIN', 'CRED2TECH_MEMBER']}>
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
            <Route path="/users/:id" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'DSA_ADMIN', 'DSA', 'ADMIN', 'CRED2TECH_MEMBER']}>
                <UserDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/users/:id/edit" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'DSA_ADMIN', 'DSA', 'ADMIN', 'CRED2TECH_MEMBER']}>
                <EditUserPage />
              </ProtectedRoute>
            } />
            <Route path="/users/:id/payout-setup" element={
              <ProtectedRoute allowedRoles={['DSA_ADMIN']}>
                <SubDsaPayoutSetupPage />
              </ProtectedRoute>
            } />
            <Route
              path="/tenants"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <TenantsListPage />
                </ProtectedRoute>
              }
            />
            <Route path="/hierarchy" element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'DSA_ADMIN', 'DSA', 'ADMIN', 'CRED2TECH_MEMBER']}>
                <HierarchyPage />
              </ProtectedRoute>
            } />

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
            <Route path="/admin/msme-cases" element={
               <ProtectedRoute allowedRoles={['SUPER_ADMIN']}><AdminMsmeCasesPage /></ProtectedRoute>
            } />
            <Route path="/admin/transactions" element={
               <ProtectedRoute allowedRoles={['SUPER_ADMIN']}><AdminTransactionsPage /></ProtectedRoute>
            } />
            <Route path="/admin/tickets" element={
               <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'CRED2TECH_MEMBER']}><AdminTicketsListPage /></ProtectedRoute>
            } />
            <Route path="/admin/tickets/:id" element={
               <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'CRED2TECH_MEMBER']}><AdminTicketDetailPage /></ProtectedRoute>
            } />
            <Route path="/admin/ticket-recipients" element={
               <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'CRED2TECH_MEMBER']}><AdminTicketRecipientsPage /></ProtectedRoute>
            } />

            {/* Feedback/support tickets — shared path for MSME + DSA/staff
                submitters (see navItems.js#msme-tickets for why this isn't
                under /msme/*); ownership is enforced server-side either way. */}
            <Route path="/tickets" element={
               <ProtectedRoute allowedRoles={['MSME_CUSTOMER', 'DSA_ADMIN', 'DSA_MEMBER', 'SUB_DSA']}><MyTicketsPage /></ProtectedRoute>
            } />
            <Route path="/tickets/:id" element={
               <ProtectedRoute allowedRoles={['MSME_CUSTOMER', 'DSA_ADMIN', 'DSA_MEMBER', 'SUB_DSA']}><MyTicketDetailPage /></ProtectedRoute>
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
              path="/customers/salaried/add"
              element={
                <ProtectedRoute allowedRoles={['DSA_ADMIN', 'DSA_MEMBER']}>
                  <AddSalariedCustomerWizardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:customer_id"
              element={
                <ProtectedRoute allowedRoles={['DSA_ADMIN', 'DSA_MEMBER', 'SUPER_ADMIN', 'MSME_CUSTOMER']}>
                  <CustomerProfilePage />
                </ProtectedRoute>
              }
            />

            {/* Case overview/detail page — NOT one of the 7 case-journey
                steps. Steps 4-7 (Income Summary, Bureau & Obligations, ESR,
                Proposal) render inline inside AddCustomerWizardPage now
                (?step=4..7 on /customers/add or /msme/onboarding) instead of
                separate routes, so effects that only run "while mounted"
                (bureau auto-fetch, etc.) survive across the whole journey. */}
            <Route
              path="/cases/:id"
              element={
                <ProtectedRoute allowedRoles={['DSA_ADMIN', 'DSA_MEMBER', 'SUPER_ADMIN', 'MSME_CUSTOMER']}>
                  <CaseDetailPage />
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

            {/* Disbursement / PDD / Financials operational tools */}
            <Route
              path="/disbursements/partial"
              element={
                <ProtectedRoute allowedRoles={['DSA_ADMIN', 'DSA_MEMBER']}>
                  <PartDisbursementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pdd-management"
              element={
                <ProtectedRoute allowedRoles={['DSA_ADMIN', 'DSA_MEMBER']}>
                  <PddManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/financials/sales-incentive"
              element={
                <ProtectedRoute allowedRoles={['DSA_ADMIN', 'DSA_MEMBER']}>
                  <SalesIncentivePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/financials/lender-commission"
              element={
                <ProtectedRoute allowedRoles={['DSA_ADMIN']}>
                  <LenderCommissionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/financials/sub-dsa-payout"
              element={
                <ProtectedRoute allowedRoles={['DSA_ADMIN']}>
                  <SubDsaPayoutPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/wallet"
              element={
                <ProtectedRoute allowedRoles={['DSA_ADMIN', 'DSA_MEMBER', 'SUB_DSA']}>
                  <MyWalletPage />
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
