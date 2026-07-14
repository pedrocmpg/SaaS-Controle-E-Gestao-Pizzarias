import { useState } from "react";
import { adminUsersService } from "../../services/api";
import AdminHeader from "../../components/AdminHeader";

const roleLabels = {
  GERENTE: "Gerente",
  ATENDENTE: "Atendente",
};

export default function AdminOperators() {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "ATENDENTE" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await adminUsersService.create(form);
      setSuccess(`Operador "${data.admin.name}" criado com sucesso.`);
      setForm({ name: "", email: "", password: "", role: "ATENDENTE" });
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível criar o operador.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-50">
      <AdminHeader />

      <main className="container-app py-10">
        <h1 className="text-2xl font-bold text-brand-900 mb-6">Novo operador</h1>

        <form onSubmit={handleSubmit} className="card p-8 w-full max-w-md space-y-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Nome</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              minLength={2}
              className="w-full border border-gray-200 rounded-xl p-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full border border-gray-200 rounded-xl p-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">Senha temporária</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={8}
              className="w-full border border-gray-200 rounded-xl p-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">Função</label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-xl p-2.5 text-sm"
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">{success}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Criando..." : "Criar operador"}
          </button>
        </form>
      </main>
    </div>
  );
}
