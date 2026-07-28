const {
  renderComandaCozinha,
  renderCupomCliente,
  renderCupomComanda,
  renderRomaneioMotoboy,
  centralizar,
  doisLados,
  quebrar,
} = require("../impressaoLayout");

/** Junta as linhas em texto corrido, como sai no papel. */
const texto = (payload) => payload.linhas.map((l) => l.texto).join("\n");
/** Linhas de um estilo específico. */
const porEstilo = (payload, estilo) => payload.linhas.filter((l) => l.estilo === estilo).map((l) => l.texto);

const pedidoBase = {
  id: 412,
  createdAt: new Date("2026-07-28T19:42:00"),
  deliveryType: "ENTREGA",
  customerName: "Maria Silva",
  phone: "51999998888",
  address: "Rua das Flores, 123 - Centro",
  paymentMethod: "DINHEIRO",
  deliveryFee: 10,
  totalPrice: 85,
  notes: null,
  items: [
    {
      itemName: "Pizza Grande",
      quantity: 1,
      subtotal: 65,
      flavors: ["Calabresa", "Frango c/ Catupiry"],
      borderName: "Catupiry",
      observations: "sem cebola",
    },
    { itemName: "Refrigerante 2L", quantity: 2, subtotal: 10, flavors: null, borderName: null, observations: null },
  ],
};

describe("helpers de formatação", () => {
  it("doisLados alinha o valor na margem direita", () => {
    const l = doisLados(" Total", "R$ 10,00", 32);
    expect(l).toHaveLength(32);
    expect(l.endsWith("R$ 10,00")).toBe(true);
  });

  it("quebrar nunca corta palavra ao meio nem estoura a largura", () => {
    const linhas = quebrar("Calabresa / Frango com Catupiry / Quatro Queijos", 32, "    > ");
    linhas.forEach((l) => expect(l.length).toBeLessThanOrEqual(32));
    expect(linhas.join(" ")).toContain("Catupiry");
  });

  it("centralizar não estoura quando o texto é maior que a largura", () => {
    expect(centralizar("x".repeat(40), 32)).toHaveLength(40);
  });

  it("um rótulo não se repete nas linhas de continuação", () => {
    const linhas = quebrar("Rua das Flores, 123 - Bairro Centro, apto 302", 48, " Endereco: ", " ".repeat(11));
    expect(linhas.length).toBeGreaterThan(1);
    expect(linhas.filter((l) => l.includes("Endereco:"))).toHaveLength(1);
  });
});

describe("comanda de cozinha", () => {
  it("traz número do pedido, hora, itens, sabores e borda", () => {
    const t = texto(renderComandaCozinha(pedidoBase));
    expect(t).toContain("PEDIDO #412");
    expect(t).toContain("19:42");
    expect(t).toContain("1x PIZZA GRANDE");
    expect(t).toContain("Calabresa / Frango c/ Catupiry");
    expect(t).toContain("Borda: Catupiry");
    expect(t).toContain("2x REFRIGERANTE 2L");
  });

  it("NÃO imprime valores — a cozinha não precisa de preço e o número atrapalha a leitura", () => {
    const t = texto(renderComandaCozinha(pedidoBase));
    expect(t).not.toContain("R$");
    expect(t).not.toContain("85");
  });

  it("põe a observação do item em destaque (maior fonte de retrabalho na cozinha)", () => {
    const destaques = porEstilo(renderComandaCozinha(pedidoBase), "destaque");
    expect(destaques.some((l) => l.includes("OBS: SEM CEBOLA"))).toBe(true);
  });

  it("distingue retirada de tele-entrega", () => {
    const t = texto(renderComandaCozinha({ ...pedidoBase, deliveryType: "RETIRADA" }));
    expect(t).toContain("RETIRADA NO BALCAO");
    expect(t).not.toContain("TELE-ENTREGA");
  });

  it("aceita sabores gravados como objetos, não só como strings", () => {
    const t = texto(
      renderComandaCozinha({
        ...pedidoBase,
        items: [{ itemName: "Pizza", quantity: 1, flavors: [{ nome: "Marguerita" }] }],
      })
    );
    expect(t).toContain("Marguerita");
  });

  it("respeita a largura de 32 colunas (impressora 58mm)", () => {
    const payload = renderComandaCozinha(pedidoBase, { largura: 32 });
    payload.linhas
      .filter((l) => l.estilo === "separador")
      .forEach((l) => expect(l.texto).toHaveLength(32));
  });
});

describe("cupom do cliente", () => {
  it("traz DOCUMENTO NAO FISCAL — emissão fiscal está fora de escopo do projeto", () => {
    expect(texto(renderCupomCliente(pedidoBase))).toContain("DOCUMENTO NAO FISCAL");
  });

  it("traz endereço completo, que é o que o motoboy usa para achar a casa", () => {
    expect(texto(renderCupomCliente(pedidoBase))).toContain("Rua das Flores, 123");
  });

  it("endereço longo quebra em várias linhas sem repetir o rótulo", () => {
    const t = texto(
      renderCupomCliente({ ...pedidoBase, address: "Rua das Flores, 123 - Bairro Centro, apto 302 bloco B" })
    );
    expect(t.match(/Endereco:/g)).toHaveLength(1);
    expect(t).toContain("bloco B");
  });

  it("traz total, taxa de entrega e forma de pagamento", () => {
    const t = texto(renderCupomCliente(pedidoBase));
    expect(t).toContain("R$ 85,00");
    expect(t).toContain("R$ 10,00");
    expect(t).toContain("Dinheiro");
  });

  it("imprime o troco quando o pagamento é em dinheiro e o valor pago foi informado", () => {
    const t = texto(renderCupomCliente(pedidoBase, { valorPago: 100 }));
    expect(t).toContain("TROCO");
    expect(t).toContain("R$ 15,00");
  });

  it("não imprime troco em PIX, mesmo se valorPago vier preenchido por engano", () => {
    const t = texto(renderCupomCliente({ ...pedidoBase, paymentMethod: "PIX" }, { valorPago: 100 }));
    expect(t).not.toContain("TROCO");
  });

  it("cupom de comanda de salão também é não-fiscal e mostra a mesa", () => {
    const t = texto(
      renderCupomComanda({
        id: 7,
        numeroMesa: 4,
        abertaEm: new Date("2026-07-28T20:00:00"),
        fechadaEm: new Date("2026-07-28T21:00:00"),
        paymentMethod: "PIX",
        totalPrice: 120,
        itens: [{ descricao: "Rodizio", quantidade: 2, unitPrice: 60, sabroesSnapshot: null }],
      })
    );
    expect(t).toContain("DOCUMENTO NAO FISCAL");
    expect(t).toContain("MESA 4");
    expect(t).toContain("R$ 120,00");
  });
});

describe("romaneio do motoboy", () => {
  // Critério de aceite do spec-7: os números do romaneio batem EXATAMENTE com TurnoMotoboy.
  // Turno com 10 entregas x 14 + 5 de extra + 20 de aluguel = 165 de valorDaNoite.
  const turno = {
    id: 33,
    motoboyId: 8,
    abertoEm: new Date("2026-07-28T18:00:00"),
    fechadoEm: new Date("2026-07-29T00:30:00"),
    fundoTroco: 50,
    totalEntregas: 10,
    valorPorEntrega: 14,
    valorAluguelMoto: 20,
    totalExtras: 5,
    valorDaNoite: 165,
    totalRecebidoDinheiro: 300,
    totalRecebidoCartao: 80,
    totalRecebidoPix: 40,
    acerto: 85,
    sangria: 85,
  };

  const opts = {
    motoboyNome: "Joao",
    pedidos: [{ id: 1, paymentMethod: "DINHEIRO", totalPrice: 50 }],
    extras: [{ tipo: "GORJETA", valor: 5, motivo: "cliente deu gorjeta" }],
  };

  it("reproduz os valores do turno sem recalcular nada", () => {
    const t = texto(renderRomaneioMotoboy(turno, opts));
    expect(t).toContain("R$ 165,00"); // valorDaNoite
    expect(t).toContain("R$ 300,00"); // totalRecebidoDinheiro
    expect(t).toContain("R$ 85,00"); // acerto / sangria
    expect(t).toContain("10 entregas x R$ 14,00");
  });

  it("acerto positivo diz que o motoboy repassa ao caixa", () => {
    const t = texto(renderRomaneioMotoboy(turno, opts));
    expect(t).toContain("MOTOBOY REPASSA AO CAIXA");
    expect(t).not.toContain("PIZZARIA PAGA AO MOTOBOY");
  });

  it("acerto negativo diz que a pizzaria paga ao motoboy", () => {
    const t = texto(renderRomaneioMotoboy({ ...turno, acerto: -40, sangria: 0 }, opts));
    expect(t).toContain("PIZZARIA PAGA AO MOTOBOY");
    expect(t).toContain("R$ -40,00");
  });

  it("acerto zerado não acusa dívida de nenhum dos lados", () => {
    const t = texto(renderRomaneioMotoboy({ ...turno, acerto: 0, sangria: 0 }, opts));
    expect(t).toContain("NADA A ACERTAR");
  });

  it("sai em duas vias com linha de assinatura (comprovante físico do acerto)", () => {
    const t = texto(renderRomaneioMotoboy(turno, opts));
    expect(t).toContain("1a VIA");
    expect(t).toContain("2a VIA");
    expect(t.match(/Assinatura do motoboy/g)).toHaveLength(2);
    expect(t.match(/Assinatura do responsavel/g)).toHaveLength(2);
  });

  it("lista os extras com o motivo — é o que justifica o valor no acerto", () => {
    const t = texto(renderRomaneioMotoboy(turno, opts));
    expect(t).toContain("Gorjeta");
    expect(t).toContain("cliente deu gorjeta");
  });

  it("turno sem extras não imprime a seção de extras", () => {
    const t = texto(renderRomaneioMotoboy({ ...turno, totalExtras: 0 }, { ...opts, extras: [] }));
    expect(t).not.toContain("EXTRAS");
  });
});
