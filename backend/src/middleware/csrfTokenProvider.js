/**
 * Middleware para expor CSRF token em respostas
 * Adiciona o token em header X-CSRF-Token para que o frontend possa capturar
 */
function provideCsrfToken(req, res, next) {
  // Adiciona método helper para gerar token
  const originalJson = res.json;
  
  res.json = function(data) {
    // Se for GET (safe), adiciona token no header
    if (req.method === "GET") {
      res.set("X-CSRF-Token", req.csrfToken());
    }
    // Chama o json original
    return originalJson.call(this, data);
  };
  
  next();
}

module.exports = { provideCsrfToken };
