/**
 * Teste de impressão isolado: `npm run testar-impressora`.
 *
 * Existe para separar, na hora da instalação, "a impressora está errada" de "o token está
 * errado" — sem isso, um agente que não imprime tem duas causas possíveis e o suporte por
 * telefone vira adivinhação.
 */

const config = require("./config");
const { imprimirTeste } = require("./impressora");

(async () => {
  console.log(`\nTestando a impressora ${config.IMPRESSORA_TIPO} em ${config.IMPRESSORA_INTERFACE}...\n`);
  try {
    await imprimirTeste();
    console.log("\n[OK] Deu certo! Confira o papel que saiu na impressora.\n");
  } catch (err) {
    console.error(`\n[ERRO] Nao foi possivel imprimir: ${err.message}\n`);
    console.error("Verifique:");
    console.error("  1. a impressora esta ligada e com papel;");
    console.error("  2. o cabo USB / o cabo de rede esta conectado;");
    console.error("  3. a linha IMPRESSORA_INTERFACE do arquivo .env esta correta.");
    console.error("     (veja o README.md para descobrir o nome ou o IP da impressora)\n");
    process.exit(1);
  }
})();
