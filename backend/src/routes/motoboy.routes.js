const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { requireAnyRole } = require("../middleware/authorization");
const { adminReadLimiter, adminWriteLimiter } = require("../middleware/rateLimiter");
const validateRequest = require("../middleware/validateRequest");
const {
  abrirTurnoMotoboySchema,
  extraMotoboySchema,
  fecharTurnoMotoboySchema,
} = require("../validators/schemas");
const { logSecurityEvent } = require("../lib/securityLogger");
const { logAuditChange } = require("../middleware/auditLogger");
const { resolveLojaId } = require("../lib/lojaScope");

const router = express.Router();

// Despacho (ver/atribuir pedidos): qualquer operador da loja.
const DESPACHO_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE", "ATENDENTE"];
// Abrir/fechar/lançar extra no próprio turno: operadores + o próprio motoboy (se logar no sistema).
const TURNO_MOTOBOY_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE", "ATENDENTE", "MOTOBOY"];
// Conferência do turno (checagem do dia seguinte) — mais restrita, mesmo padrão do Caixa.
const CONFERENCIA_MOTOBOY_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE"];

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
 * GET /api/motoboy/lista
 * Motoboys (role MOTOBOY) cadastrados na loja — para o dropdown de atribuição no despacho
 * e abertura de turno. Não usa /api/admin/users porque essa rota é restrita a SUPER_ADMIN.
 */
router.get("/lista", requireAuth, requireAnyRole(...DESPACHO_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const motoboys = await prisma.admin.findMany({
      where: { lojaId: req.lojaId, role: "MOTOBOY" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    res.json(motoboys);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/motoboy/despacho
 * Pedidos SAIU_PARA_ENTREGA da loja, agrupados por motoboy (tela de despacho ao vivo).
 */
router.get("/despacho", requireAuth, requireAnyRole(...DESPACHO_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const pedidos = await prisma.order.findMany({
      where: { lojaId: req.lojaId, status: "SAIU_PARA_ENTREGA" },
      include: { motoboy: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "asc" },
    });

    res.json(pedidos);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/motoboy/turnos/atual?motoboyId=X
 * Turno ABERTO do motoboy informado, ou lista de todos os turnos abertos da loja se
 * motoboyId não for informado (visão do gerente de quem está trabalhando).
 */
router.get("/turnos/atual", requireAuth, requireAnyRole(...TURNO_MOTOBOY_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const { motoboyId } = req.query;
    const where = { lojaId: req.lojaId, status: "ABERTO" };
    if (motoboyId && !isNaN(parseInt(motoboyId))) {
      where.motoboyId = parseInt(motoboyId);
      const turno = await prisma.turnoMotoboy.findFirst({ where });
      return res.json(turno);
    }

    const turnos = await prisma.turnoMotoboy.findMany({
      where,
      include: { motoboy: { select: { id: true, name: true } } },
      orderBy: { abertoEm: "asc" },
    });
    res.json(turnos);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/motoboy/turnos/historico
 * Turnos não-abertos da loja (para a tela de conferência).
 */
router.get("/turnos/historico", requireAuth, requireAnyRole(...TURNO_MOTOBOY_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const turnos = await prisma.turnoMotoboy.findMany({
      where: { lojaId: req.lojaId, status: { not: "ABERTO" } },
      include: { motoboy: { select: { id: true, name: true } } },
      orderBy: { abertoEm: "desc" },
      take: 30,
    });
    res.json(turnos);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/motoboy/turnos/abrir
 * 409 se já existir turno ABERTO do mesmo motoboy (checado em app; o índice único parcial
 * no banco cobre a corrida de dois "abrir turno" simultâneos para o mesmo motoboy).
 */
router.post("/turnos/abrir", requireAuth, requireAnyRole(...TURNO_MOTOBOY_ROLES), adminWriteLimiter, attachLojaId, validateRequest(abrirTurnoMotoboySchema), async (req, res, next) => {
  try {
    const { motoboyId, fundoTroco } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    const existente = await prisma.turnoMotoboy.findFirst({
      where: { motoboyId, status: "ABERTO" },
    });
    if (existente) {
      return res.status(409).json({ error: "Este motoboy já tem um turno aberto." });
    }

    const turno = await prisma.turnoMotoboy.create({
      data: { lojaId: req.lojaId, motoboyId, fundoTroco, abertoPorId: req.admin.id },
    });

    logSecurityEvent("ABRIR_TURNO_MOTOBOY", { adminId: req.admin.id, turnoMotoboyId: turno.id, motoboyId }, ip);

    res.status(201).json(turno);
  } catch (err) {
    // Rede de segurança: dois "abrir turno" simultâneos para o mesmo motoboy colidem no
    // índice único parcial do banco (um turno ABERTO por motoboy).
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Este motoboy já tem um turno aberto." });
    }
    next(err);
  }
});

/**
 * POST /api/motoboy/turnos/:id/extras
 * Lança um valor extra (entrega longa, gorjeta, ajuda de custo, outro) no turno. Motivo obrigatório.
 */
router.post("/turnos/:id/extras", requireAuth, requireAnyRole(...TURNO_MOTOBOY_ROLES), adminWriteLimiter, attachLojaId, validateRequest(extraMotoboySchema), async (req, res, next) => {
  try {
    const turnoMotoboyId = parseInt(req.params.id);
    const { tipo, valor, motivo } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(turnoMotoboyId)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const turno = await prisma.turnoMotoboy.findFirst({ where: { id: turnoMotoboyId, lojaId: req.lojaId } });
    if (!turno) {
      return res.status(404).json({ error: "Turno de motoboy não encontrado nesta loja." });
    }
    if (turno.status !== "ABERTO") {
      return res.status(409).json({ error: "Turno de motoboy não está aberto." });
    }

    const extra = await prisma.extraMotoboy.create({
      data: { turnoMotoboyId, tipo, valor, motivo, adminId: req.admin.id },
    });

    logSecurityEvent("EXTRA_MOTOBOY", { adminId: req.admin.id, turnoMotoboyId, tipo, valor }, ip);
    logAuditChange("ExtraMotoboy", extra.id, "CREATE", null, extra, req.admin.id, ip, req.get("user-agent")).catch((err) =>
      console.error("Erro ao logar auditoria de extra de motoboy:", err)
    );

    res.status(201).json(extra);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/motoboy/turnos/:id/fechar
 * Calcula valorDaNoite (entregas × valor/entrega + extras + aluguel), o dinheiro que o motoboy
 * está segurando (fundoTroco + entregas cobradas em dinheiro na entrega) e o acerto/sangria.
 * Cartão/PIX são digitados manualmente (fase 1). Status vira FECHADO_AGUARDANDO_CONFERENCIA.
 */
router.post("/turnos/:id/fechar", requireAuth, requireAnyRole(...TURNO_MOTOBOY_ROLES), adminWriteLimiter, attachLojaId, validateRequest(fecharTurnoMotoboySchema), async (req, res, next) => {
  try {
    const turnoMotoboyId = parseInt(req.params.id);
    const { totalRecebidoCartao, totalRecebidoPix } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(turnoMotoboyId)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const turno = await prisma.turnoMotoboy.findFirst({ where: { id: turnoMotoboyId, lojaId: req.lojaId } });
    if (!turno) {
      return res.status(404).json({ error: "Turno de motoboy não encontrado nesta loja." });
    }
    if (turno.status !== "ABERTO") {
      return res.status(409).json({ error: "Turno de motoboy não está aberto." });
    }

    const [loja, pedidos, extras] = await Promise.all([
      prisma.loja.findUnique({ where: { id: req.lojaId } }),
      // FK direta (turnoMotoboyId) elimina ambiguidade entre turnos do mesmo motoboy no mesmo dia.
      prisma.order.findMany({ where: { turnoMotoboyId, status: "ENTREGUE" } }),
      prisma.extraMotoboy.findMany({ where: { turnoMotoboyId } }),
    ]);

    const totalEntregas = pedidos.length;
    const valorPorEntrega = Number(loja.valorPorEntregaMotoboy);
    const valorAluguelMoto = Number(loja.valorAluguelMotoNoite);
    const totalExtras = extras.reduce((sum, e) => sum + Number(e.valor), 0);
    const valorDaNoite = totalEntregas * valorPorEntrega + totalExtras + valorAluguelMoto;

    // Dinheiro físico que o motoboy está segurando = fundo de troco inicial + entregas cobradas
    // em dinheiro na entrega. O fundo de troco é capital de giro e sempre volta inteiro.
    const totalRecebidoDinheiro =
      Number(turno.fundoTroco) +
      pedidos
        .filter((p) => p.cobradoNaEntrega && p.paymentMethod === "DINHEIRO")
        .reduce((sum, p) => sum + Number(p.totalPrice), 0);

    // Desconta o fundo de troco antes de comparar com valorDaNoite — ele nunca é ganho de ninguém.
    const acerto = totalRecebidoDinheiro - Number(turno.fundoTroco) - valorDaNoite;
    // acerto > 0: motoboy fica com mais dinheiro do que devia -> repassa a diferença (sangria).
    // acerto < 0: motoboy ficou com menos do que devia -> pizzaria paga a diferença (nunca sangria).
    const sangria = acerto > 0 ? acerto : 0;

    const atualizado = await prisma.turnoMotoboy.update({
      where: { id: turnoMotoboyId },
      data: {
        status: "FECHADO_AGUARDANDO_CONFERENCIA",
        fechadoPorId: req.admin.id,
        fechadoEm: new Date(),
        totalEntregas,
        valorPorEntrega,
        valorAluguelMoto,
        totalExtras,
        valorDaNoite,
        totalRecebidoDinheiro,
        totalRecebidoCartao,
        totalRecebidoPix,
        acerto,
        sangria,
      },
    });

    logSecurityEvent("FECHAR_TURNO_MOTOBOY", { adminId: req.admin.id, turnoMotoboyId, acerto, sangria }, ip);
    logAuditChange(
      "TurnoMotoboy",
      turnoMotoboyId,
      "UPDATE",
      { status: turno.status },
      { status: atualizado.status, acerto, sangria },
      req.admin.id,
      ip,
      req.get("user-agent")
    ).catch((err) => console.error("Erro ao logar auditoria de fechamento de turno de motoboy:", err));

    res.json(atualizado);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/motoboy/turnos/:id/conferir
 * Conferência do dia seguinte. Restrito a GERENTE+ (não ATENDENTE/MOTOBOY).
 */
router.post("/turnos/:id/conferir", requireAuth, requireAnyRole(...CONFERENCIA_MOTOBOY_ROLES), adminWriteLimiter, attachLojaId, async (req, res, next) => {
  try {
    const turnoMotoboyId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(turnoMotoboyId)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const turno = await prisma.turnoMotoboy.findFirst({ where: { id: turnoMotoboyId, lojaId: req.lojaId } });
    if (!turno) {
      return res.status(404).json({ error: "Turno de motoboy não encontrado nesta loja." });
    }
    if (turno.status !== "FECHADO_AGUARDANDO_CONFERENCIA") {
      return res.status(409).json({ error: "Turno de motoboy não está aguardando conferência." });
    }

    const atualizado = await prisma.turnoMotoboy.update({
      where: { id: turnoMotoboyId },
      data: {
        status: "CONFERIDO",
        conferidoPorId: req.admin.id,
        conferidoEm: new Date(),
      },
    });

    logSecurityEvent("CONFERIR_TURNO_MOTOBOY", { adminId: req.admin.id, turnoMotoboyId }, ip);

    res.json(atualizado);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
