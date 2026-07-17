import { useEffect, useState } from "react";
import { adminUsersService } from "../../services/api";
import { CadastroTable } from "./CadastroTable";
import { Field, inputClass } from "./FormField";
import { StatusBadge } from "../ui/Badge";
import Button from "../ui/Button";
import { useToast } from "../ui/Toast";

/**
 * Motoboys e Operadores são o mesmo model de banco (Admin, diferenciado por
 * role) — este componente interno concentra a plumbing comum de list/
 * create/update/soft-delete, reaproveitada pelas duas telas de cadastro
 * (CadastroMotoboys.jsx e AdminOperators.jsx). Exclusão nunca chama o
 * DELETE definitivo: vira `active: false` (soft-delete), porque um admin
 * com histórico de turno/pedido quebra por causa de FK (ver spec-4).
 */
export function AdminCadastroScreen({ title, itemLabelSingular, roleFilter, roleOptions, emptyMessage }) {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function load() {
    setLoading(true);
    adminUsersService
      .list(roleFilter.length === 1 ? roleFilter[0] : undefined)
      .then((list) => setAdmins(roleFilter.length === 1 ? list : list.filter((a) => roleFilter.includes(a.role))))
      .catch(() => toast.error(`Não foi possível carregar ${title.toLowerCase()}.`))
      .finally(() => setLoading(false));
  }

  async function handleBulkToggleActive(ids, active) {
    try {
      await Promise.all(ids.map((id) => adminUsersService.update(id, { active })));
      toast.success(active ? "Contas ativadas." : "Contas desativadas.");
      load();
    } catch {
      toast.error("Não foi possível atualizar as contas selecionadas.");
    }
  }

  async function handleDelete(row) {
    try {
      // Soft-delete: nunca DELETE definitivo (evita erro de FK com histórico).
      await adminUsersService.update(row.id, { active: false });
      toast.success("Conta desativada.");
      setAdmins((prev) => prev.map((a) => (a.id === row.id ? { ...a, active: false } : a)));
    } catch {
      toast.error("Não foi possível desativar a conta.");
    }
  }

  const columns = [
    { key: "name", label: "Nome" },
    { key: "email", label: "E-mail" },
    ...(roleOptions.length > 1
      ? [{ key: "role", label: "Papel", render: (row) => roleOptions.find((r) => r.value === row.role)?.label || row.role }]
      : []),
    {
      key: "active",
      label: "Status",
      render: (row) => <StatusBadge domain="cadastro" value={row.active !== false ? "ativo" : "inativo"} />,
    },
  ];

  return (
    <CadastroTable
      title={title}
      itemLabelSingular={itemLabelSingular}
      columns={columns}
      rows={admins}
      loading={loading}
      onBulkToggleActive={handleBulkToggleActive}
      onDelete={handleDelete}
      emptyMessage={emptyMessage}
      renderForm={(row, close) => (
        <AdminForm
          row={row}
          roleOptions={roleOptions}
          defaultRole={roleFilter[0]}
          onSaved={(saved) => {
            setAdmins((prev) => (row ? prev.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...prev]));
            close();
          }}
          onCancel={close}
        />
      )}
    />
  );
}

function AdminForm({ row, roleOptions, defaultRole, onSaved, onCancel }) {
  const [name, setName] = useState(row?.name || "");
  const [email, setEmail] = useState(row?.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(row?.role || defaultRole);
  const [active, setActive] = useState(row?.active ?? true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      let saved;
      if (row) {
        const data = { name, active };
        if (roleOptions.length > 1) data.role = role;
        saved = await adminUsersService.update(row.id, data);
      } else {
        saved = await adminUsersService.create({ name, email, password, role });
      }
      toast.success(row ? "Conta atualizada." : "Conta criada.");
      onSaved(saved);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Não foi possível salvar a conta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Nome" required>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="E-mail" required>
        <input
          className={inputClass}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={!!row}
          required
        />
      </Field>
      {!row && (
        <Field label="Senha" required>
          <input
            className={inputClass}
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
      )}
      {roleOptions.length > 1 && (
        <Field label="Papel" required>
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
            {roleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      {row && (
        <label className="flex items-center gap-2 mb-6 text-sm text-ink">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Ativo
        </label>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" loading={saving} className="flex-1">
          Salvar
        </Button>
      </div>
    </form>
  );
}
