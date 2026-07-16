import { useEffect, useMemo, useState } from "react";
import { catalogService, ordersService } from "../../services/api";
import PizzaBuilderModal from "../../components/PizzaBuilderModal";

const PAYMENT_METHODS = [
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "PIX", label: "PIX" },
  { value: "CARTAO_CREDITO", label: "Cartão de crédito" },
  { value: "CARTAO_DEBITO", label: "Cartão de débito" },
];

const inputClass =
  "w-full border border-flour-2 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-char";

/**
 * Modal de criação de tele-entrega pelo atendente.
 * Reaproveita o catálogo (catalogService) e o PizzaBuilderModal (via onAdd),
 * mantendo os itens numa lista local — sem tocar no carrinho da vitrine pública.
 */
export default function NovoPedidoModal({ onClose, onCreated }) {
  const [catalog, setCatalog] = useState({ pizzaSizes: [], flavors: [], borders: [], products: [] });
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const [items, setItems] = useState([]);
  const [builderSize, setBuilderSize] = useState(null);

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState("ENTREGA");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("DINHEIRO");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [notes, setNotes] = useState("");

  const [lookupStatus, setLookupStatus] = useState(null); // null | "found" | "new"
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    catalogService
      .getAll()
      .then((data) =>
        setCatalog({
          pizzaSizes: data.pizzaSizes || [],
          flavors: data.flavors || [],
          borders: data.borders || [],
          products: data.products || [],
        })
      )
      .catch(() => setError("Não foi possível carregar o cardápio."))
      .finally(() => setLoadingCatalog(false));
  }, []);

  const itemsTotal = useMemo(
    () => items.reduce((sum, i) => sum + Number(i.unitPrice) * Number(i.quantity), 0),
    [items]
  );
  const fee = deliveryType === "ENTREGA" ? Number(deliveryFee) || 0 : 0;
  const total = itemsTotal + fee;

  function addLocalItem(item) {
    setItems((prev) => [...prev, item]);
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function addProduct(product) {
    addLocalItem({
      itemName: product.name,
      itemType: product.category, // COMBO | BEBIDA | ESPECIAL
      flavors: null,
      borderName: null,
      quantity: 1,
      unitPrice: Number(product.price),
      observations: null,
    });
  }

  async function handlePhoneBlur() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setLookupStatus(null);
      return;
    }
    try {
      const res = await ordersService.lookupCliente(phone);
      if (res.found) {
        setLookupStatus("found");
        if (res.cliente.name) setCustomerName(res.cliente.name);
        if (res.cliente.address) setAddress(res.cliente.address);
      } else {
        setLookupStatus("new");
      }
    } catch {
      setLookupStatus(null);
    }
  }

  function validate() {
    if (customerName.trim().length < 2) return "Informe o nome do cliente.";
    if (phone.replace(/\D/g, "").length < 10) return "Telefone inválido.";
    if (deliveryType === "ENTREGA" && address.trim().length < 3) return "Informe o endereço de entrega.";
    if (items.length === 0) return "Adicione pelo menos um item.";
    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);

    const payload = {
      customerName: customerName.trim(),
      phone: phone.trim(),
      address: deliveryType === "ENTREGA" ? address.trim() : null,
      deliveryType,
      paymentMethod,
      notes: notes.trim() || null,
      deliveryFee: fee,
      origem: "TELEFONE",
      items: items.map((i) => ({
        itemName: i.itemName,
        itemType: i.itemType,
        flavors: i.flavors || null,
        borderName: i.borderName || null,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        observations: i.observations || null,
      })),
    };

    try {
      const order = await ordersService.create(payload);
      onCreated?.(order);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível criar o pedido.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-3xl sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-flour-2 flex-shrink-0">
          <h2 className="text-lg font-display font-semibold text-char">Novo pedido</h2>
          <button onClick={onClose} className="text-2xl leading-none text-ink-soft hover:text-char px-2" aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {error && (
            <p className="text-red-500 text-sm cursor-pointer" onClick={() => setError(null)}>
              {error} (clique para dispensar)
            </p>
          )}

          {/* Dados do cliente */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">Telefone</label>
              <input
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={handlePhoneBlur}
                placeholder="(54) 99999-1234"
              />
              {lookupStatus === "found" && (
                <p className="text-xs text-basil mt-1">Cliente encontrado — dados preenchidos.</p>
              )}
              {lookupStatus === "new" && <p className="text-xs text-ink-soft mt-1">Cliente novo.</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">Cliente</label>
              <input
                className={inputClass}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nome do cliente"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">Tipo</label>
              <select className={inputClass} value={deliveryType} onChange={(e) => setDeliveryType(e.target.value)}>
                <option value="ENTREGA">Entrega</option>
                <option value="RETIRADA">Retirada</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-soft mb-1">Forma de pagamento</label>
              <select className={inputClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {PAYMENT_METHODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {deliveryType === "ENTREGA" && (
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-ink-soft mb-1">Endereço</label>
                <input
                  className={inputClass}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, número, bairro"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-soft mb-1">Taxa de entrega (R$)</label>
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.01"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
          )}

          {/* Itens */}
          <div>
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2">Itens do pedido</h3>

            {items.length === 0 ? (
              <p className="text-ink-soft text-sm mb-3">Nenhum item adicionado.</p>
            ) : (
              <ul className="mb-3 divide-y divide-flour-2 border border-flour-2 rounded-lg">
                {items.map((item, index) => (
                  <li key={index} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>
                      {item.quantity}x {item.itemName}
                      {Array.isArray(item.flavors) && item.flavors.length > 0 && (
                        <span className="text-ink-soft"> — {item.flavors.join(", ")}</span>
                      )}
                      {item.borderName && <span className="text-ink-soft"> · borda {item.borderName}</span>}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-mono">R$ {(Number(item.unitPrice) * Number(item.quantity)).toFixed(2)}</span>
                      <button onClick={() => removeItem(index)} className="text-red-500 hover:text-red-600" aria-label="Remover item">
                        ✕
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {loadingCatalog ? (
              <p className="text-ink-soft text-sm">Carregando cardápio...</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-ink-soft mb-1">Montar pizza</p>
                  <div className="flex flex-wrap gap-2">
                    {catalog.pizzaSizes.map((size) => (
                      <button
                        key={size.id}
                        onClick={() => setBuilderSize(size)}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold border border-flour-2 hover:bg-flour-2"
                      >
                        {size.name} · R$ {Number(size.price).toFixed(2)}
                      </button>
                    ))}
                  </div>
                </div>

                {catalog.products.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-ink-soft mb-1">Bebidas e combos</p>
                    <div className="flex flex-wrap gap-2">
                      {catalog.products.map((product) => (
                        <button
                          key={product.id}
                          onClick={() => addProduct(product)}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold border border-flour-2 hover:bg-flour-2"
                        >
                          + {product.name} · R$ {Number(product.price).toFixed(2)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-ink-soft mb-1">Observações</label>
            <textarea
              className={inputClass}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: troco para R$ 100, sem cebola..."
            />
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between gap-4 p-4 border-t border-flour-2 flex-shrink-0">
          <div className="text-sm">
            <span className="text-ink-soft">Total: </span>
            <span className="font-mono font-semibold text-char">R$ {total.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary text-sm">
              Cancelar
            </button>
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary text-sm disabled:opacity-50">
              {submitting ? "Salvando..." : "Criar pedido"}
            </button>
          </div>
        </div>
      </div>

      {builderSize && (
        <PizzaBuilderModal
          size={builderSize}
          flavors={catalog.flavors}
          borders={catalog.borders}
          onClose={() => setBuilderSize(null)}
          onAdd={(item) => {
            addLocalItem(item);
            setBuilderSize(null);
          }}
        />
      )}
    </div>
  );
}
