/**
 * Enfileiramento de impressão — ponto único onde um job nasce.
 *
 * Separa o que tem I/O (ler o pedido, gravar o job, emitir no socket) do que é layout
 * puro (`impressaoLayout.js`). Os handlers chamam daqui; nenhum monta payload por conta
 * própria, senão a comanda da cozinha diverge conforme a rota que a disparou.
 *
 * Regra de resiliência: enfileirar NUNCA pode derrubar a operação. Se a impressão falhar,
 * o pedido continua criado — a pizzaria não pode parar de vender porque a impressora
 * está sem papel. Por isso `enfileirarSeguro` engole o erro e só loga.
 */

const prisma = require("./prisma");
const { decrypt } = require("./encryption");
const { emitImpressaoJob } = require("./socket");
const {
  renderComandaCozinha,
  renderCupomCliente,
  renderCupomComanda,
  renderRomaneioMotoboy,
} = require("./impressaoLayout");

/**
 * Persiste o job e avisa o agente da loja.
 * @returns {Promise<object>} o JobImpressao criado.
 */
async function enfileirar({ lojaId, tipo, payload, origemId = null }) {
  const job = await prisma.jobImpressao.create({
    data: { lojaId, tipo, payload, origemId },
  });

  // Se o agente estiver offline, ele pega este job no reconnect via GET /pendentes.
  emitImpressaoJob(lojaId, job);
  return job;
}

/**
 * Igual a `enfileirar`, mas nunca lança: usado nos disparos automáticos, onde a impressão
 * é um efeito colateral e não pode fazer a requisição principal falhar.
 */
async function enfileirarSeguro(args) {
  try {
    return await enfileirar(args);
  } catch (err) {
    console.error(`Falha ao enfileirar impressão (${args.tipo}, origem ${args.origemId}):`, err.message);
    return null;
  }
}

/** Largura configurada da loja. Fase 1: 48 colunas (80mm) para todo mundo. */
const larguraDaLoja = () => 48;

/** Pedido com itens, telefone/endereço já descriptografados para o papel. */
async function carregarPedido(orderId, lojaId) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, lojaId },
    include: { items: true },
  });
  if (!order) return null;
  return {
    ...order,
    phone: order.phone ? decrypt(order.phone) : null,
    address: order.address ? decrypt(order.address) : null,
  };
}

/** Comanda de cozinha de um pedido de tele-entrega. */
async function enfileirarComandaCozinha(lojaId, orderId, { seguro = false } = {}) {
  const order = await carregarPedido(orderId, lojaId);
  if (!order) return null;

  const fn = seguro ? enfileirarSeguro : enfileirar;
  return fn({
    lojaId,
    tipo: "COMANDA_COZINHA",
    origemId: order.id,
    payload: renderComandaCozinha(order, { largura: larguraDaLoja() }),
  });
}

/** Cupom do cliente (via que acompanha o pedido). */
async function enfileirarCupomPedido(lojaId, orderId, { seguro = false } = {}) {
  const order = await carregarPedido(orderId, lojaId);
  if (!order) return null;

  const loja = await prisma.loja.findUnique({ where: { id: lojaId }, select: { nome: true } });

  const fn = seguro ? enfileirarSeguro : enfileirar;
  return fn({
    lojaId,
    tipo: "CUPOM_CLIENTE",
    origemId: order.id,
    payload: renderCupomCliente(order, { largura: larguraDaLoja(), nomeLoja: loja ? loja.nome : "" }),
  });
}

/** Cupom de uma comanda de salão. */
async function enfileirarCupomComanda(lojaId, comandaId, { seguro = false } = {}) {
  const comanda = await prisma.comanda.findFirst({
    where: { id: comandaId, lojaId },
    include: { itens: true },
  });
  if (!comanda) return null;

  const loja = await prisma.loja.findUnique({ where: { id: lojaId }, select: { nome: true } });

  const fn = seguro ? enfileirarSeguro : enfileirar;
  return fn({
    lojaId,
    tipo: "CUPOM_CLIENTE",
    origemId: comanda.id,
    payload: renderCupomComanda(comanda, { largura: larguraDaLoja(), nomeLoja: loja ? loja.nome : "" }),
  });
}

/**
 * Romaneio do turno do motoboy. Só faz sentido em turno já fechado — em turno ABERTO os
 * campos de acerto ainda são null e o papel sairia com "R$ 0,00" em tudo.
 */
async function enfileirarRomaneioMotoboy(lojaId, turnoId, { seguro = false } = {}) {
  const turno = await prisma.turnoMotoboy.findFirst({
    where: { id: turnoId, lojaId },
    include: {
      motoboy: { select: { name: true } },
      extras: true,
      pedidos: { where: { status: "ENTREGUE" }, select: { id: true, paymentMethod: true, totalPrice: true } },
    },
  });
  if (!turno || turno.status === "ABERTO") return null;

  const fn = seguro ? enfileirarSeguro : enfileirar;
  return fn({
    lojaId,
    tipo: "ROMANEIO_MOTOBOY",
    origemId: turno.id,
    payload: renderRomaneioMotoboy(turno, {
      largura: larguraDaLoja(),
      motoboyNome: turno.motoboy ? turno.motoboy.name : "",
      pedidos: turno.pedidos,
      extras: turno.extras,
    }),
  });
}

module.exports = {
  enfileirar,
  enfileirarSeguro,
  enfileirarComandaCozinha,
  enfileirarCupomPedido,
  enfileirarCupomComanda,
  enfileirarRomaneioMotoboy,
};
