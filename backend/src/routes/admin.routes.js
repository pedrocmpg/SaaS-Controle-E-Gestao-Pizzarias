const express = require("express");
const bcrypt = require("bcryptjs");
const Joi = require("joi");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { requireRole, requireAnyRole } = require("../middleware/authorization");
const { adminReadLimiter, adminWriteLimiter } = require("../middleware/rateLimiter");
const validateRequest = require("../middleware/validateRequest");
const { logSecurityEvent } = require("../lib/securityLogger");

const router = express.Router();

/**
 * GET /api/admin/users
 * Lista todos os admins (SUPER_ADMIN e ADMIN podem listar)
 */
router.get("/users", requireAuth, requireRole("SUPER_ADMIN"), adminReadLimiter, async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;

    const admins = await prisma.admin.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        totpEnabled: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    logSecurityEvent("LIST_ADMINS", { adminId: req.admin.id, count: admins.length }, ip);

    res.json({ admins });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/users/:id
 * Retorna dados de um admin específico
 */
router.get("/users/:id", requireAuth, requireRole("SUPER_ADMIN"), adminReadLimiter, async (req, res, next) => {
  try {
    const adminId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(adminId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        totpEnabled: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
      },
    });

    if (!admin) {
      return res.status(404).json({ error: "Admin não encontrado" });
    }

    logSecurityEvent("VIEW_ADMIN", { adminId: req.admin.id, targetAdminId: adminId }, ip);

    res.json({ admin });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/users
 * Cria um novo admin (SUPER_ADMIN only)
 */
router.post(
  "/users",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  adminWriteLimiter,
  validateRequest(
    Joi.object({
      name: Joi.string().min(2).max(100).required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(8).max(128).required(),
      role: Joi.string().valid("SUPER_ADMIN", "ADMIN", "VIEWER", "GERENTE", "ATENDENTE").default("VIEWER"),
    })
  ),
  async (req, res, next) => {
    try {
      const { name, email, password, role } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      // Verifica se email já existe
      const existing = await prisma.admin.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ error: "Email já cadastrado" });
      }

      // Hash da senha
      const passwordHash = await bcrypt.hash(password, 12);

      // Cria novo admin
      const newAdmin = await prisma.admin.create({
        data: {
          name,
          email,
          passwordHash,
          role: role || "VIEWER",
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      logSecurityEvent("CREATE_ADMIN", { adminId: req.admin.id, newAdminId: newAdmin.id, role }, ip);

      res.status(201).json({
        message: "Admin criado com sucesso",
        admin: newAdmin,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/admin/users/:id
 * Atualiza um admin (SUPER_ADMIN pode atualizar qualquer um, ADMIN só a si mesmo)
 */
router.put(
  "/users/:id",
  requireAuth,
  adminWriteLimiter,
  validateRequest(
    Joi.object({
      name: Joi.string().min(2).max(100).optional(),
      role: Joi.string().valid("SUPER_ADMIN", "ADMIN", "VIEWER", "GERENTE", "ATENDENTE").optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const adminId = parseInt(req.params.id);
      const ip = req.ip || req.connection.remoteAddress;

      if (isNaN(adminId)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      // Validação de autorização
      if (req.admin.role === "ADMIN" && req.admin.id !== adminId) {
        logSecurityEvent("UNAUTHORIZED_UPDATE_ATTEMPT", {
          adminId: req.admin.id,
          targetAdminId: adminId,
        }, ip);
        return res.status(403).json({ error: "Você só pode atualizar sua própria conta" });
      }

      if (req.admin.role !== "SUPER_ADMIN" && req.admin.role !== "ADMIN") {
        logSecurityEvent("INSUFFICIENT_ROLE_UPDATE", {
          adminId: req.admin.id,
          targetAdminId: adminId,
          role: req.admin.role,
        }, ip);
        return res.status(403).json({ error: "Permissão insuficiente" });
      }

      // Impede que ADMIN mude a role de alguém
      if (req.admin.role === "ADMIN" && req.body.role) {
        return res.status(403).json({ error: "Apenas SUPER_ADMIN pode alterar roles" });
      }

      // Atualiza admin
      const updated = await prisma.admin.update({
        where: { id: adminId },
        data: req.body,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          updatedAt: true,
        },
      });

      logSecurityEvent("UPDATE_ADMIN", { adminId: req.admin.id, targetAdminId: adminId }, ip);

      res.json({
        message: "Admin atualizado com sucesso",
        admin: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/admin/users/:id
 * Deleta um admin (SUPER_ADMIN only)
 */
router.delete("/users/:id", requireAuth, requireRole("SUPER_ADMIN"), adminWriteLimiter, async (req, res, next) => {
  try {
    const adminId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(adminId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    // Impede que se delete a si mesmo
    if (req.admin.id === adminId) {
      return res.status(400).json({ error: "Você não pode deletar sua própria conta" });
    }

    await prisma.admin.delete({ where: { id: adminId } });

    logSecurityEvent("DELETE_ADMIN", { adminId: req.admin.id, deletedAdminId: adminId }, ip);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/users/:id/password
 * Muda a senha de um admin
 */
router.put(
  "/users/:id/password",
  requireAuth,
  adminWriteLimiter,
  validateRequest(
    Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().min(8).max(128).required(),
    })
  ),
  async (req, res, next) => {
    try {
      const adminId = parseInt(req.params.id);
      const { currentPassword, newPassword } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      if (isNaN(adminId)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      // Um admin só pode mudar sua própria senha, SUPER_ADMIN pode mudar de qualquer um
      if (req.admin.role !== "SUPER_ADMIN" && req.admin.id !== adminId) {
        logSecurityEvent("UNAUTHORIZED_PASSWORD_CHANGE", {
          adminId: req.admin.id,
          targetAdminId: adminId,
        }, ip);
        return res.status(403).json({ error: "Você só pode mudar sua própria senha" });
      }

      const admin = await prisma.admin.findUnique({ where: { id: adminId } });

      if (!admin) {
        return res.status(404).json({ error: "Admin não encontrado" });
      }

      // Se não for SUPER_ADMIN, valida a senha atual
      if (req.admin.role !== "SUPER_ADMIN") {
        const passwordMatches = await bcrypt.compare(currentPassword, admin.passwordHash);
        if (!passwordMatches) {
          logSecurityEvent("INVALID_CURRENT_PASSWORD", { adminId: req.admin.id }, ip);
          return res.status(401).json({ error: "Senha atual inválida" });
        }
      }

      // Hash da nova senha
      const newPasswordHash = await bcrypt.hash(newPassword, 12);

      await prisma.admin.update({
        where: { id: adminId },
        data: { passwordHash: newPasswordHash },
      });

      logSecurityEvent("PASSWORD_CHANGED", { adminId: req.admin.id, targetAdminId: adminId }, ip);

      res.json({ message: "Senha alterada com sucesso" });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/admin/users/:id/reset-2fa
 * Reseta 2FA de um admin (SUPER_ADMIN only)
 * Útil se admin perder o celular
 */
router.post("/users/:id/reset-2fa", requireAuth, requireRole("SUPER_ADMIN"), adminWriteLimiter, async (req, res, next) => {
  try {
    const adminId = parseInt(req.params.id);
    const ip = req.ip || req.connection.remoteAddress;

    if (isNaN(adminId)) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const admin = await prisma.admin.findUnique({ where: { id: adminId } });

    if (!admin) {
      return res.status(404).json({ error: "Admin não encontrado" });
    }

    await prisma.admin.update({
      where: { id: adminId },
      data: {
        totpSecret: null,
        totpEnabled: false,
        backupCodes: null,
      },
    });

    logSecurityEvent("2FA_RESET_BY_ADMIN", {
      adminId: req.admin.id,
      targetAdminId: adminId,
    }, ip);

    res.json({ message: "2FA resetado. Admin deve configurar novamente ao fazer login." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
