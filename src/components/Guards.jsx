import { Navigate } from "react-router-dom";
import { useAuth }  from "../hooks/useAuth.jsx";
import { PageLoader } from "./Atoms.jsx";

export function RequireAuth({ children, fallback }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) {
    if (fallback) { fallback(); return null; }
    return <Navigate to="/" replace />;
  }
  return children;
}

export function RequireAdmin({ children }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user || !isAdmin) return <Navigate to="/" replace />;
  return children;
}
