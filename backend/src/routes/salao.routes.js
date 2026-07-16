const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { requireAnyRole } = require("../middleware/authorization");
const { adminReadLimiter, adminWriteLimiter } = require("../middleware/rateLimiter");
const validateRequest = require("../middleware/validateRequest");
const { adicionarItemComandaSchema, fecharComandaSchema } = require("../validators/schemas");
const { logSecurityEvent } = require("../lib/securityLogger");
const { logAuditChange } = require("../middleware/auditLogger");
const { resolveLojaId } = require("../lib/lojaScope");

const router = express.Router();

// Roles que podem operar o salão (mesas/comandas) — mesmo padrão de ORDER_ROLES.
const SALAO_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE", "ATENDENTE"];
// Preço do rodízio por faixa é catálogo, mesmas roles de escrita do cardápio.
const RODIZIO_WRITE_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE"];

const FAIXA_LABEL = { ADULTO: "Adulto", CRIANCA: "Criança", MEIA: "Meia" };

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
  const total = itens.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
  return prisma.comanda.update({ where: { id: comandaId }, data: { totalPrice: total } });
}

// ---------- Mesas ----------

/**
 * GET /api/salao/mesas
 * Lista as mesas da loja com status e resumo da comanda aberta (se ocupada).
 */
router.get("/mesas", requireAuth, requireAnyRole(...SALAO_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const mesas = await prisma.mesa.findMany({
      where: { lojaId: req.lojaId },
      orderBy: { numero: "asc" },
      include: {
        comandas: {
          where: { status: "ABERTA" },
          select: { id: true, totalPrice: true, abertaEm: true },
        },
      },
    });
    res.json(mesas.map((m) => ({ ...m, comandaAberta: m.comandas[0] || null, comandas: undefined })));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/salao/mesas/:numero/abrir
 * Abre uma comanda para a mesa (mesa precisa estar LIVRE). 409 se já ocupada.
 */
router.post("/mesas/:numero/abrir", requireAuth, requireAnyRole(...SALAO_ROLES), adminWriteLimiter, attachLojaId, async (req, res, next) => {
  try {
    const numero = parseInt(req.params.numero);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(numero)) {
      return res.status(400).json({ error: "Número de mesa inválido." });
    }

    const mesa = await prisma.mesa.findUnique({ where: { lojaId_numero: { lojaId: req.lojaId, numero } } });
    if (!mesa) {
      return res.status(404).json({ error: "Mesa não encontrada nesta loja." });
    }

    // Atualização condicional: evita duas comandas simultâneas na mesma mesa numa corrida.
    const { count } = await prisma.mesa.updateMany({
      where: { id: mesa.id, status: "LIVRE" },
      data: { status: "OCUPADA" },
    });
    if (count === 0) {
      return res.status(409).json({ error: "Mesa já está ocupada." });
    }

    const comanda = await prisma.comanda.create({
      data: {
        lojaId: req.lojaId,
        mesaId: mesa.id,
        atendenteAberturaId: req.admin.id,
      },
      include: { itens: true },
    });

    logSecurityEvent("ABRIR_MESA", { adminId: req.admin.id, mesaId: mesa.id, comandaId: comanda.id }, ip);

    res.status(201).json(comanda);
  } catch (err) {
    next(err);
  }
});

// ---------- Comandas ----------

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
      include: { itens: true, mesa: true },
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
 * POST /api/salao/comandas/:id/itens
 * Adiciona item de rodízio (por faixa) ou produto/bebida à comanda.
 */
router.post(
  "/comandas/:id/itens",
  requireAuth,
  requireAnyRole(...SALAO_ROLES),
  adminWriteLimiter,
  attachLojaId,
  validateRequest(adicionarItemComandaSchema),
  async (req, res, next) => {
    try {
      const comandaId = parseInt(req.params.id);
      const { tipo, faixaRodizio, productId, quantity } = req.body;
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

      let descricao;
      let unitPrice;

      if (tipo === "RODIZIO") {
        const precoRodizio = await prisma.rodizioPreco.findUnique({
          where: { lojaId_faixa: { lojaId: req.lojaId, faixa: faixaRodizio } },
        });
        if (!precoRodizio || !precoRodizio.active) {
          return res.status(400).json({ error: "Preço de rodízio não cadastrado para esta faixa." });
        }
        descricao = `Rodízio - ${FAIXA_LABEL[faixaRodizio]}`;
        unitPrice = precoRodizio.preco;
      } else {
        const product = await prisma.product.findFirst({ where: { id: productId, lojaId: req.lojaId } });
        if (!product) {
          return res.status(404).json({ error: "Produto não encontrado nesta loja." });
        }
        descricao = product.name;
        unitPrice = product.price;
      }

      await prisma.comandaItem.create({
        data: {
          comandaId,
          tipo,
          faixaRodizio: tipo === "RODIZIO" ? faixaRodizio : null,
          productId: tipo === "PRODUTO" ? productId : null,
          descricao,
          quantity,
          unitPrice,
        },
      });

      const updated = await recalcularTotalComanda(comandaId);

      logSecurityEvent("ADICIONAR_ITEM_COMANDA", { adminId: req.admin.id, comandaId, tipo }, ip);

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

      const [updatedComanda] = await prisma.$transaction([
        prisma.comanda.update({
          where: { id: comandaId },
          data: {
            status: "FECHADA",
            fechadaEm: new Date(),
            paymentMethod,
            atendenteFechamentoId: req.admin.id,
            caixaSessaoId: caixaSessao.id,
          },
          include: { itens: true },
        }),
        prisma.mesa.update({ where: { id: comanda.mesaId }, data: { status: "LIVRE" } }),
      ]);

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

// ---------- Preços do rodízio ----------

/**
 * GET /api/salao/rodizio/precos
 */
router.get("/rodizio/precos", requireAuth, requireAnyRole(...SALAO_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const precos = await prisma.rodizioPreco.findMany({ where: { lojaId: req.lojaId }, orderBy: { faixa: "asc" } });
    res.json(precos);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/salao/rodizio/precos/:faixa
 * Cria ou atualiza o preço da faixa (upsert) — cadastro simples de catálogo.
 */
router.put("/rodizio/precos/:faixa", requireAuth, requireAnyRole(...RODIZIO_WRITE_ROLES), adminWriteLimiter, attachLojaId, async (req, res, next) => {
  try {
    const faixa = String(req.params.faixa || "").toUpperCase();
    const { preco, active } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    if (!["ADULTO", "CRIANCA", "MEIA"].includes(faixa)) {
      return res.status(400).json({ error: "Faixa inválida." });
    }
    if (preco == null || isNaN(Number(preco)) || Number(preco) <= 0) {
      return res.status(400).json({ error: "Preço inválido." });
    }

    const precoRodizio = await prisma.rodizioPreco.upsert({
      where: { lojaId_faixa: { lojaId: req.lojaId, faixa } },
      update: { preco: Number(preco), ...(active != null ? { active: Boolean(active) } : {}) },
      create: { lojaId: req.lojaId, faixa, preco: Number(preco), active: active != null ? Boolean(active) : true },
    });

    logSecurityEvent("UPDATE_RODIZIO_PRECO", { adminId: req.admin.id, faixa }, ip);

    res.json(precoRodizio);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
