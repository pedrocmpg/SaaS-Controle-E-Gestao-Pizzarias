import { useEffect, useState } from "react";
import { salaoService, pdvConfigService, catalogService } from "../../services/api";
import MontadorPizzaModal from "./MontadorPizzaModal";

const PAYMENT_METHODS = [
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "PIX", label: "PIX" },
  { value: "CARTAO_CREDITO", label: "Cartão de crédito" },
  { value: "CARTAO_DEBITO", label: "Cartão de débito" },
];

const inputClass = "w-full border border-flour-2 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-char";

/**
 * Modal da comanda: grade de grupos/botões configurável (spec-5) — clique num
 * grupo mostra seus botões; clique num botão lança direto (PRODUTO) ou abre o
 * montador (PIZZA). Produtos de categoria RODIZIO pedem quantidade antes de lançar.
 */
export default function ComandaModal({ comandaId, onClose, onClosed }) {
  const [comanda, setComanda] = useState(null);
  const [grupos, setGrupos] = useState([]);
  const [productsById, setProductsById] = useState({});
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [grupoAbertoId, setGrupoAbertoId] = useState(null);
  const [botaoPizza, setBotaoPizza] = useState(null);
  const [botaoRodizio, setBotaoRodizio] = useState(null);
  const [quantidadeRodizio, setQuantidadeRodizio] = useState(1);

  const [paymentMethod, setPaymentMethod] = useState("DINHEIRO");
  const [showFechar, setShowFechar] = useState(false);

  function reload() {
    return salaoService.getComanda(comandaId).then(setComanda);
  }

  useEffect(() => {
    Promise.all([
      reload(),
      pdvConfigService.getGrupos().then((gs) => setGrupos(gs.filter((g) => g.ativo))),
      pdvConfigService.getLojaConfig().then(setConfig),
      catalogService.getProducts().then((products) => {
        setProductsById(Object.fromEntries(products.map((p) => [p.id, p])));
      }),
    ])
      .catch(() => setError("Não foi possível carregar a comanda."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comandaId]);

  async function lancarProduto(botao, quantidade = 1) {
    setBusy(true);
    setError(null);
    try {
      await salaoService.addItemProduto(comandaId, { botaoId: botao.id, quantidade });
      await reload();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível adicionar o item.");
    } finally {
      setBusy(false);
    }
  }

  function handleBotaoClick(botao) {
    if (botao.tipo === "PIZZA") {
      setBotaoPizza(botao);
      return;
    }
    const product = productsById[botao.productId];
    if (product?.category === "RODIZIO") {
      setBotaoRodizio(botao);
      setQuantidadeRodizio(1);
      return;
    }
    lancarProduto(botao, 1);
  }

  async function confirmarRodizio() {
    await lancarProduto(botaoRodizio, Number(quantidadeRodizio) || 1);
    setBotaoRodizio(null);
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

  const grupoAberto = grupos.find((g) => g.id === grupoAbertoId) || null;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-flour-2 flex-shrink-0">
          <h2 className="text-lg font-display font-semibold text-char">
            {comanda?.numeroMesa != null ? `Mesa ${comanda.numeroMesa}` : "Balcão"}
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
                      <li key={item.id} className="px-3 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span>
                            {item.quantidade}x {item.descricao}
                          </span>
                          <span className="flex items-center gap-3">
                            <span className="font-mono">R$ {(Number(item.unitPrice) * item.quantidade).toFixed(2)}</span>
                            <button
                              onClick={() => removeItem(item.id)}
                              disabled={busy}
                              className="text-red-500 hover:text-red-600 disabled:opacity-50"
                              aria-label="Remover item"
                            >
                              ✕
                            </button>
                          </span>
                        </div>
                        {item.sabroesSnapshot?.length > 0 && (
                          <p className="text-xs text-ink-soft mt-1">
                            {item.sabroesSnapshot.map((s) => s.nome).join(", ")}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {grupos.length === 0 ? (
                <p className="text-ink-soft text-sm">Nenhum grupo configurado na grade do PDV.</p>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-ink-soft mb-2">Grupos</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {grupos.map((grupo) => (
                      <button
                        key={grupo.id}
                        onClick={() => setGrupoAbertoId(grupo.id === grupoAbertoId ? null : grupo.id)}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold transition"
                        style={{
                          backgroundColor: grupo.id === grupoAbertoId ? grupo.cor || "#E67E22" : "transparent",
                          color: grupo.id === grupoAbertoId ? grupo.corFonte || "#FFFFFF" : undefined,
                          border: `1px solid ${grupo.cor || "#9CA3AF"}`,
                        }}
                      >
                        {grupo.nome}
                      </button>
                    ))}
                  </div>

                  {grupoAberto && (
                    <div className="flex flex-wrap gap-2">
                      {(grupoAberto.botoes || [])
                        .filter((b) => b.ativo)
                        .map((botao) => (
                          <button
                            key={botao.id}
                            onClick={() => handleBotaoClick(botao)}
                            disabled={busy}
                            className="px-3 py-2 rounded-lg text-xs font-semibold border border-flour-2 hover:bg-flour-2 disabled:opacity-50"
                            style={{ backgroundColor: botao.cor || undefined }}
                          >
                            {botao.labelBotao}
                          </button>
                        ))}
                    </div>
                  )}
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

      {botaoPizza && (
        <MontadorPizzaModal
          comandaId={comandaId}
          botao={botaoPizza}
          usaBorda={!!config?.usaBorda}
          onClose={() => setBotaoPizza(null)}
          onAdded={async () => {
            setBotaoPizza(null);
            await reload();
          }}
        />
      )}

      {botaoRodizio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-xs">
            <p className="text-sm font-semibold text-char mb-3">{botaoRodizio.labelBotao}</p>
            <label className="block mb-4">
              <span className="block text-xs text-ink-soft mb-1">Quantidade</span>
              <input
                type="number"
                min="1"
                className={inputClass}
                value={quantidadeRodizio}
                onChange={(e) => setQuantidadeRodizio(e.target.value)}
                autoFocus
              />
            </label>
            <div className="flex gap-3">
              <button onClick={() => setBotaoRodizio(null)} className="btn-secondary text-sm flex-1">
                Cancelar
              </button>
              <button onClick={confirmarRodizio} disabled={busy} className="btn-primary text-sm flex-1 disabled:opacity-50">
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
