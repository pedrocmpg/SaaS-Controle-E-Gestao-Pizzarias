const morgan = require("morgan");
const { logger } = require("../lib/logger");

/**
 * Stream que redireciona Morgan para Winston
 */
const stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

/**
 * Formato customizado para Morgan
 * Inclui método, URL, status, tempo de resposta e tamanho
 */
const httpLogger = morgan(
  ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms',
  {
    stream,
    skip: (req, res) => {
      // Não loga health checks
      if (req.path === "/api/health") return true;
      // Não loga requisições de CSRF token
      if (req.path === "/api/auth/csrf" && req.method === "GET") return true;
      return false;
    },
  }
);

module.exports = { httpLogger };
