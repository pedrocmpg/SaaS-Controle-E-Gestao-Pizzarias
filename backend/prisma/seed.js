require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { pizzaSizes, borders, flavors, products } = require("./seedData");

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando seed do banco de dados...");

  // Limpa tabelas de catálogo (mantém pedidos existentes)
  await prisma.pizzaSize.deleteMany();
  await prisma.border.deleteMany();
  await prisma.flavor.deleteMany();
  await prisma.product.deleteMany();

  await prisma.pizzaSize.createMany({ data: pizzaSizes });
  await prisma.border.createMany({ data: borders });
  await prisma.flavor.createMany({ data: flavors });
  await prisma.product.createMany({ data: products });

  console.log(`Tamanhos de pizza: ${pizzaSizes.length}`);
  console.log(`Bordas: ${borders.length}`);
  console.log(`Sabores: ${flavors.length}`);
  console.log(`Produtos (combos/bebidas): ${products.length}`);

  // Configurações da loja
  const openingHours = {
    seg: { open: "18:00", close: "23:00" },
    ter: { open: "18:00", close: "23:00" },
    qua: { open: "18:00", close: "23:00" },
    qui: { open: "18:00", close: "23:00" },
    sex: { open: "18:00", close: "23:59" },
    sab: { open: "18:00", close: "23:59" },
    dom: { open: "18:00", close: "23:00" },
  };

  await prisma.storeSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
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

  // Admin inicial
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
    },
  });
  console.log(`Admin criado/atualizado: ${adminEmail}`);

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
