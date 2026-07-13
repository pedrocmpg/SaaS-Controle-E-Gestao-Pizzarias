const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");

// Criar diretório de logs se não existir
const logsDir = path.join(__dirname, "../../logs");
const fs = require("fs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Formato personalizado para logs
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

/**
 * Transporte de arquivo com rotação diária
 * - Rotaciona em novo arquivo todo dia
 * - Comprime arquivos antigos
 * - Mantém últimos 7 dias
 */
const dailyRotateFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, "application-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m", // Rotaciona se atingir 20MB
  maxDays: "7d", // Mantém últimos 7 dias
  compress: true, // Comprime arquivos antigos
  format: customFormat,
});

/**
 * Transporte para erros em arquivo separado
 */
const errorFileTransport = new DailyRotateFile({
  level: "error",
  filename: path.join(logsDir, "errors-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxDays: "30d", // Mantém últimos 30 dias de erros
  compress: true,
  format: customFormat,
});

/**
 * Transporte para logs de segurança
 */
const securityFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, "security-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxDays: "90d", // Mantém 90 dias de auditoria
  compress: true,
  format: customFormat,
});

/**
 * Logger principal
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: customFormat,
  defaultMeta: { service: "etd-pizzaria-api" },
  transports: [
    // Console em desenvolvimento
    ...(process.env.NODE_ENV !== "production"
      ? [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.printf(({ level, message, timestamp, ...meta }) => {
                const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : "";
                return `${timestamp} [${level}]: ${message} ${metaStr}`;
              })
            ),
          }),
        ]
      : []),
    // Arquivos
    dailyRotateFileTransport,
    errorFileTransport,
  ],
});

/**
 * Logger de segurança (auditoria)
 * Logs separados para eventos de segurança críticos
 */
const securityLogger = winston.createLogger({
  level: "info",
  format: customFormat,
  defaultMeta: { service: "etd-pizzaria-api-security" },
  transports: [
    securityFileTransport,
    ...(process.env.NODE_ENV !== "production"
      ? [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize({ colors: { info: "cyan" } }),
              winston.format.printf(({ level, message, timestamp, ...meta }) => {
                const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : "";
                return `🔐 ${timestamp} [${level}]: ${message} ${metaStr}`;
              })
            ),
          }),
        ]
      : []),
  ],
});

/**
 * Função auxiliar para logar eventos de segurança
 */
function logSecurityEvent(eventType, details, ip) {
  securityLogger.info(eventType, {
    ip,
    details,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Função auxiliar para logar login
 */
function logLoginAttempt(email, success, ip, userAgent) {
  const level = success ? "info" : "warn";
  const eventType = success ? "LOGIN_SUCCESS" : "LOGIN_FAILED";

  securityLogger.log(level, eventType, {
    email,
    ip,
    userAgent,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Função auxiliar para logar erro crítico
 */
function logCriticalError(errorType, message, ip) {
  logger.error(`CRITICAL_${errorType}`, {
    message,
    ip,
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  logger,
  securityLogger,
  logSecurityEvent,
  logLoginAttempt,
  logCriticalError,
};
