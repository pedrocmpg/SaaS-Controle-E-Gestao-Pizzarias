import { useEffect, useState } from "react";
import { catalogService, salaoService } from "../../services/api";

const inputClass = "w-full border border-flour-2 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-char";

/**
 * Montador de pizza: seleção de sabores (limitada a pizzaSize.maxFlavors) e,
 * se LojaConfig.usaBorda, seleção de borda. Confirma lançando o item na comanda.
 */
export default function MontadorPizzaModal({ comandaId, botao, usaBorda, onClose, onAdded }) {
  const [flavors, setFlavors] = useState([]);
  const [borders, setBorders] = useState([]);
  const [saboresSelecionados, setSaboresSelecionados] = useState([]);
  const [borderId, setBorderId] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // maxFlavors vem de PizzaSize (relação incluída em /pdv-config/grupos). Se a
  // relação não vier, cair em 1 silenciosamente esconde o problema — avisamos.
  const maxFlavors = botao.pizzaSize?.maxFlavors ?? null;
  const maxFlavorsInvalido = maxFlavors == null;
  const limiteSabores = maxFlavors ?? 1;

  useEffect(() => {
    Promise.all([
      catalogService.getFlavors().then(setFlavors),
      usaBorda ? catalogService.getBorders().then(setBorders) : Promise.resolve([]),
    ])
      .catch(() => setError("Não foi possível carregar sabores/bordas."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSabor(id) {
    setSaboresSelecionados((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= limiteSabores) return prev;
      return [...prev, id];
    });
  }

  async function handleConfirmar() {
    if (saboresSelecionados.length === 0) {
      setError("Selecione ao menos um sabor.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await salaoService.addItemPizza(comandaId, {
        botaoId: botao.id,
        sabores: saboresSelecionados,
        borderId: borderId ? Number(borderId) : null,
        quantidade: Number(quantidade) || 1,
      });
      onAdded();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível adicionar a pizza.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-flour-2 flex-shrink-0">
          <h2 className="text-lg font-display font-semibold text-char">{botao.labelBotao}</h2>
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
                {maxFlavorsInvalido && (
                  <p className="text-xs text-red-500 mb-2">
                    Não foi possível ler o máximo de sabores deste tamanho — limitado a 1. Verifique o cadastro do
                    tamanho na grade do PDV.
                  </p>
                )}
                <p className="text-xs font-semibold text-ink-soft mb-2">
                  Sabores (até {limiteSabores}) · {saboresSelecionados.length}/{limiteSabores}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {flavors.map((flavor) => {
                    const selecionado = saboresSelecionados.includes(flavor.id);
                    const desabilitado = !selecionado && saboresSelecionados.length >= limiteSabores;
                    return (
                      <button
                        key={flavor.id}
                        type="button"
                        onClick={() => toggleSabor(flavor.id)}
                        disabled={desabilitado}
                        className={`text-left px-3 py-2 rounded-lg text-xs border transition disabled:opacity-40 ${
                          selecionado ? "border-ember-500 bg-ember-500/10 font-semibold" : "border-flour-2 hover:bg-flour-2/40"
                        }`}
                      >
                        {flavor.name}
                        {Number(flavor.extraPrice) > 0 && (
                          <span className="block text-ink-soft font-mono">+R$ {Number(flavor.extraPrice).toFixed(2)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {usaBorda && borders.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ink-soft mb-2">Borda (opcional)</p>
                  <select className={inputClass} value={borderId} onChange={(e) => setBorderId(e.target.value)}>
                    <option value="">Sem borda</option>
                    {borders.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} · +R$ {Number(b.price).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-ink-soft mb-2">Quantidade</p>
                <input
                  type="number"
                  min="1"
                  className={`${inputClass} w-24`}
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {!loading && (
          <div className="flex items-center justify-end gap-2 p-4 border-t border-flour-2 flex-shrink-0">
            <button onClick={onClose} className="btn-secondary text-sm">
              Cancelar
            </button>
            <button onClick={handleConfirmar} disabled={busy} className="btn-primary text-sm disabled:opacity-50">
              {busy ? "Adicionando..." : "Adicionar à comanda"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
