require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { pizzaSizes, borders, flavors, products } = require("./seedData");

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando seed do banco de dados...");

  // Configurações da loja (criada ANTES do cardápio, pois o cardápio agora exige lojaId)
  const openingHours = {
    seg: { open: "18:00", close: "23:00" },
    ter: { open: "18:00", close: "23:00" },
    qua: { open: "18:00", close: "23:00" },
    qui: { open: "18:00", close: "23:00" },
    sex: { open: "18:00", close: "23:59" },
    sab: { open: "18:00", close: "23:59" },
    dom: { open: "18:00", close: "23:00" },
  };

  const loja = await prisma.loja.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      nome: process.env.LOJA_NOME || "E Tenho Ditto Pizzaria",
      whatsapp: "5554999999999", // número fictício - atualizar depois
      phone: "(54) 99999-9999", // número fictício - atualizar depois
      address: "R Pernambuco, 392 - Sala 01",
      city: "Bento Gonçalves",
      state: "RS",
      zipCode: "95705-052",
      ifoodUrl:
        "https://www.ifood.com.br/delivery/bento-goncalves-rs/e-tenho-ditto-pizzaria---bento-goncalves-e-garibaldi-humaita/9e21dfe2-99f6-4abc-9b51-3e4433336bfb",
      instagramUrl: null,
      facebookUrl: null,
      openingHours,
      minDeliveryFee: 10,
      maxDeliveryFee: 20,
      minDeliveryTime: 40,
      maxDeliveryTime: 70,
      isOpen: true,
    },
  });
  console.log("Configurações da loja criadas/atualizadas.");

  // Catálogo da loja (agora isolado por lojaId). Limpa e recria vinculado à loja.
  await prisma.pizzaSize.deleteMany();
  await prisma.border.deleteMany();
  await prisma.flavor.deleteMany();
  await prisma.product.deleteMany();

  const withLoja = (arr) => arr.map((item) => ({ ...item, lojaId: loja.id }));
  await prisma.pizzaSize.createMany({ data: withLoja(pizzaSizes) });
  await prisma.border.createMany({ data: withLoja(borders) });
  await prisma.flavor.createMany({ data: withLoja(flavors) });
  await prisma.product.createMany({ data: withLoja(products) });

  console.log(`Tamanhos de pizza: ${pizzaSizes.length}`);
  console.log(`Bordas: ${borders.length}`);
  console.log(`Sabores: ${flavors.length}`);
  console.log(`Produtos (combos/bebidas): ${products.length}`);

  // Admin inicial (SUPER_ADMIN global — sem loja vinculada)
  const adminEmail = process.env.ADMIN_EMAIL || "admin@etenhoditto.com.br";
  const adminPassword = process.env.ADMIN_PASSWORD || "troque-esta-senha";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.admin.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: process.env.ADMIN_NAME || "Administrador",
      email: adminEmail,
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });
  console.log(`Admin criado/atualizado: ${adminEmail}`);

  // Módulo PDV Salão: preço do rodízio por faixa e mesas numeradas (1 a 10).
  // Upsert (não deleteMany+createMany) para não quebrar comandas já existentes referenciando mesas.
  const RODIZIO_PRECOS = [
    { faixa: "ADULTO", preco: 69.9 },
    { faixa: "CRIANCA", preco: 34.9 },
    { faixa: "MEIA", preco: 49.9 },
  ];
  for (const { faixa, preco } of RODIZIO_PRECOS) {
    await prisma.rodizioPreco.upsert({
      where: { lojaId_faixa: { lojaId: loja.id, faixa } },
      update: {},
      create: { lojaId: loja.id, faixa, preco },
    });
  }
  console.log(`Preços de rodízio: ${RODIZIO_PRECOS.length}`);

  for (let numero = 1; numero <= 10; numero++) {
    await prisma.mesa.upsert({
      where: { lojaId_numero: { lojaId: loja.id, numero } },
      update: {},
      create: { lojaId: loja.id, numero },
    });
  }
  console.log("Mesas 1-10 criadas/atualizadas.");

  console.log("Seed finalizado com sucesso!");
}

main()
  .catch((e) => {
    console.error("Erro ao executar seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
