import { useEffect, useState } from "react";
import { catalogService } from "../../services/api";
import { CadastroTable, Field, inputClass } from "../../components/cadastro";
import { StatusBadge } from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { useToast } from "../../components/ui/Toast";

const CATEGORY_LABELS = { COMBO: "Combo", BEBIDA: "Bebida", ESPECIAL: "Especial" };

const COLUMNS = [
  { key: "name", label: "Nome" },
  { key: "category", label: "Categoria", render: (row) => CATEGORY_LABELS[row.category] || row.category },
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

export default function CadastroProdutos() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function load() {
    setLoading(true);
    catalogService
      .getProducts()
      .then(setProducts)
      .catch(() => toast.error("Não foi possível carregar os produtos."))
      .finally(() => setLoading(false));
  }

  async function handleBulkToggleActive(ids, active) {
    try {
      await Promise.all(ids.map((id) => catalogService.patchProduct(id, { active })));
      toast.success(active ? "Produtos ativados." : "Produtos desativados.");
      load();
    } catch {
      toast.error("Não foi possível atualizar os produtos selecionados.");
    }
  }

  async function handleDelete(row) {
    try {
      await catalogService.deleteProduct(row.id);
      toast.success("Produto excluído.");
      setProducts((prev) => prev.filter((p) => p.id !== row.id));
    } catch {
      toast.error("Não foi possível excluir o produto.");
    }
  }

  return (
    <CadastroTable
      title="Produtos"
      itemLabelSingular="produto"
      columns={COLUMNS}
      rows={products}
      loading={loading}
      onBulkToggleActive={handleBulkToggleActive}
      onDelete={handleDelete}
      emptyMessage="Nenhum produto cadastrado."
      renderForm={(row, close) => (
        <ProductForm
          row={row}
          onSaved={(saved) => {
            setProducts((prev) =>
              row ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev]
            );
            close();
          }}
          onCancel={close}
        />
      )}
    />
  );
}

function ProductForm({ row, onSaved, onCancel }) {
  const [name, setName] = useState(row?.name || "");
  const [category, setCategory] = useState(row?.category || "BEBIDA");
  const [price, setPrice] = useState(row ? String(row.price) : "");
  const [description, setDescription] = useState(row?.description || "");
  const [active, setActive] = useState(row?.active ?? true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    const data = {
      name,
      category,
      price: Number(price),
      description: description || null,
      active,
    };
    setSaving(true);
    try {
      const saved = row
        ? await catalogService.updateProduct(row.id, data)
        : await catalogService.createProduct(data);
      toast.success(row ? "Produto atualizado." : "Produto criado.");
      onSaved(saved);
    } catch {
      toast.error("Não foi possível salvar o produto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Nome" required>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Categoria" required>
        <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
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
