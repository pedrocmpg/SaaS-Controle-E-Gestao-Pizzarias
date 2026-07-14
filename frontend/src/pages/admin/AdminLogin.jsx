import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";
import Logo from "../../components/Logo";

export default function AdminLogin() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await login(email, password);
      const role = data.admin?.role;
      if (role === "GERENTE" || role === "ATENDENTE") {
        navigate("/operacao/pedidos");
      } else {
        navigate("/admin/dashboard");
      }
    } catch (err) {
      setError(
        err.response?.data?.error || "Não foi possível entrar. Verifique suas credenciais."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50 px-4">
      <div className="card p-8 w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Logo />
        </div>
        <h1 className="text-xl font-bold text-brand-900 text-center mb-6">Painel Administrativo</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-brand-900 mb-1">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-brand-900 mb-1">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
