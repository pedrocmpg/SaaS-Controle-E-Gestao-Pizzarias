/**
 * Erro com status HTTP explícito, para que uma checagem feita DENTRO de uma
 * `prisma.$transaction` aborte a transação e ainda vire uma resposta limpa no handler
 * (em vez de vazar como 500 pelo errorHandler).
 */
class HttpError extends Error {
  constructor(httpStatus, message) {
    super(message);
    this.name = "HttpError";
    this.httpStatus = httpStatus;
  }
}

/** 409 — o recurso mudou de estado antes desta requisição (ex.: duplo clique em "fechar"). */
const conflito = (message) => new HttpError(409, message);

/**
 * Responde `err` se ele carrega um status HTTP; senão devolve false para o handler
 * seguir com `next(err)`.
 */
function responderSeHttpError(err, res) {
  if (err instanceof HttpError) {
    res.status(err.httpStatus).json({ error: err.message });
    return true;
  }
  return false;
}

module.exports = { HttpError, conflito, responderSeHttpError };
