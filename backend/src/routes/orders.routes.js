const express = require("express");
const prisma = require("../lib/prisma");
const { encrypt, decrypt } = require("../lib/encryption");
const { requireAuth } = require("../middleware/auth");
const { requireAnyRole } = require("../middleware/authorization");
const { orderLimiter, adminReadLimiter, adminWriteLimiter } = require("../middleware/rateLimiter");
const validateRequest = require("../middleware/validateRequest");
const { createOrderSchema, updateOrderStatusSchema } = require("../validators/schemas");
const { logSecurityEvent } = require("../lib/securityLogger");

const router = express.Router();

const VALID_STATUSES = [
  "PENDENTE",
  "CONFIRMADO",
  "EM_PREPARO",
  "SAIU_PARA_ENTREGA",
  "ENTREGUE",
  "CANCELADO",
];

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

    const order = await prisma.order.create({
      data: {
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
router.get("/", requireAuth, adminReadLimiter, async (req, res, next) => {
  try {
    const { status, page = 1, pageSize = 20 } = req.query;
    const ip = req.ip || req.connection.remoteAddress;

    // Validação de página e tamanho
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize) || 20)); // máx 100

    const where = status && VALID_STATUSES.includes(String(status).toUpperCase())
      ? { status: String(status).toUpperCase() }
      : undefined;

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
router.get("/:id", requireAuth, adminReadLimiter, async (req, res, next) => {
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
router.patch("/:id/status", requireAuth, requireAnyRole("SUPER_ADMIN", "ADMIN"), adminWriteLimiter, validateRequest(updateOrderStatusSchema), async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.id);
    const { status } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(orderId)) {
      return res.status(400).json({ error: "ID de pedido inválido" });
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

    res.json(order);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
