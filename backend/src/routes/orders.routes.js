const express = require("express");
const prisma = require("../lib/prisma");
const { encrypt, decrypt, hashPhone } = require("../lib/encryption");
const { resolveLojaId } = require("../lib/lojaScope");
const { requireAuth } = require("../middleware/auth");
const { requireAnyRole } = require("../middleware/authorization");
const { orderLimiter, adminReadLimiter, adminWriteLimiter } = require("../middleware/rateLimiter");
const validateRequest = require("../middleware/validateRequest");
const { createOrderSchema, updateOrderStatusSchema } = require("../validators/schemas");
const { logSecurityEvent } = require("../lib/securityLogger");
const { ALL_STATUSES, isValidTransition } = require("../lib/orderStatus");
const { emitPedidoNovo, emitPedidoStatus, emitDespachoAtribuido, emitDespachoEntregue } = require("../lib/socket");
const { logAuditChange } = require("../middleware/auditLogger");

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
router.post("/", requireAuth, requireAnyRole(...ORDER_ROLES), adminWriteLimiter, validateRequest(createOrderSchema), async (req, res, next) => {
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

    const lojaId = await resolveLojaId(req);
    if (lojaId == null) {
      return res.status(400).json({ error: "Nenhuma loja associada a esta requisição." });
    }

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
router.get("/cliente/lookup", requireAuth, requireAnyRole(...ORDER_ROLES), adminReadLimiter, async (req, res, next) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ error: "Telefone é obrigatório." });
    }

    const lojaId = await resolveLojaId(req);
    if (lojaId == null) {
      return res.status(400).json({ error: "Nenhuma loja associada a esta requisição." });
    }

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
