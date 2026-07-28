import { useState } from "react";

/**
 * Botão de (re)impressão.
 *
 * É recurso de RECUPERAÇÃO — comanda saiu borrada, acabou o papel, o agente estava
 * desligado. O fluxo normal é automático: o backend enfileira sozinho ao criar o pedido.
 *
 * Dá retorno visual próprio porque o papel sai longe da tela: sem o "Enviado", o atendente
 * não sabe se o clique valeu e clica de novo, gerando pilha de papel repetido.
 */
export default function BotaoImprimir({ onImprimir, children = "Imprimir", className = "" }) {
  const [estado, setEstado] = useState("ocioso"); // ocioso | enviando | enviado | erro
  const [erro, setErro] = useState(null);

  async function clicar() {
    if (estado === "enviando") return;
    setEstado("enviando");
    setErro(null);
    try {
      await onImprimir();
      setEstado("enviado");
      setTimeout(() => setEstado("ocioso"), 2500);
    } catch (err) {
      setErro(err.response?.data?.error || "Não foi possível enviar para a impressora.");
      setEstado("erro");
      setTimeout(() => setEstado("ocioso"), 4000);
    }
  }

  const rotulo =
    estado === "enviando" ? "Enviando..." : estado === "enviado" ? "Enviado ✓" : estado === "erro" ? "Falhou" : children;

  return (
    <button
      onClick={clicar}
      disabled={estado === "enviando"}
      title={erro || "Enviar para a impressora térmica"}
      className={`text-xs px-3 py-1.5 rounded-full border transition disabled:opacity-50 ${
        estado === "enviado"
          ? "border-basil text-basil"
          : estado === "erro"
            ? "border-red-300 text-red-600"
            : "border-flour-2 text-ink-soft hover:text-char"
      } ${className}`}
    >
      {rotulo}
    </button>
  );
}
