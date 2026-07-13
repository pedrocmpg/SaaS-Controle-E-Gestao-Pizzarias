const helmet = require("helmet");

/**
 * Middleware de headers de segurança usando Helmet
 * Adiciona proteções contra:
 * - X-Frame-Options (clickjacking)
 * - X-Content-Type-Options (MIME sniffing)
 * - Strict-Transport-Security (HTTPS)
 * - Content-Security-Policy
 * - Referrer-Policy
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year (31536000 segundos)
    includeSubDomains: true,
    preload: true, // Permite adicionar à lista de preload do navegador
  },
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin",
  },
  noSniff: true,
  xssFilter: true,
});

module.exports = securityHeaders;
