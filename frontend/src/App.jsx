import { Routes, Route, Navigate } from "react-router-dom";
// DESATIVADO temporariamente (jul/2026) — fluxo de vitrine pública para
// cliente final. Projeto pivotou pra hub interno multi-tenant.
// Manter código pronto pra reativação futura, não apagar.
// import Layout from "./components/Layout";
// import Home from "./pages/Home";
// import Menu from "./pages/Menu";
// import About from "./pages/About";
// import Contact from "./pages/Contact";
// import Checkout from "./pages/Checkout";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminKanban from "./pages/admin/AdminKanban";
import AdminOperators from "./pages/admin/AdminOperators";
import AdminRoute from "./pages/admin/AdminRoute";
import CadastroProdutos from "./pages/admin/CadastroProdutos";
import CadastroSabores from "./pages/admin/CadastroSabores";
import CadastroTamanhosBordas from "./pages/admin/CadastroTamanhosBordas";
import CadastroOfertas from "./pages/admin/CadastroOfertas";
import CadastroMotoboys from "./pages/admin/CadastroMotoboys";
import AppShell from "./components/layout/AppShell";
import OperacaoPedidos from "./pages/operacao/OperacaoPedidos";
import OperacaoRelatorio from "./pages/operacao/OperacaoRelatorio";
import OperacaoSalao from "./pages/operacao/OperacaoSalao";
import OperacaoCaixa from "./pages/operacao/OperacaoCaixa";
import OperacaoDespacho from "./pages/operacao/OperacaoDespacho";
import OperacaoMotoboyTurno from "./pages/operacao/OperacaoMotoboyTurno";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { ToastProvider } from "./components/ui";
import { OPERACAO_COM_MOTOBOY_ROLES, GERENCIA_ROLES, SUPER_ADMIN_ONLY } from "./constants/roles";

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        {/* DESATIVADO temporariamente (jul/2026) — fluxo de vitrine pública para
            cliente final. Projeto pivotou pra hub interno multi-tenant.
            Manter código pronto pra reativação futura, não apagar. */}
        {/* <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/cardapio" element={<Menu />} />
          <Route path="/sobre" element={<About />} />
          <Route path="/contato" element={<Contact />} />
          <Route path="/checkout" element={<Checkout />} />
        </Route> */}
        <Route path="/" element={<Navigate to="/admin" replace />} />

        <Route
          path="/admin"
          element={
            <AdminAuthProvider>
              <AdminLogin />
            </AdminAuthProvider>
          }
        />

        {/* Shell único (sidebar retrátil) compartilhado por /admin/* (exceto
            login) e /operacao/* — spec-4. */}
        <Route
          path="/*"
          element={
            <AdminAuthProvider>
              <AdminRoute allowedRoles={OPERACAO_COM_MOTOBOY_ROLES}>
                <AppShell />
              </AdminRoute>
            </AdminAuthProvider>
          }
        >
          <Route path="admin/dashboard" element={<AdminKanban />} />
          <Route
            path="admin/produtos"
            element={
              <AdminRoute allowedRoles={GERENCIA_ROLES}>
                <CadastroProdutos />
              </AdminRoute>
            }
          />
          <Route
            path="admin/sabores"
            element={
              <AdminRoute allowedRoles={GERENCIA_ROLES}>
                <CadastroSabores />
              </AdminRoute>
            }
          />
          <Route
            path="admin/tamanhos-bordas"
            element={
              <AdminRoute allowedRoles={GERENCIA_ROLES}>
                <CadastroTamanhosBordas />
              </AdminRoute>
            }
          />
          <Route
            path="admin/ofertas"
            element={
              <AdminRoute allowedRoles={GERENCIA_ROLES}>
                <CadastroOfertas />
              </AdminRoute>
            }
          />
          <Route
            path="admin/motoboys"
            element={
              <AdminRoute allowedRoles={SUPER_ADMIN_ONLY}>
                <CadastroMotoboys />
              </AdminRoute>
            }
          />
          <Route
            path="admin/operadores"
            element={
              <AdminRoute allowedRoles={SUPER_ADMIN_ONLY}>
                <AdminOperators />
              </AdminRoute>
            }
          />

          <Route path="operacao" element={<Navigate to="/operacao/pedidos" replace />} />
          <Route path="operacao/pedidos" element={<OperacaoPedidos />} />
          <Route path="operacao/salao" element={<OperacaoSalao />} />
          <Route path="operacao/caixa" element={<OperacaoCaixa />} />
          <Route path="operacao/caixa/sangrias" element={<OperacaoCaixa />} />
          <Route path="operacao/despacho" element={<OperacaoDespacho />} />
          <Route path="operacao/motoboy" element={<OperacaoMotoboyTurno />} />
          <Route
            path="operacao/relatorio"
            element={
              <AdminRoute allowedRoles={GERENCIA_ROLES}>
                <OperacaoRelatorio />
              </AdminRoute>
            }
          />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
