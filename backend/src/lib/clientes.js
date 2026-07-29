/**
 * Regras puras da tela de clientes (CRM) — spec-8.
 *
 * Nada aqui toca banco: o handler lê, chama estas funções, responde. É o que
 * permite testar mascaramento e agregados sem servidor nem Postgres.
 */

/** Pedido que não conta como faturamento do cliente. */
const STATUS_NAO_FATURA = "CANCELADO";

/**
 * Mascara o telefone para a listagem: DDD visível, meio escondido, final visível.
 * O final é o que o atendente usa para reconhecer o cliente ("o do 1234"); o miolo
 * não serve para nada na lista e é o que identifica a pessoa.
 *
 * @param {string|null} phone telefone em claro (já descriptografado)
 * @returns {string|null} ex.: "(54) ****-1234"
 */
function mascararTelefone(phone) {
  if (!phone) return null;
  const digitos = String(phone).replace(/\D/g, "");
  if (digitos.length < 4) return null;

  const last4 = digitos.slice(-4);
  const ddd = digitos.length >= 10 ? digitos.slice(0, 2) : null;
  return ddd ? `(${ddd}) ****-${last4}` : `****-${last4}`;
}

/**
 * Formata o telefone completo para a tela de detalhe.
 * @param {string|null} phone telefone em claro
 * @returns {string|null} ex.: "(54) 99999-1234"
 */
function formatarTelefone(phone) {
  if (!phone) return null;
  const d = String(phone).replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

/**
 * Agrega os pedidos de UM cliente.
 *
 * Pedido CANCELADO não entra em faturamento nem em contagem: um cliente que pediu
 * e cancelou não "gastou" nada, e contá-lo inflaria o ticket médio da loja inteira.
 * Mas a data do último pedido considera o cancelado — para "sumiu há 30 dias", o
 * que importa é o último contato, não a última venda.
 *
 * @param {Array<{status: string, totalPrice: number|string, createdAt: Date|string}>} pedidos
 * @param {Date} [agora] injetável para teste determinístico
 */
function agregarPedidos(pedidos, agora = new Date()) {
  const validos = pedidos.filter((p) => p.status !== STATUS_NAO_FATURA);

  const totalGasto = validos.reduce((soma, p) => soma + Number(p.totalPrice), 0);
  const totalPedidos = validos.length;
  const ticketMedio = totalPedidos > 0 ? totalGasto / totalPedidos : 0;

  const datas = pedidos.map((p) => new Date(p.createdAt).getTime()).filter((t) => !isNaN(t));
  const ultimoPedidoEm = datas.length > 0 ? new Date(Math.max(...datas)) : null;

  return {
    totalPedidos,
    totalGasto: arredondar(totalGasto),
    ticketMedio: arredondar(ticketMedio),
    ultimoPedidoEm,
    diasSemPedir: ultimoPedidoEm ? diasEntre(ultimoPedidoEm, agora) : null,
  };
}

/** Dias inteiros decorridos entre duas datas (nunca negativo). */
function diasEntre(de, ate) {
  const ms = ate.getTime() - new Date(de).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Dinheiro com 2 casas, sem o lixo de ponto flutuante (0.1+0.2). */
function arredondar(valor) {
  return Math.round(valor * 100) / 100;
}

/**
 * Decide como buscar a partir do que o atendente digitou.
 *
 * - Só dígitos, 4+ → busca por final do telefone (`phoneLast4`). É como se procura
 *   na prática: "o cliente do 1234".
 * - Só dígitos, telefone completo (10-11) → também tenta match exato por hash.
 * - Qualquer outra coisa → busca por nome (texto puro, aceita parcial).
 *
 * Busca por PEDAÇO do meio do telefone é impossível: `phone` é AES com IV
 * aleatório, então não existe LIKE sobre ele. Por isso os 4 últimos dígitos
 * ficam em claro numa coluna própria.
 *
 * @param {string} termo
 * @returns {{tipo: "nome"|"telefone", valor: string, completo: boolean}|null}
 */
function interpretarBusca(termo) {
  const limpo = String(termo || "").trim();
  if (!limpo) return null;

  const soDigitos = /^[\d\s()+-]+$/.test(limpo);
  if (soDigitos) {
    const digitos = limpo.replace(/\D/g, "");
    if (digitos.length >= 4) {
      return {
        tipo: "telefone",
        valor: digitos,
        completo: digitos.length >= 10, // com DDD: dá para tentar o hash exato
      };
    }
    // 1-3 dígitos: específico demais para telefone, pode ser nome ("Pizzaria 24")
    return { tipo: "nome", valor: limpo, completo: false };
  }

  return { tipo: "nome", valor: limpo, completo: false };
}

module.exports = {
  mascararTelefone,
  formatarTelefone,
  agregarPedidos,
  interpretarBusca,
  diasEntre,
  STATUS_NAO_FATURA,
};
