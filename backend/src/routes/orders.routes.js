const express = require("express");
const prisma = require("../lib/prisma");
const { encrypt, decrypt } = require("../lib/encryption");
const { requireAuth } = require("../middleware/auth");
const { requireAnyRole } = require("../middleware/authorization");
const { orderLimiter, adminReadLimiter, adminWriteLimiter } = require("../middleware/rateLimiter");
const validateRequest = require("../middleware/validateRequest");
const { createOrderSchema, updateOrderStatusSchema } = require("../validators/schemas");
const { logSecurityEvent } = require("../lib/securityLogger");
const { ALL_STATUSES, isValidTransition } = require("../lib/orderStatus");
const { emitPedidoNovo, emitPedidoStatus } = require("../lib/socket");

const router = express.Router();

// Roles que podem operar pedidos (ver + mudar status)
const ORDER_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE", "ATENDENTE"];

const VALID_STATUSES = ALL_STATUSES;

/**
 * POST /api/orders
 * Cria um novo pedido. Rota pública (usada pelo checkout do site).
 * Telefone e endereço são criptografados antes de salvar.
 */
router.post("/", orderLimiter, validateRequest(createOrderSchema), async (req, res, next) => {
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
    } = req.body;

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
    const fee = deliveryType === "RETIRADA" ? 0 : Number(deliveryFee) || 10;
    const totalPrice = itemsTotal + fee;

    // Loja de destino: hoje há uma única loja. Estrutura pronta p/ múltiplas lojas.
    const loja = await prisma.loja.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
    if (!loja) {
      return res.status(503).json({ error: "Nenhuma loja configurada. Execute o seed." });
    }

    const order = await prisma.order.create({
      data: {
        lojaId: loja.id,
        customerName,
        phone: encrypt(phone), // Criptografa telefone
        address: address ? encrypt(address) : null, // Criptografa endereço
        deliveryType: deliveryType || "ENTREGA",
        paymentMethod,
        notes: notes || null,
        deliveryFee: fee,
        totalPrice,
        items: { create: itemsData },
      },
      include: { items: true },
    });

    // Descriptografa antes de retornar (para que cliente receba os dados legíveis)
    const responseOrder = {
      ...order,
      phone: decrypt(order.phone),
      address: order.address ? decrypt(order.address) : null,
    };

    // Notifica o painel em tempo real (room da loja)
    emitPedidoNovo(order.lojaId, responseOrder);

    res.status(201).json(responseOrder);
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
    if (lojaId && !isNaN(parseInt(lojaId))) {
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
    const { status } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(orderId)) {
      return res.status(400).json({ error: "ID de pedido inválido" });
    }

    const current = await prisma.order.findUnique({ where: { id: orderId } });
    if (!current) {
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

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: { items: true },
    });

    logSecurityEvent("UPDATE_ORDER_STATUS", {
      adminId: req.admin.id,
      orderId,
      newStatus: status,
    }, ip);

    // Notifica o painel em tempo real (room da loja)
    emitPedidoStatus(order.lojaId, order);

    res.json(order);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
