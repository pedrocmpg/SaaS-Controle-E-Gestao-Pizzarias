import { Link, useLocation } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";
import Logo from "./Logo";

// Links do menu admin e os roles que podem vê-los.
const NAV_LINKS = [
  { to: "/admin/dashboard", label: "Pedidos", roles: ["SUPER_ADMIN", "ADMIN", "GERENTE", "ATENDENTE"] },
  { to: "/admin/operadores", label: "Operadores", roles: ["SUPER_ADMIN"] },
];

export default function AdminHeader() {
  const { admin, logout } = useAdminAuth();
  const location = useLocation();
  const role = admin?.role;

  return (
    <header className="bg-white border-b border-black/5">
      <div className="container-app flex items-center justify-between h-20">
        <Logo />
        <div className="flex items-center gap-4">
          {NAV_LINKS.filter((link) => !role || link.roles.includes(role)).map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`text-sm font-semibold hover:underline ${
                  active ? "text-accent-600" : "text-brand-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <span className="text-sm text-gray-500">Olá, {admin?.name || "Admin"}</span>
          <button onClick={logout} className="text-sm font-semibold text-red-500 hover:underline">
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
