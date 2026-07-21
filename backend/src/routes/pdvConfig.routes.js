const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { requireAnyRole } = require("../middleware/authorization");
const { adminReadLimiter, adminWriteLimiter } = require("../middleware/rateLimiter");
const validateRequest = require("../middleware/validateRequest");
const { lojaConfigSchema, grupoPdvSchema, reordenarPdvSchema, botaoPdvSchema } = require("../validators/schemas");
const { logSecurityEvent } = require("../lib/securityLogger");
const { logAuditChange } = require("../middleware/auditLogger");
const { resolveLojaId } = require("../lib/lojaScope");

const router = express.Router();

// Configuração da grade (grupos/botões/LojaConfig) — só quem gerencia o cardápio, não ATENDENTE.
const PDV_CONFIG_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE"];

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

// ---------- Config da loja ----------

/**
 * GET /api/pdv-config/loja-config
 * Cria a config com defaults na primeira leitura (upsert-on-read).
 */
router.get("/loja-config", requireAuth, requireAnyRole(...PDV_CONFIG_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const config = await prisma.lojaConfig.upsert({
      where: { lojaId: req.lojaId },
      update: {},
      create: { lojaId: req.lojaId },
    });
    res.json(config);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/pdv-config/loja-config
 */
router.put(
  "/loja-config",
  requireAuth,
  requireAnyRole(...PDV_CONFIG_ROLES),
  adminWriteLimiter,
  attachLojaId,
  validateRequest(lojaConfigSchema),
  async (req, res, next) => {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const before = await prisma.lojaConfig.findUnique({ where: { lojaId: req.lojaId } });

      const config = await prisma.lojaConfig.upsert({
        where: { lojaId: req.lojaId },
        update: req.body,
        create: { lojaId: req.lojaId, ...req.body },
      });

      logSecurityEvent("UPDATE_LOJA_CONFIG", { adminId: req.admin.id, lojaId: req.lojaId }, ip);
      logAuditChange("LojaConfig", config.id, "UPDATE", before, config, req.admin.id, ip, req.get("user-agent")).catch((err) =>
        console.error("Erro ao logar auditoria de LojaConfig:", err)
      );

      res.json(config);
    } catch (err) {
      next(err);
    }
  }
);

// ---------- Grupos ----------

/**
 * GET /api/pdv-config/grupos
 * Lista aninhada (grupos + botões), ordenada por posicao — serve admin, preview e operação.
 */
router.get("/grupos", requireAuth, requireAnyRole(...PDV_CONFIG_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    // pizzaSize/product são necessários no PDV: o montador usa pizzaSize.maxFlavors
    // para limitar os sabores por tamanho, e a grade usa product.category (RODIZIO).
    const grupos = await prisma.grupoPDV.findMany({
      where: { lojaId: req.lojaId },
      orderBy: { posicao: "asc" },
      include: {
        botoes: {
          orderBy: { posicao: "asc" },
          include: { pizzaSize: true, product: true },
        },
      },
    });
    res.json(grupos);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/pdv-config/grupos
 */
router.post(
  "/grupos",
  requireAuth,
  requireAnyRole(...PDV_CONFIG_ROLES),
  adminWriteLimiter,
  attachLojaId,
  validateRequest(grupoPdvSchema),
  async (req, res, next) => {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const grupo = await prisma.grupoPDV.create({ data: { lojaId: req.lojaId, ...req.body } });

      logSecurityEvent("CREATE_GRUPO_PDV", { adminId: req.admin.id, grupoId: grupo.id }, ip);
      logAuditChange("GrupoPDV", grupo.id, "CREATE", null, grupo, req.admin.id, ip, req.get("user-agent")).catch((err) =>
        console.error("Erro ao logar auditoria de GrupoPDV:", err)
      );

      res.status(201).json(grupo);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/pdv-config/grupos/:id
 */
router.put(
  "/grupos/:id",
  requireAuth,
  requireAnyRole(...PDV_CONFIG_ROLES),
  adminWriteLimiter,
  attachLojaId,
  validateRequest(grupoPdvSchema),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const ip = req.ip || req.connection.remoteAddress;
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID inválido." });
      }

      const before = await prisma.grupoPDV.findFirst({ where: { id, lojaId: req.lojaId } });
      if (!before) {
        return res.status(404).json({ error: "Grupo não encontrado nesta loja." });
      }

      const grupo = await prisma.grupoPDV.update({ where: { id }, data: req.body });

      logSecurityEvent("UPDATE_GRUPO_PDV", { adminId: req.admin.id, grupoId: id }, ip);
      logAuditChange("GrupoPDV", id, "UPDATE", before, grupo, req.admin.id, ip, req.get("user-agent")).catch((err) =>
        console.error("Erro ao logar auditoria de GrupoPDV:", err)
      );

      res.json(grupo);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/pdv-config/grupos/:id
 * Cascade: remove também os botões do grupo (onDelete: Cascade no schema).
 */
router.delete("/grupos/:id", requireAuth, requireAnyRole(...PDV_CONFIG_ROLES), adminWriteLimiter, attachLojaId, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;
    if (isNaN(id)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const before = await prisma.grupoPDV.findFirst({ where: { id, lojaId: req.lojaId } });
    if (!before) {
      return res.status(404).json({ error: "Grupo não encontrado nesta loja." });
    }

    await prisma.grupoPDV.delete({ where: { id } });

    logSecurityEvent("DELETE_GRUPO_PDV", { adminId: req.admin.id, grupoId: id }, ip);
    logAuditChange("GrupoPDV", id, "DELETE", before, null, req.admin.id, ip, req.get("user-agent")).catch((err) =>
      console.error("Erro ao logar auditoria de GrupoPDV:", err)
    );

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/pdv-config/grupos/reordenar
 * Body: { items: [{id, posicao}, ...] }
 */
router.put(
  "/grupos/reordenar",
  requireAuth,
  requireAnyRole(...PDV_CONFIG_ROLES),
  adminWriteLimiter,
  attachLojaId,
  validateRequest(reordenarPdvSchema),
  async (req, res, next) => {
    try {
      const { items } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      const grupos = await prisma.grupoPDV.findMany({
        where: { id: { in: items.map((i) => i.id) }, lojaId: req.lojaId },
        select: { id: true },
      });
      if (grupos.length !== items.length) {
        return res.status(404).json({ error: "Um ou mais grupos não encontrados nesta loja." });
      }

      await prisma.$transaction(items.map((i) => prisma.grupoPDV.update({ where: { id: i.id }, data: { posicao: i.posicao } })));

      logSecurityEvent("REORDENAR_GRUPOS_PDV", { adminId: req.admin.id, count: items.length }, ip);

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// ---------- Botões ----------

/**
 * GET /api/pdv-config/botoes?grupoId=
 */
router.get("/botoes", requireAuth, requireAnyRole(...PDV_CONFIG_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const grupoId = req.query.grupoId ? parseInt(req.query.grupoId) : undefined;
    if (req.query.grupoId && isNaN(grupoId)) {
      return res.status(400).json({ error: "grupoId inválido." });
    }

    const botoes = await prisma.botaoPDV.findMany({
      where: { lojaId: req.lojaId, ...(grupoId ? { grupoId } : {}) },
      orderBy: { posicao: "asc" },
      include: { pizzaSize: true, product: true },
    });
    res.json(botoes);
  } catch (err) {
    next(err);
  }
});

/**
 * Confirma que o grupo, e o PizzaSize/Product referenciado, pertencem à loja do operador.
 */
async function validarVinculosBotao(lojaId, body) {
  const grupo = await prisma.grupoPDV.findFirst({ where: { id: body.grupoId, lojaId } });
  if (!grupo) {
    return "Grupo não encontrado nesta loja.";
  }
  if (body.tipo === "PIZZA") {
    const pizzaSize = await prisma.pizzaSize.findFirst({ where: { id: body.pizzaSizeId, lojaId } });
    if (!pizzaSize) {
      return "Tamanho de pizza não encontrado nesta loja.";
    }
  } else {
    const product = await prisma.product.findFirst({ where: { id: body.productId, lojaId } });
    if (!product) {
      return "Produto não encontrado nesta loja.";
    }
  }
  return null;
}

/**
 * POST /api/pdv-config/botoes
 */
router.post(
  "/botoes",
  requireAuth,
  requireAnyRole(...PDV_CONFIG_ROLES),
  adminWriteLimiter,
  attachLojaId,
  validateRequest(botaoPdvSchema),
  async (req, res, next) => {
    try {
      const ip = req.ip || req.connection.remoteAddress;

      const erro = await validarVinculosBotao(req.lojaId, req.body);
      if (erro) {
        return res.status(400).json({ error: erro });
      }

      const botao = await prisma.botaoPDV.create({ data: { lojaId: req.lojaId, ...req.body } });

      logSecurityEvent("CREATE_BOTAO_PDV", { adminId: req.admin.id, botaoId: botao.id }, ip);
      logAuditChange("BotaoPDV", botao.id, "CREATE", null, botao, req.admin.id, ip, req.get("user-agent")).catch((err) =>
        console.error("Erro ao logar auditoria de BotaoPDV:", err)
      );

      res.status(201).json(botao);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/pdv-config/botoes/:id
 */
router.put(
  "/botoes/:id",
  requireAuth,
  requireAnyRole(...PDV_CONFIG_ROLES),
  adminWriteLimiter,
  attachLojaId,
  validateRequest(botaoPdvSchema),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const ip = req.ip || req.connection.remoteAddress;
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID inválido." });
      }

      const before = await prisma.botaoPDV.findFirst({ where: { id, lojaId: req.lojaId } });
      if (!before) {
        return res.status(404).json({ error: "Botão não encontrado nesta loja." });
      }

      const erro = await validarVinculosBotao(req.lojaId, req.body);
      if (erro) {
        return res.status(400).json({ error: erro });
      }

      // Zera o FK do tipo anterior explicitamente (ex: trocar de PIZZA pra PRODUTO).
      const data = {
        ...req.body,
        pizzaSizeId: req.body.tipo === "PIZZA" ? req.body.pizzaSizeId : null,
        productId: req.body.tipo === "PRODUTO" ? req.body.productId : null,
      };

      const botao = await prisma.botaoPDV.update({ where: { id }, data });

      logSecurityEvent("UPDATE_BOTAO_PDV", { adminId: req.admin.id, botaoId: id }, ip);
      logAuditChange("BotaoPDV", id, "UPDATE", before, botao, req.admin.id, ip, req.get("user-agent")).catch((err) =>
        console.error("Erro ao logar auditoria de BotaoPDV:", err)
      );

      res.json(botao);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/pdv-config/botoes/:id
 */
router.delete("/botoes/:id", requireAuth, requireAnyRole(...PDV_CONFIG_ROLES), adminWriteLimiter, attachLojaId, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;
    if (isNaN(id)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const before = await prisma.botaoPDV.findFirst({ where: { id, lojaId: req.lojaId } });
    if (!before) {
      return res.status(404).json({ error: "Botão não encontrado nesta loja." });
    }

    await prisma.botaoPDV.delete({ where: { id } });

    logSecurityEvent("DELETE_BOTAO_PDV", { adminId: req.admin.id, botaoId: id }, ip);
    logAuditChange("BotaoPDV", id, "DELETE", before, null, req.admin.id, ip, req.get("user-agent")).catch((err) =>
      console.error("Erro ao logar auditoria de BotaoPDV:", err)
    );

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/pdv-config/botoes/reordenar
 * Body: { items: [{id, posicao}, ...] }
 */
router.put(
  "/botoes/reordenar",
  requireAuth,
  requireAnyRole(...PDV_CONFIG_ROLES),
  adminWriteLimiter,
  attachLojaId,
  validateRequest(reordenarPdvSchema),
  async (req, res, next) => {
    try {
      const { items } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      const botoes = await prisma.botaoPDV.findMany({
        where: { id: { in: items.map((i) => i.id) }, lojaId: req.lojaId },
        select: { id: true },
      });
      if (botoes.length !== items.length) {
        return res.status(404).json({ error: "Um ou mais botões não encontrados nesta loja." });
      }

      await prisma.$transaction(items.map((i) => prisma.botaoPDV.update({ where: { id: i.id }, data: { posicao: i.posicao } })));

      logSecurityEvent("REORDENAR_BOTOES_PDV", { adminId: req.admin.id, count: items.length }, ip);

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
