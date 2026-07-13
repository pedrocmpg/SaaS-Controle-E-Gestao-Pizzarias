import { Navigate } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";

// Protege rotas do painel: redireciona para o login se não houver token válido.
// Se `allowedRoles` for informado, também exige que admin.role esteja na lista.
export default function AdminRoute({ children, allowedRoles }) {
  const { isAuthenticated, admin, loadingAdmin } = useAdminAuth();

  if (!isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  if (allowedRoles) {
    if (loadingAdmin) {
      return null;
    }
    if (!admin || !allowedRoles.includes(admin.role)) {
      return <Navigate to="/admin/dashboard" replace />;
    }
  }

  return children;
}
