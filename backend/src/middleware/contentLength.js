/**
 * Middleware para validar Content-Length nos headers
 * Previne ataques de memory exhaustion e requisições malformadas
 */

const { logger } = require("../lib/logger");

/**
 * Configura limites de tamanho para diferentes tipos de requisição
 */
const CONTENT_LENGTH_LIMITS = {
  default: 1 * 1024 * 1024, // 1MB padrão
  upload: 10 * 1024 * 1024, // 10MB para uploads (futuro)
  json: 1 * 1024 * 1024, // 1MB para JSON
};

/**
 * Middleware para validar Content-Length
 * Bloqueia requisições sem Content-Length ou muito grandes
 */
function validateContentLength(req, res, next) {
  const contentLength = req.get("content-length");
  const ip = req.ip || req.connection.remoteAddress;

  // Se método é GET, HEAD, DELETE geralmente não tem body
  if (["GET", "HEAD", "DELETE", "OPTIONS"].includes(req.method)) {
    // Mas se tiver Content-Length, valida mesmo assim
    if (!contentLength) {
      return next();
    }
  }

  // Se é POST, PUT, PATCH deve ter Content-Length
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    if (!contentLength) {
      logger.warn("MISSING_CONTENT_LENGTH", {
        method: req.method,
        path: req.path,
        ip,
        timestamp: new Date().toISOString(),
      });

      return res.status(411).json({
        error: "Content-Length header é obrigatório para esse método.",
      });
    }
  }

  // Valida se Content-Length é um número válido
  const length = parseInt(contentLength, 10);
  if (isNaN(length) || length < 0) {
    logger.warn("INVALID_CONTENT_LENGTH", {
      contentLength,
      method: req.method,
      path: req.path,
      ip,
      timestamp: new Date().toISOString(),
    });

    return res.status(400).json({
      error: "Content-Length inválido.",
    });
  }

  // Determina o limite apropriado
  const limit = CONTENT_LENGTH_LIMITS.default;

  // Valida se está dentro do limite
  if (length > limit) {
    logger.warn("CONTENT_LENGTH_EXCEEDED", {
      contentLength: length,
      limit,
      method: req.method,
      path: req.path,
      ip,
      percentage: ((length / limit) * 100).toFixed(1),
      timestamp: new Date().toISOString(),
    });

    return res.status(413).json({
      error: `Payload muito grande. Máximo: ${limit / 1024 / 1024}MB`,
      maxSize: limit,
    });
  }

  // Adiciona informação ao request para logging
  req.contentLength = length;

  next();
}

/**
 * Middleware para validar Content-Type
 * Garante que requisições com body tenham Content-Type válido
 */
function validateContentType(req, res, next) {
  const contentType = req.get("content-type");
  const ip = req.ip || req.connection.remoteAddress;

  // Métodos que devem ter Content-Type
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    if (!contentType) {
      logger.warn("MISSING_CONTENT_TYPE", {
        method: req.method,
        path: req.path,
        ip,
        timestamp: new Date().toISOString(),
      });

      return res.status(415).json({
        error: "Content-Type header é obrigatório para esse método.",
      });
    }

    // Valida se é JSON ou form-urlencoded
    const validTypes = [
      "application/json",
      "application/x-www-form-urlencoded",
      "multipart/form-data",
    ];

    const isValid = validTypes.some((type) => contentType.includes(type));

    if (!isValid) {
      logger.warn("INVALID_CONTENT_TYPE", {
        contentType,
        method: req.method,
        path: req.path,
        ip,
        validTypes,
        timestamp: new Date().toISOString(),
      });

      return res.status(415).json({
        error: "Content-Type não suportado.",
        supported: validTypes,
      });
    }
  }

  next();
}

module.exports = {
  validateContentLength,
  validateContentType,
  CONTENT_LENGTH_LIMITS,
};
