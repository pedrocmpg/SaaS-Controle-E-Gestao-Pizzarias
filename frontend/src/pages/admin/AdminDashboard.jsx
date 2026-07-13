import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ordersService } from "../../services/api";
import { useAdminAuth } from "../../context/AdminAuthContext";
import Logo from "../../components/Logo";

const statusLabels = {
  PENDENTE: "Pendente",
  CONFIRMADO: "Confirmado",
  EM_PREPARO: "Em preparo",
  SAIU_PARA_ENTREGA: "Saiu para entrega",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

const statusColors = {
  PENDENTE: "bg-yellow-100 text-yellow-700",
  CONFIRMADO: "bg-blue-100 text-blue-700",
  EM_PREPARO: "bg-orange-100 text-orange-700",
  SAIU_PARA_ENTREGA: "bg-purple-100 text-purple-700",
  ENTREGUE: "bg-green-100 text-green-700",
  CANCELADO: "bg-red-100 text-red-700",
};

export default function AdminDashboard() {
  const { admin, logout } = useAdminAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");

  const loadOrders = useCallback(() => {
    setLoading(true);
    ordersService
      .list(statusFilter ? { status: statusFilter } : {})
      .then((data) => setOrders(data.orders))
      .catch(() => setError("Não foi possível carregar os pedidos."))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function handleStatusChange(orderId, newStatus) {
    try {
      await ordersService.updateStatus(orderId, newStatus);
      loadOrders();
    } catch {
      setError("Não foi possível atualizar o status do pedido.");
    }
  }

  return (
    <div className="min-h-screen bg-brand-50">
      <header className="bg-white border-b border-black/5">
        <div className="container-app flex items-center justify-between h-20">
          <Logo />
          <div className="flex items-center gap-4">
            {admin?.role === "SUPER_ADMIN" && (
              <Link to="/admin/operadores" className="text-sm font-semibold text-brand-900 hover:underline">
                Operadores
              </Link>
            )}
            <span className="text-sm text-gray-500">Olá, {admin?.name || "Admin"}</span>
            <button onClick={logout} className="text-sm font-semibold text-red-500 hover:underline">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="container-app py-10">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <h1 className="text-2xl font-bold text-brand-900">Pedidos</h1>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-xl p-2 text-sm"
          >
            <option value="">Todos os status</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-red-500 mb-4">{error}</p>}

        {loading ? (
          <p className="text-gray-500">Carregando pedidos...</p>
        ) : orders.length === 0 ? (
          <p className="text-gray-500">Nenhum pedido encontrado.</p>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="card p-5">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-bold text-brand-900">
                      Pedido #{order.id} - {order.customerName}
                    </p>
                    <p className="text-sm text-gray-500">{order.phone}</p>
                    {order.address && <p className="text-sm text-gray-500">{order.address}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(order.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>

                  <div className="text-right">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColors[order.status]}`}
                    >
                      {statusLabels[order.status]}
                    </span>
                    <p className="font-bold text-accent-600 mt-2">
                      R$ {Number(order.totalPrice).toFixed(2)}
                    </p>
                  </div>
                </div>

                <ul className="mt-4 border-t border-black/5 pt-3 space-y-1 text-sm">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      {item.quantity}x {item.itemName}
                      {item.flavors?.length > 0 && (
                        <span className="text-gray-500"> - {item.flavors.join(", ")}</span>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex items-center gap-2">
                  <label className="text-sm text-gray-500">Atualizar status:</label>
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                    className="border border-gray-200 rounded-lg p-1.5 text-sm"
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
