-- Módulo PDV Salão/Rodízio + Caixa (spec-2). Greenfield: tabelas novas, sem backfill.

-- CreateEnum
CREATE TYPE "StatusMesa" AS ENUM ('LIVRE', 'OCUPADA');
CREATE TYPE "StatusComanda" AS ENUM ('ABERTA', 'FECHADA', 'CANCELADA');
CREATE TYPE "FaixaRodizio" AS ENUM ('ADULTO', 'CRIANCA', 'MEIA');
CREATE TYPE "ComandaItemTipo" AS ENUM ('RODIZIO', 'PRODUTO');
CREATE TYPE "TipoCaixa" AS ENUM ('SALAO', 'TELE_ENTREGA');
CREATE TYPE "StatusCaixa" AS ENUM ('ABERTO', 'FECHADO_AGUARDANDO_CONFERENCIA', 'CONFERIDO');
CREATE TYPE "TipoMovimentoCaixa" AS ENUM ('SANGRIA', 'SUPRIMENTO');

-- CreateTable mesas
CREATE TABLE "mesas" (
    "id" SERIAL NOT NULL,
    "lojaId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "status" "StatusMesa" NOT NULL DEFAULT 'LIVRE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mesas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mesas_lojaId_idx" ON "mesas"("lojaId");
CREATE UNIQUE INDEX "mesas_lojaId_numero_key" ON "mesas"("lojaId", "numero");

-- CreateTable rodizio_precos
CREATE TABLE "rodizio_precos" (
    "id" SERIAL NOT NULL,
    "lojaId" INTEGER NOT NULL,
    "faixa" "FaixaRodizio" NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rodizio_precos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "rodizio_precos_lojaId_idx" ON "rodizio_precos"("lojaId");
CREATE UNIQUE INDEX "rodizio_precos_lojaId_faixa_key" ON "rodizio_precos"("lojaId", "faixa");

-- CreateTable caixa_sessoes
CREATE TABLE "caixa_sessoes" (
    "id" SERIAL NOT NULL,
    "lojaId" INTEGER NOT NULL,
    "tipo" "TipoCaixa" NOT NULL,
    "status" "StatusCaixa" NOT NULL DEFAULT 'ABERTO',
    "fundoTroco" DECIMAL(10,2) NOT NULL,
    "abertoPorId" INTEGER NOT NULL,
    "abertoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadoPorId" INTEGER,
    "fechadoEm" TIMESTAMP(3),
    "totalVendasDinheiro" DECIMAL(10,2),
    "totalVendasCartao" DECIMAL(10,2),
    "totalVendasPix" DECIMAL(10,2),
    "totalSangrias" DECIMAL(10,2),
    "totalSuprimentos" DECIMAL(10,2),
    "saldoFinalCalculado" DECIMAL(10,2),
    "conferidoPorId" INTEGER,
    "conferidoEm" TIMESTAMP(3),
    "saldoFinalContado" DECIMAL(10,2),
    CONSTRAINT "caixa_sessoes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "caixa_sessoes_lojaId_idx" ON "caixa_sessoes"("lojaId");

-- Uma sessão ABERTO por vez por (lojaId, tipo). Índice único parcial: não expressável via
-- @@unique do Prisma (sem suporte a índice condicional), escrito à mão. Garante integridade
-- no banco mesmo se dois "abrir caixa" simultâneos passarem pela checagem em app ao mesmo
-- tempo (2-5 atendentes concorrentes). A aplicação também checa antes, para devolver um 409
-- amigável; esta constraint é a rede de segurança contra a corrida.
CREATE UNIQUE INDEX "caixa_sessao_uma_aberta_por_loja_tipo"
ON "caixa_sessoes" ("lojaId", "tipo")
WHERE "status" = 'ABERTO';

-- CreateTable comandas
CREATE TABLE "comandas" (
    "id" SERIAL NOT NULL,
    "lojaId" INTEGER NOT NULL,
    "mesaId" INTEGER NOT NULL,
    "status" "StatusComanda" NOT NULL DEFAULT 'ABERTA',
    "abertaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadaEm" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "totalPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "atendenteAberturaId" INTEGER,
    "atendenteFechamentoId" INTEGER,
    "caixaSessaoId" INTEGER,
    CONSTRAINT "comandas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "comandas_lojaId_idx" ON "comandas"("lojaId");
CREATE INDEX "comandas_mesaId_idx" ON "comandas"("mesaId");
CREATE INDEX "comandas_caixaSessaoId_idx" ON "comandas"("caixaSessaoId");

-- CreateTable comanda_items
CREATE TABLE "comanda_items" (
    "id" SERIAL NOT NULL,
    "comandaId" INTEGER NOT NULL,
    "tipo" "ComandaItemTipo" NOT NULL,
    "faixaRodizio" "FaixaRodizio",
    "productId" INTEGER,
    "descricao" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comanda_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "comanda_items_comandaId_idx" ON "comanda_items"("comandaId");

-- CreateTable movimentos_caixa
CREATE TABLE "movimentos_caixa" (
    "id" SERIAL NOT NULL,
    "caixaSessaoId" INTEGER NOT NULL,
    "tipo" "TipoMovimentoCaixa" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "adminId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "movimentos_caixa_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "movimentos_caixa_caixaSessaoId_idx" ON "movimentos_caixa"("caixaSessaoId");

-- Foreign keys (onDelete alinhado aos defaults do Prisma: SET NULL p/ opcional, RESTRICT p/ obrigatório).
ALTER TABLE "mesas"            ADD CONSTRAINT "mesas_lojaId_fkey"                     FOREIGN KEY ("lojaId")                REFERENCES "lojas"("id")         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rodizio_precos"   ADD CONSTRAINT "rodizio_precos_lojaId_fkey"            FOREIGN KEY ("lojaId")                REFERENCES "lojas"("id")         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "caixa_sessoes"    ADD CONSTRAINT "caixa_sessoes_lojaId_fkey"             FOREIGN KEY ("lojaId")                REFERENCES "lojas"("id")         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "caixa_sessoes"    ADD CONSTRAINT "caixa_sessoes_abertoPorId_fkey"        FOREIGN KEY ("abertoPorId")           REFERENCES "admins"("id")        ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "caixa_sessoes"    ADD CONSTRAINT "caixa_sessoes_fechadoPorId_fkey"       FOREIGN KEY ("fechadoPorId")          REFERENCES "admins"("id")        ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "caixa_sessoes"    ADD CONSTRAINT "caixa_sessoes_conferidoPorId_fkey"     FOREIGN KEY ("conferidoPorId")        REFERENCES "admins"("id")        ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "comandas"         ADD CONSTRAINT "comandas_lojaId_fkey"                  FOREIGN KEY ("lojaId")                REFERENCES "lojas"("id")         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comandas"         ADD CONSTRAINT "comandas_mesaId_fkey"                  FOREIGN KEY ("mesaId")                REFERENCES "mesas"("id")         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comandas"         ADD CONSTRAINT "comandas_atendenteAberturaId_fkey"     FOREIGN KEY ("atendenteAberturaId")   REFERENCES "admins"("id")        ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "comandas"         ADD CONSTRAINT "comandas_atendenteFechamentoId_fkey"   FOREIGN KEY ("atendenteFechamentoId") REFERENCES "admins"("id")        ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "comandas"         ADD CONSTRAINT "comandas_caixaSessaoId_fkey"           FOREIGN KEY ("caixaSessaoId")         REFERENCES "caixa_sessoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "comanda_items"    ADD CONSTRAINT "comanda_items_comandaId_fkey"          FOREIGN KEY ("comandaId")             REFERENCES "comandas"("id")      ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "comanda_items"    ADD CONSTRAINT "comanda_items_productId_fkey"          FOREIGN KEY ("productId")             REFERENCES "products"("id")      ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "movimentos_caixa" ADD CONSTRAINT "movimentos_caixa_caixaSessaoId_fkey"   FOREIGN KEY ("caixaSessaoId")         REFERENCES "caixa_sessoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimentos_caixa" ADD CONSTRAINT "movimentos_caixa_adminId_fkey"         FOREIGN KEY ("adminId")               REFERENCES "admins"("id")        ON DELETE RESTRICT ON UPDATE CASCADE;
