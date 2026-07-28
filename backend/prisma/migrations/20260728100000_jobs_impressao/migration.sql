-- Spec-7: fila de impressão térmica consumida pelo agente local.

CREATE TYPE "TipoImpressao" AS ENUM ('COMANDA_COZINHA', 'CUPOM_CLIENTE', 'ROMANEIO_MOTOBOY');
CREATE TYPE "StatusImpressao" AS ENUM ('PENDENTE', 'IMPRESSO', 'ERRO');

CREATE TABLE "jobs_impressao" (
    "id" SERIAL NOT NULL,
    "lojaId" INTEGER NOT NULL,
    "tipo" "TipoImpressao" NOT NULL,
    "status" "StatusImpressao" NOT NULL DEFAULT 'PENDENTE',
    "payload" JSONB NOT NULL,
    "origemId" INTEGER,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,
    "impressoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_impressao_pkey" PRIMARY KEY ("id")
);

-- O agente busca sempre "PENDENTE desta loja"; é o único padrão de leitura quente.
CREATE INDEX "jobs_impressao_lojaId_status_idx" ON "jobs_impressao"("lojaId", "status");

ALTER TABLE "jobs_impressao" ADD CONSTRAINT "jobs_impressao_lojaId_fkey"
    FOREIGN KEY ("lojaId") REFERENCES "lojas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
