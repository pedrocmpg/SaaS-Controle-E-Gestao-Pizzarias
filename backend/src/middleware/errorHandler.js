// Middleware central de tratamento de erros
function errorHandler(err, req, res, next) {
  console.error("Erro na aplicação:", err);

  if (err.code === "P2002") {
    return res.status(409).json({ error: "Registro duplicado.", details: err.meta });
  }

  if (err.code === "P2025") {
    return res.status(404).json({ error: "Registro não encontrado." });
  }

  res.status(err.status || 500).json({
    error: err.message || "Erro interno do servidor.",
  });
}

module.exports = errorHandler;
