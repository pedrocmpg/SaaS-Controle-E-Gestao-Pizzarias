/**
 * Middleware para validar request com Joi
 */
const validateRequest = (schema, source = "body") => {
  return (req, res, next) => {
    const dataToValidate = req[source];

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true, // remove campos desconhecidos
    });

    if (error) {
      const messages = error.details.map((detail) => detail.message);
      return res.status(400).json({
        error: "Dados inválidos",
        details: messages,
      });
    }

    // substitui os dados validados e sanitizados
    req[source] = value;
    next();
  };
};

module.exports = validateRequest;
