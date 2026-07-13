const express = require("express");
const prisma = require("../lib/prisma");
const { encrypt, decrypt } = require("../lib/encryption");
const { requireAuth } = require("../middleware/auth");
const { requireAnyRole } = require("../middleware/authorization");
const { adminReadLimiter, adminWriteLimiter } = require("../middleware/rateLimiter");
const validateRequest = require("../middleware/validateRequest");
const { updateSettingsSchema } = require("../validators/schemas");
const { logSecurityEvent } = require("../lib/securityLogger");

const router = express.Router();

/**
 * GET /api/settings
 * Retorna as configurações públicas da loja (endereço, whatsapp, horários, etc).
 * Descriptografa dados sensíveis antes de retornar.
 */
router.get("/", async (req, res, next) => {
  try {
    const settings = await prisma.storeSettings.findUnique({ where: { id: 1 } });

    if (!settings) {
      return res.status(404).json({ error: "Configurações da loja não encontradas. Execute o seed." });
    }

    // Descriptografa dados sensíveis
    const decryptedSettings = {
      ...settings,
      phone: decrypt(settings.phone),
      whatsapp: decrypt(settings.whatsapp),
      address: decrypt(settings.address),
    };

    res.json(decryptedSettings);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/settings
 * Atualiza as configurações da loja. Protegida (SUPER_ADMIN e ADMIN).
 * Criptografa dados sensíveis (phone, whatsapp, address) antes de salvar.
 */
router.put("/", requireAuth, requireAnyRole("SUPER_ADMIN", "ADMIN"), adminWriteLimiter, validateRequest(updateSettingsSchema), async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress;

    // Criptografa dados sensíveis se fornecidos
    const dataToUpdate = { ...req.body };
    if (dataToUpdate.phone) {
      dataToUpdate.phone = encrypt(dataToUpdate.phone);
    }
    if (dataToUpdate.whatsapp) {
      dataToUpdate.whatsapp = encrypt(dataToUpdate.whatsapp);
    }
    if (dataToUpdate.address) {
      dataToUpdate.address = encrypt(dataToUpdate.address);
    }

    const settings = await prisma.storeSettings.update({
      where: { id: 1 },
      data: dataToUpdate,
    });

    // Descriptografa antes de retornar
    const decryptedSettings = {
      ...settings,
      phone: decrypt(settings.phone),
      whatsapp: decrypt(settings.whatsapp),
      address: decrypt(settings.address),
    };

    logSecurityEvent("UPDATE_SETTINGS", { adminId: req.admin.id }, ip);

    res.json(decryptedSettings);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
