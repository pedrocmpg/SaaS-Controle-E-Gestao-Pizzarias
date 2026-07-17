import { useEffect, useState } from "react";
import { catalogService } from "../../services/api";
import { CadastroTable, Field, inputClass } from "../../components/cadastro";
import { StatusBadge } from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { useToast } from "../../components/ui/Toast";

const TYPE_LABELS = { SALGADA: "Salgada", DOCE: "Doce" };

const COLUMNS = [
  { key: "name", label: "Nome" },
  { key: "type", label: "Tipo", render: (row) => TYPE_LABELS[row.type] || row.type },
  {
    key: "extraPrice",
    label: "Preço adicional",
    align: "right",
    render: (row) => <span className="font-price">R$ {Number(row.extraPrice).toFixed(2)}</span>,
  },
  {
    key: "active",
    label: "Status",
    render: (row) => <StatusBadge domain="cadastro" value={row.active ? "ativo" : "inativo"} />,
  },
];

export default function CadastroSabores() {
  const [flavors, setFlavors] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function load() {
    setLoading(true);
    catalogService
      .getFlavors()
      .then(setFlavors)
      .catch(() => toast.error("Não foi possível carregar os sabores."))
      .finally(() => setLoading(false));
  }

  async function handleBulkToggleActive(ids, active) {
    try {
      await Promise.all(ids.map((id) => catalogService.patchFlavor(id, { active })));
      toast.success(active ? "Sabores ativados." : "Sabores desativados.");
      load();
    } catch {
      toast.error("Não foi possível atualizar os sabores selecionados.");
    }
  }

  async function handleDelete(row) {
    try {
      await catalogService.deleteFlavor(row.id);
      toast.success("Sabor excluído.");
      setFlavors((prev) => prev.filter((f) => f.id !== row.id));
    } catch {
      toast.error("Não foi possível excluir o sabor.");
    }
  }

  return (
    <CadastroTable
      title="Sabores"
      itemLabelSingular="sabor"
      columns={COLUMNS}
      rows={flavors}
      loading={loading}
      onBulkToggleActive={handleBulkToggleActive}
      onDelete={handleDelete}
      emptyMessage="Nenhum sabor cadastrado."
      renderForm={(row, close) => (
        <FlavorForm
          row={row}
          onSaved={(saved) => {
            setFlavors((prev) =>
              row ? prev.map((f) => (f.id === saved.id ? saved : f)) : [saved, ...prev]
            );
            close();
          }}
          onCancel={close}
        />
      )}
    />
  );
}

function FlavorForm({ row, onSaved, onCancel }) {
  const [name, setName] = useState(row?.name || "");
  const [type, setType] = useState(row?.type || "SALGADA");
  const [extraPrice, setExtraPrice] = useState(row ? String(row.extraPrice) : "0");
  const [description, setDescription] = useState(row?.description || "");
  const [active, setActive] = useState(row?.active ?? true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    const data = {
      name,
      type,
      extraPrice: Number(extraPrice),
      description: description || null,
      active,
    };
    setSaving(true);
    try {
      const saved = row
        ? await catalogService.updateFlavor(row.id, data)
        : await catalogService.createFlavor(data);
      toast.success(row ? "Sabor atualizado." : "Sabor criado.");
      onSaved(saved);
    } catch {
      toast.error("Não foi possível salvar o sabor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Nome" required>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Tipo" required>
        <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Preço adicional (R$)" required>
        <input
          className={`${inputClass} font-mono`}
          type="number"
          step="0.01"
          min="0"
          value={extraPrice}
          onChange={(e) => setExtraPrice(e.target.value)}
          required
        />
      </Field>
      <Field label="Descrição">
        <textarea
          className={inputClass}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <label className="flex items-center gap-2 mb-6 text-sm text-ink">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Ativo
      </label>

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
