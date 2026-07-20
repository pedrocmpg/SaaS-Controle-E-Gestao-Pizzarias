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
  pizzaSizePatchSchema,
  flavorPatchSchema,
  borderPatchSchema,
  productPatchSchema,
} = require("../validators/schemas");
const { logSecurityEvent } = require("../lib/securityLogger");
const { resolveLojaId } = require("../lib/lojaScope");

const router = express.Router();

// Roles que podem consultar o cardápio (inclui ATENDENTE p/ montar pedidos).
const CATALOG_READ_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE", "ATENDENTE"];
// Roles que podem editar o cardápio.
const CATALOG_WRITE_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE"];

/**
 * Middleware: resolve e anexa o lojaId efetivo do operador (isolamento multi-tenant).
 */
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

/**
 * Garante que o registro pertence à loja do operador antes de alterar/excluir.
 * Retorna true se ok; caso contrário responde 404 e retorna false.
 */
async function ensureOwned(model, id, lojaId, res) {
  const found = await prisma[model].findFirst({ where: { id, lojaId }, select: { id: true } });
  if (!found) {
    res.status(404).json({ error: "Registro não encontrado nesta loja." });
    return false;
  }
  return true;
}

/**
 * GET /api/catalog
 * Retorna todo o catálogo de uma vez.
 */
router.get("/", requireAuth, requireAnyRole(...CATALOG_READ_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const { lojaId } = req;
    const [pizzaSizes, flavors, borders, products] = await Promise.all([
      prisma.pizzaSize.findMany({ where: { lojaId, active: true }, orderBy: { order: "asc" } }),
      prisma.flavor.findMany({ where: { lojaId, active: true }, orderBy: { order: "asc" } }),
      prisma.border.findMany({ where: { lojaId, active: true }, orderBy: { order: "asc" } }),
      prisma.product.findMany({ where: { lojaId, active: true }, orderBy: { order: "asc" } }),
    ]);

    res.json({ pizzaSizes, flavors, borders, products });
  } catch (err) {
    next(err);
  }
});

// ---------- Pizza Sizes ----------
router.get("/sizes", requireAuth, requireAnyRole(...CATALOG_READ_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const sizes = await prisma.pizzaSize.findMany({ where: { lojaId: req.lojaId }, orderBy: { order: "asc" } });
    res.json(sizes);
  } catch (err) {
    next(err);
  }
});

router.post("/sizes", requireAuth, requireAnyRole(...CATALOG_WRITE_ROLES), adminWriteLimiter, attachLojaId, auditCatalogChange("PizzaSize"), validateRequest(pizzaSizeSchema), async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;

    const size = await prisma.pizzaSize.create({ data: { ...req.body, lojaId: req.lojaId } });

    logSecurityEvent("CREATE_PIZZA_SIZE", { adminId: req.admin.id, sizeId: size.id }, ip);

    res.status(201).json(size);
  } catch (err) {
    next(err);
  }
});

router.put("/sizes/:id", requireAuth, requireAnyRole(...CATALOG_WRITE_ROLES), adminWriteLimiter, attachLojaId, auditCatalogChange("PizzaSize"), validateRequest(pizzaSizeSchema), async (req, res, next) => {
  try {
    const sizeId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(sizeId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    if (!(await ensureOwned("pizzaSize", sizeId, req.lojaId, res))) return;

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

/**
 * PATCH /api/catalog/sizes/:id
 * Edição parcial (preço/disponibilidade) — usada pela tela de Cardápio do operador.
 */
router.patch("/sizes/:id", requireAuth, requireAnyRole(...CATALOG_WRITE_ROLES), adminWriteLimiter, attachLojaId, auditCatalogChange("PizzaSize"), validateRequest(pizzaSizePatchSchema), async (req, res, next) => {
  try {
    const sizeId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(sizeId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    if (!(await ensureOwned("pizzaSize", sizeId, req.lojaId, res))) return;

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

router.delete("/sizes/:id", requireAuth, requireAnyRole(...CATALOG_WRITE_ROLES), adminWriteLimiter, attachLojaId, auditCatalogChange("PizzaSize"), async (req, res, next) => {
  try {
    const sizeId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(sizeId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    if (!(await ensureOwned("pizzaSize", sizeId, req.lojaId, res))) return;

    await prisma.pizzaSize.delete({ where: { id: sizeId } });

    logSecurityEvent("DELETE_PIZZA_SIZE", { adminId: req.admin.id, sizeId }, ip);

    res.status(204).send();
  } catch (err) {
    if (err.code === "P2003") {
      return res.status(409).json({ error: "Este tamanho está em uso em um botão da grade PDV. Desative-o em vez de excluir." });
    }
    next(err);
  }
});

// ---------- Flavors ----------
router.get("/flavors", requireAuth, requireAnyRole(...CATALOG_READ_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const { type } = req.query;
    const flavors = await prisma.flavor.findMany({
      where: { lojaId: req.lojaId, ...(type ? { type: String(type).toUpperCase() } : {}) },
      orderBy: { order: "asc" },
    });
    res.json(flavors);
  } catch (err) {
    next(err);
  }
});

router.post("/flavors", requireAuth, requireAnyRole(...CATALOG_WRITE_ROLES), adminWriteLimiter, attachLojaId, auditCatalogChange("Flavor"), validateRequest(flavorSchema), async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;

    const flavor = await prisma.flavor.create({ data: { ...req.body, lojaId: req.lojaId } });

    logSecurityEvent("CREATE_FLAVOR", { adminId: req.admin.id, flavorId: flavor.id }, ip);

    res.status(201).json(flavor);
  } catch (err) {
    next(err);
  }
});

router.put("/flavors/:id", requireAuth, requireAnyRole(...CATALOG_WRITE_ROLES), adminWriteLimiter, attachLojaId, auditCatalogChange("Flavor"), validateRequest(flavorSchema), async (req, res, next) => {
  try {
    const flavorId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(flavorId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    if (!(await ensureOwned("flavor", flavorId, req.lojaId, res))) return;

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

/**
 * PATCH /api/catalog/flavors/:id
 * Edição parcial (preço extra/disponibilidade) — usada pela tela de Cardápio do operador.
 */
router.patch("/flavors/:id", requireAuth, requireAnyRole(...CATALOG_WRITE_ROLES), adminWriteLimiter, attachLojaId, auditCatalogChange("Flavor"), validateRequest(flavorPatchSchema), async (req, res, next) => {
  try {
    const flavorId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(flavorId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    if (!(await ensureOwned("flavor", flavorId, req.lojaId, res))) return;

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

router.delete("/flavors/:id", requireAuth, requireAnyRole(...CATALOG_WRITE_ROLES), adminWriteLimiter, attachLojaId, auditCatalogChange("Flavor"), async (req, res, next) => {
  try {
    const flavorId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(flavorId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    if (!(await ensureOwned("flavor", flavorId, req.lojaId, res))) return;

    await prisma.flavor.delete({ where: { id: flavorId } });

    logSecurityEvent("DELETE_FLAVOR", { adminId: req.admin.id, flavorId }, ip);

    res.status(204).send();
  } catch (err) {
    if (err.code === "P2003") {
      return res.status(409).json({ error: "Este sabor está em uso em uma comanda ou botão. Desative-o em vez de excluir." });
    }
    next(err);
  }
});

// ---------- Borders ----------
router.get("/borders", requireAuth, requireAnyRole(...CATALOG_READ_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const borders = await prisma.border.findMany({ where: { lojaId: req.lojaId }, orderBy: { order: "asc" } });
    res.json(borders);
  } catch (err) {
    next(err);
  }
});

router.post("/borders", requireAuth, requireAnyRole(...CATALOG_WRITE_ROLES), adminWriteLimiter, attachLojaId, auditCatalogChange("Border"), validateRequest(borderSchema), async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;

    const border = await prisma.border.create({ data: { ...req.body, lojaId: req.lojaId } });

    logSecurityEvent("CREATE_BORDER", { adminId: req.admin.id, borderId: border.id }, ip);

    res.status(201).json(border);
  } catch (err) {
    next(err);
  }
});

router.put("/borders/:id", requireAuth, requireAnyRole(...CATALOG_WRITE_ROLES), adminWriteLimiter, attachLojaId, auditCatalogChange("Border"), validateRequest(borderSchema), async (req, res, next) => {
  try {
    const borderId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(borderId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    if (!(await ensureOwned("border", borderId, req.lojaId, res))) return;

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

/**
 * PATCH /api/catalog/borders/:id
 * Edição parcial (preço/disponibilidade) — usada pela tela de Cardápio do operador.
 */
router.patch("/borders/:id", requireAuth, requireAnyRole(...CATALOG_WRITE_ROLES), adminWriteLimiter, attachLojaId, auditCatalogChange("Border"), validateRequest(borderPatchSchema), async (req, res, next) => {
  try {
    const borderId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(borderId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    if (!(await ensureOwned("border", borderId, req.lojaId, res))) return;

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

router.delete("/borders/:id", requireAuth, requireAnyRole(...CATALOG_WRITE_ROLES), adminWriteLimiter, attachLojaId, auditCatalogChange("Border"), async (req, res, next) => {
  try {
    const borderId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(borderId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    if (!(await ensureOwned("border", borderId, req.lojaId, res))) return;

    await prisma.border.delete({ where: { id: borderId } });

    logSecurityEvent("DELETE_BORDER", { adminId: req.admin.id, borderId }, ip);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ---------- Products ----------
router.get("/products", requireAuth, requireAnyRole(...CATALOG_READ_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const { category } = req.query;
    const products = await prisma.product.findMany({
      where: { lojaId: req.lojaId, ...(category ? { category: String(category).toUpperCase() } : {}) },
      orderBy: { order: "asc" },
    });
    res.json(products);
  } catch (err) {
    next(err);
  }
});

router.post("/products", requireAuth, requireAnyRole(...CATALOG_WRITE_ROLES), adminWriteLimiter, attachLojaId, auditCatalogChange("Product"), validateRequest(productSchema), async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;

    const product = await prisma.product.create({ data: { ...req.body, lojaId: req.lojaId } });

    logSecurityEvent("CREATE_PRODUCT", { adminId: req.admin.id, productId: product.id }, ip);

    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

router.put("/products/:id", requireAuth, requireAnyRole(...CATALOG_WRITE_ROLES), adminWriteLimiter, attachLojaId, auditCatalogChange("Product"), validateRequest(productSchema), async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(productId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    if (!(await ensureOwned("product", productId, req.lojaId, res))) return;

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

/**
 * PATCH /api/catalog/products/:id
 * Edição parcial (preço/disponibilidade) — usada pela tela de Cardápio do operador.
 */
router.patch("/products/:id", requireAuth, requireAnyRole(...CATALOG_WRITE_ROLES), adminWriteLimiter, attachLojaId, auditCatalogChange("Product"), validateRequest(productPatchSchema), async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(productId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    if (!(await ensureOwned("product", productId, req.lojaId, res))) return;

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

router.delete("/products/:id", requireAuth, requireAnyRole(...CATALOG_WRITE_ROLES), adminWriteLimiter, attachLojaId, auditCatalogChange("Product"), async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(productId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    if (!(await ensureOwned("product", productId, req.lojaId, res))) return;

    await prisma.product.delete({ where: { id: productId } });

    logSecurityEvent("DELETE_PRODUCT", { adminId: req.admin.id, productId }, ip);

    res.status(204).send();
  } catch (err) {
    if (err.code === "P2003") {
      return res.status(409).json({ error: "Este produto está em uso em um botão da grade PDV. Desative-o em vez de excluir." });
    }
    next(err);
  }
});

module.exports = router;
