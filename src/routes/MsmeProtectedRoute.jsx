import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMsmeAuth } from '../context/MsmeAuthContext';
import PageSkeleton from '../components/ui/PageSkeleton';

const MsmeProtectedRoute = () => {
  const { user, loading } = useMsmeAuth();
  const location = useLocation();

  if (loading) {
    return <PageSkeleton />;
  }

  if (!user) {
    return <Navigate to="/msme/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default MsmeProtectedRoute;
