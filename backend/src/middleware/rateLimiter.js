const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

/**
 * Fora de produção os limiters abaixo (general/admin) são compartilhados entre
 * TODAS as rotas admin (contador único por admin, não por endpoint), o que esgota
 * a cota em minutos de uso normal de um dev testando o painel. Em produção
 * continuam ativos normalmente.
 */
const isProduction = process.env.NODE_ENV === "production";
const passthrough = (req, res, next) => next();

/**
 * Rate limiter para login (máx 5 tentativas por 15 minutos por IP)
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máx 5 requisições
  message: {
    error: "Muitas tentativas de login. Tente novamente em 15 minutos.",
  },
  standardHeaders: true, // retorna info no header RateLimit-*
  legacyHeaders: false, // desativa X-RateLimit-* headers
  skip: (req) => false,
  handler: (req, res) => {
    res.status(429).json({
      error: "Muitas tentativas. Por favor, aguarde.",
      retryAfter: req.rateLimit.resetTime,
    });
  },
});

/**
 * Rate limiter para criar pedidos (máx 20 por hora por IP)
 */
const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20,
  message: {
    error: "Limite de pedidos atingido. Tente novamente mais tarde.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: "Limite de pedidos atingido.",
      retryAfter: req.rateLimit.resetTime,
    });
  },
});

/**
 * Rate limiter geral para todas as rotas (100 req por 15 min por IP)
 */
const generalLimiter = isProduction
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
    })
  : passthrough;

/**
 * Rate limiter para endpoints administrativos (LIST, VIEW)
 * Mais generoso que para modificações (50 req por 15 min por usuário autenticado)
 */
const adminReadLimiter = isProduction
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 50,
      keyGenerator: (req, res) => {
        // Limita por admin ID se autenticado, senão por IP (com suporte IPv6)
        return req.admin?.id ? `admin:${req.admin.id}` : ipKeyGenerator(req, res);
      },
      message: {
        error: "Limite de leitura atingido. Tente novamente em alguns minutos.",
      },
      standardHeaders: true,
      legacyHeaders: false,
    })
  : passthrough;

/**
 * Rate limiter para endpoints administrativos (CREATE, UPDATE, DELETE)
 * Bem restritivo (10 req por 15 min por usuário autenticado)
 */
const adminWriteLimiter = isProduction
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      keyGenerator: (req, res) => {
        // Limita por admin ID se autenticado, senão por IP (com suporte IPv6)
        return req.admin?.id ? `admin:${req.admin.id}` : ipKeyGenerator(req, res);
      },
      message: {
        error: "Limite de escrita atingido. Tente novamente em alguns minutos.",
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        res.status(429).json({
          error: "Limite de modificações atingido. Por favor, aguarde.",
          retryAfter: req.rateLimit.resetTime,
        });
      },
    })
  : passthrough;

/**
 * Rate limiter específico para operações sensíveis (export, batch delete, etc)
 * Muito restritivo (3 req por hora por usuário)
 */
const adminSensitiveLimiter = isProduction
  ? rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 3,
      keyGenerator: (req, res) => {
        return req.admin?.id ? `admin:sensitive:${req.admin.id}` : ipKeyGenerator(req, res);
      },
      message: {
        error: "Limite de operações sensíveis atingido. Tente novamente em 1 hora.",
      },
      standardHeaders: true,
      legacyHeaders: false,
    })
  : passthrough;

module.exports = {
  loginLimiter,
  orderLimiter,
  generalLimiter,
  adminReadLimiter,
  adminWriteLimiter,
  adminSensitiveLimiter,
};
