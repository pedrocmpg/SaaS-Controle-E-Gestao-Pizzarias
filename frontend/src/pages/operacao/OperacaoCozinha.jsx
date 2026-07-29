import { useCallback, useEffect, useRef, useState } from "react";
import { ordersService } from "../../services/api";
import { connectSocket } from "../../services/socket";

// Limiares de tempo (minutos) que colorem o card. Ficam aqui, num só lugar:
// viram parametrização por loja no futuro, e espalhados pelo JSX seriam
// impossíveis de achar.
const ALERTA_AMARELO_MIN = 15;
const ALERTA_VERMELHO_MIN = 25;

// Um único timer re-renderiza todos os cards. Um timer por card multiplicaria
// os intervalos por pedido numa tela que fica aberta a noite inteira.
const TICK_MS = 30_000;

// Colunas do fluxo de produção.
//
// A cozinha só avança RECEBIDO -> EM_PREPARO. Ela NÃO despacha: a transição para
// SAIU_PARA_ENTREGA exige um motoboy com turno aberto (orders.routes.js), e quem
// escolhe o motoboy é a tela de Despacho. Um botão "saiu" aqui falharia com 409
// toda vez, porque a cozinha não tem essa informação.
//
// A terceira coluna é só leitura, e existe porque a cozinha precisa ver o pedido
// deixar a casa — sem isso ele sumiria da tela sem explicação ao ser despachado.
const COLUNAS = [
  { status: "RECEBIDO", titulo: "Recebidos", proximo: "EM_PREPARO", acao: "Iniciar preparo" },
  { status: "EM_PREPARO", titulo: "Em preparo", proximo: null, acao: null },
  { status: "SAIU_PARA_ENTREGA", titulo: "Saiu para entrega", proximo: null, acao: null },
];

const STATUS_CONSULTADOS = COLUNAS.map((c) => c.status).join(",");

const TIPO_LABEL = {
  ENTREGA: "ENTREGA",
  RETIRADA: "RETIRADA",
};

function minutosDesde(iso) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

// Verde → amarelo → vermelho pulsante conforme o pedido envelhece. É o ponto
// central da tela: o cozinheiro lê a cor de longe, não o número.
function estiloPorTempo(minutos) {
  if (minutos >= ALERTA_VERMELHO_MIN) {
    return {
      card: "bg-red-50 border-red-500 animate-pulse",
      tempo: "text-red-600",
    };
  }
  if (minutos >= ALERTA_AMARELO_MIN) {
    return { card: "bg-yellow-50 border-yellow-500", tempo: "text-yellow-700" };
  }
  return { card: "bg-white border-green-500", tempo: "text-green-700" };
}

export default function OperacaoCozinha() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [conectado, setConectado] = useState(false);
  // Só serve para forçar o re-render dos tempos a cada tick.
  const [, setTick] = useState(0);
  // Evita piscar "erro" quando um clique falha e o socket já corrigiu o estado.
  const avancandoRef = useRef(new Set());

  const carregar = useCallback(() => {
    ordersService
      .list({ status: STATUS_CONSULTADOS, pageSize: 100 })
      .then((data) => {
        setOrders(data.orders);
        setError(null);
      })
      .catch(() => setError("Não foi possível carregar os pedidos da cozinha."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Relógio único da tela.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Tempo real. A tela fica pendurada na parede a noite inteira, então o
  // cleanup precisa remover TODOS os listeners: sem isso, cada reconexão
  // acumularia um handler e a tela iria degradando sozinha.
  useEffect(() => {
    const socket = connectSocket();

    const upsert = (order) =>
      setOrders((prev) => {
        const existe = prev.some((o) => o.id === order.id);
        if (existe) return prev.map((o) => (o.id === order.id ? { ...o, ...order } : o));
        return [order, ...prev];
      });

    // Após queda de rede, o socket reconecta sozinho — mas o que aconteceu
    // durante a queda não chega por evento. Recarregar no reconnect é o que
    // impede a tela de mostrar um movimento congelado no passado.
    const onConnect = () => {
      setConectado(true);
      carregar();
    };
    const onDisconnect = () => setConectado(false);

    setConectado(socket.connected);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("pedido:novo", upsert);
    socket.on("pedido:status_atualizado", upsert);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("pedido:novo", upsert);
      socket.off("pedido:status_atualizado", upsert);
    };
  }, [carregar]);

  async function avancar(order, proximo) {
    if (!proximo || avancandoRef.current.has(order.id)) return;
    avancandoRef.current.add(order.id);

    const anterior = orders;
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: proximo } : o)));

    try {
      const atualizado = await ordersService.updateStatus(order.id, proximo);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...atualizado } : o)));
    } catch (err) {
      // O backend valida a transição; se recusou, o estado local está errado.
      setOrders(anterior);
      setError(err.response?.data?.error || "Não foi possível avançar o pedido.");
      if (err.response?.status === 409) carregar();
    } finally {
      avancandoRef.current.delete(order.id);
    }
  }

  const porColuna = COLUNAS.map((coluna) => ({
    ...coluna,
    // Mais antigo primeiro: o pedido atrasado tem que estar no topo, não
    // enterrado embaixo dos que acabaram de entrar.
    pedidos: orders
      .filter((o) => o.status === coluna.status)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
  }));

  return (
    <div className="min-h-screen bg-char text-flour p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-display font-semibold">Cozinha</h1>
        <div className="flex items-center gap-4">
          {error && (
            <button onClick={() => setError(null)} className="text-sm text-red-300 underline">
              {error} (dispensar)
            </button>
          )}
          <span className="flex items-center gap-2 text-sm text-flour/60">
            <span
              className={`w-2.5 h-2.5 rounded-full ${conectado ? "bg-green-400" : "bg-red-500"}`}
              aria-hidden="true"
            />
            {conectado ? "Ao vivo" : "Reconectando..."}
          </span>
        </div>
      </div>

      {loading ? (
        <p className="text-flour/60">Carregando pedidos...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {porColuna.map((coluna) => (
            <section key={coluna.status} className="min-w-0">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                {coluna.titulo}
                <span className="text-sm bg-flour/15 rounded-full px-2 py-0.5">
                  {coluna.pedidos.length}
                </span>
              </h2>

              <div className="space-y-3">
                {coluna.pedidos.length === 0 && (
                  <p className="text-flour/40 text-sm">Nenhum pedido.</p>
                )}

                {coluna.pedidos.map((order) => {
                  const minutos = minutosDesde(order.createdAt);
                  const estilo = estiloPorTempo(minutos);
                  return (
                    <article
                      key={order.id}
                      className={`rounded-xl border-l-8 p-4 text-char shadow ${estilo.card}`}
                    >
                      <header className="flex items-baseline justify-between gap-2 mb-2">
                        <span className="font-mono text-2xl font-bold">#{order.id}</span>
                        <span className={`text-2xl font-bold tabular-nums ${estilo.tempo}`}>
                          {minutos} min
                        </span>
                      </header>

                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">
                        {TIPO_LABEL[order.deliveryType] || order.deliveryType} · {order.customerName}
                      </p>

                      <ul className="space-y-1.5 mb-2">
                        {order.items?.map((item) => (
                          <li key={item.id} className="text-lg leading-snug">
                            <span className="font-bold">{item.quantity}x</span> {item.itemName}
                            {Array.isArray(item.flavors) && item.flavors.length > 0 && (
                              <span className="text-ink-soft"> ({item.flavors.join(", ")})</span>
                            )}
                            {item.borderName && (
                              <span className="text-ink-soft"> · borda {item.borderName}</span>
                            )}
                            {/* Observação do item é a fonte nº1 de retrabalho na
                                cozinha ("sem cebola") — mesma decisão do layout impresso. */}
                            {item.observations && (
                              <p className="font-bold text-red-700 uppercase text-base">
                                {item.observations}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>

                      {order.notes && (
                        <p className="font-bold text-red-700 uppercase text-base mb-2">
                          {order.notes}
                        </p>
                      )}

                      {/* Botão grande: operado por toque, possivelmente com a mão suja. */}
                      {coluna.acao && coluna.proximo && (
                        <button
                          onClick={() => avancar(order, coluna.proximo)}
                          className="w-full py-4 rounded-lg bg-char text-flour font-semibold text-lg active:scale-[0.98] transition"
                        >
                          {coluna.acao}
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
