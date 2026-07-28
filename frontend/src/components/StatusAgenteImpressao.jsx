import { useEffect, useState } from "react";
import { impressaoService } from "../services/api";
import { connectSocket } from "../services/socket";

/**
 * Indicador de impressora no shell da aplicação.
 *
 * Se o agente cair no meio do movimento, o atendente precisa descobrir NA HORA — não
 * quando a cozinha reclamar que não chegou comanda. Por isso o indicador é global e fica
 * sempre visível, não escondido numa tela de configuração.
 *
 * Estado inicial vem do HTTP (o agente pode já estar conectado antes desta tela abrir) e
 * é mantido pelo evento de socket que o backend emite no connect/disconnect do agente.
 */
export default function StatusAgenteImpressao({ collapsed = false }) {
  const [conectado, setConectado] = useState(null); // null = ainda verificando

  useEffect(() => {
    let ativo = true;

    impressaoService
      .getAgenteStatus()
      .then((data) => ativo && setConectado(Boolean(data.conectado)))
      .catch(() => ativo && setConectado(false));

    const socket = connectSocket();
    const aoMudar = (data) => setConectado(Boolean(data && data.conectado));
    socket.on("impressao:agente_status", aoMudar);

    return () => {
      ativo = false;
      socket.off("impressao:agente_status", aoMudar);
    };
  }, []);

  if (conectado === null) return null;

  const descricao = conectado
    ? "O agente de impressão está conectado. As comandas saem automaticamente."
    : "O agente de impressão está desligado. Os pedidos NÃO estão sendo impressos — eles ficam guardados e saem quando o agente voltar.";

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 ${collapsed ? "justify-center" : ""}`}
      title={descricao}
    >
      {/* O ponto continua visível com a sidebar colapsada: é o sinal que não pode sumir. */}
      <span
        role="img"
        aria-label={descricao}
        className={`w-2.5 h-2.5 rounded-full shrink-0 ${conectado ? "bg-basil" : "bg-red-500 animate-pulse"}`}
      />
      {!collapsed && (
        <span className={`text-xs truncate ${conectado ? "text-flour/50" : "text-red-400 font-semibold"}`}>
          {conectado ? "Impressora ok" : "Impressora offline"}
        </span>
      )}
    </div>
  );
}
