// Isolamento entre tenants é regra não-negociável do projeto: estes testes existem para que
// um fallback silencioso nunca volte a ser reintroduzido em resolveLojaId.
const { resolveLojaId } = require("../lojaScope");

// Só a loja 1 existe. Injetado para o teste não depender de banco.
const lojaExiste = async (id) => (id === 1 ? { id: 1 } : null);
const resolver = (req) => resolveLojaId(req, { lojaExiste });

const operador = (lojaId) => ({ id: 2, role: "ATENDENTE", lojaId });
const superAdmin = { id: 1, role: "SUPER_ADMIN", lojaId: null };

describe("resolveLojaId", () => {
  it("operador vinculado usa a própria loja e IGNORA lojaId vindo do body", async () => {
    const lojaId = await resolver({ admin: operador(1), body: { lojaId: 999 }, query: {} });
    expect(lojaId).toBe(1);
  });

  it("operador vinculado IGNORA lojaId vindo da query", async () => {
    const lojaId = await resolver({ admin: operador(1), body: {}, query: { lojaId: "999" } });
    expect(lojaId).toBe(1);
  });

  it("SUPER_ADMIN resolve a loja informada quando ela existe", async () => {
    const lojaId = await resolver({ admin: superAdmin, body: { lojaId: 1 }, query: {} });
    expect(lojaId).toBe(1);
  });

  it("SUPER_ADMIN informando loja inexistente resolve null (handler responde 400, não 500)", async () => {
    const lojaId = await resolver({ admin: superAdmin, body: { lojaId: 999 }, query: {} });
    expect(lojaId).toBeNull();
  });

  it("SUPER_ADMIN sem informar loja resolve null — NÃO existe fallback para a primeira loja", async () => {
    const lojaId = await resolver({ admin: superAdmin, body: {}, query: {} });
    expect(lojaId).toBeNull();
  });

  it("requisição sem admin resolve null — NÃO existe fallback para a primeira loja", async () => {
    const lojaId = await resolver({ body: {}, query: {} });
    expect(lojaId).toBeNull();
  });

  it("lojaId não numérico resolve null em vez de virar NaN", async () => {
    const lojaId = await resolver({ admin: superAdmin, body: { lojaId: "abc" }, query: {} });
    expect(lojaId).toBeNull();
  });
});
