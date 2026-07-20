import { useCallback, useEffect, useState } from "react";
import { ordersService } from "../../services/api";

const PERIODOS = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7dias", label: "7 dias" },
  { key: "30dias", label: "30 dias" },
  { key: "custom", label: "Personalizado" },
];

const brl = (v) => `R$ ${Number(v || 0).toFixed(2)}`;

// Rótulos amigáveis para as formas de pagamento vindas cruas do banco.
const PAGAMENTO_LABEL = {
  DINHEIRO: "Dinheiro",
  CARTAO: "Cartão",
  CARTAO_CREDITO: "Cartão crédito",
  CARTAO_DEBITO: "Cartão débito",
  PIX: "PIX",
  NAO_INFORMADO: "Não informado",
};
const pagamentoLabel = (m) => PAGAMENTO_LABEL[m] || m;

function MetricCard({ label, value, sub }) {
  return (
    <div className="card p-6">
      <p className="text-sm text-ink-soft mb-2">{label}</p>
      <p className="text-3xl font-mono font-semibold text-char">{value}</p>
      {sub && <p className="text-xs text-ink-soft mt-1">{sub}</p>}
    </div>
  );
}

// Gráfico de barras simples em SVG inline (sem dependência externa).
function FaturamentoChart({ dados }) {
  if (!dados || dados.length === 0) {
    return <p className="text-ink-soft text-sm">Sem dados no período.</p>;
  }

  const max = Math.max(...dados.map((d) => d.receita), 1);
  const barW = 40;
  const gap = 16;
  const chartH = 160;
  const labelH = 28;
  const width = dados.length * (barW + gap) + gap;
  const height = chartH + labelH;

  const formatDia = (iso) => {
    const [, m, d] = iso.split("-");
    return `${d}/${m}`;
  };

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} role="img" aria-label="Faturamento por dia">
        {dados.map((d, i) => {
          const h = Math.round((d.receita / max) * chartH);
          const x = gap + i * (barW + gap);
          const y = chartH - h;
          return (
            <g key={d.dia}>
              <rect x={x} y={y} width={barW} height={h} rx="4" className="fill-ember-500/70" />
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" className="fill-ink-soft" fontSize="10">
                {d.receita >= 1000 ? `${(d.receita / 1000).toFixed(1)}k` : Math.round(d.receita)}
              </text>
              <text x={x + barW / 2} y={chartH + 16} textAnchor="middle" className="fill-ink-soft" fontSize="10">
                {formatDia(d.dia)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function OperacaoRelatorio() {
  const [periodo, setPeriodo] = useState("hoje");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (periodo === "custom" && (!from || !to)) {
      // Espera as duas datas antes de buscar.
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const params = periodo === "custom" ? { periodo, from, to } : { periodo };
    ordersService
      .getReportSummary(params)
      .then(setReport)
      .catch((err) => setError(err.response?.data?.error || "Não foi possível carregar o relatório."))
      .finally(() => setLoading(false));
  }, [periodo, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const canalTotal = report ? report.porCanal.teleEntrega + report.porCanal.salao : 0;
  const pct = (parte) => (canalTotal > 0 ? Math.round((parte / canalTotal) * 100) : 0);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <h1 className="text-2xl font-display font-semibold text-char">Relatório gerencial</h1>
        <button onClick={load} className="btn-secondary text-sm">
          Atualizar
        </button>
      </div>

      {/* Filtro de período */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {PERIODOS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriodo(p.key)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
              periodo === p.key ? "bg-char text-flour" : "bg-white text-ink-soft border border-flour-2"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {periodo === "custom" && (
        <div className="flex items-end gap-3 mb-6 flex-wrap">
          <label className="text-sm">
            <span className="block text-ink-soft mb-1">De</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-flour-2 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="block text-ink-soft mb-1">Até</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-flour-2 rounded-lg px-3 py-2 text-sm" />
          </label>
        </div>
      )}

      {error && (
        <p className="text-red-500 mb-4 cursor-pointer text-sm" onClick={() => setError(null)}>
          {error} (clique para dispensar)
        </p>
      )}

      {loading ? (
        <p className="text-ink-soft text-sm">Carregando relatório...</p>
      ) : !report ? (
        <p className="text-ink-soft text-sm">Selecione um período para ver o relatório.</p>
      ) : (
        <div className="space-y-6">
          {/* Métricas principais */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard label="Pedidos" value={report.totalPedidos} />
            <MetricCard label="Faturamento" value={brl(report.totalReceita)} />
            <MetricCard label="Ticket médio" value={brl(report.ticketMedio)} />
          </div>

          {/* Gráfico de faturamento por dia */}
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-ink-soft mb-4">Faturamento por dia</h2>
            <FaturamentoChart dados={report.faturamentoPorDia} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Por canal */}
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-ink-soft mb-4">Por canal</h2>
              <div className="space-y-3">
                {[
                  { nome: "Tele-entrega", valor: report.porCanal.teleEntrega },
                  { nome: "Salão", valor: report.porCanal.salao },
                ].map((c) => (
                  <div key={c.nome}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-char">{c.nome}</span>
                      <span className="font-mono text-ink-soft">
                        {brl(c.valor)} · {pct(c.valor)}%
                      </span>
                    </div>
                    <div className="h-2 bg-flour-2 rounded-full overflow-hidden">
                      <div className="h-full bg-basil rounded-full" style={{ width: `${pct(c.valor)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Por forma de pagamento */}
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-ink-soft mb-4">Por forma de pagamento</h2>
              {report.porFormaPagamento.length === 0 ? (
                <p className="text-ink-soft text-sm">Sem dados no período.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {report.porFormaPagamento.map((p) => (
                      <tr key={p.metodo} className="border-t border-flour-2 first:border-0">
                        <td className="py-2 text-char">{pagamentoLabel(p.metodo)}</td>
                        <td className="py-2 text-right font-mono text-ink-soft">{brl(p.receita)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Ranking de itens */}
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-ink-soft mb-4">Itens mais vendidos</h2>
            {report.topItens.length === 0 ? (
              <p className="text-ink-soft text-sm">Sem vendas no período.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-ink-soft text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left py-2 font-semibold">#</th>
                    <th className="text-left py-2 font-semibold">Item</th>
                    <th className="text-right py-2 font-semibold">Qtd</th>
                    <th className="text-right py-2 font-semibold">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topItens.map((item, i) => (
                    <tr key={item.nome} className="border-t border-flour-2">
                      <td className="py-2 font-mono text-ink-soft">{i + 1}</td>
                      <td className="py-2 text-char">{item.nome}</td>
                      <td className="py-2 text-right font-mono">{item.quantidade}</td>
                      <td className="py-2 text-right font-mono text-ink-soft">{brl(item.receita)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
