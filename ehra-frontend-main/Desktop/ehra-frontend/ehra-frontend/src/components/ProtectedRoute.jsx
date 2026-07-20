import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // The Identity is authenticated but hasn't chosen a workspace for this
  // session yet (holds more than one membership) — every business-scoped
  // route stays closed until they pick one on /select-workspace. Not
  // applicable to /select-workspace itself, which is where this redirects.
  if (user?.needsContextSelection && location.pathname !== "/select-workspace") {
    return <Navigate to="/select-workspace" replace />;
  }

  if (roles && !roles.includes(user?.role)) return <Navigate to="/unauthorized" replace />;

  return children;
}
