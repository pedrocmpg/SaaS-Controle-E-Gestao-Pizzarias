const express = require("express");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { requireAnyRole } = require("../middleware/authorization");
const { adminReadLimiter } = require("../middleware/rateLimiter");
const { logSecurityEvent } = require("../lib/securityLogger");

const router = express.Router();

/**
 * GET /api/audit/logs
 * Lista todos os logs de auditoria com paginação e filtros
 * Query params:
 *   - table: filtrar por tabela (PizzaSize, Flavor, Border, Product)
 *   - action: filtrar por ação (CREATE, UPDATE, DELETE)
 *   - adminId: filtrar por admin
 *   - recordId: filtrar por ID do registro
 *   - startDate: filtrar por data inicial (ISO 8601)
 *   - endDate: filtrar por data final (ISO 8601)
 *   - page: número da página (default: 1)
 *   - limit: registros por página (default: 50, max: 200)
 */
router.get("/logs", requireAuth, requireAnyRole("SUPER_ADMIN", "ADMIN"), adminReadLimiter, async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const {
      table,
      action,
      adminId,
      recordId,
      startDate,
      endDate,
      page = "1",
      limit = "50",
    } = req.query;

    // Validar paginação
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Construir filtro WHERE
    const where = {};
    if (table) where.table = table;
    if (action) where.action = action;
    if (adminId) where.adminId = parseInt(adminId);
    if (recordId) where.recordId = parseInt(recordId);

    // Filtro de data
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    // Buscar logs com admin info
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          admin: { select: { id: true, name: true, email: true } },
        },
        orderBy: { timestamp: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.auditLog.count({ where }),
    ]);

    logSecurityEvent("VIEW_AUDIT_LOGS", {
      adminId: req.admin.id,
      filters: { table, action, adminId, recordId },
      resultCount: logs.length,
    }, ip);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/audit/logs/:id
 * Retorna detalhes completos de um log de auditoria específico
 */
router.get("/logs/:id", requireAuth, requireAnyRole("SUPER_ADMIN", "ADMIN"), adminReadLimiter, async (req, res, next) => {
  try {
    const logId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(logId)) {
      return res.status(400).json({ error: "ID de log inválido" });
    }

    const log = await prisma.auditLog.findUnique({
      where: { id: logId },
      include: {
        admin: { select: { id: true, name: true, email: true } },
      },
    });

    if (!log) {
      return res.status(404).json({ error: "Log não encontrado" });
    }

    logSecurityEvent("VIEW_AUDIT_LOG", {
      adminId: req.admin.id,
      logId,
    }, ip);

    res.json(log);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/audit/record/:table/:recordId
 * Retorna o histórico completo de um registro específico
 * (todos as mudanças que esse registro sofreu)
 */
router.get("/record/:table/:recordId", requireAuth, requireAnyRole("SUPER_ADMIN", "ADMIN"), adminReadLimiter, async (req, res, next) => {
  try {
    const { table, recordId } = req.params;
    const ip = req.ip || req.connection.remoteAddress;
    const recordIdNum = parseInt(recordId);

    if (isNaN(recordIdNum)) {
      return res.status(400).json({ error: "ID do registro inválido" });
    }

    // Tabelas válidas para auditoria
    const validTables = ["PizzaSize", "Flavor", "Border", "Product"];
    if (!validTables.includes(table)) {
      return res.status(400).json({ error: "Tabela inválida para auditoria" });
    }

    // Buscar histórico completo
    const history = await prisma.auditLog.findMany({
      where: {
        table,
        recordId: recordIdNum,
      },
      include: {
        admin: { select: { id: true, name: true, email: true } },
      },
      orderBy: { timestamp: "asc" },
    });

    logSecurityEvent("VIEW_RECORD_HISTORY", {
      adminId: req.admin.id,
      table,
      recordId: recordIdNum,
      historyCount: history.length,
    }, ip);

    res.json({
      table,
      recordId: recordIdNum,
      history,
      totalChanges: history.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/audit/admin/:adminId
 * Retorna todas as ações de um admin específico
 * (útil para investigar atividade suspeita)
 */
router.get("/admin/:adminId", requireAuth, requireAnyRole("SUPER_ADMIN"), adminReadLimiter, async (req, res, next) => {
  try {
    const adminId = parseInt(req.params.adminId);
    const ip = req.ip || req.connection.remoteAddress;
    const { page = "1", limit = "50" } = req.query;

    if (isNaN(adminId)) {
      return res.status(400).json({ error: "ID do admin inválido" });
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Buscar admin e verificar se existe
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: { id: true, name: true, email: true },
    });

    if (!admin) {
      return res.status(404).json({ error: "Admin não encontrado" });
    }

    // Buscar atividade do admin
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { adminId },
        orderBy: { timestamp: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.auditLog.count({ where: { adminId } }),
    ]);

    logSecurityEvent("VIEW_ADMIN_ACTIVITY", {
      adminId: req.admin.id,
      targetAdminId: adminId,
      resultCount: logs.length,
    }, ip);

    res.json({
      admin,
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/audit/stats
 * Retorna estatísticas de auditoria
 * (útil para dashboard)
 */
router.get("/stats", requireAuth, requireAnyRole("SUPER_ADMIN", "ADMIN"), adminReadLimiter, async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const { days = "30" } = req.query;

    const daysNum = Math.max(1, Math.min(365, parseInt(days) || 30));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    // Buscar estatísticas
    const allLogs = await prisma.auditLog.findMany({
      where: {
        timestamp: { gte: startDate },
      },
      select: {
        table: true,
        action: true,
        adminId: true,
        timestamp: true,
      },
    });

    // Agrupar por tabela, ação, admin, data
    const statsByTable = {};
    const statsByAction = {};
    const statsByAdmin = {};
    const statsByDate = {};

    allLogs.forEach(log => {
      // Por tabela
      statsByTable[log.table] = (statsByTable[log.table] || 0) + 1;

      // Por ação
      statsByAction[log.action] = (statsByAction[log.action] || 0) + 1;

      // Por admin
      statsByAdmin[log.adminId] = (statsByAdmin[log.adminId] || 0) + 1;

      // Por data (YYYY-MM-DD)
      const date = log.timestamp.toISOString().split("T")[0];
      statsByDate[date] = (statsByDate[date] || 0) + 1;
    });

    // Buscar info de admins para estatísticas
    const adminIds = Object.keys(statsByAdmin).map(id => parseInt(id));
    const adminInfos = await prisma.admin.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, name: true, email: true },
    });

    const adminStatsWithInfo = adminIds.map(id => {
      const admin = adminInfos.find(a => a.id === id);
      return {
        admin,
        count: statsByAdmin[id],
      };
    });

    logSecurityEvent("VIEW_AUDIT_STATS", {
      adminId: req.admin.id,
      days: daysNum,
      totalLogs: allLogs.length,
    }, ip);

    res.json({
      period: {
        days: daysNum,
        startDate,
        endDate: new Date(),
      },
      total: allLogs.length,
      byTable: statsByTable,
      byAction: statsByAction,
      byAdmin: adminStatsWithInfo,
      byDate: statsByDate,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
