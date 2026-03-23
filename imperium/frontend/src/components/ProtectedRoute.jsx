import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import PageLoader from './PageLoader.jsx';

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role && user.role !== role) {
    // Redirect to correct dashboard based on actual role
    if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'manager') return <Navigate to="/manager/dashboard" replace />;
    if (user.role === 'modele') return <Navigate to="/modele/dashboard" replace />;
    if (user.role === 'chatteur') return <Navigate to="/chatteur/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
}
