const csrf = require("csurf");

/**
 * Middleware CSRF usando cookies para armazenar tokens
 * O token é gerado automaticamente e deve ser enviado em:
 * - Header X-CSRF-Token
 * - OU campo _csrf em POST/PUT/PATCH/DELETE
 */
const csrfProtection = csrf({
  cookie: true, // Armazena token em cookie
  httpOnly: true, // Protege contra XSS
  sameSite: "strict", // Protege contra CSRF cross-site
});

/**
 * Middleware para gerar CSRF token
 * Retorna o token em req.csrfToken()
 * Use em rotas que retornam formulários
 */
const generateCsrfToken = (req, res, next) => {
  res.json({
    csrfToken: req.csrfToken(),
  });
};

module.exports = {
  csrfProtection,
  generateCsrfToken,
};
