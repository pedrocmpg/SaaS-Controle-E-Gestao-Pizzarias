-- Multi-tenant real: lojaId no cardápio + Admin, model Cliente e novos campos de Order.
-- Backfill vincula os dados existentes à loja única de produção antes de tornar lojaId obrigatório.

-- CreateEnum
CREATE TYPE "OrigemPedido" AS ENUM ('TELEFONE', 'IFOOD', 'ANOTA_AI', 'WHATSAPP', 'BALCAO');

-- AlterTable: adiciona lojaId como NULLABLE primeiro (para permitir backfill)
ALTER TABLE "admins" ADD COLUMN "lojaId" INTEGER;
ALTER TABLE "pizza_sizes" ADD COLUMN "lojaId" INTEGER;
ALTER TABLE "flavors" ADD COLUMN "lojaId" INTEGER;
ALTER TABLE "borders" ADD COLUMN "lojaId" INTEGER;
ALTER TABLE "products" ADD COLUMN "lojaId" INTEGER;

-- Backfill: vincula cardápio existente (e admins não-SUPER_ADMIN) à loja única.
DO $$
DECLARE
  default_loja INTEGER;
BEGIN
  SELECT id INTO default_loja FROM "lojas" ORDER BY id ASC LIMIT 1;
  IF default_loja IS NULL THEN
    RAISE EXCEPTION 'Nenhuma loja encontrada para backfill de lojaId. Rode o seed da loja antes desta migração.';
  END IF;
  UPDATE "pizza_sizes" SET "lojaId" = default_loja WHERE "lojaId" IS NULL;
  UPDATE "flavors"     SET "lojaId" = default_loja WHERE "lojaId" IS NULL;
  UPDATE "borders"     SET "lojaId" = default_loja WHERE "lojaId" IS NULL;
  UPDATE "products"    SET "lojaId" = default_loja WHERE "lojaId" IS NULL;
  -- SUPER_ADMIN permanece global (lojaId NULL); demais operadores ficam na loja única.
  UPDATE "admins"      SET "lojaId" = default_loja WHERE "lojaId" IS NULL AND "role" <> 'SUPER_ADMIN';
END $$;

-- Torna lojaId obrigatório no cardápio (admins.lojaId segue nullable).
ALTER TABLE "pizza_sizes" ALTER COLUMN "lojaId" SET NOT NULL;
ALTER TABLE "flavors"     ALTER COLUMN "lojaId" SET NOT NULL;
ALTER TABLE "borders"     ALTER COLUMN "lojaId" SET NOT NULL;
ALTER TABLE "products"    ALTER COLUMN "lojaId" SET NOT NULL;

-- Substitui unique global de slug por unique por loja.
DROP INDEX "pizza_sizes_slug_key";
CREATE UNIQUE INDEX "pizza_sizes_lojaId_slug_key" ON "pizza_sizes"("lojaId", "slug");

-- Índices de lojaId.
CREATE INDEX "pizza_sizes_lojaId_idx" ON "pizza_sizes"("lojaId");
CREATE INDEX "flavors_lojaId_idx" ON "flavors"("lojaId");
CREATE INDEX "borders_lojaId_idx" ON "borders"("lojaId");
CREATE INDEX "products_lojaId_idx" ON "products"("lojaId");
CREATE INDEX "admins_lojaId_idx" ON "admins"("lojaId");

-- AlterTable orders: origem, atendenteId, clienteId.
ALTER TABLE "orders" ADD COLUMN "origem" "OrigemPedido" NOT NULL DEFAULT 'TELEFONE';
ALTER TABLE "orders" ADD COLUMN "atendenteId" INTEGER;
ALTER TABLE "orders" ADD COLUMN "clienteId" INTEGER;
CREATE INDEX "orders_atendenteId_idx" ON "orders"("atendenteId");
CREATE INDEX "orders_clienteId_idx" ON "orders"("clienteId");

-- CreateTable clientes.
CREATE TABLE "clientes" (
    "id" SERIAL NOT NULL,
    "lojaId" INTEGER NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "clientes_lojaId_idx" ON "clientes"("lojaId");
CREATE UNIQUE INDEX "clientes_lojaId_phoneHash_key" ON "clientes"("lojaId", "phoneHash");

-- Foreign keys (onDelete alinhado aos defaults do Prisma: SET NULL p/ opcional, RESTRICT p/ obrigatório).
ALTER TABLE "admins"      ADD CONSTRAINT "admins_lojaId_fkey"      FOREIGN KEY ("lojaId")      REFERENCES "lojas"("id")   ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "pizza_sizes" ADD CONSTRAINT "pizza_sizes_lojaId_fkey" FOREIGN KEY ("lojaId")      REFERENCES "lojas"("id")   ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "flavors"     ADD CONSTRAINT "flavors_lojaId_fkey"     FOREIGN KEY ("lojaId")      REFERENCES "lojas"("id")   ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "borders"     ADD CONSTRAINT "borders_lojaId_fkey"     FOREIGN KEY ("lojaId")      REFERENCES "lojas"("id")   ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "products"    ADD CONSTRAINT "products_lojaId_fkey"    FOREIGN KEY ("lojaId")      REFERENCES "lojas"("id")   ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "clientes"    ADD CONSTRAINT "clientes_lojaId_fkey"    FOREIGN KEY ("lojaId")      REFERENCES "lojas"("id")   ON DELETE RESTRICT  ON UPDATE CASCADE;
ALTER TABLE "orders"      ADD CONSTRAINT "orders_atendenteId_fkey" FOREIGN KEY ("atendenteId") REFERENCES "admins"("id")  ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "orders"      ADD CONSTRAINT "orders_clienteId_fkey"   FOREIGN KEY ("clienteId")   REFERENCES "clientes"("id") ON DELETE SET NULL  ON UPDATE CASCADE;
