/**
 * Protected Route Component
 * 
 * Wraps dashboard routes to enforce authentication and role-based access.
 * 
 * Behavior:
 * - While auth is loading: shows a centered spinner
 * - If not authenticated: redirects to the appropriate login page
 *   (admin routes → /login/admin, staff routes → /login/staff)
 * - If authenticated but wrong role: redirects to correct dashboard
 * - If authenticated with correct role: renders the child route
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    // Determine which login page to redirect to based on the URL
    const loginPath = location.pathname.startsWith('/admin') ? '/login/admin' : '/login/staff';
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    // User is logged in but doesn't have the right role
    const correctDashboard = user.role === 'superadmin' ? '/admin/dashboard' : '/staff/dashboard';
    return <Navigate to={correctDashboard} replace />;
  }

  return children;
}
