-- Módulo PDV/Salão com grade configurável (spec-5). Substitui a tela fixa de
-- rodízio (Mesa/RodizioPreco) por grupos/botões parametrizáveis por loja.
-- Sem dado de produção a preservar (spec confirma reset manual antes do
-- lançamento) — migration destrutiva sobre Mesa/RodizioPreco é aceitável.

-- CreateEnum
CREATE TYPE "ModoAdicionalSabor" AS ENUM ('CHEIO');

-- CreateEnum
CREATE TYPE "TipoBotaoPDV" AS ENUM ('PIZZA', 'PRODUTO');

-- DropForeignKey
ALTER TABLE "comanda_items" DROP CONSTRAINT "comanda_items_productId_fkey";

-- DropForeignKey
ALTER TABLE "comandas" DROP CONSTRAINT "comandas_mesaId_fkey";

-- DropForeignKey
ALTER TABLE "mesas" DROP CONSTRAINT "mesas_lojaId_fkey";

-- DropForeignKey
ALTER TABLE "rodizio_precos" DROP CONSTRAINT "rodizio_precos_lojaId_fkey";

-- DropIndex
DROP INDEX "comandas_mesaId_idx";

-- AlterTable
ALTER TABLE "comanda_items" DROP COLUMN "createdAt",
DROP COLUMN "faixaRodizio",
DROP COLUMN "productId",
DROP COLUMN "quantity",
ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "quantidade" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "sabroesSnapshot" JSONB,
DROP COLUMN "tipo",
ADD COLUMN     "tipo" "TipoBotaoPDV" NOT NULL;

-- AlterTable
ALTER TABLE "comandas" DROP COLUMN "mesaId",
ADD COLUMN     "numeroMesa" INTEGER;

-- AlterTable
ALTER TABLE "flavors" ADD COLUMN     "codigo" TEXT;

-- AlterTable
ALTER TABLE "pizza_sizes" ADD COLUMN     "codigo" TEXT,
ADD COLUMN     "precoDelivery" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "codigo" TEXT,
ADD COLUMN     "precoDelivery" DECIMAL(10,2);

-- DropTable
DROP TABLE "mesas";

-- DropTable
DROP TABLE "rodizio_precos";

-- DropEnum
DROP TYPE "ComandaItemTipo";

-- DropEnum
DROP TYPE "FaixaRodizio";

-- DropEnum
DROP TYPE "StatusMesa";

-- CreateTable
CREATE TABLE "loja_configs" (
    "id" SERIAL NOT NULL,
    "lojaId" INTEGER NOT NULL,
    "modoAdicionalSabor" "ModoAdicionalSabor" NOT NULL DEFAULT 'CHEIO',
    "usaBorda" BOOLEAN NOT NULL DEFAULT false,
    "usaMesa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loja_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupos_pdv" (
    "id" SERIAL NOT NULL,
    "lojaId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT,
    "corFonte" TEXT,
    "posicao" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grupos_pdv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "botoes_pdv" (
    "id" SERIAL NOT NULL,
    "lojaId" INTEGER NOT NULL,
    "grupoId" INTEGER NOT NULL,
    "posicao" INTEGER NOT NULL,
    "labelBotao" TEXT NOT NULL,
    "cor" TEXT,
    "tipo" "TipoBotaoPDV" NOT NULL,
    "pizzaSizeId" INTEGER,
    "productId" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "botoes_pdv_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loja_configs_lojaId_key" ON "loja_configs"("lojaId");

-- CreateIndex
CREATE INDEX "grupos_pdv_lojaId_idx" ON "grupos_pdv"("lojaId");

-- CreateIndex
CREATE INDEX "grupos_pdv_lojaId_ativo_idx" ON "grupos_pdv"("lojaId", "ativo");

-- CreateIndex
CREATE INDEX "botoes_pdv_lojaId_idx" ON "botoes_pdv"("lojaId");

-- CreateIndex
CREATE INDEX "botoes_pdv_grupoId_idx" ON "botoes_pdv"("grupoId");

-- CreateIndex
CREATE INDEX "botoes_pdv_grupoId_ativo_idx" ON "botoes_pdv"("grupoId", "ativo");

-- CreateIndex
CREATE INDEX "comandas_lojaId_status_idx" ON "comandas"("lojaId", "status");

-- AddForeignKey
ALTER TABLE "loja_configs" ADD CONSTRAINT "loja_configs_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "lojas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupos_pdv" ADD CONSTRAINT "grupos_pdv_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "lojas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "botoes_pdv" ADD CONSTRAINT "botoes_pdv_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "lojas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "botoes_pdv" ADD CONSTRAINT "botoes_pdv_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "grupos_pdv"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "botoes_pdv" ADD CONSTRAINT "botoes_pdv_pizzaSizeId_fkey" FOREIGN KEY ("pizzaSizeId") REFERENCES "pizza_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "botoes_pdv" ADD CONSTRAINT "botoes_pdv_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
