const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const prisma = require("../lib/prisma");
const { requireAuth } = require("../middleware/auth");
const { loginLimiter } = require("../middleware/rateLimiter");
const validateRequest = require("../middleware/validateRequest");
const { loginSchema } = require("../validators/schemas");
const { logLoginAttempt, logSecurityEvent } = require("../lib/securityLogger");
const { addToBlacklist } = require("../lib/tokenBlacklist");
const { getCookieConfig } = require("../middleware/cookieConfig");
const { generateTotpSecret, verifyTotp, generateBackupCodes, useBackupCode } = require("../lib/totp");
const { csrfProtection } = require("../middleware/csrf");

const router = express.Router();

/**
 * GET /api/auth/csrf
 * Retorna um token CSRF para ser usado em requisições POST/PUT/PATCH/DELETE
 */
router.get("/csrf", csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

/**
 * POST /api/auth/login
 * Autentica o administrador. Se 2FA habilitado, retorna status 2FA_REQUIRED
 */
router.post("/login", loginLimiter, validateRequest(loginSchema), async (req, res, next) => {
  try {
    const { email, password, totpCode, backupCode } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    const admin = await prisma.admin.findUnique({ where: { email } });

    if (!admin) {
      logLoginAttempt(email, false, ip, req.get("user-agent"));
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const passwordMatches = await bcrypt.compare(password, admin.passwordHash);

    if (!passwordMatches) {
      logLoginAttempt(email, false, ip, req.get("user-agent"));
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    // Se 2FA está habilitado, exige código TOTP ou backup code
    if (admin.totpEnabled) {
      // Verifica TOTP
      if (totpCode) {
        if (!verifyTotp(admin.totpSecret, totpCode)) {
          logSecurityEvent("INVALID_TOTP", { adminId: admin.id }, ip);
          return res.status(401).json({ error: "Código TOTP inválido." });
        }
      }
      // Ou verifica backup code
      else if (backupCode) {
        const result = useBackupCode(admin.backupCodes, backupCode);
        if (!result.valid) {
          logSecurityEvent("INVALID_BACKUP_CODE", { adminId: admin.id }, ip);
          return res.status(401).json({ error: "Código de backup inválido." });
        }
        // Atualiza backup codes (removeu um)
        await prisma.admin.update({
          where: { id: admin.id },
          data: { backupCodes: result.encrypted },
        });
      }
      // Sem TOTP nem backup code
      else {
        // Retorna token temporário para 2FA
        const tempToken = jwt.sign(
          { id: admin.id, email: admin.email, type: "2FA_TEMP" },
          process.env.JWT_SECRET,
          { expiresIn: "5m" } // Válido por 5 minutos apenas
        );

        return res.json({
          status: "2FA_REQUIRED",
          tempToken,
          message: "Código 2FA necessário.",
        });
      }
    }

    // Login bem-sucedido
    logLoginAttempt(email, true, ip, req.get("user-agent"));

    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role || "VIEWER",
        lojaId: admin.lojaId ?? null,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );

    // Atualiza lastLoginAt e lastLoginIp
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      },
    });

    // Define token em HttpOnly cookie
    const cookieConfig = getCookieConfig();
    res.cookie("token", token, cookieConfig);

    res.json({
      status: "SUCCESS",
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role || "VIEWER", lojaId: admin.lojaId ?? null },
      token,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Retorna os dados do admin autenticado
 */
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    logSecurityEvent("ADMIN_ME_ACCESS", { adminId: req.admin.id }, ip);

    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        lojaId: true,
        totpEnabled: true,
        lastLoginAt: true,
        lastLoginIp: true,
      },
    });

    res.json({ admin });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 * Revoga o token JWT e remove o cookie
 */
router.post("/logout", requireAuth, async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;
    const jwtExpiry = req.admin.exp ? new Date(req.admin.exp * 1000) : null;

    // Adiciona token à blacklist
    await addToBlacklist(req.token, jwtExpiry);

    // Remove cookie
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    logSecurityEvent("LOGOUT", { adminId: req.admin.id }, ip);

    res.json({ message: "Logout realizado com sucesso." });
  } catch (err) {
    res.status(500).json({ error: "Erro ao fazer logout" });
  }
});

/**
 * POST /api/auth/2fa/setup
 * Inicia o setup de 2FA. Retorna QR Code para scanner
 */
router.post("/2fa/setup", requireAuth, async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;

    // Gera novo secret TOTP
    const { secret, dataUrl } = generateTotpSecret(req.admin.email);

    // Gera backup codes
    const { codes: backupCodes, encrypted: encryptedBackupCodes } = generateBackupCodes();

    // Gera QR Code em data URL
    const qrCodeDataUrl = await QRCode.toDataURL(dataUrl);

    // Retorna para o frontend registrar
    res.json({
      secret, // Para teste manual
      qrCode: qrCodeDataUrl,
      backupCodes, // Mostrar apenas UMA VEZ
      message: "Escaneie o QR code com seu autenticador. Guarde os códigos de backup com segurança.",
    });

    logSecurityEvent("2FA_SETUP_INITIATED", { adminId: req.admin.id }, ip);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/2fa/confirm
 * Confirma o setup de 2FA após validar o código TOTP
 */
router.post("/2fa/confirm", requireAuth, validateRequest({
  totp: require("joi").string().length(6).pattern(/^\d+$/).required(),
}), async (req, res, next) => {
  try {
    const { totp } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    // Recupera dados do admin (para pegar secret que está em sessão)
    // Em produção, guardaria em memória/cache com TTL
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
    });

    // IMPORTANTE: Em produção, o secret deveria estar em cache/sessão temporária
    // Por simplicidade, o frontend envia o secret de volta
    // TODO: Melhorar isso em produção
    
    res.status(400).json({ 
      error: "Implemente confirmação de 2FA no frontend passando o secret gerado" 
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/2fa/enable
 * Habilita 2FA após validar o código TOTP uma vez
 */
router.post("/2fa/enable", requireAuth, validateRequest({
  secret: require("joi").string().required(),
  totp: require("joi").string().length(6).pattern(/^\d+$/).required(),
}), async (req, res, next) => {
  try {
    const { secret, totp } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    // Valida o código TOTP com o secret fornecido
    if (!verifyTotp(secret, totp)) {
      logSecurityEvent("2FA_ENABLE_FAILED", { adminId: req.admin.id, reason: "invalid_totp" }, ip);
      return res.status(401).json({ error: "Código TOTP inválido. Tente novamente." });
    }

    // Gera backup codes
    const { codes: backupCodes, encrypted: encryptedBackupCodes } = generateBackupCodes();

    // Habilita 2FA no banco
    await prisma.admin.update({
      where: { id: req.admin.id },
      data: {
        totpSecret: secret,
        totpEnabled: true,
        backupCodes: encryptedBackupCodes,
      },
    });

    logSecurityEvent("2FA_ENABLED", { adminId: req.admin.id }, ip);

    res.json({
      message: "2FA habilitado com sucesso!",
      backupCodes, // Mostrar apenas UMA VEZ aqui
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/2fa/disable
 * Desabilita 2FA (exige senha novamente como confirmação)
 */
router.post("/2fa/disable", requireAuth, validateRequest({
  password: require("joi").string().required(),
}), async (req, res, next) => {
  try {
    const { password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
    });

    const passwordMatches = await bcrypt.compare(password, admin.passwordHash);

    if (!passwordMatches) {
      logSecurityEvent("2FA_DISABLE_FAILED", { adminId: req.admin.id, reason: "invalid_password" }, ip);
      return res.status(401).json({ error: "Senha inválida." });
    }

    // Desabilita 2FA
    await prisma.admin.update({
      where: { id: req.admin.id },
      data: {
        totpSecret: null,
        totpEnabled: false,
        backupCodes: null,
      },
    });

    logSecurityEvent("2FA_DISABLED", { adminId: req.admin.id }, ip);

    res.json({ message: "2FA desabilitado." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
