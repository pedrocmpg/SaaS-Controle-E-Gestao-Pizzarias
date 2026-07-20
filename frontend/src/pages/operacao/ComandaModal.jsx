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
const brl = (v) => `R$ ${Number(v || 0).toFixed(2)}`;

/**
 * PDV de tela cheia da comanda (spec-5). Layout de caixa:
 * - Esquerda: grade de grupos (abas) + botões sempre visíveis. Clique lança
 *   direto (PRODUTO) ou abre o montador (PIZZA); RODIZIO pede quantidade.
 * - Direita: comanda fixa, com editar quantidade (+/-), remover (com confirmação)
 *   e fechamento (resumo + cálculo de troco quando dinheiro).
 * Mantém o nome/props (comandaId, onClose, onClosed) usados por OperacaoSalao.
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
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);

  // Fechamento
  const [showFechar, setShowFechar] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("DINHEIRO");
  const [valorRecebido, setValorRecebido] = useState("");

  function reload() {
    return salaoService.getComanda(comandaId).then(setComanda);
  }

  useEffect(() => {
    Promise.all([
      reload(),
      pdvConfigService.getGrupos().then((gs) => {
        const ativos = gs.filter((g) => g.ativo);
        setGrupos(ativos);
        if (ativos.length > 0) setGrupoAbertoId(ativos[0].id); // primeiro grupo já aberto
      }),
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

  async function alterarQuantidade(item, delta) {
    const nova = item.quantidade + delta;
    if (nova < 1) {
      // Chegou a zero: trata como remoção (com confirmação).
      setConfirmRemoveId(item.id);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await salaoService.updateItemQuantidade(comandaId, item.id, nova);
      await reload();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível alterar a quantidade.");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(itemId) {
    setBusy(true);
    setError(null);
    try {
      await salaoService.removeItem(comandaId, itemId);
      setConfirmRemoveId(null);
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
  const total = comanda ? Number(comanda.totalPrice) : 0;
  const qtdItens = comanda ? comanda.itens.reduce((s, i) => s + i.quantidade, 0) : 0;

  // Troco (só faz sentido pra dinheiro).
  const recebidoNum = parseFloat(valorRecebido.replace(",", "."));
  const troco = paymentMethod === "DINHEIRO" && !isNaN(recebidoNum) ? recebidoNum - total : null;

  return (
    <div className="fixed inset-0 z-40 bg-flour flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-flour-2 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-2xl leading-none text-ink-soft hover:text-char" aria-label="Voltar">
            ←
          </button>
          <h2 className="text-lg font-display font-semibold text-char">
            {comanda?.numeroMesa != null ? `Mesa ${comanda.numeroMesa}` : "Balcão"}
          </h2>
        </div>
        <span className="text-sm text-ink-soft">
          {qtdItens} {qtdItens === 1 ? "item" : "itens"}
        </span>
      </div>

      {error && (
        <p className="text-red-500 text-sm cursor-pointer px-4 sm:px-6 py-2 bg-red-50" onClick={() => setError(null)}>
          {error} (clique para dispensar)
        </p>
      )}

      {loading ? (
        <p className="text-ink-soft text-sm p-6">Carregando...</p>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* ESQUERDA: grade de produtos */}
          <div className="flex-1 flex flex-col overflow-hidden border-b lg:border-b-0 lg:border-r border-flour-2">
            {grupos.length === 0 ? (
              <p className="text-ink-soft text-sm p-6">Nenhum grupo configurado na grade do PDV.</p>
            ) : (
              <>
                {/* Abas de grupos — sempre visíveis */}
                <div className="flex gap-2 overflow-x-auto px-4 sm:px-6 py-3 flex-shrink-0 border-b border-flour-2">
                  {grupos.map((grupo) => {
                    const ativo = grupo.id === grupoAbertoId;
                    return (
                      <button
                        key={grupo.id}
                        onClick={() => setGrupoAbertoId(grupo.id)}
                        className="px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition"
                        style={{
                          backgroundColor: ativo ? grupo.cor || "#E67E22" : "transparent",
                          color: ativo ? grupo.corFonte || "#FFFFFF" : undefined,
                          border: `1px solid ${grupo.cor || "#9CA3AF"}`,
                        }}
                      >
                        {grupo.nome}
                      </button>
                    );
                  })}
                </div>

                {/* Botões do grupo aberto — grade grande */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                  {grupoAberto && (grupoAberto.botoes || []).filter((b) => b.ativo).length === 0 ? (
                    <p className="text-ink-soft text-sm">Nenhum botão neste grupo.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                      {(grupoAberto?.botoes || [])
                        .filter((b) => b.ativo)
                        .map((botao) => (
                          <button
                            key={botao.id}
                            onClick={() => handleBotaoClick(botao)}
                            disabled={busy}
                            className="aspect-square rounded-xl text-sm font-semibold border border-flour-2 hover:shadow-md hover:border-ember-500/50 disabled:opacity-50 transition flex items-center justify-center text-center p-3 bg-white"
                            style={{ backgroundColor: botao.cor || undefined }}
                          >
                            {botao.labelBotao}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* DIREITA: comanda fixa */}
          <div className="w-full lg:w-96 flex flex-col bg-white overflow-hidden flex-shrink-0">
            <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wide px-4 py-3 border-b border-flour-2 flex-shrink-0">
              Itens da comanda
            </h3>

            <div className="flex-1 overflow-y-auto px-4 py-2">
              {comanda.itens.length === 0 ? (
                <p className="text-ink-soft text-sm py-4">Nenhum item adicionado.</p>
              ) : (
                <ul className="divide-y divide-flour-2">
                  {comanda.itens.map((item) => (
                    <li key={item.id} className="py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm text-char truncate">{item.descricao}</p>
                          {item.sabroesSnapshot?.length > 0 && (
                            <p className="text-xs text-ink-soft mt-0.5">
                              {item.sabroesSnapshot.map((s) => s.nome).join(", ")}
                            </p>
                          )}
                          <p className="text-xs text-ink-soft font-mono mt-0.5">{brl(item.unitPrice)} un.</p>
                        </div>
                        <span className="font-mono text-sm text-char whitespace-nowrap">
                          {brl(Number(item.unitPrice) * item.quantidade)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        {/* Stepper de quantidade */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => alterarQuantidade(item, -1)}
                            disabled={busy}
                            className="w-7 h-7 rounded-full border border-flour-2 text-ink-soft hover:border-char disabled:opacity-40 leading-none"
                            aria-label="Diminuir"
                          >
                            −
                          </button>
                          <span className="font-mono text-sm w-6 text-center">{item.quantidade}</span>
                          <button
                            onClick={() => alterarQuantidade(item, 1)}
                            disabled={busy}
                            className="w-7 h-7 rounded-full border border-flour-2 text-ink-soft hover:border-char disabled:opacity-40 leading-none"
                            aria-label="Aumentar"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => setConfirmRemoveId(item.id)}
                          disabled={busy}
                          className="text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
                        >
                          Remover
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Rodapé: total + ações / fechamento */}
            <div className="border-t border-flour-2 p-4 flex-shrink-0 space-y-3">
              {showFechar ? (
                <>
                  <div>
                    <p className="text-xs font-semibold text-ink-soft mb-1">Forma de pagamento</p>
                    <select
                      className={inputClass}
                      value={paymentMethod}
                      onChange={(e) => {
                        setPaymentMethod(e.target.value);
                        setValorRecebido("");
                      }}
                    >
                      {PAYMENT_METHODS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {paymentMethod === "DINHEIRO" && (
                    <div>
                      <p className="text-xs font-semibold text-ink-soft mb-1">Valor recebido (opcional)</p>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        className={inputClass}
                        value={valorRecebido}
                        onChange={(e) => setValorRecebido(e.target.value)}
                      />
                      {troco != null && (
                        <p className={`text-sm mt-1 font-mono ${troco < 0 ? "text-red-500" : "text-basil"}`}>
                          {troco < 0 ? `Falta ${brl(Math.abs(troco))}` : `Troco: ${brl(troco)}`}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm text-ink-soft">Total</span>
                    <span className="font-mono font-semibold text-char text-lg">{brl(total)}</span>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setShowFechar(false)} className="btn-secondary text-sm flex-1">
                      Voltar
                    </button>
                    <button onClick={fecharComanda} disabled={busy} className="btn-primary text-sm flex-1 disabled:opacity-50">
                      {busy ? "Fechando..." : "Confirmar"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-ink-soft">Total</span>
                    <span className="font-mono font-semibold text-char text-xl">{brl(total)}</span>
                  </div>
                  <button
                    onClick={() => setShowFechar(true)}
                    disabled={busy || comanda.itens.length === 0}
                    className="btn-primary text-sm w-full disabled:opacity-50"
                  >
                    Fechar comanda
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Montador de pizza */}
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

      {/* Quantidade de rodízio */}
      {botaoRodizio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-xs">
            <p className="text-sm font-semibold text-char mb-3">{botaoRodizio.labelBotao}</p>
            <label className="block mb-4">
              <span className="block text-xs text-ink-soft mb-1">Quantidade de pessoas</span>
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

      {/* Confirmação de remoção */}
      {confirmRemoveId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-xs">
            <p className="text-sm font-semibold text-char mb-1">Remover item?</p>
            <p className="text-xs text-ink-soft mb-4">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRemoveId(null)} className="btn-secondary text-sm flex-1">
                Cancelar
              </button>
              <button
                onClick={() => removeItem(confirmRemoveId)}
                disabled={busy}
                className="text-sm flex-1 rounded-full bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50 px-4 py-2"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
