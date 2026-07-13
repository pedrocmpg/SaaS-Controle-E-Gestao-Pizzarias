const Joi = require("joi");

/**
 * Schema para login
 */
const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      "string.email": "Email deve ser válido",
      "any.required": "Email é obrigatório",
    }),
  password: Joi.string()
    .min(8)
    .max(128)
    .required()
    .messages({
      "string.min": "Senha deve ter no mínimo 8 caracteres",
      "any.required": "Senha é obrigatória",
    }),
});

/**
 * Schema para criar pedido
 */
const createOrderSchema = Joi.object({
  customerName: Joi.string()
    .min(2)
    .max(100)
    .trim()
    .required()
    .messages({
      "string.min": "Nome deve ter no mínimo 2 caracteres",
      "any.required": "Nome é obrigatório",
    }),
  phone: Joi.string()
    .pattern(/^[\d\s\-\(\)]+$/)
    .min(10)
    .max(20)
    .required()
    .messages({
      "string.pattern.base": "Telefone deve conter apenas números e caracteres válidos",
      "any.required": "Telefone é obrigatório",
    }),
  address: Joi.string()
    .max(255)
    .allow(null, ""),
  deliveryType: Joi.string()
    .valid("ENTREGA", "RETIRADA")
    .required()
    .messages({
      "any.only": "Tipo de entrega deve ser ENTREGA ou RETIRADA",
    }),
  paymentMethod: Joi.string()
    .valid("DINHEIRO", "CARTAO", "PIX", "WHATSAPP")
    .required()
    .messages({
      "any.only": "Forma de pagamento inválida",
    }),
  notes: Joi.string()
    .max(500)
    .allow(null, ""),
  deliveryFee: Joi.number()
    .min(0)
    .max(999.99)
    .allow(null),
  items: Joi.array()
    .items(
      Joi.object({
        itemName: Joi.string()
          .min(1)
          .max(100)
          .required(),
        itemType: Joi.string()
          .valid("PIZZA", "PRODUTO", "BEBIDA")
          .required(),
        flavors: Joi.string()
          .max(255)
          .allow(null, ""),
        borderName: Joi.string()
          .max(100)
          .allow(null, ""),
        quantity: Joi.number()
          .positive()
          .max(100)
          .required(),
        unitPrice: Joi.number()
          .positive()
          .max(9999.99)
          .required(),
        observations: Joi.string()
          .max(500)
          .allow(null, ""),
      })
    )
    .min(1)
    .required()
    .messages({
      "array.min": "Pedido deve ter no mínimo 1 item",
    }),
});

/**
 * Schema para atualizar status de pedido
 */
const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid("PENDENTE", "CONFIRMADO", "EM_PREPARO", "SAIU_PARA_ENTREGA", "ENTREGUE", "CANCELADO")
    .required()
    .messages({
      "any.only": "Status inválido",
      "any.required": "Status é obrigatório",
    }),
});

/**
 * Schema para atualizar configurações
 */
const updateSettingsSchema = Joi.object({
  storeName: Joi.string()
    .max(100)
    .allow(null, ""),
  address: Joi.string()
    .max(255)
    .allow(null, ""),
  phone: Joi.string()
    .pattern(/^[\d\s\-\(\)]+$/)
    .max(20)
    .allow(null, ""),
  whatsapp: Joi.string()
    .pattern(/^[\d\s\-\(\)]+$/)
    .max(20)
    .allow(null, ""),
  email: Joi.string()
    .email()
    .allow(null, ""),
  deliveryFee: Joi.number()
    .min(0)
    .max(999.99)
    .allow(null),
  openingTime: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .allow(null, ""),
  closingTime: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .allow(null, ""),
});

/**
 * Schema para criar tamanho de pizza
 */
const pizzaSizeSchema = Joi.object({
  name: Joi.string()
    .max(50)
    .required(),
  slices: Joi.number()
    .positive()
    .required(),
  basePrice: Joi.number()
    .positive()
    .required(),
  active: Joi.boolean(),
  order: Joi.number()
    .integer()
    .min(0),
});

/**
 * Schema para criar sabor
 */
const flavorSchema = Joi.object({
  name: Joi.string()
    .max(100)
    .required(),
  type: Joi.string()
    .valid("PIZZA", "DOCE")
    .required(),
  active: Joi.boolean(),
  order: Joi.number()
    .integer()
    .min(0),
});

/**
 * Schema para criar borda
 */
const borderSchema = Joi.object({
  name: Joi.string()
    .max(100)
    .required(),
  price: Joi.number()
    .positive()
    .required(),
  active: Joi.boolean(),
  order: Joi.number()
    .integer()
    .min(0),
});

/**
 * Schema para criar produto
 */
const productSchema = Joi.object({
  name: Joi.string()
    .max(100)
    .required(),
  category: Joi.string()
    .valid("COMBO", "BEBIDA", "ESPECIAL")
    .required(),
  price: Joi.number()
    .positive()
    .required(),
  description: Joi.string()
    .max(500)
    .allow(null, ""),
  active: Joi.boolean(),
  order: Joi.number()
    .integer()
    .min(0),
});

module.exports = {
  loginSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  updateSettingsSchema,
  pizzaSizeSchema,
  flavorSchema,
  borderSchema,
  productSchema,
};
