import { useCallback, useEffect, useState } from "react";
import { motoboyService } from "../../services/api";
import { connectSocket } from "../../services/socket";

const inputClass =
  "w-full border border-flour-2 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-char";

export default function OperacaoDespacho() {
  const [pedidos, setPedidos] = useState([]);
  const [motoboys, setMotoboys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selecionado, setSelecionado] = useState({}); // orderId -> motoboyId escolhido

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([motoboyService.getDespacho(), motoboyService.getLista()])
      .then(([pedidosData, motoboysData]) => {
        setPedidos(pedidosData);
        setMotoboys(motoboysData);
      })
      .catch(() => setError("Não foi possível carregar o despacho."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Tempo real: pedido despachado/entregue atualiza a lista sozinho.
  useEffect(() => {
    const socket = connectSocket();

    const onAtribuido = (order) => setPedidos((prev) => [order, ...prev.filter((p) => p.id !== order.id)]);
    const onEntregue = (order) => setPedidos((prev) => prev.filter((p) => p.id !== order.id));

    socket.on("despacho:atribuido", onAtribuido);
    socket.on("despacho:entregue", onEntregue);

    return () => {
      socket.off("despacho:atribuido", onAtribuido);
      socket.off("despacho:entregue", onEntregue);
    };
  }, []);

  async function despachar(orderId) {
    const motoboyId = selecionado[orderId];
    if (!motoboyId) {
      setError("Selecione um motoboy para despachar.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await motoboyService.despachar(orderId, Number(motoboyId));
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível despachar o pedido.");
    } finally {
      setBusy(false);
    }
  }

  async function marcarEntregue(orderId) {
    setBusy(true);
    setError(null);
    try {
      await motoboyService.marcarEntregue(orderId);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível marcar como entregue.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-ink-soft text-sm">Carregando despacho...</p>;
  }

  const porMotoboy = pedidos.reduce((acc, p) => {
    const key = p.motoboy ? p.motoboy.name : "Sem motoboy atribuído";
    (acc[key] ||= []).push(p);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="text-2xl font-display font-semibold text-char mb-6">Despacho</h1>

      {error && (
        <p className="text-red-500 mb-4 cursor-pointer text-sm" onClick={() => setError(null)}>
          {error} (clique para dispensar)
        </p>
      )}

      {pedidos.length === 0 ? (
        <p className="text-ink-soft text-sm">Nenhum pedido em rota no momento.</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(porMotoboy).map(([nome, lista]) => (
            <div key={nome}>
              <h2 className="text-sm font-semibold text-ink-soft mb-2">
                {nome} · {lista.length} entrega{lista.length > 1 ? "s" : ""} em rota
              </h2>
              <div className="space-y-3">
                {lista.map((p) => (
                  <div key={p.id} className="card p-4 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-sm font-semibold text-char">{p.customerName}</p>
                      <p className="text-xs text-ink-soft">Pedido #{p.id}</p>
                    </div>

                    {!p.motoboyId ? (
                      <div className="flex items-center gap-2">
                        <select
                          className={`${inputClass} w-48`}
                          value={selecionado[p.id] || ""}
                          onChange={(e) => setSelecionado((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        >
                          <option value="">Escolher motoboy</option>
                          {motoboys.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        <button onClick={() => despachar(p.id)} disabled={busy} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                          Despachar
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => marcarEntregue(p.id)} disabled={busy} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                        Marcar entregue
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
