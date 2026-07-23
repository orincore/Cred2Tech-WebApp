import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMe } from '../api/authService';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const ProtectedRoute = ({ children, allowedRoles, allowedTenantTypes }) => {
  const { user, isAuthenticated, isLoading, hasRole, hasTenantType, logout } = useAuth();
  const location = useLocation();
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      if (isAuthenticated) {
        setIsValidating(true);
        try {
          await getMe();
        } catch (error) {
          // Token is invalid, logout user
          logout();
        } finally {
          setIsValidating(false);
        }
      }
    };

    validateToken();
  }, [isAuthenticated, logout]);

  if (isLoading || isValidating) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner size={40} fullPage />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
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
