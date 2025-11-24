import { Navigate, Outlet } from 'react-router-dom';

// simplest: rely on backend cookie + a small "am I logged in" ping
export function ProtectedRoute({ isAuthenticated }) {
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}
