/**
 * Middleware para configurar cookies de autenticação de forma segura
 * HttpOnly: Não acessível via JavaScript (mitiga XSS)
 * Secure: Apenas via HTTPS (em produção)
 * SameSite: Protege contra CSRF
 */

/**
 * Retorna configuração de cookie otimizada para o ambiente
 */
function getCookieConfig() {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true, // Impede acesso via JavaScript (mitiga XSS)
    secure: isProduction, // Apenas HTTPS em produção
    sameSite: 'strict', // Proteção contra CSRF
    maxAge: 8 * 60 * 60 * 1000, // 8 horas em milissegundos
    path: '/', // Cookie disponível em toda a aplicação
    domain: isProduction ? process.env.DOMAIN : undefined, // Apenas em produção
  };
}

/**
 * Middleware para validar CORS e permitir cookies entre domínios
 * Deve ser usado em conjunto com CORS middleware
 */
function enableCookiesWithCORS(req, res, next) {
  // Set-Cookie headers são controlados pelo navegador quando SameSite=Strict
  res.set('Access-Control-Allow-Credentials', 'true');
  next();
}

module.exports = {
  getCookieConfig,
  enableCookiesWithCORS,
};
