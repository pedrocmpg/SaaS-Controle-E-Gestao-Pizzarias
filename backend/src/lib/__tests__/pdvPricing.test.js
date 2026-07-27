const { calcularPrecoPizza } = require("../pdvPricing");

describe("calcularPrecoPizza", () => {
  it("soma preço base do tamanho, adicionais dos sabores e borda", () => {
    const preco = calcularPrecoPizza({
      pizzaSize: { price: 40 },
      flavors: [{ extraPrice: 5 }, { extraPrice: 3 }],
      border: { price: 8 },
      modoAdicionalSabor: "CHEIO",
    });

    expect(preco).toBe(56);
  });

  it("pizza sem borda não soma adicional de borda", () => {
    const preco = calcularPrecoPizza({
      pizzaSize: { price: 40 },
      flavors: [{ extraPrice: 5 }],
      border: null,
      modoAdicionalSabor: "CHEIO",
    });

    expect(preco).toBe(45);
  });

  it("sabores sem adicional mantêm o preço base do tamanho", () => {
    const preco = calcularPrecoPizza({
      pizzaSize: { price: 40 },
      flavors: [{ extraPrice: 0 }, { extraPrice: 0 }],
      border: null,
      modoAdicionalSabor: "CHEIO",
    });

    expect(preco).toBe(40);
  });

  it("modo de adicional diferente de CHEIO lança erro em vez de calcular errado", () => {
    expect(() =>
      calcularPrecoPizza({
        pizzaSize: { price: 40 },
        flavors: [{ extraPrice: 5 }],
        border: null,
        modoAdicionalSabor: "PROPORCIONAL",
      })
    ).toThrow(/não implementado/);
  });
});
