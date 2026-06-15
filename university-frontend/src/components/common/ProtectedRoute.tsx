import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';

interface Props {
  roles: string[];
}

export const ProtectedRoute: React.FC<Props> = ({ roles }) => {
  const { isAuthenticated, role } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role && !roles.includes(role)) {
    return <div>403 Forbidden - You do not have the required role ({roles.join(', ')})</div>;
  }

  return <Outlet />;
};
