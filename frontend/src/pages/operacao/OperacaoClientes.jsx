import { useCallback, useEffect, useState } from "react";
import { Search, X, RotateCcw } from "lucide-react";
import { clientesService } from "../../services/api";
import NovoPedidoModal from "./NovoPedidoModal";

// Atalhos de recuperação de cliente. Os valores são os que o dono usa para
// pensar o movimento ("sumiu faz um mês"), não uma escala contínua.
const FILTROS_INATIVIDADE = [
  { dias: 30, label: "Sem pedir há 30 dias" },
  { dias: 60, label: "Sem pedir há 60 dias" },
];

const ORDENACOES = [
  { valor: "ultimoPedido", label: "Último pedido" },
  { valor: "totalGasto", label: "Total gasto" },
  { valor: "nome", label: "Nome" },
];

function moeda(valor) {
  return `R$ ${Number(valor || 0).toFixed(2)}`;
}

function dataCurta(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function OperacaoClientes() {
  const [clientes, setClientes] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [inativoDias, setInativoDias] = useState(null);
  const [orderBy, setOrderBy] = useState("ultimoPedido");
  const [page, setPage] = useState(1);

  const [detalhe, setDetalhe] = useState(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [repetindo, setRepetindo] = useState(null);

  const carregar = useCallback(() => {
    setLoading(true);
    clientesService
      .list({
        q: buscaAplicada || undefined,
        inativoDias: inativoDias || undefined,
        orderBy,
        page,
      })
      .then((data) => {
        setClientes(data.clientes);
        setTotal(data.total);
        setError(null);
      })
      .catch(() => setError("Não foi possível carregar os clientes."))
      .finally(() => setLoading(false));
  }, [buscaAplicada, inativoDias, orderBy, page]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Busca só ao submeter: a consulta agrega os pedidos de todos os clientes do
  // recorte, então disparar a cada tecla digitada seria desperdício.
  function submeterBusca(evento) {
    evento.preventDefault();
    setPage(1);
    setBuscaAplicada(busca.trim());
  }

  function limparBusca() {
    setBusca("");
    setBuscaAplicada("");
    setPage(1);
  }

  function alternarInatividade(dias) {
    setPage(1);
    setInativoDias((atual) => (atual === dias ? null : dias));
  }

  function abrirDetalhe(cliente) {
    setCarregandoDetalhe(true);
    setDetalhe({ id: cliente.id, name: cliente.name });
    clientesService
      .getById(cliente.id)
      .then((data) => setDetalhe({ ...data.cliente, pedidos: data.pedidos }))
      .catch(() => {
        setError("Não foi possível carregar o histórico do cliente.");
        setDetalhe(null);
      })
      .finally(() => setCarregandoDetalhe(false));
  }

  // "Repetir último pedido": o maior ganho operacional da tela — um pedido
  // recorrente sai em um clique em vez de digitação completa. Itens cancelados
  // não servem de modelo, então usa o último pedido que virou venda.
  function repetirUltimoPedido() {
    const ultimo = detalhe?.pedidos?.find((p) => !p.naoFatura);
    if (!ultimo) {
      setError("Este cliente não tem pedido anterior para repetir.");
      return;
    }

    setRepetindo({
      customerName: detalhe.name,
      phone: detalhe.phone || "",
      address: ultimo.address || detalhe.address || "",
      deliveryType: ultimo.deliveryType,
      paymentMethod: ultimo.paymentMethod,
      deliveryFee: ultimo.deliveryFee,
      notes: ultimo.notes || "",
      items: (ultimo.items || []).map((item) => ({
        itemName: item.itemName,
        itemType: item.itemType,
        flavors: item.flavors || null,
        borderName: item.borderName || null,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        observations: item.observations || null,
      })),
    });
  }

  const totalPaginas = Math.max(1, Math.ceil(total / 30));

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <h1 className="text-2xl font-display font-semibold text-char">Clientes</h1>
        <span className="text-sm text-ink-soft">{total} cliente(s)</span>
      </div>

      {error && (
        <p className="text-red-500 mb-4 cursor-pointer text-sm" onClick={() => setError(null)}>
          {error} (clique para dispensar)
        </p>
      )}

      <div className="flex items-end gap-3 flex-wrap mb-4">
        <form onSubmit={submeterBusca} className="flex items-center gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome ou telefone (ex.: 1234)"
              className="input pl-9 pr-8 w-72"
              aria-label="Buscar cliente por nome ou telefone"
            />
            {busca && (
              <button
                type="button"
                onClick={limparBusca}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-soft hover:text-char"
                aria-label="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button type="submit" className="btn-secondary text-sm">
            Buscar
          </button>
        </form>

        <div className="flex items-center gap-2">
          {FILTROS_INATIVIDADE.map((filtro) => (
            <button
              key={filtro.dias}
              onClick={() => alternarInatividade(filtro.dias)}
              className={`px-3 py-2 rounded-full text-sm font-semibold transition ${
                inativoDias === filtro.dias
                  ? "bg-char text-flour"
                  : "bg-white text-ink-soft border border-flour-2"
              }`}
            >
              {filtro.label}
            </button>
          ))}
        </div>

        <label className="text-sm text-ink-soft flex items-center gap-2">
          Ordenar por
          <select
            value={orderBy}
            onChange={(e) => {
              setPage(1);
              setOrderBy(e.target.value);
            }}
            className="input py-2"
          >
            {ORDENACOES.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* A busca por telefone tem um limite real que vem da criptografia, não da
          tela — dizer isso aqui evita o atendente achar que o sistema falhou. */}
      <p className="text-xs text-ink-soft mb-4">
        Busca por telefone: digite os 4 últimos dígitos ou o número completo.
      </p>

      {loading ? (
        <p className="text-ink-soft text-sm">Carregando clientes...</p>
      ) : clientes.length === 0 ? (
        <p className="text-ink-soft text-sm">
          {buscaAplicada || inativoDias
            ? "Nenhum cliente encontrado com esse filtro."
            : "Nenhum cliente ainda. Os clientes aparecem aqui conforme os pedidos entram."}
        </p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-flour-2 text-ink-soft text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold">Telefone</th>
                <th className="text-right px-4 py-3 font-semibold">Pedidos</th>
                <th className="text-right px-4 py-3 font-semibold">Total gasto</th>
                <th className="text-right px-4 py-3 font-semibold">Ticket médio</th>
                <th className="text-left px-4 py-3 font-semibold">Último pedido</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((cliente) => (
                <tr
                  key={cliente.id}
                  onClick={() => abrirDetalhe(cliente)}
                  className="border-t border-flour-2 cursor-pointer hover:bg-flour-2/40"
                >
                  <td className="px-4 py-3 font-medium text-char">{cliente.name}</td>
                  <td className="px-4 py-3 font-mono text-ink-soft">{cliente.phone || "—"}</td>
                  <td className="px-4 py-3 text-right">{cliente.totalPedidos}</td>
                  <td className="px-4 py-3 text-right font-mono">{moeda(cliente.totalGasto)}</td>
                  <td className="px-4 py-3 text-right font-mono">{moeda(cliente.ticketMedio)}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {dataCurta(cliente.ultimoPedidoEm)}
                    {cliente.diasSemPedir != null && (
                      <span className="text-xs"> · há {cliente.diasSemPedir} dia(s)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary text-sm disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-ink-soft">
            Página {page} de {totalPaginas}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
            disabled={page >= totalPaginas}
            className="btn-secondary text-sm disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}

      {detalhe && (
        <PainelCliente
          cliente={detalhe}
          carregando={carregandoDetalhe}
          onFechar={() => setDetalhe(null)}
          onRepetir={repetirUltimoPedido}
        />
      )}

      {repetindo && (
        <NovoPedidoModal
          inicial={repetindo}
          onClose={() => setRepetindo(null)}
          onCreated={() => {
            setRepetindo(null);
            setDetalhe(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function PainelCliente({ cliente, carregando, onFechar, onRepetir }) {
  const temPedidoRepetivel = cliente.pedidos?.some((p) => !p.naoFatura);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-char/40" onClick={onFechar} aria-hidden="true" />

      <aside className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl">
        <header className="sticky top-0 bg-white border-b border-flour-2 px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-char truncate">{cliente.name}</h2>
            {/* Telefone completo: é a tela de atendimento, onde o operador liga
                para o cliente. Na lista ele aparece mascarado. */}
            <p className="text-sm text-ink-soft font-mono">{cliente.phone || "sem telefone"}</p>
          </div>
          <button onClick={onFechar} className="text-ink-soft hover:text-char" aria-label="Fechar">
            <X size={20} />
          </button>
        </header>

        <div className="px-6 py-5 space-y-5">
          {carregando ? (
            <p className="text-ink-soft text-sm">Carregando histórico...</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Indicador rotulo="Pedidos" valor={cliente.totalPedidos ?? 0} />
                <Indicador rotulo="Total gasto" valor={moeda(cliente.totalGasto)} />
                <Indicador rotulo="Ticket médio" valor={moeda(cliente.ticketMedio)} />
              </div>

              {cliente.address && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-soft mb-1">Endereço</p>
                  <p className="text-sm text-char">{cliente.address}</p>
                </div>
              )}

              <button
                onClick={onRepetir}
                disabled={!temPedidoRepetivel}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <RotateCcw size={16} />
                Repetir último pedido
              </button>

              <div>
                <p className="text-xs uppercase tracking-wide text-ink-soft mb-2">
                  Histórico ({cliente.pedidos?.length || 0})
                </p>

                {!cliente.pedidos || cliente.pedidos.length === 0 ? (
                  <p className="text-sm text-ink-soft">Nenhum pedido registrado.</p>
                ) : (
                  <ul className="space-y-3">
                    {cliente.pedidos.map((pedido) => (
                      <li key={pedido.id} className="border border-flour-2 rounded-lg p-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono text-sm">#{pedido.id}</span>
                          <span className="text-xs text-ink-soft">{dataCurta(pedido.createdAt)}</span>
                        </div>
                        <p className="text-sm text-ink-soft">
                          {pedido.items?.map((i) => `${i.quantity}x ${i.itemName}`).join(", ")}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="font-mono text-sm">{moeda(pedido.totalPrice)}</span>
                          {pedido.naoFatura && (
                            <span className="text-xs text-red-600 font-semibold">CANCELADO</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function Indicador({ rotulo, valor }) {
  return (
    <div className="bg-flour-2 rounded-lg px-3 py-2">
      <p className="text-xs text-ink-soft">{rotulo}</p>
      <p className="text-base font-semibold text-char font-mono">{valor}</p>
    </div>
  );
}
