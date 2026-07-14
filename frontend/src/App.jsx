import { Routes, Route } from "react-router-dom";
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
