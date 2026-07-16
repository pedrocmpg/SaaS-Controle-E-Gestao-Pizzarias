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
  // Uma única forma de pagamento por pedido (decisão de negócio).
  paymentMethod: Joi.string()
    .valid("DINHEIRO", "PIX", "CARTAO_CREDITO", "CARTAO_DEBITO")
    .required()
    .messages({
      "any.only": "Forma de pagamento inválida",
    }),
  // Origem do pedido. Fase 1 só usa TELEFONE; default aplicado no backend.
  origem: Joi.string()
    .valid("TELEFONE", "IFOOD", "ANOTA_AI", "WHATSAPP", "BALCAO")
    .optional(),
  // SUPER_ADMIN global pode indicar a loja; operador vinculado ignora este campo.
  lojaId: Joi.number().integer().positive().optional(),
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
        // Alinhado ao OrderItem.itemType do Prisma (MONTAVEL | COMBO | BEBIDA | ESPECIAL).
        itemType: Joi.string()
          .valid("MONTAVEL", "COMBO", "BEBIDA", "ESPECIAL")
          .required(),
        // flavors é Json no Prisma (array de nomes). Aceita array ou string legada.
        flavors: Joi.alternatives()
          .try(Joi.array().items(Joi.string().max(100)), Joi.string().max(255))
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
    .valid("RECEBIDO", "EM_PREPARO", "SAIU_PARA_ENTREGA", "ENTREGUE", "CANCELADO")
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
    .valid("SALGADA", "DOCE")
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

/**
 * Schema para edição parcial de tamanho de pizza (preço/disponibilidade)
 */
// Nota: o schema pizzaSizeSchema (criação) usa "basePrice", mas o campo real no
// Prisma é "price" — usamos o nome correto aqui para a edição parcial.
const pizzaSizePatchSchema = Joi.object({
  price: Joi.number().positive(),
  active: Joi.boolean(),
}).min(1);

/**
 * Schema para edição parcial de sabor (preço extra/disponibilidade)
 */
const flavorPatchSchema = Joi.object({
  extraPrice: Joi.number().min(0),
  active: Joi.boolean(),
}).min(1);

/**
 * Schema para edição parcial de borda (preço/disponibilidade)
 */
const borderPatchSchema = Joi.object({
  price: Joi.number().positive(),
  active: Joi.boolean(),
}).min(1);

/**
 * Schema para edição parcial de produto (preço/disponibilidade)
 */
const productPatchSchema = Joi.object({
  price: Joi.number().positive(),
  active: Joi.boolean(),
}).min(1);

/**
 * Schema para adicionar item a uma comanda de salão (rodízio por faixa ou produto/bebida)
 */
const adicionarItemComandaSchema = Joi.object({
  tipo: Joi.string()
    .valid("RODIZIO", "PRODUTO")
    .required()
    .messages({
      "any.only": "Tipo de item deve ser RODIZIO ou PRODUTO",
      "any.required": "Tipo de item é obrigatório",
    }),
  faixaRodizio: Joi.string()
    .valid("ADULTO", "CRIANCA", "MEIA")
    .when("tipo", { is: "RODIZIO", then: Joi.required(), otherwise: Joi.forbidden() }),
  productId: Joi.number()
    .integer()
    .positive()
    .when("tipo", { is: "PRODUTO", then: Joi.required(), otherwise: Joi.forbidden() }),
  quantity: Joi.number()
    .positive()
    .max(100)
    .required(),
});

/**
 * Schema para fechar uma comanda de salão (uma única forma de pagamento)
 */
const fecharComandaSchema = Joi.object({
  paymentMethod: Joi.string()
    .valid("DINHEIRO", "PIX", "CARTAO_CREDITO", "CARTAO_DEBITO")
    .required()
    .messages({
      "any.only": "Forma de pagamento inválida",
      "any.required": "Forma de pagamento é obrigatória",
    }),
});

/**
 * Schema para abrir uma sessão de caixa (salão ou tele-entrega)
 */
const abrirCaixaSchema = Joi.object({
  tipo: Joi.string()
    .valid("SALAO", "TELE_ENTREGA")
    .required()
    .messages({
      "any.only": "Tipo de caixa deve ser SALAO ou TELE_ENTREGA",
      "any.required": "Tipo de caixa é obrigatório",
    }),
  fundoTroco: Joi.number()
    .min(0)
    .max(99999.99)
    .required()
    .messages({
      "any.required": "Fundo de troco é obrigatório",
    }),
});

/**
 * Schema para sangria/suprimento — motivo é obrigatório (auditoria)
 */
const movimentoCaixaSchema = Joi.object({
  valor: Joi.number()
    .positive()
    .max(99999.99)
    .required()
    .messages({
      "any.required": "Valor é obrigatório",
    }),
  motivo: Joi.string()
    .min(1)
    .max(255)
    .trim()
    .required()
    .messages({
      "string.empty": "Motivo é obrigatório",
      "any.required": "Motivo é obrigatório",
    }),
});

/**
 * Schema para conferência do caixa no dia seguinte (saldo contado)
 */
const conferirCaixaSchema = Joi.object({
  saldoFinalContado: Joi.number()
    .min(0)
    .max(99999.99)
    .required()
    .messages({
      "any.required": "Saldo contado é obrigatório",
    }),
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
  pizzaSizePatchSchema,
  flavorPatchSchema,
  borderPatchSchema,
  productPatchSchema,
  adicionarItemComandaSchema,
  fecharComandaSchema,
  abrirCaixaSchema,
  movimentoCaixaSchema,
  conferirCaixaSchema,
};
