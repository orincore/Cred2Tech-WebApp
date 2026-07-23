import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldOff, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { DASHBOARD_ROLES } from '../constants/roles';

const UnauthorizedPage = () => {
  const navigate = useNavigate();
  const { user, isLoading, hasRole, logout } = useAuth();
  // MSME customers have no access to the DSA/admin routes under "/" — sending
  // them there just bounces back here in a loop. Send each role to a home
  // route it actually passes ProtectedRoute for.
  const isMsme = user?.role === 'MSME_CUSTOMER' || localStorage.getItem('roleName') === 'MSME_CUSTOMER';
  const homePath = isMsme ? '/msme/dashboard' : '/';
  const hasLegitHome = isMsme || hasRole(DASHBOARD_ROLES);

  // On load/refresh, if this session actually has a home route it passes
  // ProtectedRoute for (stale link, role changed, redirected here by mistake),
  // skip the "Access Denied" screen instead of making the user click through.
  useEffect(() => {
    if (!isLoading && hasLegitHome) {
      navigate(homePath, { replace: true });
    }
  }, [isLoading, hasLegitHome, homePath, navigate]);

  const handleLogout = () => {
    logout();
    localStorage.removeItem('roleName');
    navigate(isMsme ? '/msme/login' : '/login', { replace: true });
  };

  if (isLoading || hasLegitHome) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner size={40} fullPage />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      padding: 40,
      textAlign: 'center',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'var(--error-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 24,
        boxShadow: '0 8px 24px rgba(239,68,68,0.15)',
      }}>
        <ShieldOff size={36} color="var(--error)" />
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10, color: 'var(--text-primary)' }}>
        Access Denied
      </h1>
      <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 380, lineHeight: 1.7, marginBottom: 32 }}>
        You don't have the required permissions to view this page. Please contact your administrator if you believe this is an error.
      </p>
      <button className="btn btn-primary" onClick={handleLogout}>
        <LogOut size={16} /> Log Out
      </button>
    </div>
  );
};

export default UnauthorizedPage;
