const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { requireAnyRole } = require("../middleware/authorization");
const { adminReadLimiter, adminWriteLimiter } = require("../middleware/rateLimiter");
const { auditCatalogChange } = require("../middleware/auditLogger");
const validateRequest = require("../middleware/validateRequest");
const {
  pizzaSizeSchema,
  flavorSchema,
  borderSchema,
  productSchema,
} = require("../validators/schemas");
const { logSecurityEvent } = require("../lib/securityLogger");

const router = express.Router();

/**
 * GET /api/catalog
 * Retorna todo o catálogo de uma vez.
 */
router.get("/", async (req, res, next) => {
  try {
    const [pizzaSizes, flavors, borders, products] = await Promise.all([
      prisma.pizzaSize.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
      prisma.flavor.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
      prisma.border.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
      prisma.product.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
    ]);

    res.json({ pizzaSizes, flavors, borders, products });
  } catch (err) {
    next(err);
  }
});

// ---------- Pizza Sizes ----------
router.get("/sizes", adminReadLimiter, async (req, res, next) => {
  try {
    const sizes = await prisma.pizzaSize.findMany({ orderBy: { order: "asc" } });
    res.json(sizes);
  } catch (err) {
    next(err);
  }
});

router.post("/sizes", requireAuth, requireAnyRole("SUPER_ADMIN", "ADMIN"), adminWriteLimiter, auditCatalogChange("PizzaSize"), validateRequest(pizzaSizeSchema), async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;

    const size = await prisma.pizzaSize.create({ data: req.body });

    logSecurityEvent("CREATE_PIZZA_SIZE", { adminId: req.admin.id, sizeId: size.id }, ip);

    res.status(201).json(size);
  } catch (err) {
    next(err);
  }
});

router.put("/sizes/:id", requireAuth, requireAnyRole("SUPER_ADMIN", "ADMIN"), adminWriteLimiter, auditCatalogChange("PizzaSize"), validateRequest(pizzaSizeSchema), async (req, res, next) => {
  try {
    const sizeId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(sizeId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const size = await prisma.pizzaSize.update({
      where: { id: sizeId },
      data: req.body,
    });

    logSecurityEvent("UPDATE_PIZZA_SIZE", { adminId: req.admin.id, sizeId }, ip);

    res.json(size);
  } catch (err) {
    next(err);
  }
});

router.delete("/sizes/:id", requireAuth, requireAnyRole("SUPER_ADMIN", "ADMIN"), adminWriteLimiter, auditCatalogChange("PizzaSize"), async (req, res, next) => {
  try {
    const sizeId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(sizeId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    await prisma.pizzaSize.delete({ where: { id: sizeId } });

    logSecurityEvent("DELETE_PIZZA_SIZE", { adminId: req.admin.id, sizeId }, ip);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ---------- Flavors ----------
router.get("/flavors", adminReadLimiter, async (req, res, next) => {
  try {
    const { type } = req.query;
    const flavors = await prisma.flavor.findMany({
      where: type ? { type: String(type).toUpperCase() } : undefined,
      orderBy: { order: "asc" },
    });
    res.json(flavors);
  } catch (err) {
    next(err);
  }
});

router.post("/flavors", requireAuth, requireAnyRole("SUPER_ADMIN", "ADMIN"), adminWriteLimiter, auditCatalogChange("Flavor"), validateRequest(flavorSchema), async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;

    const flavor = await prisma.flavor.create({ data: req.body });

    logSecurityEvent("CREATE_FLAVOR", { adminId: req.admin.id, flavorId: flavor.id }, ip);

    res.status(201).json(flavor);
  } catch (err) {
    next(err);
  }
});

router.put("/flavors/:id", requireAuth, requireAnyRole("SUPER_ADMIN", "ADMIN"), adminWriteLimiter, auditCatalogChange("Flavor"), validateRequest(flavorSchema), async (req, res, next) => {
  try {
    const flavorId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(flavorId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const flavor = await prisma.flavor.update({
      where: { id: flavorId },
      data: req.body,
    });

    logSecurityEvent("UPDATE_FLAVOR", { adminId: req.admin.id, flavorId }, ip);

    res.json(flavor);
  } catch (err) {
    next(err);
  }
});

router.delete("/flavors/:id", requireAuth, requireAnyRole("SUPER_ADMIN", "ADMIN"), adminWriteLimiter, auditCatalogChange("Flavor"), async (req, res, next) => {
  try {
    const flavorId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(flavorId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    await prisma.flavor.delete({ where: { id: flavorId } });

    logSecurityEvent("DELETE_FLAVOR", { adminId: req.admin.id, flavorId }, ip);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ---------- Borders ----------
router.get("/borders", adminReadLimiter, async (req, res, next) => {
  try {
    const borders = await prisma.border.findMany({ orderBy: { order: "asc" } });
    res.json(borders);
  } catch (err) {
    next(err);
  }
});

router.post("/borders", requireAuth, requireAnyRole("SUPER_ADMIN", "ADMIN"), adminWriteLimiter, auditCatalogChange("Border"), validateRequest(borderSchema), async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;

    const border = await prisma.border.create({ data: req.body });

    logSecurityEvent("CREATE_BORDER", { adminId: req.admin.id, borderId: border.id }, ip);

    res.status(201).json(border);
  } catch (err) {
    next(err);
  }
});

router.put("/borders/:id", requireAuth, requireAnyRole("SUPER_ADMIN", "ADMIN"), adminWriteLimiter, auditCatalogChange("Border"), validateRequest(borderSchema), async (req, res, next) => {
  try {
    const borderId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(borderId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const border = await prisma.border.update({
      where: { id: borderId },
      data: req.body,
    });

    logSecurityEvent("UPDATE_BORDER", { adminId: req.admin.id, borderId }, ip);

    res.json(border);
  } catch (err) {
    next(err);
  }
});

router.delete("/borders/:id", requireAuth, requireAnyRole("SUPER_ADMIN", "ADMIN"), adminWriteLimiter, auditCatalogChange("Border"), async (req, res, next) => {
  try {
    const borderId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(borderId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    await prisma.border.delete({ where: { id: borderId } });

    logSecurityEvent("DELETE_BORDER", { adminId: req.admin.id, borderId }, ip);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ---------- Products ----------
router.get("/products", adminReadLimiter, async (req, res, next) => {
  try {
    const { category } = req.query;
    const products = await prisma.product.findMany({
      where: category ? { category: String(category).toUpperCase() } : undefined,
      orderBy: { order: "asc" },
    });
    res.json(products);
  } catch (err) {
    next(err);
  }
});

router.post("/products", requireAuth, requireAnyRole("SUPER_ADMIN", "ADMIN"), adminWriteLimiter, auditCatalogChange("Product"), validateRequest(productSchema), async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;

    const product = await prisma.product.create({ data: req.body });

    logSecurityEvent("CREATE_PRODUCT", { adminId: req.admin.id, productId: product.id }, ip);

    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

router.put("/products/:id", requireAuth, requireAnyRole("SUPER_ADMIN", "ADMIN"), adminWriteLimiter, auditCatalogChange("Product"), validateRequest(productSchema), async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(productId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: req.body,
    });

    logSecurityEvent("UPDATE_PRODUCT", { adminId: req.admin.id, productId }, ip);

    res.json(product);
  } catch (err) {
    next(err);
  }
});

router.delete("/products/:id", requireAuth, requireAnyRole("SUPER_ADMIN", "ADMIN"), adminWriteLimiter, auditCatalogChange("Product"), async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(productId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    await prisma.product.delete({ where: { id: productId } });

    logSecurityEvent("DELETE_PRODUCT", { adminId: req.admin.id, productId }, ip);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
