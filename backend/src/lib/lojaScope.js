const prisma = require("./prisma");

/**
 * Resolve o lojaId efetivo de uma requisição autenticada (multi-tenant).
 *
 * Regras:
 * - Operador vinculado a uma loja (`req.admin.lojaId`) → SEMPRE essa loja
 *   (não pode ser sobrescrito por body/query — isolamento não-negociável).
 * - SUPER_ADMIN global (lojaId null) → usa `lojaId` do body ou da query, validando
 *   que a loja existe (id inexistente vira 400 legível, não FK violation 500).
 * - Não resolveu → null. NÃO existe fallback: cair na "primeira loja" faria uma
 *   requisição malformada gravar dado de um tenant dentro do outro, silenciosamente.
 *
 * @returns {Promise<number|null>} lojaId ou null se não for possível resolver.
 */
/** Busca padrão da loja. Injetável nos testes para não exigir banco. */
const buscarLoja = (id) => prisma.loja.findUnique({ where: { id }, select: { id: true } });

async function resolveLojaId(req, { lojaExiste = buscarLoja } = {}) {
  if (req.admin && req.admin.lojaId != null) return req.admin.lojaId;

  const informado = (req.body && req.body.lojaId) ?? (req.query && req.query.lojaId);
  if (informado == null || isNaN(parseInt(informado))) return null;

  const loja = await lojaExiste(parseInt(informado));
  return loja ? loja.id : null;
}

module.exports = { resolveLojaId };
