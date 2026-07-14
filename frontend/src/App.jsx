import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Menu from "./pages/Menu";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Checkout from "./pages/Checkout";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminKanban from "./pages/admin/AdminKanban";
import AdminOperators from "./pages/admin/AdminOperators";
import AdminRoute from "./pages/admin/AdminRoute";
import OperacaoLayout from "./pages/operacao/OperacaoLayout";
import OperacaoPedidos from "./pages/operacao/OperacaoPedidos";
import OperacaoCardapio from "./pages/operacao/OperacaoCardapio";
import OperacaoRelatorio from "./pages/operacao/OperacaoRelatorio";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { ToastProvider } from "./components/ui";

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/cardapio" element={<Menu />} />
          <Route path="/sobre" element={<About />} />
          <Route path="/contato" element={<Contact />} />
          <Route path="/checkout" element={<Checkout />} />
        </Route>

        {/* Área administrativa (fora do layout público) */}
        <Route
          path="/admin/*"
          element={
            <AdminAuthProvider>
              <AdminRoutes />
            </AdminAuthProvider>
          }
        />

        {/* Área operacional (gerente/atendente), fora do layout público */}
        <Route
          path="/operacao/*"
          element={
            <AdminAuthProvider>
              <OperacaoRoutes />
            </AdminAuthProvider>
          }
        />
      </Routes>
    </ToastProvider>
  );
}

function AdminRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AdminLogin />} />
      <Route
        path="/dashboard"
        element={
          <AdminRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "GERENTE", "ATENDENTE"]}>
            <AdminKanban />
          </AdminRoute>
        }
      />
      <Route
        path="/operadores"
        element={
          <AdminRoute allowedRoles={["SUPER_ADMIN"]}>
            <AdminOperators />
          </AdminRoute>
        }
      />
    </Routes>
  );
}

function OperacaoRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/operacao/pedidos" replace />} />
      <Route
        element={
          <AdminRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "GERENTE", "ATENDENTE"]}>
            <OperacaoLayout />
          </AdminRoute>
        }
      >
        <Route path="/pedidos" element={<OperacaoPedidos />} />
        <Route
          path="/cardapio"
          element={
            <AdminRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "GERENTE"]}>
              <OperacaoCardapio />
            </AdminRoute>
          }
        />
        <Route
          path="/relatorio"
          element={
            <AdminRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "GERENTE"]}>
              <OperacaoRelatorio />
            </AdminRoute>
          }
        />
      </Route>
    </Routes>
  );
}
