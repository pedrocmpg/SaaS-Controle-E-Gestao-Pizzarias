import { useEffect, useState } from "react";
import { catalogService } from "../../services/api";

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        checked ? "bg-basil" : "bg-gray-300"
      } ${disabled ? "opacity-50 cursor-wait" : ""}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function CategorySection({ title, items, priceField, onSave }) {
  if (items.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-lg font-display font-semibold text-char mb-3">{title}</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-flour-2 text-ink-soft text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Nome</th>
              <th className="text-left px-4 py-3 font-semibold">Preço</th>
              <th className="text-left px-4 py-3 font-semibold">Disponível</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <ItemRow key={item.id} item={item} priceField={priceField} onSave={onSave} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ItemRow({ item, priceField, onSave }) {
  const [price, setPrice] = useState(String(item[priceField]));
  const [saving, setSaving] = useState(false);

  async function commitPrice() {
    const value = Number(price);
    if (isNaN(value) || value <= 0 || value === Number(item[priceField])) {
      setPrice(String(item[priceField]));
      return;
    }
    setSaving(true);
    try {
      await onSave(item.id, { [priceField]: value });
    } catch {
      setPrice(String(item[priceField]));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(next) {
    setSaving(true);
    try {
      await onSave(item.id, { active: next });
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-t border-flour-2">
      <td className="px-4 py-3">{item.name}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 font-mono">
          R$
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={commitPrice}
            disabled={saving}
            className="w-20 border border-flour-2 rounded-lg px-2 py-1 font-mono"
          />
        </div>
      </td>
      <td className="px-4 py-3">
        <Toggle checked={item.active} onChange={toggleActive} disabled={saving} />
      </td>
    </tr>
  );
}

export default function OperacaoCardapio() {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Usa os endpoints individuais (não o /catalog agregado) porque este último
    // filtra active=true — aqui precisamos ver também os itens desativados
    // para poder reativá-los.
    Promise.all([catalogService.getFlavors(), catalogService.getBorders(), catalogService.getProducts()])
      .then(([flavors, borders, products]) => setCatalog({ flavors, borders, products }))
      .catch(() => setError("Não foi possível carregar o cardápio."))
      .finally(() => setLoading(false));
  }, []);

  function patchLocal(collection, id, data) {
    setCatalog((prev) => ({
      ...prev,
      [collection]: prev[collection].map((it) => (it.id === id ? { ...it, ...data } : it)),
    }));
  }

  async function saveFlavor(id, data) {
    const updated = await catalogService.patchFlavor(id, data);
    patchLocal("flavors", id, updated);
  }

  async function saveProduct(id, data) {
    const updated = await catalogService.patchProduct(id, data);
    patchLocal("products", id, updated);
  }

  async function saveBorder(id, data) {
    const updated = await catalogService.patchBorder(id, data);
    patchLocal("borders", id, updated);
  }

  if (loading) {
    return <p className="text-ink-soft text-sm">Carregando cardápio...</p>;
  }

  if (error) {
    return <p className="text-red-500 text-sm">{error}</p>;
  }

  const salgadas = catalog.flavors.filter((f) => f.type === "SALGADA");
  const doces = catalog.flavors.filter((f) => f.type === "DOCE");
  const bebidas = catalog.products.filter((p) => p.category === "BEBIDA");

  return (
    <div>
      <h1 className="text-2xl font-display font-semibold text-char mb-6">Cardápio</h1>

      <CategorySection title="Salgadas" items={salgadas} priceField="extraPrice" onSave={saveFlavor} />
      <CategorySection title="Doces" items={doces} priceField="extraPrice" onSave={saveFlavor} />
      <CategorySection title="Bebidas" items={bebidas} priceField="price" onSave={saveProduct} />
      <CategorySection title="Bordas" items={catalog.borders} priceField="price" onSave={saveBorder} />
    </div>
  );
}
