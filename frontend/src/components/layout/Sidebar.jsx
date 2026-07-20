import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ClipboardList,
  UtensilsCrossed,
  Wallet,
  Bike,
  Truck,
  Package,
  Pizza,
  Layers,
  Tag,
  Users,
  Receipt,
  Banknote,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { useAdminAuth } from "../../context/AdminAuthContext";
import {
  OPERACAO_ROLES,
  OPERACAO_COM_MOTOBOY_ROLES,
  GERENCIA_ROLES,
  SUPER_ADMIN_ONLY,
} from "../../constants/roles";

// Config única de navegação, agrupada por seção (frequência de uso, não
// alfabética) — substitui os dois componentes de nav concorrentes que
// existiam antes (OperacaoSidebar + AdminHeader). Ver spec-4.
const NAV_SECTIONS = [
  {
    id: "operacao",
    label: "Operação",
    items: [
      { to: "/operacao/pedidos", label: "Pedidos", icon: ClipboardList, roles: OPERACAO_ROLES },
      { to: "/operacao/salao", label: "Salão", icon: UtensilsCrossed, roles: OPERACAO_ROLES },
      { to: "/operacao/caixa", label: "PDV/Caixa", icon: Wallet, roles: OPERACAO_ROLES },
      { to: "/operacao/despacho", label: "Despacho motoboy", icon: Bike, roles: OPERACAO_ROLES },
      { to: "/operacao/motoboy", label: "Motoboy", icon: Truck, roles: OPERACAO_COM_MOTOBOY_ROLES },
    ],
  },
  {
    id: "cadastros",
    label: "Cadastros",
    items: [
      { to: "/admin/produtos", label: "Produtos", icon: Package, roles: GERENCIA_ROLES },
      { to: "/admin/sabores", label: "Sabores", icon: Pizza, roles: GERENCIA_ROLES },
      { to: "/admin/tamanhos-bordas", label: "Tamanhos e bordas", icon: Layers, roles: GERENCIA_ROLES },
      { to: "/admin/ofertas", label: "Ofertas", icon: Tag, roles: GERENCIA_ROLES },
      { to: "/admin/motoboys", label: "Motoboys", icon: Truck, roles: SUPER_ADMIN_ONLY },
      { to: "/admin/operadores", label: "Operadores", icon: Users, roles: SUPER_ADMIN_ONLY },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    items: [
      { to: "/operacao/caixa", label: "Fechamentos/turnos", icon: Receipt, roles: OPERACAO_ROLES },
      { to: "/operacao/caixa/sangrias", label: "Sangrias", icon: Banknote, roles: OPERACAO_ROLES },
    ],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    items: [
      { to: "/operacao/relatorio", label: "Relatório do dia", icon: BarChart3, roles: GERENCIA_ROLES },
    ],
  },
];

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// Acha, entre todos os itens de nav, o `to` mais específico que casa com a
// rota atual — evita que "/operacao/caixa" e "/operacao/caixa/sangrias"
// fiquem destacados ao mesmo tempo quando um é prefixo do outro.
function findActiveTo(pathname) {
  const allTos = NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.to));
  let best = null;
  for (const to of allTos) {
    if (pathname === to || pathname.startsWith(`${to}/`)) {
      if (!best || to.length > best.length) best = to;
    }
  }
  return best;
}

export default function Sidebar() {
  const { admin, logout } = useAdminAuth();
  const location = useLocation();
  const role = admin?.role;
  const activeTo = findActiveTo(location.pathname);

  const [collapsed, setCollapsed] = useState(false);
  const storageKey = admin?.id ? `fornella:sidebar-collapsed:${admin.id}` : null;

  useEffect(() => {
    if (!storageKey) return;
    setCollapsed(localStorage.getItem(storageKey) === "1");
  }, [storageKey]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      if (storageKey) localStorage.setItem(storageKey, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-[216px]"
      } flex-shrink-0 bg-char text-flour min-h-screen flex flex-col transition-[width] duration-200`}
    >
      <div className={`px-5 py-5 border-b border-flour/10 flex items-center gap-3 ${collapsed ? "justify-center px-0" : ""}`}>
        <div className="w-9 h-9 rounded-full bg-ember-500 flex items-center justify-center font-semibold text-sm flex-shrink-0">
          {getInitials(admin?.name)}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{admin?.name || "Operador"}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter((item) => !role || item.roles.includes(role));
          if (items.length === 0) return null;
          return (
            <div key={section.id}>
              {!collapsed && (
                <p className="px-2 text-xs font-semibold uppercase tracking-wide text-flour/40 mb-2">
                  {section.label}
                </p>
              )}
              <div className="space-y-1">
                {items.map((item) => {
                  const active = item.to === activeTo;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        collapsed ? "justify-center" : ""
                      } ${active ? "bg-ember-500 text-white" : "text-flour/80 hover:bg-flour/10"}`}
                    >
                      <Icon size={18} className="flex-shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-flour/10 space-y-3">
        <button
          onClick={toggleCollapsed}
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-flour/70 hover:text-flour hover:bg-flour/10 transition w-full ${
            collapsed ? "justify-center" : ""
          }`}
          aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span>Colapsar</span>}
        </button>

        {!collapsed && (
          <p className="px-2 text-xs text-flour/40 truncate">
            {admin?.loja?.nome || "Loja não identificada"}
          </p>
        )}

        <button
          onClick={logout}
          className={`flex items-center gap-2 px-2 py-1.5 text-sm font-semibold text-flour/70 hover:text-flour transition ${
            collapsed ? "justify-center w-full" : ""
          }`}
        >
          <LogOut size={16} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
