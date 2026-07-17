-- AlterTable
ALTER TABLE "admins" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ofertas" (
    "id" SERIAL NOT NULL,
    "lojaId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "precoPromocional" DECIMAL(10,2) NOT NULL,
    "validoDe" TIMESTAMP(3),
    "validoAte" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ofertas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ofertas_produtos" (
    "ofertaId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,

    CONSTRAINT "ofertas_produtos_pkey" PRIMARY KEY ("ofertaId","productId")
);

-- CreateIndex
CREATE INDEX "ofertas_lojaId_idx" ON "ofertas"("lojaId");

-- AddForeignKey
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "lojas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas_produtos" ADD CONSTRAINT "ofertas_produtos_ofertaId_fkey" FOREIGN KEY ("ofertaId") REFERENCES "ofertas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ofertas_produtos" ADD CONSTRAINT "ofertas_produtos_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
