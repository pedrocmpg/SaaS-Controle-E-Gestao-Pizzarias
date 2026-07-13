const validator = require("validator");

/**
 * Middleware para sanitizar dados de entrada
 * Remove caracteres perigosos e normaliza dados
 */
function sanitizeRequest(req, res, next) {
  // Sanitiza strings em req.body
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }

  // Sanitiza strings em req.query
  if (req.query && typeof req.query === "object") {
    req.query = sanitizeObject(req.query);
  }

  // Sanitiza strings em req.params
  if (req.params && typeof req.params === "object") {
    req.params = sanitizeObject(req.params);
  }

  next();
}

/**
 * Recursivamente sanitiza um objeto
 */
function sanitizeObject(obj) {
  const sanitized = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      sanitized[key] = value;
    } else if (typeof value === "string") {
      // Remove XSS, normaliza whitespace
      sanitized[key] = validator.escape(value).trim();
    } else if (typeof value === "object" && !Array.isArray(value)) {
      // Recursivo para objetos aninhados
      sanitized[key] = sanitizeObject(value);
    } else if (Array.isArray(value)) {
      // Sanitiza arrays
      sanitized[key] = value.map((item) =>
        typeof item === "string" ? validator.escape(item).trim() : item
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitiza uma string individual
 */
function sanitizeString(str) {
  if (typeof str !== "string") return str;
  return validator.escape(str).trim();
}

module.exports = {
  sanitizeRequest,
  sanitizeString,
};
