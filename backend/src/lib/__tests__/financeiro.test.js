const { calcularFechamentoTurno, calcularFechamentoCaixa } = require("../financeiro");

/** Pedido entregue e cobrado em dinheiro na entrega (o caso que gera espécie na mão do motoboy). */
const pedidoDinheiro = (totalPrice) => ({ paymentMethod: "DINHEIRO", cobradoNaEntrega: true, totalPrice });

describe("calcularFechamentoTurno", () => {
  it("turno sem entregas e sem extras: valorDaNoite é só o aluguel e a pizzaria deve ao motoboy", () => {
    const r = calcularFechamentoTurno({
      fundoTroco: 50,
      pedidos: [],
      extras: [],
      valorPorEntrega: 8,
      valorAluguelMoto: 30,
    });

    expect(r.totalEntregas).toBe(0);
    expect(r.valorDaNoite).toBe(30);
    expect(r.acerto).toBe(-30);
    expect(r.sangria).toBe(0);
  });

  it("entregas em dinheiro cobrindo o valor da noite: acerto positivo e sangria igual ao acerto", () => {
    const r = calcularFechamentoTurno({
      fundoTroco: 50,
      pedidos: [pedidoDinheiro(100), pedidoDinheiro(80)],
      extras: [],
      valorPorEntrega: 8,
      valorAluguelMoto: 30,
    });

    // valorDaNoite = 2 × 8 + 0 + 30 = 46; espécie recebida = 180
    expect(r.valorDaNoite).toBe(46);
    expect(r.totalRecebidoDinheiro).toBe(230); // 50 de fundo + 180
    expect(r.acerto).toBe(134);
    expect(r.sangria).toBe(134);
  });

  it("acerto exatamente zero: sangria é 0, não negativo e não -0", () => {
    const r = calcularFechamentoTurno({
      fundoTroco: 40,
      pedidos: [pedidoDinheiro(46)],
      extras: [],
      valorPorEntrega: 16,
      valorAluguelMoto: 30,
    });

    expect(r.valorDaNoite).toBe(46);
    expect(r.acerto).toBe(0);
    expect(r.sangria).toBe(0);
    expect(Object.is(r.sangria, -0)).toBe(false);
  });

  it("fundo de troco nunca vira ganho: fundos diferentes produzem o mesmo acerto", () => {
    const cenario = (fundoTroco) =>
      calcularFechamentoTurno({
        fundoTroco,
        pedidos: [pedidoDinheiro(120), pedidoDinheiro(60)],
        extras: [{ valor: 10 }],
        valorPorEntrega: 8,
        valorAluguelMoto: 30,
      });

    const pequeno = cenario(20);
    const grande = cenario(500);

    expect(pequeno.acerto).toBe(grande.acerto);
    expect(pequeno.sangria).toBe(grande.sangria);
    // O fundo aparece no dinheiro em mãos, mas não no acerto.
    expect(grande.totalRecebidoDinheiro - pequeno.totalRecebidoDinheiro).toBe(480);
  });

  it("pedido pago antecipadamente não entra no dinheiro em espécie, mesmo com paymentMethod DINHEIRO", () => {
    const r = calcularFechamentoTurno({
      fundoTroco: 0,
      pedidos: [
        pedidoDinheiro(100),
        { paymentMethod: "DINHEIRO", cobradoNaEntrega: false, totalPrice: 999 },
      ],
      extras: [],
      valorPorEntrega: 8,
      valorAluguelMoto: 0,
    });

    expect(r.totalEntregas).toBe(2); // conta como entrega paga ao motoboy
    expect(r.totalRecebidoDinheiro).toBe(100); // mas não gera espécie
  });

  it("pedidos em cartão e PIX não entram no dinheiro em espécie", () => {
    const r = calcularFechamentoTurno({
      fundoTroco: 0,
      pedidos: [
        { paymentMethod: "CARTAO_CREDITO", cobradoNaEntrega: true, totalPrice: 200 },
        { paymentMethod: "CARTAO_DEBITO", cobradoNaEntrega: true, totalPrice: 150 },
        { paymentMethod: "PIX", cobradoNaEntrega: true, totalPrice: 90 },
        pedidoDinheiro(40),
      ],
      extras: [],
      valorPorEntrega: 8,
      valorAluguelMoto: 0,
    });

    expect(r.totalEntregas).toBe(4);
    expect(r.totalRecebidoDinheiro).toBe(40);
  });

  it("extras dos quatro tipos somam corretamente em totalExtras e entram no valor da noite", () => {
    const r = calcularFechamentoTurno({
      fundoTroco: 0,
      pedidos: [],
      extras: [
        { tipo: "ENTREGA_LONGA", valor: 5 },
        { tipo: "GORJETA", valor: 12.5 },
        { tipo: "AJUDA_CUSTO", valor: 20 },
        { tipo: "OUTRO", valor: 2.5 },
      ],
      valorPorEntrega: 8,
      valorAluguelMoto: 30,
    });

    expect(r.totalExtras).toBe(40);
    expect(r.valorDaNoite).toBe(70);
  });

  it("aceita Decimal do Prisma (objeto com toString) sem virar NaN", () => {
    const decimal = (v) => ({ toString: () => String(v), valueOf: () => v });
    const r = calcularFechamentoTurno({
      fundoTroco: decimal(50),
      pedidos: [{ paymentMethod: "DINHEIRO", cobradoNaEntrega: true, totalPrice: decimal(100) }],
      extras: [{ valor: decimal(10) }],
      valorPorEntrega: decimal(8),
      valorAluguelMoto: decimal(30),
    });

    expect(r.valorDaNoite).toBe(48);
    expect(r.acerto).toBe(52);
  });
});

describe("calcularFechamentoCaixa", () => {
  const comandas = [
    { paymentMethod: "DINHEIRO", totalPrice: 100 },
    { paymentMethod: "DINHEIRO", totalPrice: 50 },
    { paymentMethod: "CARTAO_CREDITO", totalPrice: 200 },
    { paymentMethod: "CARTAO_DEBITO", totalPrice: 80 },
    { paymentMethod: "PIX", totalPrice: 60 },
  ];

  it("faz o breakdown correto por forma de pagamento", () => {
    const r = calcularFechamentoCaixa({ fundoTroco: 100, comandas, movimentos: [] });

    expect(r.totalVendasDinheiro).toBe(150);
    expect(r.totalVendasCartao).toBe(280); // crédito + débito
    expect(r.totalVendasPix).toBe(60);
  });

  it("cartão e PIX não entram no saldo em espécie da gaveta", () => {
    const r = calcularFechamentoCaixa({ fundoTroco: 100, comandas, movimentos: [] });

    expect(r.saldoFinalCalculado).toBe(250); // 100 de fundo + 150 em dinheiro
  });

  it("sangria subtrai e suprimento soma no saldo esperado", () => {
    const r = calcularFechamentoCaixa({
      fundoTroco: 100,
      comandas,
      movimentos: [
        { tipo: "SANGRIA", valor: 70 },
        { tipo: "SANGRIA", valor: 30 },
        { tipo: "SUPRIMENTO", valor: 25 },
      ],
    });

    expect(r.totalSangrias).toBe(100);
    expect(r.totalSuprimentos).toBe(25);
    expect(r.saldoFinalCalculado).toBe(175); // 100 + 150 - 100 + 25
  });

  it("caixa sem nenhuma comanda: saldo calculado é exatamente o fundo de troco", () => {
    const r = calcularFechamentoCaixa({ fundoTroco: 120, comandas: [], movimentos: [] });

    expect(r.totalVendasDinheiro).toBe(0);
    expect(r.saldoFinalCalculado).toBe(120);
  });

  it("comanda sem forma de pagamento não é contada em nenhum método", () => {
    const r = calcularFechamentoCaixa({
      fundoTroco: 0,
      comandas: [{ paymentMethod: null, totalPrice: 999 }],
      movimentos: [],
    });

    expect(r.totalVendasDinheiro).toBe(0);
    expect(r.totalVendasCartao).toBe(0);
    expect(r.totalVendasPix).toBe(0);
    expect(r.saldoFinalCalculado).toBe(0);
  });
});
