const prisma = require("./prisma");

/**
 * Resolve o lojaId efetivo de uma requisição autenticada (multi-tenant).
 *
 * Regras:
 * - Operador vinculado a uma loja (`req.admin.lojaId`) → SEMPRE essa loja
 *   (não pode ser sobrescrito por body/query — isolamento não-negociável).
 * - SUPER_ADMIN global (lojaId null) → usa `lojaId` do body ou da query, se informado.
 * - Fallback do piloto: se ainda não resolveu e `fallbackToFirst`, usa a loja única (menor id).
 *
 * @returns {Promise<number|null>} lojaId ou null se não for possível resolver.
 */
async function resolveLojaId(req, { fallbackToFirst = true } = {}) {
  if (req.admin && req.admin.lojaId != null) return req.admin.lojaId;

  const fromBody = req.body && req.body.lojaId;
  if (fromBody != null && !isNaN(parseInt(fromBody))) return parseInt(fromBody);

  const fromQuery = req.query && req.query.lojaId;
  if (fromQuery != null && !isNaN(parseInt(fromQuery))) return parseInt(fromQuery);

  if (fallbackToFirst) {
    const loja = await prisma.loja.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
    return loja ? loja.id : null;
  }
  return null;
}

module.exports = { resolveLojaId };
