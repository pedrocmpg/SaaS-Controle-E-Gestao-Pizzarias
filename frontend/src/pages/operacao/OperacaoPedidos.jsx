import { useCallback, useEffect, useState } from "react";
import { ordersService } from "../../services/api";
import { getNextStatus } from "../../services/orderStatus";

const TABS = [
  { key: "TODOS", label: "Todos" },
  { key: "RECEBIDO", label: "Pendente" },
  { key: "EM_PREPARO", label: "Em preparo" },
  { key: "SAIU_PARA_ENTREGA", label: "Saiu para entrega" },
  { key: "ENTREGUE", label: "Entregue" },
];

// Cores de badge alinhadas ao design system do site (--melt, --ember, --basil).
const STATUS_BADGE = {
  RECEBIDO: "bg-melt/20 text-melt",
  EM_PREPARO: "bg-ember-500/15 text-ember-600",
  SAIU_PARA_ENTREGA: "bg-basil/15 text-basil",
  ENTREGUE: "bg-gray-200 text-gray-600",
  CANCELADO: "bg-gray-200 text-gray-500",
};

const STATUS_LABEL = {
  RECEBIDO: "Pendente",
  EM_PREPARO: "Em preparo",
  SAIU_PARA_ENTREGA: "Saiu para entrega",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

// Verbo do botão de ação conforme o status atual do pedido.
const ACTION_LABEL = {
  RECEBIDO: "Aceitar",
  EM_PREPARO: "Avançar",
  SAIU_PARA_ENTREGA: "Confirmar entrega",
};

export default function OperacaoPedidos() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("TODOS");

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

  async function advanceStatus(order) {
    const next = getNextStatus(order.status);
    if (!next) return;

    const previous = orders;
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
    try {
      const updated = await ordersService.updateStatus(order.id, next);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...updated } : o)));
    } catch (err) {
      setOrders(previous);
      setError(err.response?.data?.error || "Não foi possível atualizar o status.");
    }
  }

  const counts = TABS.reduce((acc, tab) => {
    acc[tab.key] = tab.key === "TODOS" ? orders.length : orders.filter((o) => o.status === tab.key).length;
    return acc;
  }, {});

  const visibleOrders = activeTab === "TODOS" ? orders : orders.filter((o) => o.status === activeTab);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <h1 className="text-2xl font-display font-semibold text-char">Pedidos</h1>
        <button onClick={loadOrders} className="btn-secondary text-sm">
          Atualizar
        </button>
      </div>

      {error && (
        <p className="text-red-500 mb-4 cursor-pointer text-sm" onClick={() => setError(null)}>
          {error} (clique para dispensar)
        </p>
      )}

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition ${
              activeTab === tab.key ? "bg-char text-flour" : "bg-white text-ink-soft border border-flour-2"
            }`}
          >
            {tab.label}
            <span
              className={`text-xs rounded-full px-1.5 ${
                activeTab === tab.key ? "bg-flour/20" : "bg-flour-2"
              }`}
            >
              {counts[tab.key] || 0}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-ink-soft text-sm">Carregando pedidos...</p>
      ) : visibleOrders.length === 0 ? (
        <p className="text-ink-soft text-sm">Nenhum pedido nesta categoria.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-flour-2 text-ink-soft text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Pedido</th>
                <th className="text-left px-4 py-3 font-semibold">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold">Itens</th>
                <th className="text-left px-4 py-3 font-semibold">Valor</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => {
                const isTerminal = order.status === "ENTREGUE" || order.status === "CANCELADO";
                const actionLabel = ACTION_LABEL[order.status];
                return (
                  <tr key={order.id} className="border-t border-flour-2">
                    <td className="px-4 py-3 font-mono text-ink">#{order.id}</td>
                    <td className="px-4 py-3">{order.customerName}</td>
                    <td className="px-4 py-3 text-ink-soft max-w-xs truncate">
                      {order.items?.map((i) => `${i.quantity}x ${i.itemName}`).join(", ")}
                    </td>
                    <td className="px-4 py-3 font-mono">R$ {Number(order.totalPrice).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[order.status]}`}>
                        {STATUS_LABEL[order.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!isTerminal && actionLabel && (
                        <button
                          onClick={() => advanceStatus(order)}
                          className="btn-primary text-xs px-3 py-1.5"
                        >
                          {actionLabel}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
