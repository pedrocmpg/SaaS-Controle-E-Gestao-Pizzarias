const express = require("express");
const prisma = require("../lib/prisma");
const { decrypt, hashPhone } = require("../lib/encryption");
const attachLojaId = require("../middleware/attachLojaId");
const { requireAuth } = require("../middleware/auth");
const { requireAnyRole } = require("../middleware/authorization");
const { adminReadLimiter } = require("../middleware/rateLimiter");
const { logSecurityEvent } = require("../lib/securityLogger");
const {
  mascararTelefone,
  formatarTelefone,
  agregarPedidos,
  interpretarBusca,
  STATUS_NAO_FATURA,
} = require("../lib/clientes");

const router = express.Router();

// Visão agregada do cliente é gerencial. O ATENDENTE já tem o lookup por telefone
// de que precisa em GET /api/orders/cliente/lookup, no momento do pedido.
const CRM_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE"];

const PAGE_SIZE_PADRAO = 30;
const PAGE_SIZE_MAX = 100;

/**
 * Monta o `where` de busca a partir do termo digitado.
 *
 * Telefone: `phone` é AES com IV aleatório, então não existe LIKE sobre ele. A
 * busca por final usa `phoneLast4` (em claro), e a busca por número completo
 * também tenta o match exato por `phoneHash` — que é o caminho preciso quando o
 * atendente tem o número inteiro.
 */
function montarWhereBusca(lojaId, termo) {
  const base = { lojaId };
  const busca = interpretarBusca(termo);
  if (!busca) return base;

  if (busca.tipo === "telefone") {
    const alternativas = [{ phoneLast4: busca.valor.slice(-4) }];
    if (busca.completo) {
      const hash = hashPhone(busca.valor);
      if (hash) alternativas.push({ phoneHash: hash });
    }
    return { ...base, OR: alternativas };
  }

  return { ...base, name: { contains: busca.valor, mode: "insensitive" } };
}

/**
 * GET /api/clientes
 * Lista paginada com busca e agregados. Isolada por loja.
 *
 * Query: q, inativoDias, page, pageSize, orderBy (ultimoPedido|totalGasto|nome).
 */
router.get("/", requireAuth, requireAnyRole(...CRM_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const { q, inativoDias, page = 1, pageSize = PAGE_SIZE_PADRAO, orderBy = "ultimoPedido" } = req.query;
    const lojaId = req.lojaId;
    const ip = req.ip || req.connection.remoteAddress;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSizeNum = Math.min(PAGE_SIZE_MAX, Math.max(1, parseInt(pageSize) || PAGE_SIZE_PADRAO));

    const where = montarWhereBusca(lojaId, q);

    // Ordenar por agregado (total gasto / último pedido) exigiria calcular sobre
    // TODOS os clientes antes de paginar. Com o volume de uma pizzaria isso é
    // barato, e é o que mantém a ordenação correta — paginar primeiro e ordenar
    // depois ordenaria só a página, que estaria errado.
    const clientes = await prisma.cliente.findMany({
      where,
      select: { id: true, name: true, phone: true, createdAt: true },
      orderBy: orderBy === "nome" ? { name: "asc" } : { id: "desc" },
    });

    if (clientes.length === 0) {
      return res.json({ clientes: [], total: 0, page: pageNum, pageSize: pageSizeNum });
    }

    // Um único groupBy para todos os clientes do recorte — evita o N+1 de agregar
    // pedido por pedido. Todos os `where` levam lojaId: dado de outra pizzaria não
    // pode entrar na conta, nem por acidente.
    const ids = clientes.map((c) => c.id);
    const pedidos = await prisma.order.findMany({
      where: { lojaId, clienteId: { in: ids } },
      select: { clienteId: true, status: true, totalPrice: true, createdAt: true },
    });

    const porCliente = new Map();
    for (const pedido of pedidos) {
      if (!porCliente.has(pedido.clienteId)) porCliente.set(pedido.clienteId, []);
      porCliente.get(pedido.clienteId).push(pedido);
    }

    const agora = new Date();
    let linhas = clientes.map((cliente) => {
      const agregados = agregarPedidos(porCliente.get(cliente.id) || [], agora);
      return {
        id: cliente.id,
        name: cliente.name,
        // Telefone mascarado: a lista mostra o suficiente para reconhecer o
        // cliente; o número inteiro só aparece no detalhe.
        phone: mascararTelefone(cliente.phone ? decrypt(cliente.phone) : null),
        ...agregados,
      };
    });

    // Filtro de recuperação: quem não pede há N dias. Cliente que nunca pediu não
    // é "inativo" — nunca esteve ativo —, então fica fora.
    const dias = parseInt(inativoDias);
    if (!isNaN(dias) && dias > 0) {
      linhas = linhas.filter((l) => l.diasSemPedir != null && l.diasSemPedir >= dias);
    }

    linhas.sort(comparadorDe(orderBy));

    const total = linhas.length;
    const inicio = (pageNum - 1) * pageSizeNum;
    const pagina = linhas.slice(inicio, inicio + pageSizeNum);

    logSecurityEvent("LIST_CLIENTES", { adminId: req.admin.id, lojaId, total }, ip);

    res.json({ clientes: pagina, total, page: pageNum, pageSize: pageSizeNum });
  } catch (err) {
    next(err);
  }
});

/** Ordenação da lista já com os agregados calculados. */
function comparadorDe(orderBy) {
  if (orderBy === "nome") return (a, b) => a.name.localeCompare(b.name, "pt-BR");
  if (orderBy === "totalGasto") return (a, b) => b.totalGasto - a.totalGasto;
  // Padrão: quem pediu mais recentemente primeiro. Sem pedido vai para o fim.
  return (a, b) => {
    if (!a.ultimoPedidoEm) return 1;
    if (!b.ultimoPedidoEm) return -1;
    return new Date(b.ultimoPedidoEm) - new Date(a.ultimoPedidoEm);
  };
}

/**
 * GET /api/clientes/inativos?dias=30
 * Atalho da lista de recuperação, ordenado por valor: o dono quer saber quais
 * clientes VALIOSOS sumiram, não qualquer um.
 * Definida antes de /:id para não colidir com o parâmetro.
 */
router.get("/inativos", requireAuth, requireAnyRole(...CRM_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const dias = Math.max(1, parseInt(req.query.dias) || 30);
    const lojaId = req.lojaId;

    const clientes = await prisma.cliente.findMany({
      where: { lojaId },
      select: { id: true, name: true, phone: true },
    });

    if (clientes.length === 0) return res.json({ clientes: [], dias });

    const pedidos = await prisma.order.findMany({
      where: { lojaId, clienteId: { in: clientes.map((c) => c.id) } },
      select: { clienteId: true, status: true, totalPrice: true, createdAt: true },
    });

    const porCliente = new Map();
    for (const pedido of pedidos) {
      if (!porCliente.has(pedido.clienteId)) porCliente.set(pedido.clienteId, []);
      porCliente.get(pedido.clienteId).push(pedido);
    }

    const agora = new Date();
    const inativos = clientes
      .map((cliente) => {
        const agregados = agregarPedidos(porCliente.get(cliente.id) || [], agora);
        return {
          id: cliente.id,
          name: cliente.name,
          phone: mascararTelefone(cliente.phone ? decrypt(cliente.phone) : null),
          ...agregados,
        };
      })
      .filter((c) => c.diasSemPedir != null && c.diasSemPedir >= dias)
      .sort((a, b) => b.totalGasto - a.totalGasto);

    res.json({ clientes: inativos, dias });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/clientes/:id
 * Detalhe com histórico completo. Aqui o telefone e o endereço vêm inteiros —
 * é a tela de atendimento, onde o operador precisa ligar para o cliente.
 */
router.get("/:id", requireAuth, requireAnyRole(...CRM_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const lojaId = req.lojaId;
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(id)) return res.status(400).json({ error: "ID de cliente inválido." });

    const cliente = await prisma.cliente.findFirst({
      // lojaId no where (não findUnique por id): pedir o cliente de outra pizzaria
      // tem que ser 404, nunca um vazamento entre tenants.
      where: { id, lojaId },
    });

    if (!cliente) return res.status(404).json({ error: "Cliente não encontrado." });

    const pedidos = await prisma.order.findMany({
      where: { lojaId, clienteId: id },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

    const agregados = agregarPedidos(pedidos, new Date());
    const telefone = cliente.phone ? decrypt(cliente.phone) : null;

    logSecurityEvent("VIEW_CLIENTE", { adminId: req.admin.id, clienteId: id, lojaId }, ip);

    res.json({
      cliente: {
        id: cliente.id,
        name: cliente.name,
        phone: formatarTelefone(telefone),
        address: cliente.address ? decrypt(cliente.address) : null,
        createdAt: cliente.createdAt,
        ...agregados,
      },
      pedidos: pedidos.map((pedido) => ({
        ...pedido,
        phone: undefined, // já vem do cliente; não repetir dado sensível por linha
        address: pedido.address ? decrypt(pedido.address) : null,
        naoFatura: pedido.status === STATUS_NAO_FATURA,
      })),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
