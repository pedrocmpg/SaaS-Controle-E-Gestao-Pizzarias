-- Módulo Motoboy (spec-3): despacho + fechamento/sangria. Greenfield: tabelas novas +
-- extensão aditiva de "orders", sem backfill (pedidos existentes ficam com os novos campos
-- em seus defaults/null).

-- CreateEnum
CREATE TYPE "StatusTurnoMotoboy" AS ENUM ('ABERTO', 'FECHADO_AGUARDANDO_CONFERENCIA', 'CONFERIDO');
CREATE TYPE "TipoExtraMotoboy" AS ENUM ('ENTREGA_LONGA', 'GORJETA', 'AJUDA_CUSTO', 'OUTRO');

-- AlterTable orders: vínculo com motoboy/turno e forma de cobrança da entrega
ALTER TABLE "orders" ADD COLUMN "cobradoNaEntrega" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "orders" ADD COLUMN "motoboyId" INTEGER;
ALTER TABLE "orders" ADD COLUMN "turnoMotoboyId" INTEGER;
ALTER TABLE "orders" ADD COLUMN "entregueEm" TIMESTAMP(3);
CREATE INDEX "orders_motoboyId_status_idx" ON "orders"("motoboyId", "status");
CREATE INDEX "orders_turnoMotoboyId_idx" ON "orders"("turnoMotoboyId");

-- AlterTable lojas: valores configuráveis do módulo Motoboy
ALTER TABLE "lojas" ADD COLUMN "valorPorEntregaMotoboy" DECIMAL(10,2) NOT NULL DEFAULT 14;
ALTER TABLE "lojas" ADD COLUMN "valorAluguelMotoNoite" DECIMAL(10,2) NOT NULL DEFAULT 20;

-- CreateTable turnos_motoboy
CREATE TABLE "turnos_motoboy" (
    "id" SERIAL NOT NULL,
    "lojaId" INTEGER NOT NULL,
    "motoboyId" INTEGER NOT NULL,
    "status" "StatusTurnoMotoboy" NOT NULL DEFAULT 'ABERTO',
    "fundoTroco" DECIMAL(10,2) NOT NULL,
    "abertoPorId" INTEGER NOT NULL,
    "abertoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadoPorId" INTEGER,
    "fechadoEm" TIMESTAMP(3),
    "totalEntregas" INTEGER,
    "valorPorEntrega" DECIMAL(10,2),
    "valorAluguelMoto" DECIMAL(10,2),
    "totalExtras" DECIMAL(10,2),
    "valorDaNoite" DECIMAL(10,2),
    "totalRecebidoDinheiro" DECIMAL(10,2),
    "totalRecebidoCartao" DECIMAL(10,2),
    "totalRecebidoPix" DECIMAL(10,2),
    "acerto" DECIMAL(10,2),
    "sangria" DECIMAL(10,2),
    "conferidoPorId" INTEGER,
    "conferidoEm" TIMESTAMP(3),
    CONSTRAINT "turnos_motoboy_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "turnos_motoboy_lojaId_idx" ON "turnos_motoboy"("lojaId");
CREATE INDEX "turnos_motoboy_motoboyId_idx" ON "turnos_motoboy"("motoboyId");

-- Um turno ABERTO por vez por motoboy (não por loja — vários motoboys podem estar abertos ao
-- mesmo tempo na mesma loja). Índice único parcial: não expressável via @@unique do Prisma,
-- escrito à mão. Mesma defesa em profundidade do módulo Caixa (checagem em app + esta
-- constraint como rede de segurança contra corrida de "abrir turno" simultâneo).
CREATE UNIQUE INDEX "turno_motoboy_um_aberto_por_motoboy"
ON "turnos_motoboy" ("motoboyId")
WHERE "status" = 'ABERTO';

-- CreateTable extras_motoboy
CREATE TABLE "extras_motoboy" (
    "id" SERIAL NOT NULL,
    "turnoMotoboyId" INTEGER NOT NULL,
    "tipo" "TipoExtraMotoboy" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "adminId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "extras_motoboy_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "extras_motoboy_turnoMotoboyId_idx" ON "extras_motoboy"("turnoMotoboyId");

-- Foreign keys (onDelete alinhado aos defaults do Prisma: SET NULL p/ opcional, RESTRICT p/ obrigatório).
ALTER TABLE "orders"         ADD CONSTRAINT "orders_motoboyId_fkey"                FOREIGN KEY ("motoboyId")       REFERENCES "admins"("id")         ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders"         ADD CONSTRAINT "orders_turnoMotoboyId_fkey"           FOREIGN KEY ("turnoMotoboyId")  REFERENCES "turnos_motoboy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "turnos_motoboy" ADD CONSTRAINT "turnos_motoboy_lojaId_fkey"          FOREIGN KEY ("lojaId")          REFERENCES "lojas"("id")          ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "turnos_motoboy" ADD CONSTRAINT "turnos_motoboy_motoboyId_fkey"       FOREIGN KEY ("motoboyId")       REFERENCES "admins"("id")         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "turnos_motoboy" ADD CONSTRAINT "turnos_motoboy_abertoPorId_fkey"     FOREIGN KEY ("abertoPorId")     REFERENCES "admins"("id")         ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "turnos_motoboy" ADD CONSTRAINT "turnos_motoboy_fechadoPorId_fkey"    FOREIGN KEY ("fechadoPorId")    REFERENCES "admins"("id")         ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "turnos_motoboy" ADD CONSTRAINT "turnos_motoboy_conferidoPorId_fkey"  FOREIGN KEY ("conferidoPorId")  REFERENCES "admins"("id")         ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "extras_motoboy" ADD CONSTRAINT "extras_motoboy_turnoMotoboyId_fkey"  FOREIGN KEY ("turnoMotoboyId")  REFERENCES "turnos_motoboy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "extras_motoboy" ADD CONSTRAINT "extras_motoboy_adminId_fkey"         FOREIGN KEY ("adminId")         REFERENCES "admins"("id")         ON DELETE RESTRICT ON UPDATE CASCADE;
