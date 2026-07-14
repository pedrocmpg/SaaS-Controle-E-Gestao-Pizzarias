/**
 * Ciclo de vida do status de um pedido.
 *
 * Fluxo linear (só avança, nunca volta nem pula etapas):
 *   RECEBIDO -> EM_PREPARO -> SAIU_PARA_ENTREGA -> ENTREGUE
 *
 * CANCELADO pode ocorrer a partir de qualquer estado não-terminal.
 * ENTREGUE e CANCELADO são terminais.
 */

// Ordem das etapas "de progresso" (cancelamento é tratado à parte)
const STATUS_FLOW = ["RECEBIDO", "EM_PREPARO", "SAIU_PARA_ENTREGA", "ENTREGUE"];

const ALL_STATUSES = [...STATUS_FLOW, "CANCELADO"];

const TERMINAL_STATUSES = ["ENTREGUE", "CANCELADO"];

/**
 * Retorna o próximo status do fluxo, ou null se já for terminal.
 */
function getNextStatus(current) {
  const idx = STATUS_FLOW.indexOf(current);
  if (idx === -1 || idx === STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1];
}

/**
 * Valida se a transição from -> to é permitida.
 * - Avançar apenas para o próximo status do fluxo.
 * - Cancelar a partir de qualquer estado não-terminal.
 * - Nunca voltar, pular etapas, nem transicionar a partir de um estado terminal.
 */
function isValidTransition(from, to) {
  if (!ALL_STATUSES.includes(to)) return false;
  if (TERMINAL_STATUSES.includes(from)) return false; // nada sai de um terminal
  if (to === "CANCELADO") return true; // cancelar de qualquer não-terminal
  return getNextStatus(from) === to; // só o próximo do fluxo
}

module.exports = {
  STATUS_FLOW,
  ALL_STATUSES,
  TERMINAL_STATUSES,
  getNextStatus,
  isValidTransition,
};
