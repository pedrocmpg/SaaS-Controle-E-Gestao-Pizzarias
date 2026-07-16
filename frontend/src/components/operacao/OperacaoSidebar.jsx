import { Link, useLocation } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";

// Itens da seção "Operação" — visíveis a todos, mas filtrados por role.
const OPERATION_LINKS = [
  { to: "/operacao/pedidos", label: "Pedidos", roles: ["SUPER_ADMIN", "ADMIN", "GERENTE", "ATENDENTE"] },
  { to: "/operacao/salao", label: "Salão", roles: ["SUPER_ADMIN", "ADMIN", "GERENTE", "ATENDENTE"] },
  { to: "/operacao/caixa", label: "Caixa", roles: ["SUPER_ADMIN", "ADMIN", "GERENTE", "ATENDENTE"] },
  { to: "/operacao/cardapio", label: "Cardápio", roles: ["SUPER_ADMIN", "ADMIN", "GERENTE"] },
  { to: "/operacao/relatorio", label: "Relatório do dia", roles: ["SUPER_ADMIN", "ADMIN", "GERENTE"] },
];

// Itens da seção "Administração" — sempre exibidos, mas desabilitados fora do SUPER_ADMIN.
// "Configurações" ainda não tem tela própria; fica sempre desabilitado até existir.
const ADMIN_LINKS = [
  { to: "/admin/operadores", label: "Operadores" },
  { to: null, label: "Configurações" },
];

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export default function OperacaoSidebar() {
  const { admin, logout } = useAdminAuth();
  const location = useLocation();
  const role = admin?.role;
  const isSuperAdmin = role === "SUPER_ADMIN";

  return (
    <aside className="w-64 flex-shrink-0 bg-char text-flour min-h-screen flex flex-col">
      <div className="px-5 py-6 border-b border-flour/10">
        <p className="font-display font-semibold text-lg">Pizzaria</p>
      </div>

      <div className="px-5 py-5 border-b border-flour/10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-ember-500 flex items-center justify-center font-semibold text-sm flex-shrink-0">
          {getInitials(admin?.name)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{admin?.name || "Operador"}</p>
          <p className="text-xs text-flour/60 truncate">Loja atual</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-6">
        <div>
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-flour/40 mb-2">
            Operação
          </p>
          <div className="space-y-1">
            {OPERATION_LINKS.filter((link) => !role || link.roles.includes(role)).map((link) => {
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition ${
                    active ? "bg-ember-500 text-white" : "text-flour/80 hover:bg-flour/10"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-flour/40 mb-2">
            Administração
          </p>
          <div className="space-y-1">
            {ADMIN_LINKS.map((link) =>
              isSuperAdmin && link.to ? (
                <Link
                  key={link.to}
                  to={link.to}
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-flour/80 hover:bg-flour/10 transition"
                >
                  {link.label}
                </Link>
              ) : (
                <span
                  key={link.to}
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-flour/30 cursor-not-allowed select-none"
                  title="Disponível apenas para o Admin Master"
                >
                  {link.label}
                </span>
              )
            )}
          </div>
        </div>
      </nav>

      <div className="px-5 py-4 border-t border-flour/10">
        <button
          onClick={logout}
          className="text-sm font-semibold text-flour/70 hover:text-flour transition"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
