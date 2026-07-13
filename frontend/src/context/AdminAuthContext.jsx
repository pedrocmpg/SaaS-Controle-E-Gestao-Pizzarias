import { createContext, useContext, useEffect, useState } from "react";
import { authService, fetchCsrfToken } from "../services/api";

const AdminAuthContext = createContext(null);
const TOKEN_KEY = "etd_admin_token";

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loadingAdmin, setLoadingAdmin] = useState(() => !!localStorage.getItem(TOKEN_KEY));

  useEffect(() => {
    if (!token) {
      setLoadingAdmin(false);
      return;
    }
    authService
      .me()
      .then((data) => setAdmin(data.admin))
      .catch(() => logout())
      .finally(() => setLoadingAdmin(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function login(email, password) {
    // Busca CSRF token antes de fazer login
    await fetchCsrfToken();
    
    const data = await authService.login(email, password);
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setAdmin(data.admin);
    return data;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setAdmin(null);
  }

  return (
    <AdminAuthContext.Provider value={{ admin, token, login, logout, isAuthenticated: !!token, loadingAdmin }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth deve ser usado dentro de um AdminAuthProvider");
  return ctx;
}
