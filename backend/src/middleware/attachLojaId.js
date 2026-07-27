const { resolveLojaId } = require("../lib/lojaScope");
const { logSecurityEvent } = require("../lib/securityLogger");

/**
 * Ponto ÚNICO de resolução de tenant do sistema. Toda rota que consulta ou grava dado
 * de loja passa por aqui e usa `req.lojaId` — nunca resolve o tenant por conta própria.
 *
 * Sem loja resolvida a requisição para em 400: não existe caminho "sem tenant" que grave
 * dado. A falha é logada porque, depois da remoção do fallback, um operador sem `lojaId`
 * fica incapaz de operar — e isso precisa ser visível na operação, não silencioso.
 */
async function attachLojaId(req, res, next) {
  try {
    req.lojaId = await resolveLojaId(req);
    if (req.lojaId == null) {
      const ip = req.ip || req.connection.remoteAddress;
      logSecurityEvent(
        "LOJA_NAO_RESOLVIDA",
        { adminId: req.admin ? req.admin.id : null, role: req.admin ? req.admin.role : null, path: req.originalUrl },
        ip
      );
      return res.status(400).json({ error: "Nenhuma loja associada a esta requisição." });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = attachLojaId;
