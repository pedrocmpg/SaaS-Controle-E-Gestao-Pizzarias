import { useCallback, useEffect, useState } from "react";
import { salaoService, pdvConfigService, impressaoService } from "../../services/api";
import BotaoImprimir from "../../components/BotaoImprimir";
import ComandaModal from "./ComandaModal";

export default function OperacaoSalao() {
  const [config, setConfig] = useState(null);
  const [comandas, setComandas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comandaId, setComandaId] = useState(null);
  const [numeroInput, setNumeroInput] = useState("");
  const [abrindo, setAbrindo] = useState(false);
  const [ultimaFechadaId, setUltimaFechadaId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([pdvConfigService.getLojaConfig().then(setConfig), salaoService.listComandas({ status: "ABERTA" }).then(setComandas)])
      .catch(() => setError("Não foi possível carregar as comandas."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function abrirComanda(numeroMesa) {
    setError(null);
    setAbrindo(true);
    try {
      const comanda = await salaoService.abrirComanda(numeroMesa);
      setNumeroInput("");
      setComandaId(comanda.id);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível abrir a comanda.");
    } finally {
      setAbrindo(false);
    }
  }

  function handleAbrirComMesa(e) {
    e.preventDefault();
    const numero = parseInt(numeroInput);
    if (isNaN(numero) || numero <= 0) {
      setError("Informe um número de mesa válido.");
      return;
    }
    abrirComanda(numero);
  }

  function handleComandaClosed(fechadaId) {
    setComandaId(null);
    // Guarda a última fechada só para oferecer a 2ª via: a comanda some da grade ao fechar
    // (a grade lista as abertas), e sem isso não haveria de onde reimprimir o cupom.
    setUltimaFechadaId(fechadaId ?? null);
    load();
  }

  const usaMesa = config?.usaMesa ?? true;

  return (
    <div>
      <h1 className="text-2xl font-display font-semibold text-char mb-6">Salão</h1>

      {error && (
        <p className="text-red-500 mb-4 cursor-pointer text-sm" onClick={() => setError(null)}>
          {error} (clique para dispensar)
        </p>
      )}

      {ultimaFechadaId && (
        <div className="card p-3 mb-6 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-ink-soft">Comanda #{ultimaFechadaId} fechada. O cupom foi enviado à impressora.</span>
          <BotaoImprimir onImprimir={() => impressaoService.cupomComanda(ultimaFechadaId)}>
            Reimprimir cupom
          </BotaoImprimir>
          <button onClick={() => setUltimaFechadaId(null)} className="text-xs text-ink-soft hover:text-char underline">
            dispensar
          </button>
        </div>
      )}

      {!loading && (
        <div className="card p-4 mb-6">
          {usaMesa ? (
            <form onSubmit={handleAbrirComMesa} className="flex items-end gap-3">
              <label className="text-sm">
                <span className="block text-ink-soft mb-1">Número da mesa</span>
                <input
                  type="number"
                  min="1"
                  className="border border-flour-2 rounded-lg px-3 py-2 text-sm w-32"
                  value={numeroInput}
                  onChange={(e) => setNumeroInput(e.target.value)}
                />
              </label>
              <button type="submit" disabled={abrindo} className="btn-primary text-sm disabled:opacity-50">
                Abrir mesa
              </button>
            </form>
          ) : (
            <button onClick={() => abrirComanda(null)} disabled={abrindo} className="btn-primary text-sm disabled:opacity-50">
              Abrir comanda
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-ink-soft text-sm">Carregando comandas...</p>
      ) : comandas.length === 0 ? (
        <p className="text-ink-soft text-sm">Nenhuma comanda aberta.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
          {comandas.map((comanda) => (
            <button
              key={comanda.id}
              onClick={() => setComandaId(comanda.id)}
              className="card p-5 text-left transition hover:shadow-md border-ember-500/40 bg-ember-500/5"
            >
              <p className="text-2xl font-display font-semibold text-char">
                {comanda.numeroMesa != null ? `Mesa ${comanda.numeroMesa}` : "Balcão"}
              </p>
              <p className="text-xs font-semibold mt-1 text-ember-600">Aberta</p>
              <p className="text-sm font-mono text-ink-soft mt-2">R$ {Number(comanda.totalPrice).toFixed(2)}</p>
            </button>
          ))}
        </div>
      )}

      {comandaId && <ComandaModal comandaId={comandaId} onClose={() => setComandaId(null)} onClosed={handleComandaClosed} />}
    </div>
  );
}
