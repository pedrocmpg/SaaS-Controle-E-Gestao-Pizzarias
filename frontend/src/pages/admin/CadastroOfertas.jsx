import { useEffect, useState } from "react";
import { ofertasService } from "../../services/api";
import { CadastroTable, Field, inputClass } from "../../components/cadastro";
import { StatusBadge } from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";

const COLUMNS = [
  { key: "name", label: "Nome" },
  {
    key: "products",
    label: "Produtos",
    render: (row) => (
      <span className="text-ink-soft text-sm">
        {row.products?.map((p) => p.name).join(", ") || "—"}
      </span>
    ),
  },
  {
    key: "precoPromocional",
    label: "Valor",
    align: "right",
    render: (row) => <span className="font-price">R$ {Number(row.precoPromocional).toFixed(2)}</span>,
  },
  {
    key: "active",
    label: "Status",
    render: (row) => <StatusBadge domain="cadastro" value={row.active ? "ativo" : "inativo"} />,
  },
];

export default function CadastroOfertas() {
  const [ofertas, setOfertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function load() {
    setLoading(true);
    ofertasService
      .list()
      .then(setOfertas)
      .catch(() => toast.error("Não foi possível carregar as ofertas."))
      .finally(() => setLoading(false));
  }

  async function handleBulkToggleActive(ids, active) {
    try {
      await Promise.all(ids.map((id) => ofertasService.patch(id, { active })));
      toast.success(active ? "Ofertas ativadas." : "Ofertas desativadas.");
      load();
    } catch {
      toast.error("Não foi possível atualizar as ofertas selecionadas.");
    }
  }

  async function handleDelete(row) {
    try {
      await ofertasService.remove(row.id);
      toast.success("Oferta excluída.");
      setOfertas((prev) => prev.filter((o) => o.id !== row.id));
    } catch {
      toast.error("Não foi possível excluir a oferta.");
    }
  }

  return (
    <CadastroTable
      title="Ofertas"
      itemLabelSingular="oferta"
      columns={COLUMNS}
      rows={ofertas}
      loading={loading}
      onBulkToggleActive={handleBulkToggleActive}
      onDelete={handleDelete}
      emptyMessage="Nenhuma oferta cadastrada."
      renderForm={(row, close) => (
        <OfertaForm
          row={row}
          onSaved={(saved) => {
            setOfertas((prev) => (row ? prev.map((o) => (o.id === saved.id ? saved : o)) : [saved, ...prev]));
            close();
          }}
          onCancel={close}
        />
      )}
    />
  );
}

// Formulário de Oferta é o mais complexo da leva de cadastros: além dos
// campos comuns, precisa de um multi-select de produtos do cardápio da loja
// (spec-4 — Oferta vincula produtos específicos, não é um card solto).
function OfertaForm({ row, onSaved, onCancel }) {
  const [name, setName] = useState(row?.name || "");
  const [description, setDescription] = useState(row?.description || "");
  const [precoPromocional, setPrecoPromocional] = useState(row ? String(row.precoPromocional) : "");
  const [validoDe, setValidoDe] = useState(row?.validoDe ? row.validoDe.slice(0, 10) : "");
  const [validoAte, setValidoAte] = useState(row?.validoAte ? row.validoAte.slice(0, 10) : "");
  const [active, setActive] = useState(row?.active ?? true);
  const [productIds, setProductIds] = useState(new Set(row?.productIds || []));
  const [availableProducts, setAvailableProducts] = useState(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    ofertasService
      .getProdutosDisponiveis()
      .then(setAvailableProducts)
      .catch(() => toast.error("Não foi possível carregar os produtos disponíveis."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleProduct(id) {
    setProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (productIds.size === 0) {
      toast.error("Selecione ao menos um produto pra vincular à oferta.");
      return;
    }
    const data = {
      name,
      description: description || null,
      precoPromocional: Number(precoPromocional),
      validoDe: validoDe || null,
      validoAte: validoAte || null,
      active,
      productIds: Array.from(productIds),
    };
    setSaving(true);
    try {
      const saved = row
        ? await ofertasService.update(row.id, data)
        : await ofertasService.create(data);
      toast.success(row ? "Oferta atualizada." : "Oferta criada.");
      onSaved(saved);
    } catch {
      toast.error("Não foi possível salvar a oferta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Nome" required>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Descrição">
        <textarea
          className={inputClass}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <Field label="Preço promocional (R$)" required>
        <input
          className={`${inputClass} font-mono`}
          type="number"
          step="0.01"
          min="0"
          value={precoPromocional}
          onChange={(e) => setPrecoPromocional(e.target.value)}
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Válido de">
          <input className={inputClass} type="date" value={validoDe} onChange={(e) => setValidoDe(e.target.value)} />
        </Field>
        <Field label="Válido até">
          <input className={inputClass} type="date" value={validoAte} onChange={(e) => setValidoAte(e.target.value)} />
        </Field>
      </div>

      <Field label="Produtos vinculados" required>
        {availableProducts === null ? (
          <Spinner size="sm" />
        ) : (
          <div className="border border-flour-2 rounded-lg max-h-48 overflow-y-auto divide-y divide-flour-2">
            {availableProducts.map((product) => (
              <label key={product.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={productIds.has(product.id)}
                  onChange={() => toggleProduct(product.id)}
                />
                <span className="flex-1">{product.name}</span>
                <span className="font-price text-ink-soft">R$ {Number(product.price).toFixed(2)}</span>
              </label>
            ))}
            {availableProducts.length === 0 && (
              <p className="px-3 py-4 text-sm text-ink-soft">Nenhum produto cadastrado ainda.</p>
            )}
          </div>
        )}
      </Field>

      <label className="flex items-center gap-2 mb-6 mt-4 text-sm text-ink">
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
