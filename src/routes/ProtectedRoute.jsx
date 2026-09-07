import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMe } from '../api/authService';
import PageSkeleton from '../components/ui/PageSkeleton';

const ProtectedRoute = ({ children, allowedRoles, allowedTenantTypes }) => {
  const { user, isAuthenticated, isLoading, hasRole, hasTenantType, logout } = useAuth();
  const location = useLocation();

  // Background safety net only — deliberately does NOT block rendering
  // (used to via its own isValidating skeleton, which fired a full extra
  // page-level skeleton on every single navigation between protected
  // routes, since a fresh ProtectedRoute element mounts per route match).
  // isAuthenticated already reflects a locally-stored, well-formed token,
  // and a genuinely revoked/expired one is already caught two other ways
  // that don't need a render-blocking check here: axiosInstance's own 401
  // interceptor (the very first real API call the page below makes) and
  // AuthContext's live session-revoked poll (SessionRevokedModal). This
  // getMe() call is just an extra, slightly earlier confirmation of the
  // same thing — worth keeping, not worth a loading state of its own.
  useEffect(() => {
    if (!isAuthenticated) return;
    getMe().catch(() => logout());
  }, [isAuthenticated, logout]);

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Mandatory MFA gate for staff/DSA/admin accounts. MSME_CUSTOMER is
  // excluded — borrowers authenticate via a separate mobile-OTP-only flow
  // (direct.customer.auth) that never sets mfa_email_enabled/mfa_totp_enabled,
  // so this check would otherwise never resolve for them. This mainly
  // catches accounts with a still-valid session token issued before MFA
  // became mandatory (see AuthContext's normalizeUser) — every session
  // token issued *after* this feature shipped already implies mfaEnabled by
  // construction, since the backend never issues one without it.
  if (location.pathname !== '/mfa-setup' && user?.role !== 'MSME_CUSTOMER' && !user?.mfaEnabled) {
    return <Navigate to="/mfa-setup" state={{ from: location }} replace />;
  }

  // MSME customers live in their own portal — send them home instead of
  // showing them the internal admin/DSA "Access Denied" page.
  if (user?.role === 'MSME_CUSTOMER' && allowedRoles && !hasRole(allowedRoles)) {
    return <Navigate to="/msme/dashboard" replace />;
  }

  // Role check
  if (allowedRoles && !hasRole(allowedRoles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Tenant type check
  if (allowedTenantTypes && !hasTenantType(allowedTenantTypes)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
