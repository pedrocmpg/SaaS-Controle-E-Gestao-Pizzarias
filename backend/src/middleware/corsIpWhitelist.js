/**
 * Middleware para CORS com validação de IP
 * Adiciona camada extra de segurança validando origem + IP
 */

const { logger } = require("../lib/logger");

/**
 * IP whitelist padrão
 * Pode ser estendida via .env
 */
const DEFAULT_IP_WHITELIST = [
  "127.0.0.1", // localhost
  "::1", // localhost IPv6
  "localhost",
];

/**
 * Carrega IP whitelist do .env
 * Formato: IP1,IP2,IP3
 * Exemplo: CORS_IP_WHITELIST=192.168.1.100,10.0.0.1
 */
function getIpWhitelist() {
  const envList = process.env.CORS_IP_WHITELIST;
  const customList = envList ? envList.split(",").map((ip) => ip.trim()) : [];
  return [...DEFAULT_IP_WHITELIST, ...customList];
}

/**
 * Valida se o IP está na whitelist
 * @param {string} clientIp - IP do cliente
 * @param {Array<string>} whitelist - Lista de IPs permitidos
 * @returns {boolean}
 */
function isIpAllowed(clientIp, whitelist) {
  // Tira porter se existir (ex: 127.0.0.1:54321 -> 127.0.0.1)
  const ipOnly = clientIp ? clientIp.split(":")[0] : "";

  return whitelist.some((allowedIp) => {
    // Suporta wildcard 192.168.1.* (match prefix)
    if (allowedIp.includes("*")) {
      const prefix = allowedIp.replace("*", "");
      return ipOnly.startsWith(prefix);
    }

    return ipOnly === allowedIp;
  });
}

/**
 * Middleware CORS com validação de IP
 * Valida origem + IP antes de permitir CORS
 */
function corsWithIpWhitelist(req, res, next) {
  const origin = req.get("origin");
  const clientIp = req.ip || req.connection.remoteAddress;
  const ipWhitelist = getIpWhitelist();
  const isProduction = process.env.NODE_ENV === "production";

  // Configurações de CORS padrão
  const allowedOrigins = [
    process.env.FRONTEND_URL || "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5173",
  ];

  // Validação 1: Valida origem
  const originValid = !origin || allowedOrigins.includes(origin);

  // Validação 2: Valida IP (se em produção)
  const ipValid = isProduction ? isIpAllowed(clientIp, ipWhitelist) : true;

  // Se ambas válidas, permite CORS
  if (originValid && ipValid) {
    res.header("Access-Control-Allow-Origin", origin || allowedOrigins[0]);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token");
    res.header("Access-Control-Max-Age", "3600");

    // Se é preflight, responde aqui
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    return next();
  }

  // Log de violação
  if (!originValid) {
    logger.warn("CORS_ORIGIN_REJECTED", {
      origin: origin || "none",
      ip: clientIp,
      allowedOrigins,
      timestamp: new Date().toISOString(),
    });
  }

  if (!ipValid) {
    logger.warn("CORS_IP_REJECTED", {
      origin: origin || "none",
      ip: clientIp,
      whitelist: ipWhitelist,
      timestamp: new Date().toISOString(),
    });
  }

  // Rejeita CORS
  res.status(403).json({
    error: "CORS não permitido.",
    details: {
      originValid,
      ipValid,
      clientIp,
    },
  });
}

/**
 * Middleware para apenas validar IP (sem validar origem)
 * Útil se você já tem CORS middleware do Express
 */
function ipWhitelistOnly(req, res, next) {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    return next(); // Development mode, skip IP check
  }

  const clientIp = req.ip || req.connection.remoteAddress;
  const ipWhitelist = getIpWhitelist();

  if (!isIpAllowed(clientIp, ipWhitelist)) {
    const ip = clientIp ? clientIp.split(":")[0] : "";
    logger.warn("IP_WHITELIST_REJECTED", {
      ip,
      whitelist: ipWhitelist,
      path: req.path,
      timestamp: new Date().toISOString(),
    });

    return res.status(403).json({
      error: "IP não autorizado.",
    });
  }

  next();
}

module.exports = {
  corsWithIpWhitelist,
  ipWhitelistOnly,
  getIpWhitelist,
  isIpAllowed,
};
