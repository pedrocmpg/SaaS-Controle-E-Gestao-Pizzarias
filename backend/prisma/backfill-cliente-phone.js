/**
 * Backfill do telefone dos clientes já existentes (spec-8).
 *
 * A migration 20260729120000 copia `Order.phone` (cifrado) para `Cliente.phone` em
 * SQL puro, mas `phoneLast4` precisa do número em claro — e descriptografar AES é
 * coisa de aplicação, não de SQL. Este script fecha essa parte.
 *
 * Idempotente: só toca em clientes com `phoneLast4` nulo. Pode rodar de novo sem
 * duplicar efeito.
 *
 * Uso (a partir de backend/):  node prisma/backfill-cliente-phone.js
 */
const prisma = require("../src/lib/prisma");
const { decrypt, normalizePhone } = require("../src/lib/encryption");

async function main() {
  const pendentes = await prisma.cliente.findMany({
    where: { phoneLast4: null },
    select: { id: true, phone: true, lojaId: true },
  });

  console.log(`Clientes sem phoneLast4: ${pendentes.length}`);

  let preenchidos = 0;
  let semTelefone = 0;
  let falhas = 0;

  for (const cliente of pendentes) {
    if (!cliente.phone) {
      // Cliente que nunca teve pedido com telefone recuperável. Fica sem número
      // até o próximo contato — o upsert de POST /api/orders preenche.
      semTelefone++;
      continue;
    }

    const emClaro = decrypt(cliente.phone);
    if (!emClaro) {
      // Cifra inválida ou gravada com outra chave. Não é fatal: o cliente segue
      // funcionando, só não aparece na busca por final até pedir de novo.
      console.warn(`  cliente ${cliente.id} (loja ${cliente.lojaId}): telefone não descriptografou`);
      falhas++;
      continue;
    }

    const digitos = normalizePhone(emClaro);
    if (digitos.length < 4) {
      falhas++;
      continue;
    }

    await prisma.cliente.update({
      where: { id: cliente.id },
      data: { phoneLast4: digitos.slice(-4) },
    });
    preenchidos++;
  }

  console.log(`Preenchidos: ${preenchidos}`);
  console.log(`Sem telefone no histórico: ${semTelefone}`);
  console.log(`Falhas: ${falhas}`);
}

main()
  .catch((err) => {
    console.error("Backfill falhou:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
