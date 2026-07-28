const express = require("express");
const prisma = require("../lib/prisma");
const { encrypt, decrypt, hashPhone } = require("../lib/encryption");
const attachLojaId = require("../middleware/attachLojaId");
const { requireAuth } = require("../middleware/auth");
const { requireAnyRole } = require("../middleware/authorization");
const { orderLimiter, adminReadLimiter, adminWriteLimiter } = require("../middleware/rateLimiter");
const validateRequest = require("../middleware/validateRequest");
const { createOrderSchema, updateOrderStatusSchema } = require("../validators/schemas");
const { logSecurityEvent } = require("../lib/securityLogger");
const { ALL_STATUSES, isValidTransition } = require("../lib/orderStatus");
const { emitPedidoNovo, emitPedidoStatus, emitDespachoAtribuido, emitDespachoEntregue } = require("../lib/socket");
const { logAuditChange } = require("../middleware/auditLogger");
const { enfileirarComandaCozinha, enfileirarCupomPedido } = require("../lib/impressao");

const router = express.Router();

// Roles que podem operar pedidos (ver + mudar status)
const ORDER_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE", "ATENDENTE"];

const VALID_STATUSES = ALL_STATUSES;

/**
 * POST /api/orders
 * Cria um pedido de tele-entrega pelo ATENDENTE autenticado (fluxo interno).
 * - lojaId resolvido do operador (isolamento multi-tenant).
 * - Telefone/endereço criptografados no Order; Cliente upsertado por telefone (histórico).
 * - Notifica o painel da loja em tempo real via WebSocket.
 */
router.post("/", requireAuth, requireAnyRole(...ORDER_ROLES), adminWriteLimiter, attachLojaId, validateRequest(createOrderSchema), async (req, res, next) => {
  try {
    const {
      customerName,
      phone,
      address,
      deliveryType,
      paymentMethod,
      notes,
      deliveryFee,
      items,
      origem,
    } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const lojaId = req.lojaId;

    const itemsData = items.map((item) => {
      const unitPrice = Number(item.unitPrice);
      const quantity = Number(item.quantity) || 1;
      return {
        itemName: item.itemName,
        itemType: item.itemType,
        flavors: item.flavors || null,
        borderName: item.borderName || null,
        quantity,
        unitPrice,
        subtotal: unitPrice * quantity,
        observations: item.observations || null,
      };
    });

    const itemsTotal = itemsData.reduce((sum, i) => sum + i.subtotal, 0);
    // Taxa de entrega: valor fixo digitado pelo atendente. RETIRADA não cobra taxa.
    const fee = deliveryType === "RETIRADA" ? 0 : Number(deliveryFee) || 0;
    const totalPrice = itemsTotal + fee;

    // Cliente/histórico por telefone, isolado por loja (mesmo telefone em outra loja = outro cliente).
    const phoneHash = hashPhone(phone);
    let cliente = null;
    if (phoneHash) {
      cliente = await prisma.cliente.upsert({
        where: { lojaId_phoneHash: { lojaId, phoneHash } },
        update: {
          name: customerName,
          ...(address ? { address: encrypt(address) } : {}),
        },
        create: {
          lojaId,
          phoneHash,
          name: customerName,
          address: address ? encrypt(address) : null,
        },
      });
    }

    const order = await prisma.order.create({
      data: {
        lojaId,
        customerName,
        phone: encrypt(phone), // Criptografa telefone
        address: address ? encrypt(address) : null, // Criptografa endereço
        deliveryType: deliveryType || "ENTREGA",
        paymentMethod,
        notes: notes || null,
        origem: origem || "TELEFONE",
        deliveryFee: fee,
        totalPrice,
        atendenteId: req.admin.id,
        clienteId: cliente ? cliente.id : null,
        items: { create: itemsData },
      },
      include: { items: true },
    });

    // Descriptografa antes de retornar (dados legíveis para o painel)
    const responseOrder = {
      ...order,
      phone: decrypt(order.phone),
      address: order.address ? decrypt(order.address) : null,
    };

    logSecurityEvent("CREATE_ORDER", { adminId: req.admin.id, orderId: order.id, lojaId }, ip);

    // Notifica o painel em tempo real (room da loja)
    emitPedidoNovo(order.lojaId, responseOrder);

    // Impressão automática da comanda de cozinha: é o disparo que importa. Se o atendente
    // precisasse clicar para a cozinha saber do pedido, o problema não estaria resolvido.
    // `seguro`: falha de impressão não pode derrubar a criação do pedido já gravado.
    await enfileirarComandaCozinha(order.lojaId, order.id, { seguro: true });

    res.status(201).json(responseOrder);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders/cliente/lookup?phone=
 * Busca o cliente por telefone (isolado por loja) para auto-preencher o pedido.
 * Definida antes de GET /:id para não colidir com o parâmetro.
 */
router.get("/cliente/lookup", requireAuth, requireAnyRole(...ORDER_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ error: "Telefone é obrigatório." });
    }

    const lojaId = req.lojaId;

    const phoneHash = hashPhone(phone);
    if (!phoneHash) {
      return res.json({ found: false });
    }

    const cliente = await prisma.cliente.findUnique({
      where: { lojaId_phoneHash: { lojaId, phoneHash } },
    });

    if (!cliente) {
      return res.json({ found: false });
    }

    res.json({
      found: true,
      cliente: {
        name: cliente.name,
        address: cliente.address ? decrypt(cliente.address) : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders
 * Lista pedidos (uso do painel admin). Protegida.
 * Descriptografa telefone e endereço antes de retornar.
 */
router.get("/", requireAuth, requireAnyRole(...ORDER_ROLES), adminReadLimiter, async (req, res, next) => {
  try {
    const { status, lojaId, page = 1, pageSize = 20 } = req.query;
    const ip = req.ip || req.connection.remoteAddress;

    // Validação de página e tamanho
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize) || 20)); // máx 100

    const where = {};
    if (status && VALID_STATUSES.includes(String(status).toUpperCase())) {
      where.status = String(status).toUpperCase();
    }
    // Isolamento: operador vinculado só vê a própria loja; SUPER_ADMIN global pode filtrar por ?lojaId.
    if (req.admin.lojaId != null) {
      where.lojaId = req.admin.lojaId;
    } else if (lojaId && !isNaN(parseInt(lojaId))) {
      where.lojaId = parseInt(lojaId);
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * pageSizeNum,
        take: pageSizeNum,
      }),
      prisma.order.count({ where }),
    ]);

    // Descriptografa dados sensíveis
    const decryptedOrders = orders.map((order) => ({
      ...order,
      phone: decrypt(order.phone),
      address: order.address ? decrypt(order.address) : null,
    }));

    logSecurityEvent("LIST_ORDERS", { adminId: req.admin.id, page: pageNum }, ip);

    res.json({ orders: decryptedOrders, total, page: pageNum, pageSize: pageSizeNum });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders/reports/today
 * Números simples do dia atual: total de pedidos, faturamento, ticket médio.
 * Protegida (SUPER_ADMIN, ADMIN, GERENTE — não ATENDENTE).
 */
router.get("/reports/today", requireAuth, requireAnyRole("SUPER_ADMIN", "ADMIN", "GERENTE"), adminReadLimiter, async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const reportWhere = {
      createdAt: { gte: startOfDay },
      status: { not: "CANCELADO" },
    };
    // Operador vinculado só soma a própria loja.
    if (req.admin.lojaId != null) {
      reportWhere.lojaId = req.admin.lojaId;
    }

    const orders = await prisma.order.findMany({
      where: reportWhere,
      select: { totalPrice: true },
    });

    const ordersToday = orders.length;
    const revenueToday = orders.reduce((sum, o) => sum + Number(o.totalPrice), 0);
    const averageTicket = ordersToday > 0 ? revenueToday / ordersToday : 0;

    logSecurityEvent("VIEW_TODAY_REPORT", { adminId: req.admin.id }, ip);

    res.json({ ordersToday, revenueToday, averageTicket });
  } catch (err) {
    next(err);
  }
});

// Roles com acesso ao relatório gerencial (mesma régua de /reports/today).
const REPORT_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE"];

// Períodos pré-definidos aceitos por /reports/summary. Datas sempre em horário local do servidor.
function resolveReportRange(query) {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const periodo = (query.periodo || "hoje").toString();

  // Intervalo custom: from/to em YYYY-MM-DD (inclusivo nas duas pontas).
  if (periodo === "custom") {
    const from = query.from ? new Date(`${query.from}T00:00:00`) : startOfToday;
    const to = query.to ? new Date(`${query.to}T23:59:59.999`) : now;
    if (isNaN(from) || isNaN(to) || from > to) return null;
    return { gte: from, lte: to };
  }

  const start = new Date(startOfToday);
  let end = now;

  switch (periodo) {
    case "hoje":
      break;
    case "ontem":
      start.setDate(start.getDate() - 1);
      end = new Date(startOfToday.getTime() - 1); // 23:59:59.999 de ontem
      break;
    case "7dias":
      start.setDate(start.getDate() - 6); // hoje + 6 dias atrás = 7 dias
      break;
    case "30dias":
      start.setDate(start.getDate() - 29);
      break;
    default:
      return null;
  }
  return { gte: start, lte: end };
}

// Chave YYYY-MM-DD em horário local (para agrupar faturamento por dia).
function dayKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * GET /api/orders/reports/summary
 * Relatório gerencial por período. Agrega tele-entrega (Order) + salão (Comanda fechada).
 * Query: periodo=hoje|ontem|7dias|30dias|custom (+ from/to em YYYY-MM-DD quando custom).
 * Isolado por loja via attachLojaId (multi-tenant não-negociável).
 */
router.get("/reports/summary", requireAuth, requireAnyRole(...REPORT_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;

    const range = resolveReportRange(req.query);
    if (!range) {
      return res.status(400).json({ error: "Período inválido. Use hoje|ontem|7dias|30dias|custom (com from/to)." });
    }

    const lojaId = req.lojaId;

    // Tele-entrega: pedidos não cancelados no período.
    const orders = await prisma.order.findMany({
      where: { lojaId, status: { not: "CANCELADO" }, createdAt: range },
      select: {
        totalPrice: true,
        paymentMethod: true,
        createdAt: true,
        items: { select: { itemName: true, quantity: true, subtotal: true } },
      },
    });

    // Salão: comandas fechadas no período (fechadaEm dentro do range).
    const comandas = await prisma.comanda.findMany({
      where: { lojaId, status: "FECHADA", fechadaEm: range },
      select: {
        totalPrice: true,
        paymentMethod: true,
        fechadaEm: true,
        itens: { select: { descricao: true, quantidade: true, unitPrice: true } },
      },
    });

    // Normaliza a forma de pagamento para um rótulo estável.
    const normPagamento = (pm) => (pm ? pm.toString().toUpperCase() : "NAO_INFORMADO");

    const porDia = {}; // dayKey -> receita
    const porPagamento = {}; // metodo -> receita
    const rankItens = {}; // nome -> { quantidade, receita }

    let totalPedidos = 0;
    let totalReceita = 0;
    let receitaTele = 0;
    let receitaSalao = 0;

    const acumular = (valor, data, pagamento, itens, mapItem) => {
      const v = Number(valor);
      totalPedidos += 1;
      totalReceita += v;
      const dk = dayKey(data);
      porDia[dk] = (porDia[dk] || 0) + v;
      const pg = normPagamento(pagamento);
      porPagamento[pg] = (porPagamento[pg] || 0) + v;
      for (const it of itens) {
        const { nome, qtd, receita } = mapItem(it);
        if (!nome) continue;
        const cur = rankItens[nome] || { quantidade: 0, receita: 0 };
        cur.quantidade += qtd;
        cur.receita += receita;
        rankItens[nome] = cur;
      }
    };

    for (const o of orders) {
      receitaTele += Number(o.totalPrice);
      acumular(o.totalPrice, o.createdAt, o.paymentMethod, o.items, (it) => ({
        nome: it.itemName,
        qtd: it.quantity,
        receita: Number(it.subtotal),
      }));
    }
    for (const c of comandas) {
      receitaSalao += Number(c.totalPrice);
      acumular(c.totalPrice, c.fechadaEm, c.paymentMethod, c.itens, (it) => ({
        nome: it.descricao,
        qtd: it.quantidade,
        receita: Number(it.unitPrice) * it.quantidade,
      }));
    }

    const ticketMedio = totalPedidos > 0 ? totalReceita / totalPedidos : 0;

    // Série diária ordenada por data (para o gráfico).
    const faturamentoPorDia = Object.entries(porDia)
      .map(([dia, receita]) => ({ dia, receita: Number(receita.toFixed(2)) }))
      .sort((a, b) => a.dia.localeCompare(b.dia));

    const porFormaPagamento = Object.entries(porPagamento)
      .map(([metodo, receita]) => ({ metodo, receita: Number(receita.toFixed(2)) }))
      .sort((a, b) => b.receita - a.receita);

    const topItens = Object.entries(rankItens)
      .map(([nome, v]) => ({ nome, quantidade: v.quantidade, receita: Number(v.receita.toFixed(2)) }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);

    logSecurityEvent("VIEW_REPORT_SUMMARY", { adminId: req.admin.id, periodo: req.query.periodo || "hoje" }, ip);

    res.json({
      periodo: req.query.periodo || "hoje",
      totalPedidos,
      totalReceita: Number(totalReceita.toFixed(2)),
      ticketMedio: Number(ticketMedio.toFixed(2)),
      porCanal: {
        teleEntrega: Number(receitaTele.toFixed(2)),
        salao: Number(receitaSalao.toFixed(2)),
      },
      porFormaPagamento,
      faturamentoPorDia,
      topItens,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders/:id
 * Consulta um pedido específico. Protegida.
 * Descriptografa telefone e endereço.
 */
router.get("/:id", requireAuth, requireAnyRole(...ORDER_ROLES), adminReadLimiter, async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(orderId)) {
      return res.status(400).json({ error: "ID de pedido inválido" });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      return res.status(404).json({ error: "Pedido não encontrado." });
    }

    // Isolamento: operador não pode ver pedido de outra loja.
    if (req.admin.lojaId != null && order.lojaId !== req.admin.lojaId) {
      return res.status(404).json({ error: "Pedido não encontrado." });
    }

    // Descriptografa dados sensíveis
    const decryptedOrder = {
      ...order,
      phone: decrypt(order.phone),
      address: order.address ? decrypt(order.address) : null,
    };

    logSecurityEvent("VIEW_ORDER", { adminId: req.admin.id, orderId }, ip);

    res.json(decryptedOrder);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/orders/:id/status
 * Atualiza o status de um pedido. Protegida (SUPER_ADMIN e ADMIN).
 */
router.patch("/:id/status", requireAuth, requireAnyRole(...ORDER_ROLES), adminWriteLimiter, validateRequest(updateOrderStatusSchema), async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const { status, motoboyId } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(orderId)) {
      return res.status(400).json({ error: "ID de pedido inválido" });
    }

    const current = await prisma.order.findUnique({ where: { id: orderId } });
    if (!current) {
      return res.status(404).json({ error: "Pedido não encontrado." });
    }

    // Isolamento: operador não pode alterar pedido de outra loja.
    if (req.admin.lojaId != null && current.lojaId !== req.admin.lojaId) {
      return res.status(404).json({ error: "Pedido não encontrado." });
    }

    // Só permite avançar na ordem correta (sem pular/voltar), exceto cancelamento
    if (current.status !== status && !isValidTransition(current.status, status)) {
      logSecurityEvent("INVALID_ORDER_TRANSITION", {
        adminId: req.admin.id,
        orderId,
        from: current.status,
        to: status,
      }, ip);
      return res.status(409).json({
        error: `Transição de status inválida: ${current.status} → ${status}.`,
        from: current.status,
        to: status,
      });
    }

    // Módulo Motoboy: despacho exige um turno ABERTO do motoboy escolhido nesta loja.
    // Vincula a FK direta (turnoMotoboyId) para o fechamento do turno não depender de janela
    // de tempo — evita que um pedido marcado ENTREGUE com atraso caia no turno errado.
    const data = { status };
    if (status === "SAIU_PARA_ENTREGA") {
      const turno = await prisma.turnoMotoboy.findFirst({
        where: { motoboyId, lojaId: current.lojaId, status: "ABERTO" },
      });
      if (!turno) {
        return res.status(409).json({ error: "Motoboy não tem turno aberto nesta loja. Abra um turno antes de despachar." });
      }
      data.motoboyId = motoboyId;
      data.turnoMotoboyId = turno.id;
    }
    if (status === "ENTREGUE") {
      data.entregueEm = new Date();
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data,
      include: { items: true },
    });

    logSecurityEvent("UPDATE_ORDER_STATUS", {
      adminId: req.admin.id,
      orderId,
      newStatus: status,
    }, ip);

    logAuditChange(
      "Order",
      orderId,
      "UPDATE",
      { status: current.status },
      { status: order.status },
      req.admin.id,
      ip,
      req.get("user-agent")
    ).catch((err) => console.error("Erro ao logar auditoria de status de pedido:", err));

    // Notifica o painel em tempo real (room da loja)
    emitPedidoStatus(order.lojaId, order);
    if (status === "SAIU_PARA_ENTREGA") {
      emitDespachoAtribuido(order.lojaId, order);
      // Cupom do cliente: a via que sai junto com o pedido, na mão do motoboy.
      await enfileirarCupomPedido(order.lojaId, order.id, { seguro: true });
    }
    if (status === "ENTREGUE") {
      emitDespachoEntregue(order.lojaId, order);
    }

    res.json(order);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
