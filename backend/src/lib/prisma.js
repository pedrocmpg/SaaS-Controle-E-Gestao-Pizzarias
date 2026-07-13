const { PrismaClient } = require("@prisma/client");

// Evita múltiplas instâncias do Prisma Client em ambiente de dev com hot-reload
const prisma = global.__prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

module.exports = prisma;
