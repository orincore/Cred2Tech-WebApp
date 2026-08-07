import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMsmeAuth } from '../context/MsmeAuthContext';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const MsmeProtectedRoute = () => {
  const { user, loading } = useMsmeAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/msme/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default MsmeProtectedRoute;
