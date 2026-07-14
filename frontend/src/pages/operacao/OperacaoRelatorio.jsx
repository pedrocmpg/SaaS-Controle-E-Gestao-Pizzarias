import { useEffect, useState } from "react";
import { ordersService } from "../../services/api";

function MetricCard({ label, value }) {
  return (
    <div className="card p-6">
      <p className="text-sm text-ink-soft mb-2">{label}</p>
      <p className="text-3xl font-mono font-semibold text-char">{value}</p>
    </div>
  );
}

export default function OperacaoRelatorio() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    ordersService
      .getTodayReport()
      .then(setReport)
      .catch(() => setError("Não foi possível carregar o relatório."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-ink-soft text-sm">Carregando relatório...</p>;
  }

  if (error) {
    return <p className="text-red-500 text-sm">{error}</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-display font-semibold text-char mb-6">Relatório do dia</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Pedidos hoje" value={report.ordersToday} />
        <MetricCard label="Faturamento hoje" value={`R$ ${report.revenueToday.toFixed(2)}`} />
        <MetricCard label="Ticket médio" value={`R$ ${report.averageTicket.toFixed(2)}`} />
      </div>
    </div>
  );
}
