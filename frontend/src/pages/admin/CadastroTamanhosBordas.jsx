import { useEffect, useState } from "react";
import { catalogService } from "../../services/api";
import { CadastroTable, Field, inputClass } from "../../components/cadastro";
import { StatusBadge } from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { useToast } from "../../components/ui/Toast";

const TABS = [
  { key: "tamanhos", label: "Tamanhos" },
  { key: "bordas", label: "Bordas" },
];

export default function CadastroTamanhosBordas() {
  const [tab, setTab] = useState("tamanhos");

  return (
    <div>
      <div className="flex items-center gap-1 mb-6 border-b border-flour-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === t.key
                ? "border-ember-500 text-ember-600"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "tamanhos" ? <TamanhosTab /> : <BordasTab />}
    </div>
  );
}

const TYPE_LABELS = { SALGADA: "Salgada", DOCE: "Doce" };

function TamanhosTab() {
  const [sizes, setSizes] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function load() {
    setLoading(true);
    catalogService
      .getSizes()
      .then(setSizes)
      .catch(() => toast.error("Não foi possível carregar os tamanhos."))
      .finally(() => setLoading(false));
  }

  async function handleBulkToggleActive(ids, active) {
    try {
      await Promise.all(ids.map((id) => catalogService.patchSize(id, { active })));
      toast.success(active ? "Tamanhos ativados." : "Tamanhos desativados.");
      load();
    } catch {
      toast.error("Não foi possível atualizar os tamanhos selecionados.");
    }
  }

  async function handleDelete(row) {
    try {
      await catalogService.deleteSize(row.id);
      toast.success("Tamanho excluído.");
      setSizes((prev) => prev.filter((s) => s.id !== row.id));
    } catch {
      toast.error("Não foi possível excluir o tamanho.");
    }
  }

  const columns = [
    { key: "name", label: "Nome" },
    { key: "slices", label: "Fatias" },
    { key: "servesPeople", label: "Serve" },
    {
      key: "price",
      label: "Valor",
      align: "right",
      render: (row) => <span className="font-price">R$ {Number(row.price).toFixed(2)}</span>,
    },
    {
      key: "active",
      label: "Status",
      render: (row) => <StatusBadge domain="cadastro" value={row.active ? "ativo" : "inativo"} />,
    },
  ];

  return (
    <CadastroTable
      title="Tamanhos"
      itemLabelSingular="tamanho"
      columns={columns}
      rows={sizes}
      loading={loading}
      onBulkToggleActive={handleBulkToggleActive}
      onDelete={handleDelete}
      emptyMessage="Nenhum tamanho cadastrado."
      renderForm={(row, close) => (
        <SizeForm
          row={row}
          onSaved={(saved) => {
            setSizes((prev) => (row ? prev.map((s) => (s.id === saved.id ? saved : s)) : [saved, ...prev]));
            close();
          }}
          onCancel={close}
        />
      )}
    />
  );
}

function SizeForm({ row, onSaved, onCancel }) {
  const [name, setName] = useState(row?.name || "");
  const [slug, setSlug] = useState(row?.slug || "");
  const [slices, setSlices] = useState(row ? String(row.slices) : "8");
  const [maxFlavors, setMaxFlavors] = useState(row ? String(row.maxFlavors) : "2");
  const [servesPeople, setServesPeople] = useState(row ? String(row.servesPeople) : "2");
  const [price, setPrice] = useState(row ? String(row.price) : "");
  const [active, setActive] = useState(row?.active ?? true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    const data = {
      name,
      slug: slug || name.toLowerCase().replace(/\s+/g, "-"),
      slices: Number(slices),
      maxFlavors: Number(maxFlavors),
      servesPeople: Number(servesPeople),
      price: Number(price),
      active,
    };
    setSaving(true);
    try {
      const saved = row
        ? await catalogService.updateSize(row.id, data)
        : await catalogService.createSize(data);
      toast.success(row ? "Tamanho atualizado." : "Tamanho criado.");
      onSaved(saved);
    } catch {
      toast.error("Não foi possível salvar o tamanho.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Nome" required>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Identificador (slug)">
        <input
          className={inputClass}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="gerado a partir do nome, se vazio"
        />
      </Field>
      <Field label="Fatias" required>
        <input
          className={inputClass}
          type="number"
          min="1"
          value={slices}
          onChange={(e) => setSlices(e.target.value)}
          required
        />
      </Field>
      <Field label="Máx. sabores" required>
        <input
          className={inputClass}
          type="number"
          min="1"
          value={maxFlavors}
          onChange={(e) => setMaxFlavors(e.target.value)}
          required
        />
      </Field>
      <Field label="Serve quantas pessoas" required>
        <input
          className={inputClass}
          type="number"
          min="1"
          value={servesPeople}
          onChange={(e) => setServesPeople(e.target.value)}
          required
        />
      </Field>
      <Field label="Preço (R$)" required>
        <input
          className={`${inputClass} font-mono`}
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
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

function BordasTab() {
  const [borders, setBorders] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function load() {
    setLoading(true);
    catalogService
      .getBorders()
      .then(setBorders)
      .catch(() => toast.error("Não foi possível carregar as bordas."))
      .finally(() => setLoading(false));
  }

  async function handleBulkToggleActive(ids, active) {
    try {
      await Promise.all(ids.map((id) => catalogService.patchBorder(id, { active })));
      toast.success(active ? "Bordas ativadas." : "Bordas desativadas.");
      load();
    } catch {
      toast.error("Não foi possível atualizar as bordas selecionadas.");
    }
  }

  async function handleDelete(row) {
    try {
      await catalogService.deleteBorder(row.id);
      toast.success("Borda excluída.");
      setBorders((prev) => prev.filter((b) => b.id !== row.id));
    } catch {
      toast.error("Não foi possível excluir a borda.");
    }
  }

  const columns = [
    { key: "name", label: "Nome" },
    { key: "type", label: "Tipo", render: (row) => TYPE_LABELS[row.type] || row.type },
    {
      key: "price",
      label: "Valor",
      align: "right",
      render: (row) => <span className="font-price">R$ {Number(row.price).toFixed(2)}</span>,
    },
    {
      key: "active",
      label: "Status",
      render: (row) => <StatusBadge domain="cadastro" value={row.active ? "ativo" : "inativo"} />,
    },
  ];

  return (
    <CadastroTable
      title="Bordas"
      itemLabelSingular="borda"
      columns={columns}
      rows={borders}
      loading={loading}
      onBulkToggleActive={handleBulkToggleActive}
      onDelete={handleDelete}
      emptyMessage="Nenhuma borda cadastrada."
      renderForm={(row, close) => (
        <BorderForm
          row={row}
          onSaved={(saved) => {
            setBorders((prev) => (row ? prev.map((b) => (b.id === saved.id ? saved : b)) : [saved, ...prev]));
            close();
          }}
          onCancel={close}
        />
      )}
    />
  );
}

function BorderForm({ row, onSaved, onCancel }) {
  const [name, setName] = useState(row?.name || "");
  const [type, setType] = useState(row?.type || "SALGADA");
  const [price, setPrice] = useState(row ? String(row.price) : "");
  const [active, setActive] = useState(row?.active ?? true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    const data = { name, type, price: Number(price), active };
    setSaving(true);
    try {
      const saved = row
        ? await catalogService.updateBorder(row.id, data)
        : await catalogService.createBorder(data);
      toast.success(row ? "Borda atualizada." : "Borda criada.");
      onSaved(saved);
    } catch {
      toast.error("Não foi possível salvar a borda.");
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
      <Field label="Preço (R$)" required>
        <input
          className={`${inputClass} font-mono`}
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
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
