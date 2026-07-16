import { useEffect, useState } from "react";
import { catalogService, salaoService } from "../../services/api";

const PAYMENT_METHODS = [
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "PIX", label: "PIX" },
  { value: "CARTAO_CREDITO", label: "Cartão de crédito" },
  { value: "CARTAO_DEBITO", label: "Cartão de débito" },
];

const FAIXA_LABEL = { ADULTO: "Adulto", CRIANCA: "Criança", MEIA: "Meia" };

const inputClass =
  "w-full border border-flour-2 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-char";

/**
 * Modal da comanda de uma mesa: adicionar rodízio/produtos e fechar com forma de pagamento.
 */
export default function ComandaModal({ comandaId, onClose, onClosed }) {
  const [comanda, setComanda] = useState(null);
  const [precos, setPrecos] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [faixaSelecionada, setFaixaSelecionada] = useState("ADULTO");
  const [quantidadeRodizio, setQuantidadeRodizio] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("DINHEIRO");
  const [showFechar, setShowFechar] = useState(false);

  function reload() {
    return salaoService.getComanda(comandaId).then(setComanda);
  }

  useEffect(() => {
    Promise.all([reload(), salaoService.getRodizioPrecos().then(setPrecos), catalogService.getProducts().then(setProducts)])
      .catch(() => setError("Não foi possível carregar a comanda."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comandaId]);

  async function addRodizio() {
    setBusy(true);
    setError(null);
    try {
      const updated = await salaoService.addItem(comandaId, {
        tipo: "RODIZIO",
        faixaRodizio: faixaSelecionada,
        quantity: Number(quantidadeRodizio) || 1,
      });
      setComanda(updated);
      await reload();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível adicionar o rodízio.");
    } finally {
      setBusy(false);
    }
  }

  async function addProduto(product) {
    setBusy(true);
    setError(null);
    try {
      await salaoService.addItem(comandaId, { tipo: "PRODUTO", productId: product.id, quantity: 1 });
      await reload();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível adicionar o item.");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(itemId) {
    setBusy(true);
    setError(null);
    try {
      await salaoService.removeItem(comandaId, itemId);
      await reload();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível remover o item.");
    } finally {
      setBusy(false);
    }
  }

  async function fecharComanda() {
    setBusy(true);
    setError(null);
    try {
      await salaoService.fecharComanda(comandaId, paymentMethod);
      onClosed?.();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível fechar a comanda.");
    } finally {
      setBusy(false);
    }
  }

  const precoAtivo = precos.find((p) => p.faixa === faixaSelecionada && p.active);
  const bebidasCombos = products.filter((p) => p.category === "BEBIDA" || p.category === "COMBO" || p.category === "ESPECIAL");

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-flour-2 flex-shrink-0">
          <h2 className="text-lg font-display font-semibold text-char">
            {comanda ? `Mesa ${comanda.mesa?.numero}` : "Comanda"}
          </h2>
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

          {loading ? (
            <p className="text-ink-soft text-sm">Carregando...</p>
          ) : (
            <>
              <div>
                <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2">Itens da comanda</h3>
                {comanda.itens.length === 0 ? (
                  <p className="text-ink-soft text-sm mb-3">Nenhum item adicionado.</p>
                ) : (
                  <ul className="mb-3 divide-y divide-flour-2 border border-flour-2 rounded-lg">
                    {comanda.itens.map((item) => (
                      <li key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span>
                          {item.quantity}x {item.descricao}
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="font-mono">R$ {(Number(item.unitPrice) * item.quantity).toFixed(2)}</span>
                          <button
                            onClick={() => removeItem(item.id)}
                            disabled={busy}
                            className="text-red-500 hover:text-red-600 disabled:opacity-50"
                            aria-label="Remover item"
                          >
                            ✕
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-ink-soft mb-1">Adicionar rodízio</p>
                <div className="flex flex-wrap items-end gap-2">
                  <select className={inputClass} value={faixaSelecionada} onChange={(e) => setFaixaSelecionada(e.target.value)}>
                    {precos.map((p) => (
                      <option key={p.faixa} value={p.faixa} disabled={!p.active}>
                        {FAIXA_LABEL[p.faixa]} · R$ {Number(p.preco).toFixed(2)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    className={`${inputClass} w-20`}
                    value={quantidadeRodizio}
                    onChange={(e) => setQuantidadeRodizio(e.target.value)}
                  />
                  <button onClick={addRodizio} disabled={busy || !precoAtivo} className="btn-primary text-sm px-3 py-2 disabled:opacity-50">
                    Adicionar
                  </button>
                </div>
              </div>

              {bebidasCombos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ink-soft mb-1">Bebidas e combos</p>
                  <div className="flex flex-wrap gap-2">
                    {bebidasCombos.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => addProduto(product)}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold border border-flour-2 hover:bg-flour-2 disabled:opacity-50"
                      >
                        + {product.name} · R$ {Number(product.price).toFixed(2)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showFechar && (
                <div className="border border-flour-2 rounded-lg p-3">
                  <p className="text-xs font-semibold text-ink-soft mb-2">Forma de pagamento</p>
                  <select className={inputClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    {PAYMENT_METHODS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </div>

        {!loading && (
          <div className="flex items-center justify-between gap-4 p-4 border-t border-flour-2 flex-shrink-0">
            <div className="text-sm">
              <span className="text-ink-soft">Total: </span>
              <span className="font-mono font-semibold text-char">R$ {Number(comanda.totalPrice).toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="btn-secondary text-sm">
                Voltar
              </button>
              {showFechar ? (
                <button onClick={fecharComanda} disabled={busy} className="btn-primary text-sm disabled:opacity-50">
                  {busy ? "Fechando..." : "Confirmar fechamento"}
                </button>
              ) : (
                <button
                  onClick={() => setShowFechar(true)}
                  disabled={busy || comanda.itens.length === 0}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  Fechar comanda
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
