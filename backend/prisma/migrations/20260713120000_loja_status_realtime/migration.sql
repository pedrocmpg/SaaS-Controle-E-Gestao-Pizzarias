-- Migration: fundação multi-loja, FK lojaId em orders e novo ciclo de OrderStatus
--
-- ATENÇÃO: esta migration altera dados de produção. Revisar antes de aplicar.
-- Aplicar com: npx prisma migrate deploy   (ou  npx prisma migrate dev)

-- =====================================================================
-- 1) store_settings -> lojas  (Loja passa a ser a dona da configuração)
-- =====================================================================
ALTER TABLE "store_settings" RENAME TO "lojas";

-- Nome da loja (backfill com valor padrão; default removido logo abaixo)
ALTER TABLE "lojas" ADD COLUMN "nome" TEXT NOT NULL DEFAULT 'E Tenho Ditto Pizzaria';
ALTER TABLE "lojas" ALTER COLUMN "nome" DROP DEFAULT;

-- createdAt (não existia em store_settings)
ALTER TABLE "lojas" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- id: era @default(1) fixo; passa a ser autoincrement (sequence)
CREATE SEQUENCE IF NOT EXISTS "lojas_id_seq" OWNED BY "lojas"."id";
SELECT setval('lojas_id_seq', COALESCE((SELECT MAX("id") FROM "lojas"), 1));
ALTER TABLE "lojas" ALTER COLUMN "id" SET DEFAULT nextval('lojas_id_seq');

-- =====================================================================
-- 2) OrderStatus: remove PENDENTE/CONFIRMADO, adiciona RECEBIDO
--    Backfill: PENDENTE -> RECEBIDO, CONFIRMADO -> EM_PREPARO
-- =====================================================================
ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "OrderStatus_new" AS ENUM ('RECEBIDO', 'EM_PREPARO', 'SAIU_PARA_ENTREGA', 'ENTREGUE', 'CANCELADO');

ALTER TABLE "orders"
  ALTER COLUMN "status" TYPE "OrderStatus_new"
  USING (
    CASE "status"::text
      WHEN 'PENDENTE' THEN 'RECEBIDO'
      WHEN 'CONFIRMADO' THEN 'EM_PREPARO'
      ELSE "status"::text
    END
  )::"OrderStatus_new";

DROP TYPE "OrderStatus";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";

ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'RECEBIDO';

-- =====================================================================
-- 3) orders.lojaId (FK) — backfill para a loja existente e torna obrigatório
-- =====================================================================
ALTER TABLE "orders" ADD COLUMN "lojaId" INTEGER;

-- Vincula todos os pedidos existentes à primeira loja (única em produção)
UPDATE "orders" SET "lojaId" = (SELECT "id" FROM "lojas" ORDER BY "id" ASC LIMIT 1);

ALTER TABLE "orders" ALTER COLUMN "lojaId" SET NOT NULL;

CREATE INDEX "orders_lojaId_status_idx" ON "orders"("lojaId", "status");

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_lojaId_fkey"
  FOREIGN KEY ("lojaId") REFERENCES "lojas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
