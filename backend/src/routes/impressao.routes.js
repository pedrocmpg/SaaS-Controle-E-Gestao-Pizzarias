const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { requireAnyRole } = require("../middleware/authorization");
const { adminReadLimiter, adminWriteLimiter } = require("../middleware/rateLimiter");
const attachLojaId = require("../middleware/attachLojaId");
const validateRequest = require("../middleware/validateRequest");
const { erroImpressaoSchema } = require("../validators/schemas");
const { logSecurityEvent } = require("../lib/securityLogger");
const { agenteConectado } = require("../lib/socket");
const {
  enfileirarComandaCozinha,
  enfileirarCupomPedido,
  enfileirarCupomComanda,
  enfileirarRomaneioMotoboy,
} = require("../lib/impressao");

const router = express.Router();

// Reimprimir é recurso de recuperação do balcão: qualquer operador da loja pode
// (o atendente precisa poder reimprimir uma comanda que saiu borrada).
const IMPRESSAO_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE", "ATENDENTE"];
// O agente local autentica como um usuário de serviço da loja; MOTOBOY não entra aqui.
const AGENTE_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE", "ATENDENTE"];

// Máximo de tentativas antes de o job virar ERRO definitivo. Uma impressora sem papel não
// pode travar a fila inteira — o agente segue para o próximo job.
const MAX_TENTATIVAS = 5;

/** Valida o :id da rota, respondendo 400 em vez de deixar virar NaN na query. */
function parseId(req, res) {
  const id = parseInt(req.params.id ?? req.params.orderId ?? req.params.comandaId ?? req.params.turnoId);
  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido." });
    return null;
  }
  return id;
}

/**
 * POST /api/impressao/comanda/:orderId
 * Reimprime a comanda de cozinha de um pedido.
 */
router.post("/comanda/:orderId", requireAuth, requireAnyRole(...IMPRESSAO_ROLES), adminWriteLimiter, attachLojaId, async (req, res, next) => {
  try {
    const orderId = parseId(req, res);
    if (orderId === null) return;

    const job = await enfileirarComandaCozinha(req.lojaId, orderId);
    if (!job) return res.status(404).json({ error: "Pedido não encontrado nesta loja." });

    logSecurityEvent("REIMPRIMIR_COMANDA", { adminId: req.admin.id, orderId, jobId: job.id }, req.ip);
    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/impressao/cupom/:orderId
 * Reimprime o cupom (via do cliente) de um pedido de tele-entrega.
 */
router.post("/cupom/:orderId", requireAuth, requireAnyRole(...IMPRESSAO_ROLES), adminWriteLimiter, attachLojaId, async (req, res, next) => {
  try {
    const orderId = parseId(req, res);
    if (orderId === null) return;

    const job = await enfileirarCupomPedido(req.lojaId, orderId);
    if (!job) return res.status(404).json({ error: "Pedido não encontrado nesta loja." });

    logSecurityEvent("REIMPRIMIR_CUPOM", { adminId: req.admin.id, orderId, jobId: job.id }, req.ip);
    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/impressao/cupom-comanda/:comandaId
 * Imprime o cupom de uma comanda de salão (fechamento no PDV).
 */
router.post("/cupom-comanda/:comandaId", requireAuth, requireAnyRole(...IMPRESSAO_ROLES), adminWriteLimiter, attachLojaId, async (req, res, next) => {
  try {
    const comandaId = parseId(req, res);
    if (comandaId === null) return;

    const job = await enfileirarCupomComanda(req.lojaId, comandaId);
    if (!job) return res.status(404).json({ error: "Comanda não encontrada nesta loja." });

    logSecurityEvent("IMPRIMIR_CUPOM_COMANDA", { adminId: req.admin.id, comandaId, jobId: job.id }, req.ip);
    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/impressao/romaneio/:turnoId
 * Imprime o romaneio de um turno de motoboy já fechado.
 */
router.post("/romaneio/:turnoId", requireAuth, requireAnyRole(...IMPRESSAO_ROLES), adminWriteLimiter, attachLojaId, async (req, res, next) => {
  try {
    const turnoId = parseId(req, res);
    if (turnoId === null) return;

    const job = await enfileirarRomaneioMotoboy(req.lojaId, turnoId);
    if (!job) {
      return res.status(404).json({ error: "Turno não encontrado nesta loja ou ainda não fechado." });
    }

    logSecurityEvent("IMPRIMIR_ROMANEIO", { adminId: req.admin.id, turnoId, jobId: job.id }, req.ip);
    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/impressao/pendentes
 * Jobs PENDENTE da loja. O agente chama no connect e no reconnect para não perder job
 * gerado enquanto estava offline (critério de aceite do spec-7).
 */
router.get("/pendentes", requireAuth, requireAnyRole(...AGENTE_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    const jobs = await prisma.jobImpressao.findMany({
      where: { lojaId: req.lojaId, status: "PENDENTE" },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    res.json(jobs);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/impressao/agente-status
 * Indicador do painel: existe agente de impressão conectado nesta loja?
 */
router.get("/agente-status", requireAuth, requireAnyRole(...IMPRESSAO_ROLES), adminReadLimiter, attachLojaId, async (req, res, next) => {
  try {
    res.json({ conectado: await agenteConectado(req.lojaId) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/impressao/:id/confirmar
 * O agente confirma que o papel saiu.
 */
router.post("/:id/confirmar", requireAuth, requireAnyRole(...AGENTE_ROLES), adminWriteLimiter, attachLojaId, async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    // updateMany + filtro por lojaId: um agente nunca confirma job de outro tenant.
    const { count } = await prisma.jobImpressao.updateMany({
      where: { id, lojaId: req.lojaId },
      data: { status: "IMPRESSO", impressoEm: new Date(), erro: null },
    });
    if (count === 0) return res.status(404).json({ error: "Job de impressão não encontrado nesta loja." });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/impressao/:id/erro
 * O agente reporta falha. Incrementa tentativas; só vira ERRO definitivo no limite —
 * antes disso o job continua PENDENTE para o agente retentar.
 */
router.post("/:id/erro", requireAuth, requireAnyRole(...AGENTE_ROLES), adminWriteLimiter, attachLojaId, validateRequest(erroImpressaoSchema), async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const job = await prisma.jobImpressao.findFirst({ where: { id, lojaId: req.lojaId } });
    if (!job) return res.status(404).json({ error: "Job de impressão não encontrado nesta loja." });

    const tentativas = job.tentativas + 1;
    const atualizado = await prisma.jobImpressao.update({
      where: { id },
      data: {
        tentativas,
        erro: String(req.body.erro).slice(0, 500),
        status: tentativas >= MAX_TENTATIVAS ? "ERRO" : "PENDENTE",
      },
    });

    if (atualizado.status === "ERRO") {
      logSecurityEvent("IMPRESSAO_FALHOU", { jobId: id, lojaId: req.lojaId, tentativas, erro: atualizado.erro }, req.ip);
    }

    res.json({ status: atualizado.status, tentativas });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
