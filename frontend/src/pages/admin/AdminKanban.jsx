import { useCallback, useEffect, useRef, useState } from "react";
import { ordersService } from "../../services/api";
import { connectSocket } from "../../services/socket";
import {
  STATUS_FLOW,
  TERMINAL_STATUSES,
  statusLabels,
  columnAccent,
  getNextStatus,
} from "../../services/orderStatus";
import { StatusBadge } from "../../components/ui/Badge";

// Colunas do Kanban: fluxo + cancelados (visualmente separado)
const COLUMNS = [...STATUS_FLOW, "CANCELADO"];

// Beep curto via WebAudio (sem asset externo)
function playNewOrderSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1175, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.36);
    osc.onended = () => ctx.close();
  } catch {
    // silencioso se o navegador bloquear áudio
  }
}

export default function AdminKanban() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [highlighted, setHighlighted] = useState(() => new Set());
  const highlightTimers = useRef({});

  const loadOrders = useCallback(() => {
    setLoading(true);
    ordersService
      .list({ pageSize: 100 })
      .then((data) => setOrders(data.orders))
      .catch(() => setError("Não foi possível carregar os pedidos."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Marca um pedido como "novo" por alguns segundos (destaque visual)
  const highlight = useCallback((id) => {
    setHighlighted((prev) => new Set(prev).add(id));
    clearTimeout(highlightTimers.current[id]);
    highlightTimers.current[id] = setTimeout(() => {
      setHighlighted((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 6000);
  }, []);

  // Conexão em tempo real
  useEffect(() => {
    const socket = connectSocket();

    const onNovo = (order) => {
      setOrders((prev) => {
        if (prev.some((o) => o.id === order.id)) return prev;
        return [order, ...prev];
      });
      highlight(order.id);
      playNewOrderSound();
    };

    const onStatus = (order) => {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...order } : o)));
    };

    socket.on("pedido:novo", onNovo);
    socket.on("pedido:status_atualizado", onStatus);

    return () => {
      socket.off("pedido:novo", onNovo);
      socket.off("pedido:status_atualizado", onStatus);
    };
  }, [highlight]);

  useEffect(() => {
    const timers = highlightTimers.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  async function changeStatus(orderId, newStatus) {
    // Atualização otimista, revertida em caso de erro
    const previous = orders;
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
    try {
      const updated = await ordersService.updateStatus(orderId, newStatus);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)));
    } catch (err) {
      setOrders(previous);
      setError(err.response?.data?.error || "Não foi possível atualizar o status.");
    }
  }

  const ordersByStatus = (status) => orders.filter((o) => o.status === status);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <h1 className="text-2xl font-display font-semibold text-char">Pedidos</h1>
        <button onClick={loadOrders} className="btn-secondary text-sm">
          Atualizar
        </button>
      </div>

      {error && (
        <p className="text-red-500 mb-4 cursor-pointer" onClick={() => setError(null)}>
          {error} (clique para dispensar)
        </p>
      )}

      {loading ? (
        <p className="text-gray-500">Carregando pedidos...</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((status) => {
            const columnOrders = ordersByStatus(status);
            return (
              <section
                key={status}
                className={`flex-shrink-0 w-80 bg-white/60 rounded-2xl border-t-4 ${columnAccent[status]} p-3`}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <h2 className="font-semibold text-char">{statusLabels[status]}</h2>
                  <span className="text-xs font-semibold text-gray-500 bg-white rounded-full px-2 py-0.5">
                    {columnOrders.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {columnOrders.length === 0 ? (
                    <p className="text-xs text-gray-400 px-1 py-6 text-center">Sem pedidos</p>
                  ) : (
                    columnOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        highlighted={highlighted.has(order.id)}
                        onAdvance={changeStatus}
                        onCancel={changeStatus}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, highlighted, onAdvance, onCancel }) {
  const next = getNextStatus(order.status);
  const isTerminal = TERMINAL_STATUSES.includes(order.status);

  return (
    <div
      className={`card p-4 animate-scale-in ${
        highlighted ? "ring-2 ring-accent-500 shadow-lg" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-brand-900 text-sm">
            #{order.id} · {order.customerName}
          </p>
          <p className="text-xs text-gray-500">{order.phone}</p>
          {order.address && <p className="text-xs text-gray-500">{order.address}</p>}
        </div>
        <StatusBadge domain="pedido" value={order.status} className="text-[10px] px-2 py-0.5" />
      </div>

      <ul className="mt-3 border-t border-black/5 pt-2 space-y-1 text-xs text-gray-700">
        {order.items?.map((item) => (
          <li key={item.id}>
            {item.quantity}x {item.itemName}
            {item.flavors?.length > 0 && (
              <span className="text-gray-500"> — {item.flavors.join(", ")}</span>
            )}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between mt-3">
        <p className="font-price font-bold text-accent-600 text-sm">
          R$ {Number(order.totalPrice).toFixed(2)}
        </p>
        <span className="text-[10px] text-gray-400">
          {new Date(order.createdAt).toLocaleString("pt-BR")}
        </span>
      </div>

      {!isTerminal && (
        <div className="flex items-center gap-2 mt-3">
          {next && (
            <button
              onClick={() => onAdvance(order.id, next)}
              className="btn-primary text-xs flex-1 py-1.5"
            >
              Avançar → {statusLabels[next]}
            </button>
          )}
          <button
            onClick={() => onCancel(order.id, "CANCELADO")}
            className="text-xs font-semibold text-red-500 hover:underline px-2"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
