const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { requireAnyRole } = require("../middleware/authorization");
const { adminReadLimiter, adminWriteLimiter } = require("../middleware/rateLimiter");
const { auditCatalogChange } = require("../middleware/auditLogger");
const validateRequest = require("../middleware/validateRequest");
const { ofertaSchema, ofertaPatchSchema } = require("../validators/schemas");
const { logSecurityEvent } = require("../lib/securityLogger");
const { resolveLojaId } = require("../lib/lojaScope");

const router = express.Router();

// Mesmos grupos de papel usados no restante do cardápio (catalog.routes.js).
const OFERTA_READ_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE", "ATENDENTE"];
const OFERTA_WRITE_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE"];

async function attachLojaId(req, res, next) {
  try {
    req.lojaId = await resolveLojaId(req);
    if (req.lojaId == null) {
      return res.status(400).json({ error: "Nenhuma loja associada a esta requisição." });
    }
    next();
  } catch (err) {
    next(err);
  }
}

function serializeOferta(oferta) {
  return {
    ...oferta,
    produtos: undefined,
    productIds: oferta.produtos?.map((p) => p.productId) ?? undefined,
    products: oferta.produtos?.map((p) => p.product) ?? undefined,
  };
}

/**
 * GET /api/ofertas
 * Lista produtos disponíveis pra vincular a uma oferta (pro multi-select do formulário).
 */
router.get("/produtos-disponiveis", requireAuth, requireAnyRole(...OFERTA_READ_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { lojaId: req.lojaId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, category: true, price: true },
    });
    res.json(products);
  } catch (err) {
    next(err);
  }
});

router.get("/", requireAuth, requireAnyRole(...OFERTA_READ_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const ofertas = await prisma.oferta.findMany({
      where: { lojaId: req.lojaId },
      orderBy: { createdAt: "desc" },
      include: { produtos: { include: { product: { select: { id: true, name: true } } } } },
    });
    res.json(ofertas.map(serializeOferta));
  } catch (err) {
    next(err);
  }
});

router.post(
  "/",
  requireAuth,
  requireAnyRole(...OFERTA_WRITE_ROLES),
  adminWriteLimiter,
  attachLojaId,
  auditCatalogChange("Oferta"),
  validateRequest(ofertaSchema),
  async (req, res, next) => {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const { productIds, ...data } = req.body;

      const oferta = await prisma.oferta.create({
        data: {
          ...data,
          lojaId: req.lojaId,
          produtos: { create: productIds.map((productId) => ({ productId })) },
        },
        include: { produtos: { include: { product: { select: { id: true, name: true } } } } },
      });

      logSecurityEvent("CREATE_OFERTA", { adminId: req.admin.id, ofertaId: oferta.id }, ip);

      res.status(201).json(serializeOferta(oferta));
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  "/:id",
  requireAuth,
  requireAnyRole(...OFERTA_WRITE_ROLES),
  adminWriteLimiter,
  attachLojaId,
  auditCatalogChange("Oferta"),
  validateRequest(ofertaSchema),
  async (req, res, next) => {
    try {
      const ofertaId = parseInt(req.params.id);
      const ip = req.ip || req.connection.remoteAddress;

      if (isNaN(ofertaId)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      const found = await prisma.oferta.findFirst({ where: { id: ofertaId, lojaId: req.lojaId }, select: { id: true } });
      if (!found) {
        return res.status(404).json({ error: "Oferta não encontrada nesta loja." });
      }

      const { productIds, ...data } = req.body;

      // Substitui o vínculo de produtos por completo (simples, evita diff incremental).
      const oferta = await prisma.$transaction(async (tx) => {
        await tx.ofertaProduto.deleteMany({ where: { ofertaId } });
        return tx.oferta.update({
          where: { id: ofertaId },
          data: {
            ...data,
            produtos: { create: productIds.map((productId) => ({ productId })) },
          },
          include: { produtos: { include: { product: { select: { id: true, name: true } } } } },
        });
      });

      logSecurityEvent("UPDATE_OFERTA", { adminId: req.admin.id, ofertaId }, ip);

      res.json(serializeOferta(oferta));
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/ofertas/:id
 * Edição parcial (preço/disponibilidade), sem mexer nos produtos vinculados.
 */
router.patch(
  "/:id",
  requireAuth,
  requireAnyRole(...OFERTA_WRITE_ROLES),
  adminWriteLimiter,
  attachLojaId,
  auditCatalogChange("Oferta"),
  validateRequest(ofertaPatchSchema),
  async (req, res, next) => {
    try {
      const ofertaId = parseInt(req.params.id);
      const ip = req.ip || req.connection.remoteAddress;

      if (isNaN(ofertaId)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      const found = await prisma.oferta.findFirst({ where: { id: ofertaId, lojaId: req.lojaId }, select: { id: true } });
      if (!found) {
        return res.status(404).json({ error: "Oferta não encontrada nesta loja." });
      }

      const oferta = await prisma.oferta.update({
        where: { id: ofertaId },
        data: req.body,
        include: { produtos: { include: { product: { select: { id: true, name: true } } } } },
      });

      logSecurityEvent("UPDATE_OFERTA", { adminId: req.admin.id, ofertaId }, ip);

      res.json(serializeOferta(oferta));
    } catch (err) {
      next(err);
    }
  }
);

router.delete("/:id", requireAuth, requireAnyRole(...OFERTA_WRITE_ROLES), adminWriteLimiter, attachLojaId, auditCatalogChange("Oferta"), async (req, res, next) => {
  try {
    const ofertaId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(ofertaId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const found = await prisma.oferta.findFirst({ where: { id: ofertaId, lojaId: req.lojaId }, select: { id: true } });
    if (!found) {
      return res.status(404).json({ error: "Oferta não encontrada nesta loja." });
    }

    await prisma.oferta.delete({ where: { id: ofertaId } });

    logSecurityEvent("DELETE_OFERTA", { adminId: req.admin.id, ofertaId }, ip);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
