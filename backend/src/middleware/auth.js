const jwt = require("jsonwebtoken");
const { isBlacklisted } = require("../lib/tokenBlacklist");
const prisma = require("../lib/prisma");

/**
 * Middleware que exige um token JWT válido (usado nas rotas do painel admin).
 * Espera o header: Authorization: Bearer <token>
 * OU um cookie httpOnly chamado 'token'
 */
async function requireAuth(req, res, next) {
  try {
    let token;

    // Tenta obter token do header Authorization primeiro
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    // Se não encontrar, tenta cookie httpOnly
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ error: "Token de autenticação não informado." });
    }

    // Verifica se token foi revogado (com Redis ou fallback em-memória)
    const blacklisted = await isBlacklisted(token);
    if (blacklisted) {
      return res.status(401).json({ error: "Token foi revogado." });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Token expirado." });
      }
      return res.status(401).json({ error: "Token inválido." });
    }

    // Confere no banco (não só no payload do JWT) se o admin ainda está ativo —
    // cobre tanto tentativa de login com conta desativada quanto sessão já aberta
    // de alguém que foi desativado depois de emitir o token.
    const current = await prisma.admin.findUnique({
      where: { id: payload.id },
      select: { active: true },
    });
    if (!current || current.active === false) {
      return res.status(401).json({ error: "Token inválido." });
    }

    req.admin = payload;
    req.token = token;
    next();
  } catch (err) {
    console.error("Erro no middleware de autenticação:", err);
    res.status(500).json({ error: "Erro ao processar autenticação." });
  }
}

module.exports = { requireAuth };
