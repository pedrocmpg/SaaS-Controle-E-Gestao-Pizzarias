const { logSecurityEvent } = require("../lib/securityLogger");

/**
 * Roles e suas permissões
 */
const ROLES = {
  SUPER_ADMIN: {
    name: "Superadministrador",
    permissions: ["read:all", "write:all", "delete:all", "manage:admins", "manage:settings"],
  },
  ADMIN: {
    name: "Administrador",
    permissions: ["read:all", "write:all", "delete:all", "manage:settings"],
  },
  VIEWER: {
    name: "Visualizador",
    permissions: ["read:all"],
  },
  GERENTE: {
    name: "Gerente",
    permissions: ["read:all", "write:all"],
  },
  ATENDENTE: {
    name: "Atendente",
    permissions: ["read:all"],
  },
  MOTOBOY: {
    name: "Motoboy",
    permissions: [],
  },
};

/**
 * Middleware para validar se o admin tem uma role específica
 * Uso: router.get("/...", requireAuth, requireRole("ADMIN"), handler)
 */
function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ error: "Não autenticado." });
    }

    const adminRole = req.admin.role || "VIEWER";

    if (adminRole !== requiredRole) {
      const ip = req.ip || req.connection.remoteAddress;
      logSecurityEvent("UNAUTHORIZED_ACCESS_ATTEMPT", {
        adminId: req.admin.id,
        requiredRole,
        actualRole: adminRole,
        path: req.path,
      }, ip);

      return res.status(403).json({
        error: "Acesso negado. Permissão insuficiente.",
      });
    }

    next();
  };
}

/**
 * Middleware para validar se o admin tem uma permissão específica
 * Uso: router.get("/...", requireAuth, requirePermission("write:all"), handler)
 */
function requirePermission(requiredPermission) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ error: "Não autenticado." });
    }

    const adminRole = req.admin.role || "VIEWER";
    const roleConfig = ROLES[adminRole];

    if (!roleConfig || !roleConfig.permissions.includes(requiredPermission)) {
      const ip = req.ip || req.connection.remoteAddress;
      logSecurityEvent("INSUFFICIENT_PERMISSION", {
        adminId: req.admin.id,
        requiredPermission,
        adminRole,
        path: req.path,
      }, ip);

      return res.status(403).json({
        error: "Acesso negado. Permissão insuficiente.",
        requiredPermission,
      });
    }

    next();
  };
}

/**
 * Middleware para validar múltiplos roles (OR)
 * Uso: router.get("/...", requireAuth, requireAnyRole(["ADMIN", "SUPER_ADMIN"]), handler)
 */
function requireAnyRole(...roles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ error: "Não autenticado." });
    }

    const adminRole = req.admin.role || "VIEWER";

    if (!roles.includes(adminRole)) {
      const ip = req.ip || req.connection.remoteAddress;
      logSecurityEvent("INSUFFICIENT_ROLE", {
        adminId: req.admin.id,
        requiredRoles: roles,
        actualRole: adminRole,
        path: req.path,
      }, ip);

      return res.status(403).json({
        error: "Acesso negado. Role insuficiente.",
        requiredRoles: roles,
      });
    }

    next();
  };
}

/**
 * Retorna informações sobre os roles disponíveis
 */
function getRoleInfo() {
  return ROLES;
}

module.exports = {
  ROLES,
  requireRole,
  requirePermission,
  requireAnyRole,
  getRoleInfo,
};
