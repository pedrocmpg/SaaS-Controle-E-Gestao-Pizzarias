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

/**
 * Traduz o parâmetro `status` da listagem em filtro Prisma.
 *
 * Aceita um valor ("RECEBIDO") ou vários separados por vírgula
 * ("RECEBIDO,EM_PREPARO") — o KDS da cozinha monta suas colunas numa só
 * requisição em vez de uma por status.
 *
 * Status desconhecidos são descartados em silêncio: um filtro inválido não pode
 * virar `where.status = undefined` (que o Prisma ignora, devolvendo TODOS os
 * pedidos). Se nada sobrar, retorna null e o chamador não filtra por status.
 *
 * @param {string|undefined} status
 * @returns {object|string|null} valor de `where.status`, ou null para não filtrar.
 */
function parseStatusFilter(status) {
  if (!status) return null;
  const solicitados = String(status)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => ALL_STATUSES.includes(s));

  if (solicitados.length === 0) return null;
  if (solicitados.length === 1) return solicitados[0];
  return { in: [...new Set(solicitados)] };
}

module.exports = {
  STATUS_FLOW,
  ALL_STATUSES,
  TERMINAL_STATUSES,
  getNextStatus,
  isValidTransition,
  parseStatusFilter,
};
