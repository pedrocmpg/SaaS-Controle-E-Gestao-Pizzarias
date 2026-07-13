const {
  securityLogger,
  logSecurityEvent: winstonLogSecurityEvent,
  logLoginAttempt: winstonLogLoginAttempt,
  logCriticalError: winstonLogCriticalError,
} = require("./logger");

/**
 * Log de tentativas de login
 * Usa Winston com rotação de arquivo
 */
function logLoginAttempt(email, success, ip, userAgent) {
  winstonLogLoginAttempt(email, success, ip, userAgent);
}

/**
 * Log de requisições suspeitas (rate limit, validação, etc)
 */
function logSecurityEvent(eventType, details, ip) {
  winstonLogSecurityEvent(eventType, details, ip);
}

/**
 * Log de acesso a rotas protegidas
 */
function logProtectedAccess(method, path, admin, ip, success) {
  const status = success ? "ALLOWED" : "DENIED";
  securityLogger.info(`ADMIN_ACCESS_${status}`, {
    admin,
    path: `${method} ${path}`,
    ip,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log de erros críticos
 */
function logCriticalError(errorType, message, ip) {
  winstonLogCriticalError(errorType, message, ip);
}

module.exports = {
  logLoginAttempt,
  logSecurityEvent,
  logProtectedAccess,
  logCriticalError,
};
