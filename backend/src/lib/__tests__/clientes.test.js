const {
  mascararTelefone,
  formatarTelefone,
  agregarPedidos,
  interpretarBusca,
  diasEntre,
} = require("../clientes");

describe("mascararTelefone", () => {
  it("mostra DDD e os 4 últimos, esconde o miolo", () => {
    expect(mascararTelefone("54999991234")).toBe("(54) ****-1234");
  });

  it("aceita telefone já formatado", () => {
    expect(mascararTelefone("(54) 99999-1234")).toBe("(54) ****-1234");
  });

  it("telefone fixo de 10 dígitos também mantém DDD", () => {
    expect(mascararTelefone("5433221234")).toBe("(54) ****-1234");
  });

  it("sem DDD, mascara só o que dá", () => {
    expect(mascararTelefone("99991234")).toBe("****-1234");
  });

  it("telefone ausente ou curto demais vira null (nunca quebra a lista)", () => {
    expect(mascararTelefone(null)).toBeNull();
    expect(mascararTelefone("")).toBeNull();
    expect(mascararTelefone("123")).toBeNull();
  });
});

describe("formatarTelefone", () => {
  it("formata celular de 11 dígitos", () => {
    expect(formatarTelefone("54999991234")).toBe("(54) 99999-1234");
  });

  it("formata fixo de 10 dígitos", () => {
    expect(formatarTelefone("5433221234")).toBe("(54) 3322-1234");
  });

  it("tamanho inesperado volta como veio, sem inventar formato", () => {
    expect(formatarTelefone("123456")).toBe("123456");
  });
});

describe("agregarPedidos", () => {
  const agora = new Date("2026-07-29T12:00:00Z");

  it("soma faturamento e calcula ticket médio", () => {
    const r = agregarPedidos(
      [
        { status: "ENTREGUE", totalPrice: 100, createdAt: "2026-07-20T12:00:00Z" },
        { status: "ENTREGUE", totalPrice: 50, createdAt: "2026-07-25T12:00:00Z" },
      ],
      agora
    );

    expect(r.totalPedidos).toBe(2);
    expect(r.totalGasto).toBe(150);
    expect(r.ticketMedio).toBe(75);
  });

  // Invariante do CRM: cancelado não é venda. Se entrasse, inflaria o total gasto
  // e o ticket médio de um cliente que não pagou nada.
  it("pedido CANCELADO não entra em totalGasto nem na contagem", () => {
    const r = agregarPedidos(
      [
        { status: "ENTREGUE", totalPrice: 100, createdAt: "2026-07-20T12:00:00Z" },
        { status: "CANCELADO", totalPrice: 999, createdAt: "2026-07-21T12:00:00Z" },
      ],
      agora
    );

    expect(r.totalPedidos).toBe(1);
    expect(r.totalGasto).toBe(100);
    expect(r.ticketMedio).toBe(100);
  });

  // Mas para "sumiu há quanto tempo", o cancelado conta: houve contato.
  it("último pedido considera o cancelado (é contato, não venda)", () => {
    const r = agregarPedidos(
      [
        { status: "ENTREGUE", totalPrice: 100, createdAt: "2026-07-20T12:00:00Z" },
        { status: "CANCELADO", totalPrice: 50, createdAt: "2026-07-27T12:00:00Z" },
      ],
      agora
    );

    expect(r.ultimoPedidoEm).toEqual(new Date("2026-07-27T12:00:00Z"));
    expect(r.diasSemPedir).toBe(2);
  });

  it("cliente só com pedidos cancelados tem gasto zero, sem dividir por zero", () => {
    const r = agregarPedidos(
      [{ status: "CANCELADO", totalPrice: 80, createdAt: "2026-07-27T12:00:00Z" }],
      agora
    );

    expect(r.totalPedidos).toBe(0);
    expect(r.totalGasto).toBe(0);
    expect(r.ticketMedio).toBe(0);
    expect(r.diasSemPedir).toBe(2);
  });

  it("cliente sem pedido nenhum não quebra", () => {
    const r = agregarPedidos([], agora);
    expect(r.totalPedidos).toBe(0);
    expect(r.ticketMedio).toBe(0);
    expect(r.ultimoPedidoEm).toBeNull();
    expect(r.diasSemPedir).toBeNull();
  });

  it("aceita totalPrice como string (Decimal do Prisma)", () => {
    const r = agregarPedidos(
      [{ status: "ENTREGUE", totalPrice: "49.90", createdAt: "2026-07-20T12:00:00Z" }],
      agora
    );
    expect(r.totalGasto).toBe(49.9);
  });

  it("arredonda dinheiro em 2 casas (sem lixo de ponto flutuante)", () => {
    const r = agregarPedidos(
      [
        { status: "ENTREGUE", totalPrice: 0.1, createdAt: "2026-07-20T12:00:00Z" },
        { status: "ENTREGUE", totalPrice: 0.2, createdAt: "2026-07-21T12:00:00Z" },
      ],
      agora
    );
    expect(r.totalGasto).toBe(0.3);
  });
});

describe("interpretarBusca", () => {
  it("4+ dígitos = busca por final do telefone", () => {
    expect(interpretarBusca("1234")).toEqual({ tipo: "telefone", valor: "1234", completo: false });
  });

  it("telefone completo marca `completo` para tentar o hash exato", () => {
    expect(interpretarBusca("54999991234")).toEqual({
      tipo: "telefone",
      valor: "54999991234",
      completo: true,
    });
  });

  it("telefone formatado é entendido como telefone", () => {
    const r = interpretarBusca("(54) 99999-1234");
    expect(r.tipo).toBe("telefone");
    expect(r.valor).toBe("54999991234");
    expect(r.completo).toBe(true);
  });

  it("texto vira busca por nome", () => {
    expect(interpretarBusca("Maria")).toEqual({ tipo: "nome", valor: "Maria", completo: false });
  });

  it("poucos dígitos caem em nome (pode ser 'Pizzaria 24')", () => {
    expect(interpretarBusca("24").tipo).toBe("nome");
  });

  it("termo vazio ou só espaço não vira busca", () => {
    expect(interpretarBusca("")).toBeNull();
    expect(interpretarBusca("   ")).toBeNull();
    expect(interpretarBusca(undefined)).toBeNull();
  });
});

describe("diasEntre", () => {
  it("conta dias inteiros decorridos", () => {
    expect(diasEntre("2026-07-20T12:00:00Z", new Date("2026-07-29T12:00:00Z"))).toBe(9);
  });

  it("nunca retorna negativo (data futura vira 0)", () => {
    expect(diasEntre("2026-08-10T12:00:00Z", new Date("2026-07-29T12:00:00Z"))).toBe(0);
  });
});
