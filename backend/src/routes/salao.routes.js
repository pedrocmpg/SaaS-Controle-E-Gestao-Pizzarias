const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { requireAnyRole } = require("../middleware/authorization");
const { adminReadLimiter, adminWriteLimiter } = require("../middleware/rateLimiter");
const validateRequest = require("../middleware/validateRequest");
const {
  abrirComandaSchema,
  adicionarItemProdutoSchema,
  adicionarItemPizzaSchema,
  fecharComandaSchema,
} = require("../validators/schemas");
const { logSecurityEvent } = require("../lib/securityLogger");
const { logAuditChange } = require("../middleware/auditLogger");
const { resolveLojaId } = require("../lib/lojaScope");
const { calcularPrecoPizza } = require("../lib/pdvPricing");

const router = express.Router();

// Roles que podem operar o salão (comandas) — mesmo padrão de ORDER_ROLES.
const SALAO_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE", "ATENDENTE"];

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
 * Recalcula e persiste o totalPrice de uma comanda a partir dos itens atuais.
 */
async function recalcularTotalComanda(comandaId) {
  const itens = await prisma.comandaItem.findMany({ where: { comandaId } });
  const total = itens.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantidade, 0);
  return prisma.comanda.update({ where: { id: comandaId }, data: { totalPrice: total } });
}

// ---------- Comandas ----------

/**
 * GET /api/salao/comandas?status=ABERTA
 */
router.get("/comandas", requireAuth, requireAnyRole(...SALAO_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status).toUpperCase() : undefined;
    if (status && !["ABERTA", "FECHADA", "CANCELADA"].includes(status)) {
      return res.status(400).json({ error: "Status inválido." });
    }

    const comandas = await prisma.comanda.findMany({
      where: { lojaId: req.lojaId, ...(status ? { status } : {}) },
      orderBy: { abertaEm: "desc" },
      include: { itens: true },
    });
    res.json(comandas);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/salao/comandas/abrir
 * Body: { numeroMesa? }. Obrigatório se LojaConfig.usaMesa=true. 409 se já houver
 * comanda ABERTA nesse número (substitui a antiga trava de Mesa.status).
 */
router.post(
  "/comandas/abrir",
  requireAuth,
  requireAnyRole(...SALAO_ROLES),
  adminWriteLimiter,
  attachLojaId,
  validateRequest(abrirComandaSchema),
  async (req, res, next) => {
    try {
      const { numeroMesa } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      const lojaConfig = await prisma.lojaConfig.upsert({
        where: { lojaId: req.lojaId },
        update: {},
        create: { lojaId: req.lojaId },
      });

      if (lojaConfig.usaMesa && numeroMesa == null) {
        return res.status(400).json({ error: "Número da mesa é obrigatório." });
      }
      if (!lojaConfig.usaMesa && numeroMesa != null) {
        return res.status(400).json({ error: "Esta loja não usa numeração de mesa." });
      }

      if (numeroMesa != null) {
        const existente = await prisma.comanda.findFirst({
          where: { lojaId: req.lojaId, numeroMesa, status: "ABERTA" },
        });
        if (existente) {
          return res.status(409).json({ error: "Já existe uma comanda aberta nesta mesa." });
        }
      }

      const comanda = await prisma.comanda.create({
        data: {
          lojaId: req.lojaId,
          numeroMesa: numeroMesa ?? null,
          atendenteAberturaId: req.admin.id,
        },
        include: { itens: true },
      });

      logSecurityEvent("ABRIR_COMANDA", { adminId: req.admin.id, comandaId: comanda.id, numeroMesa }, ip);

      res.status(201).json(comanda);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/salao/comandas/:id
 */
router.get("/comandas/:id", requireAuth, requireAnyRole(...SALAO_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const comandaId = parseInt(req.params.id);
    if (isNaN(comandaId)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const comanda = await prisma.comanda.findFirst({
      where: { id: comandaId, lojaId: req.lojaId },
      include: { itens: true },
    });
    if (!comanda) {
      return res.status(404).json({ error: "Comanda não encontrada nesta loja." });
    }

    res.json(comanda);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/salao/comandas/:id/itens/produto
 * Lança um item PRODUTO (bebida/extra/rodízio) a partir de um BotaoPDV tipo=PRODUTO.
 */
router.post(
  "/comandas/:id/itens/produto",
  requireAuth,
  requireAnyRole(...SALAO_ROLES),
  adminWriteLimiter,
  attachLojaId,
  validateRequest(adicionarItemProdutoSchema),
  async (req, res, next) => {
    try {
      const comandaId = parseInt(req.params.id);
      const { botaoId, quantidade } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      if (isNaN(comandaId)) {
        return res.status(400).json({ error: "ID inválido." });
      }

      const comanda = await prisma.comanda.findFirst({ where: { id: comandaId, lojaId: req.lojaId } });
      if (!comanda) {
        return res.status(404).json({ error: "Comanda não encontrada nesta loja." });
      }
      if (comanda.status !== "ABERTA") {
        return res.status(409).json({ error: "Comanda não está aberta." });
      }

      const botao = await prisma.botaoPDV.findFirst({
        where: { id: botaoId, lojaId: req.lojaId, tipo: "PRODUTO", ativo: true },
        include: { product: true },
      });
      if (!botao || !botao.product) {
        return res.status(404).json({ error: "Botão não encontrado ou não é do tipo PRODUTO." });
      }

      await prisma.comandaItem.create({
        data: {
          comandaId,
          tipo: "PRODUTO",
          descricao: botao.product.name,
          unitPrice: botao.product.price,
          quantidade,
        },
      });

      const updated = await recalcularTotalComanda(comandaId);

      logSecurityEvent("ADICIONAR_ITEM_PRODUTO_COMANDA", { adminId: req.admin.id, comandaId, botaoId }, ip);

      res.status(201).json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/salao/comandas/:id/itens/pizza
 * Lança um item PIZZA (montador) a partir de um BotaoPDV tipo=PIZZA. Respeita
 * PizzaSize.maxFlavors e LojaConfig.usaBorda; preço via calcularPrecoPizza.
 */
router.post(
  "/comandas/:id/itens/pizza",
  requireAuth,
  requireAnyRole(...SALAO_ROLES),
  adminWriteLimiter,
  attachLojaId,
  validateRequest(adicionarItemPizzaSchema),
  async (req, res, next) => {
    try {
      const comandaId = parseInt(req.params.id);
      const { botaoId, sabores, borderId, quantidade } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      if (isNaN(comandaId)) {
        return res.status(400).json({ error: "ID inválido." });
      }

      const comanda = await prisma.comanda.findFirst({ where: { id: comandaId, lojaId: req.lojaId } });
      if (!comanda) {
        return res.status(404).json({ error: "Comanda não encontrada nesta loja." });
      }
      if (comanda.status !== "ABERTA") {
        return res.status(409).json({ error: "Comanda não está aberta." });
      }

      const botao = await prisma.botaoPDV.findFirst({
        where: { id: botaoId, lojaId: req.lojaId, tipo: "PIZZA", ativo: true },
        include: { pizzaSize: true },
      });
      if (!botao || !botao.pizzaSize) {
        return res.status(404).json({ error: "Botão não encontrado ou não é do tipo PIZZA." });
      }

      const pizzaSize = botao.pizzaSize;
      if (sabores.length > pizzaSize.maxFlavors) {
        return res.status(400).json({ error: `Máximo de ${pizzaSize.maxFlavors} sabor(es) para este tamanho.` });
      }

      const flavors = await prisma.flavor.findMany({
        where: { id: { in: sabores }, lojaId: req.lojaId, active: true },
      });
      if (flavors.length !== sabores.length) {
        return res.status(400).json({ error: "Um ou mais sabores não encontrados nesta loja." });
      }

      const lojaConfig = await prisma.lojaConfig.upsert({
        where: { lojaId: req.lojaId },
        update: {},
        create: { lojaId: req.lojaId },
      });

      let border = null;
      if (borderId != null) {
        if (!lojaConfig.usaBorda) {
          return res.status(400).json({ error: "Esta loja não usa borda." });
        }
        border = await prisma.border.findFirst({ where: { id: borderId, lojaId: req.lojaId, active: true } });
        if (!border) {
          return res.status(404).json({ error: "Borda não encontrada nesta loja." });
        }
      }

      const unitPrice = calcularPrecoPizza({
        pizzaSize,
        flavors,
        border,
        modoAdicionalSabor: lojaConfig.modoAdicionalSabor,
      });

      const sabroesSnapshot = flavors.map((f) => ({ nome: f.name, adicional: Number(f.extraPrice) }));
      if (border) {
        sabroesSnapshot.push({ nome: `Borda: ${border.name}`, adicional: Number(border.price) });
      }

      await prisma.comandaItem.create({
        data: {
          comandaId,
          tipo: "PIZZA",
          descricao: pizzaSize.name,
          unitPrice,
          quantidade,
          sabroesSnapshot,
        },
      });

      const updated = await recalcularTotalComanda(comandaId);

      logSecurityEvent("ADICIONAR_ITEM_PIZZA_COMANDA", { adminId: req.admin.id, comandaId, botaoId }, ip);

      res.status(201).json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/salao/comandas/:id/itens/:itemId
 */
router.delete("/comandas/:id/itens/:itemId", requireAuth, requireAnyRole(...SALAO_ROLES), adminWriteLimiter, attachLojaId, async (req, res, next) => {
  try {
    const comandaId = parseInt(req.params.id);
    const itemId = parseInt(req.params.itemId);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(comandaId) || isNaN(itemId)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const comanda = await prisma.comanda.findFirst({ where: { id: comandaId, lojaId: req.lojaId } });
    if (!comanda) {
      return res.status(404).json({ error: "Comanda não encontrada nesta loja." });
    }
    if (comanda.status !== "ABERTA") {
      return res.status(409).json({ error: "Comanda não está aberta." });
    }

    const item = await prisma.comandaItem.findFirst({ where: { id: itemId, comandaId } });
    if (!item) {
      return res.status(404).json({ error: "Item não encontrado nesta comanda." });
    }

    await prisma.comandaItem.delete({ where: { id: itemId } });
    const updated = await recalcularTotalComanda(comandaId);

    logSecurityEvent("REMOVER_ITEM_COMANDA", { adminId: req.admin.id, comandaId, itemId }, ip);

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/salao/comandas/:id/fechar
 * Fecha a comanda: exige forma de pagamento e uma sessão de caixa SALAO aberta na loja.
 */
router.post(
  "/comandas/:id/fechar",
  requireAuth,
  requireAnyRole(...SALAO_ROLES),
  adminWriteLimiter,
  attachLojaId,
  validateRequest(fecharComandaSchema),
  async (req, res, next) => {
    try {
      const comandaId = parseInt(req.params.id);
      const { paymentMethod } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      if (isNaN(comandaId)) {
        return res.status(400).json({ error: "ID inválido." });
      }

      const comanda = await prisma.comanda.findFirst({
        where: { id: comandaId, lojaId: req.lojaId },
        include: { itens: true },
      });
      if (!comanda) {
        return res.status(404).json({ error: "Comanda não encontrada nesta loja." });
      }
      if (comanda.status !== "ABERTA") {
        return res.status(409).json({ error: "Comanda não está aberta." });
      }
      if (comanda.itens.length === 0) {
        return res.status(400).json({ error: "Adicione ao menos um item antes de fechar a comanda." });
      }

      const caixaSessao = await prisma.caixaSessao.findFirst({
        where: { lojaId: req.lojaId, tipo: "SALAO", status: "ABERTO" },
      });
      if (!caixaSessao) {
        return res.status(409).json({ error: "Abra o caixa do salão antes de fechar comandas." });
      }

      const updatedComanda = await prisma.comanda.update({
        where: { id: comandaId },
        data: {
          status: "FECHADA",
          fechadaEm: new Date(),
          paymentMethod,
          atendenteFechamentoId: req.admin.id,
          caixaSessaoId: caixaSessao.id,
        },
        include: { itens: true },
      });

      logSecurityEvent("FECHAR_COMANDA", { adminId: req.admin.id, comandaId, paymentMethod }, ip);
      logAuditChange(
        "Comanda",
        comandaId,
        "UPDATE",
        { status: comanda.status },
        { status: updatedComanda.status, paymentMethod },
        req.admin.id,
        ip,
        req.get("user-agent")
      ).catch((err) => console.error("Erro ao logar auditoria de fechamento de comanda:", err));

      res.json(updatedComanda);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
