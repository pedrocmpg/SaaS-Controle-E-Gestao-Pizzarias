/**
 * Middleware para forçar HTTPS em produção
 * - Redireciona HTTP → HTTPS
 * - Valida headers de segurança
 * - Log de violações
 */

const { logger } = require("../lib/logger");

/**
 * Redireciona HTTP para HTTPS em produção
 * Em desenvolvimento, permite HTTP
 */
function httpsRedirect(req, res, next) {
  const isProduction = process.env.NODE_ENV === "production";
  const isSecure = req.secure || req.get("x-forwarded-proto") === "https";
  const shouldRedirect = isProduction && !isSecure;

  if (shouldRedirect) {
    const ip = req.ip || req.connection.remoteAddress;
    logger.warn("HTTP_TO_HTTPS_REDIRECT", {
      url: req.originalUrl,
      ip,
      timestamp: new Date().toISOString(),
    });

    // Redireciona para HTTPS
    return res.redirect(301, `https://${req.get("host")}${req.originalUrl}`);
  }

  next();
}

/**
 * Valida que a conexão é HTTPS em produção
 * Se não for, bloqueia a requisição
 */
function requireHttps(req, res, next) {
  const isProduction = process.env.NODE_ENV === "production";
  const isSecure = req.secure || req.get("x-forwarded-proto") === "https";

  if (isProduction && !isSecure) {
    const ip = req.ip || req.connection.remoteAddress;
    logger.error("INSECURE_CONNECTION_BLOCKED", {
      method: req.method,
      path: req.path,
      ip,
      timestamp: new Date().toISOString(),
    });

    return res.status(403).json({
      error: "Conexão insegura. Use HTTPS.",
    });
  }

  next();
}

/**
 * HSTS (HTTP Strict-Transport-Security) é gerenciado pelo Helmet
 * Este middleware documenta a política
 */
function hstsInfo(req, res, next) {
  // HSTS é aplicado automaticamente pelo Helmet em server.js
  // Este middleware apenas documenta
  res.set("X-HSTS-Policy", "max-age=31536000; includeSubDomains; preload");
  next();
}

module.exports = {
  httpsRedirect,
  requireHttps,
  hstsInfo,
};
