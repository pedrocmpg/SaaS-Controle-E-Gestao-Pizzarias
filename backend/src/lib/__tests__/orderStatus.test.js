const { parseStatusFilter, isValidTransition, getNextStatus } = require("../orderStatus");

describe("parseStatusFilter", () => {
  it("um status válido vira filtro simples", () => {
    expect(parseStatusFilter("RECEBIDO")).toBe("RECEBIDO");
  });

  it("vários status separados por vírgula viram filtro `in` (colunas do KDS)", () => {
    expect(parseStatusFilter("RECEBIDO,EM_PREPARO,SAIU_PARA_ENTREGA")).toEqual({
      in: ["RECEBIDO", "EM_PREPARO", "SAIU_PARA_ENTREGA"],
    });
  });

  it("normaliza caixa e espaços em volta", () => {
    expect(parseStatusFilter(" recebido , em_preparo ")).toEqual({
      in: ["RECEBIDO", "EM_PREPARO"],
    });
  });

  it("descarta status desconhecido e mantém os válidos", () => {
    expect(parseStatusFilter("RECEBIDO,INVENTADO")).toBe("RECEBIDO");
  });

  it("remove duplicatas", () => {
    expect(parseStatusFilter("RECEBIDO,RECEBIDO,EM_PREPARO")).toEqual({
      in: ["RECEBIDO", "EM_PREPARO"],
    });
  });

  // O caso que importa: um filtro 100% inválido não pode virar
  // `where.status = undefined`, porque o Prisma ignora a chave e devolveria
  // TODOS os pedidos da loja — o oposto do que foi pedido. Retornando null, o
  // chamador sabe que não deve filtrar, e a decisão fica explícita.
  it("filtro totalmente inválido retorna null, não undefined", () => {
    expect(parseStatusFilter("INVENTADO")).toBeNull();
    expect(parseStatusFilter("INVENTADO,TAMBEM_NAO_EXISTE")).toBeNull();
  });

  it("ausência de filtro retorna null", () => {
    expect(parseStatusFilter(undefined)).toBeNull();
    expect(parseStatusFilter("")).toBeNull();
  });

  it("aceita CANCELADO, que não faz parte do fluxo de progresso", () => {
    expect(parseStatusFilter("CANCELADO")).toBe("CANCELADO");
  });
});

describe("isValidTransition", () => {
  it("avança apenas para o próximo status do fluxo", () => {
    expect(isValidTransition("RECEBIDO", "EM_PREPARO")).toBe(true);
    expect(isValidTransition("EM_PREPARO", "SAIU_PARA_ENTREGA")).toBe(true);
  });

  it("não pula etapas", () => {
    expect(isValidTransition("RECEBIDO", "SAIU_PARA_ENTREGA")).toBe(false);
    expect(isValidTransition("RECEBIDO", "ENTREGUE")).toBe(false);
  });

  it("não volta atrás", () => {
    expect(isValidTransition("EM_PREPARO", "RECEBIDO")).toBe(false);
  });

  it("cancela a partir de qualquer estado não-terminal", () => {
    expect(isValidTransition("RECEBIDO", "CANCELADO")).toBe(true);
    expect(isValidTransition("SAIU_PARA_ENTREGA", "CANCELADO")).toBe(true);
  });

  it("nada sai de um estado terminal", () => {
    expect(isValidTransition("ENTREGUE", "CANCELADO")).toBe(false);
    expect(isValidTransition("CANCELADO", "RECEBIDO")).toBe(false);
  });
});

describe("getNextStatus", () => {
  it("ENTREGUE é terminal e não tem próximo", () => {
    expect(getNextStatus("ENTREGUE")).toBeNull();
  });

  it("status desconhecido não tem próximo", () => {
    expect(getNextStatus("INVENTADO")).toBeNull();
  });
});
