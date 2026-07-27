import { defineConfig } from "vitest/config";

// O backend é CommonJS: os testes usam `require` para carregar o código sob teste, e a API
// do Vitest (describe/it/expect) vem de `globals` — ela não pode ser importada via require.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.js"],
  },
});
