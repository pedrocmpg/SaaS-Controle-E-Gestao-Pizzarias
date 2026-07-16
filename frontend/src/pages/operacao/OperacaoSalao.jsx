import { useCallback, useEffect, useState } from "react";
import { salaoService } from "../../services/api";
import ComandaModal from "./ComandaModal";

const STATUS_LABEL = { LIVRE: "Livre", OCUPADA: "Ocupada" };

export default function OperacaoSalao() {
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comandaId, setComandaId] = useState(null);

  const loadMesas = useCallback(() => {
    setLoading(true);
    salaoService
      .getMesas()
      .then(setMesas)
      .catch(() => setError("Não foi possível carregar as mesas."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadMesas();
  }, [loadMesas]);

  async function handleMesaClick(mesa) {
    setError(null);
    if (mesa.status === "OCUPADA") {
      if (mesa.comandaAberta) setComandaId(mesa.comandaAberta.id);
      return;
    }
    try {
      const comanda = await salaoService.abrirMesa(mesa.numero);
      setComandaId(comanda.id);
      loadMesas();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível abrir a mesa.");
    }
  }

  function handleComandaClosed() {
    setComandaId(null);
    loadMesas();
  }

  return (
    <div>
      <h1 className="text-2xl font-display font-semibold text-char mb-6">Salão</h1>

      {error && (
        <p className="text-red-500 mb-4 cursor-pointer text-sm" onClick={() => setError(null)}>
          {error} (clique para dispensar)
        </p>
      )}

      {loading ? (
        <p className="text-ink-soft text-sm">Carregando mesas...</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
          {mesas.map((mesa) => {
            const ocupada = mesa.status === "OCUPADA";
            return (
              <button
                key={mesa.id}
                onClick={() => handleMesaClick(mesa)}
                className={`card p-5 text-left transition hover:shadow-md ${
                  ocupada ? "border-ember-500/40 bg-ember-500/5" : ""
                }`}
              >
                <p className="text-2xl font-display font-semibold text-char">Mesa {mesa.numero}</p>
                <p className={`text-xs font-semibold mt-1 ${ocupada ? "text-ember-600" : "text-basil"}`}>
                  {STATUS_LABEL[mesa.status]}
                </p>
                {ocupada && mesa.comandaAberta && (
                  <p className="text-sm font-mono text-ink-soft mt-2">
                    R$ {Number(mesa.comandaAberta.totalPrice).toFixed(2)}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {comandaId && <ComandaModal comandaId={comandaId} onClose={() => setComandaId(null)} onClosed={handleComandaClosed} />}
    </div>
  );
}
