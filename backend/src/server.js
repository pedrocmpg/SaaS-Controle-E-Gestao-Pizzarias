require("dotenv").config();
const http = require("http");
const express = require("express");
const cookieParser = require("cookie-parser");

const { initRedis } = require("./lib/redisClient");
const { logger } = require("./lib/logger");
const securityHeaders = require("./middleware/securityHeaders");
const { httpsRedirect, requireHttps } = require("./middleware/https");
const { corsWithIpWhitelist } = require("./middleware/corsIpWhitelist");
const { validateContentLength, validateContentType } = require("./middleware/contentLength");
const { sanitizeRequest } = require("./middleware/sanitizer");
const { generalLimiter } = require("./middleware/rateLimiter");
const { enableCookiesWithCORS, getCookieConfig } = require("./middleware/cookieConfig");
const { csrfProtection } = require("./middleware/csrf");
const { httpLogger } = require("./middleware/httpLogger");
const { initSocket } = require("./lib/socket");

const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const catalogRoutes = require("./routes/catalog.routes");
const ordersRoutes = require("./routes/orders.routes");
const settingsRoutes = require("./routes/settings.routes");
const auditRoutes = require("./routes/audit.routes");
const salaoRoutes = require("./routes/salao.routes");
const caixaRoutes = require("./routes/caixa.routes");
const motoboyRoutes = require("./routes/motoboy.routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// ===== INICIALIZAÇÃO =====

// Inicializa Redis (com fallback se falhar)
initRedis().catch((err) => {
  console.warn("⚠️ Redis não disponível. Usando fallback em-memória:", err.message);
});

// ===== MIDDLEWARES DE SEGURANÇA =====

// HTTPS redirect (produção)
app.use(httpsRedirect);

// Headers de segurança (Helmet)
app.use(securityHeaders);

// Rate limiting geral
app.use(generalLimiter);

// CORS com validação de IP e origem
app.use(enableCookiesWithCORS);
app.use(corsWithIpWhitelist);

// Validação de Content-Length e Content-Type (antes do body parser)
app.use(validateContentLength);
app.use(validateContentType);

// Body parser com limite de tamanho
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));

// Cookie parser (necessário para ler cookies do cliente)
app.use(cookieParser());

// CSRF protection (deve vir após cookie-parser)
app.use(csrfProtection);

// Sanitização de entrada
app.use(sanitizeRequest);

// HTTP Logging (Morgan + Winston)
app.use(httpLogger);

// ===== ROTAS =====

// Rota de health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "E Tenho Ditto Pizzaria API" });
});

// Rotas da aplicação
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/salao", salaoRoutes);
app.use("/api/caixa", caixaRoutes);
app.use("/api/motoboy", motoboyRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
});

// Tratamento de erros (deve ser o último middleware)
app.use(errorHandler);

const PORT = process.env.PORT || 3333;

// Servidor HTTP explícito para anexar o Socket.io ao mesmo servidor do Express
const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || "development"}`);
});
