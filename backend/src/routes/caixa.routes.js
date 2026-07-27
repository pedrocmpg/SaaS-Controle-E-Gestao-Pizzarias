const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { requireAnyRole } = require("../middleware/authorization");
const { adminReadLimiter, adminWriteLimiter } = require("../middleware/rateLimiter");
const validateRequest = require("../middleware/validateRequest");
const { abrirCaixaSchema, movimentoCaixaSchema, conferirCaixaSchema } = require("../validators/schemas");
const { logSecurityEvent } = require("../lib/securityLogger");
const { logAuditChange } = require("../middleware/auditLogger");
const attachLojaId = require("../middleware/attachLojaId");
const { calcularFechamentoCaixa } = require("../lib/financeiro");
const { HttpError, conflito, responderSeHttpError } = require("../lib/httpError");

const router = express.Router();

// Abrir/sangria/suprimento/fechar: qualquer operador da loja (decisão de negócio).
const CAIXA_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE", "ATENDENTE"];
// Conferência do caixa (checagem do dia seguinte) — mais restrita que a operação do turno.
const CONFERENCIA_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE"];

/**
 * GET /api/caixa/atual?tipo=SALAO
 * Sessão ABERTO corrente da loja para o tipo informado (ou null).
 */
router.get("/atual", requireAuth, requireAnyRole(...CAIXA_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const tipo = String(req.query.tipo || "SALAO").toUpperCase();
    if (!["SALAO", "TELE_ENTREGA"].includes(tipo)) {
      return res.status(400).json({ error: "Tipo de caixa inválido." });
    }

    const sessao = await prisma.caixaSessao.findFirst({
      where: { lojaId: req.lojaId, tipo, status: "ABERTO" },
    });

    res.json(sessao);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/caixa/historico
 * Sessões passadas da loja (para a tela de conferência do dia seguinte).
 */
router.get("/historico", requireAuth, requireAnyRole(...CAIXA_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const sessoes = await prisma.caixaSessao.findMany({
      where: { lojaId: req.lojaId, status: { not: "ABERTO" } },
      orderBy: { abertoEm: "desc" },
      take: 30,
    });
    res.json(sessoes);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/caixa/abrir
 * 409 se já existir sessão ABERTO do mesmo tipo na loja (checado em app; o índice único
 * parcial no banco cobre a corrida de dois "abrir caixa" simultâneos).
 */
router.post("/abrir", requireAuth, requireAnyRole(...CAIXA_ROLES), adminWriteLimiter, attachLojaId, validateRequest(abrirCaixaSchema), async (req, res, next) => {
  try {
    const { tipo, fundoTroco } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    const existente = await prisma.caixaSessao.findFirst({
      where: { lojaId: req.lojaId, tipo, status: "ABERTO" },
    });
    if (existente) {
      return res.status(409).json({ error: `Já existe um caixa ${tipo} aberto nesta loja.` });
    }

    const sessao = await prisma.caixaSessao.create({
      data: { lojaId: req.lojaId, tipo, fundoTroco, abertoPorId: req.admin.id },
    });

    logSecurityEvent("ABRIR_CAIXA", { adminId: req.admin.id, caixaSessaoId: sessao.id, tipo }, ip);

    res.status(201).json(sessao);
  } catch (err) {
    // Rede de segurança: dois "abrir caixa" simultâneos passam pela checagem acima ao mesmo
    // tempo e colidem no índice único parcial do banco (uma sessão ABERTO por loja+tipo).
    if (err.code === "P2002") {
      return res.status(409).json({ error: `Já existe um caixa ${req.body.tipo} aberto nesta loja.` });
    }
    next(err);
  }
});

async function criarMovimento(req, res, next, tipo) {
  try {
    const caixaSessaoId = parseInt(req.params.id);
    const { valor, motivo } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(caixaSessaoId)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const sessao = await prisma.caixaSessao.findFirst({ where: { id: caixaSessaoId, lojaId: req.lojaId } });
    if (!sessao) {
      return res.status(404).json({ error: "Sessão de caixa não encontrada nesta loja." });
    }
    if (sessao.status !== "ABERTO") {
      return res.status(409).json({ error: "Sessão de caixa não está aberta." });
    }

    const movimento = await prisma.movimentoCaixa.create({
      data: { caixaSessaoId, tipo, valor, motivo, adminId: req.admin.id },
    });

    logSecurityEvent(`CAIXA_${tipo}`, { adminId: req.admin.id, caixaSessaoId, valor }, ip);
    logAuditChange("MovimentoCaixa", movimento.id, "CREATE", null, movimento, req.admin.id, ip, req.get("user-agent")).catch((err) =>
      console.error("Erro ao logar auditoria de movimento de caixa:", err)
    );

    res.status(201).json(movimento);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/caixa/:id/sangria
 */
router.post("/:id/sangria", requireAuth, requireAnyRole(...CAIXA_ROLES), adminWriteLimiter, attachLojaId, validateRequest(movimentoCaixaSchema), (req, res, next) =>
  criarMovimento(req, res, next, "SANGRIA")
);

/**
 * POST /api/caixa/:id/suprimento
 */
router.post("/:id/suprimento", requireAuth, requireAnyRole(...CAIXA_ROLES), adminWriteLimiter, attachLojaId, validateRequest(movimentoCaixaSchema), (req, res, next) =>
  criarMovimento(req, res, next, "SUPRIMENTO")
);

/**
 * POST /api/caixa/:id/fechar
 * Calcula o breakdown por forma de pagamento (só dinheiro entra no saldo em espécie) e os
 * totais de sangria/suprimento. Status vira FECHADO_AGUARDANDO_CONFERENCIA.
 */
router.post("/:id/fechar", requireAuth, requireAnyRole(...CAIXA_ROLES), adminWriteLimiter, attachLojaId, async (req, res, next) => {
  try {
    const caixaSessaoId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(caixaSessaoId)) {
      return res.status(400).json({ error: "ID inválido." });
    }

    // Tudo em uma transação Serializable: ler, conferir o status, calcular e gravar. Sem isso,
    // dois cliques rápidos em "fechar" passam ambos pela checagem antes do primeiro commit e
    // o cálculo roda duas vezes. Fechamento é raro (alguns por noite) — contenção é irrelevante
    // perto do custo de um acerto financeiro errado.
    const atualizada = await prisma.$transaction(
      async (tx) => {
        const sessao = await tx.caixaSessao.findFirst({ where: { id: caixaSessaoId, lojaId: req.lojaId } });
        if (!sessao) {
          throw new HttpError(404, "Sessão de caixa não encontrada nesta loja.");
        }
        if (sessao.status !== "ABERTO") {
          throw conflito("Sessão de caixa não está aberta.");
        }

        const [comandas, movimentos] = await Promise.all([
          tx.comanda.findMany({ where: { caixaSessaoId }, select: { paymentMethod: true, totalPrice: true } }),
          tx.movimentoCaixa.findMany({ where: { caixaSessaoId } }),
        ]);

        const totais = calcularFechamentoCaixa({ fundoTroco: sessao.fundoTroco, comandas, movimentos });

        return tx.caixaSessao.update({
          where: { id: caixaSessaoId },
          data: {
            status: "FECHADO_AGUARDANDO_CONFERENCIA",
            fechadoPorId: req.admin.id,
            fechadoEm: new Date(),
            ...totais,
          },
        });
      },
      { isolationLevel: "Serializable" }
    );

    logSecurityEvent(
      "FECHAR_CAIXA",
      { adminId: req.admin.id, caixaSessaoId, saldoFinalCalculado: Number(atualizada.saldoFinalCalculado) },
      ip
    );
    logAuditChange(
      "CaixaSessao",
      caixaSessaoId,
      "UPDATE",
      { status: "ABERTO" },
      { status: atualizada.status, saldoFinalCalculado: Number(atualizada.saldoFinalCalculado) },
      req.admin.id,
      ip,
      req.get("user-agent")
    ).catch((err) => console.error("Erro ao logar auditoria de fechamento de caixa:", err));

    res.json(atualizada);
  } catch (err) {
    if (responderSeHttpError(err, res)) return;
    // Conflito de escrita serializável: outra requisição fechou a mesma sessão em paralelo.
    if (err.code === "P2034") {
      return res.status(409).json({ error: "Fechamento simultâneo detectado. Recarregue e tente novamente." });
    }
    next(err);
  }
});

/**
 * POST /api/caixa/:id/conferir
 * Conferência do dia seguinte (saldo contado na gaveta). Restrito a GERENTE+ (não ATENDENTE).
 */
router.post(
  "/:id/conferir",
  requireAuth,
  requireAnyRole(...CONFERENCIA_ROLES),
  adminWriteLimiter,
  attachLojaId,
  validateRequest(conferirCaixaSchema),
  async (req, res, next) => {
    try {
      const caixaSessaoId = parseInt(req.params.id);
      const { saldoFinalContado } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      if (isNaN(caixaSessaoId)) {
        return res.status(400).json({ error: "ID inválido." });
      }

      const sessao = await prisma.caixaSessao.findFirst({ where: { id: caixaSessaoId, lojaId: req.lojaId } });
      if (!sessao) {
        return res.status(404).json({ error: "Sessão de caixa não encontrada nesta loja." });
      }
      if (sessao.status !== "FECHADO_AGUARDANDO_CONFERENCIA") {
        return res.status(409).json({ error: "Sessão de caixa não está aguardando conferência." });
      }

      const atualizada = await prisma.caixaSessao.update({
        where: { id: caixaSessaoId },
        data: {
          status: "CONFERIDO",
          conferidoPorId: req.admin.id,
          conferidoEm: new Date(),
          saldoFinalContado,
        },
      });

      logSecurityEvent("CONFERIR_CAIXA", { adminId: req.admin.id, caixaSessaoId, saldoFinalContado }, ip);

      res.json(atualizada);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
