-- CreateEnum
CREATE TYPE "FlavorType" AS ENUM ('SALGADA', 'DOCE');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('COMBO', 'BEBIDA', 'ESPECIAL');

-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('ENTREGA', 'RETIRADA');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDENTE', 'CONFIRMADO', 'EM_PREPARO', 'SAIU_PARA_ENTREGA', 'ENTREGUE', 'CANCELADO');

-- CreateTable
CREATE TABLE "pizza_sizes" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "slices" INTEGER NOT NULL,
    "maxFlavors" INTEGER NOT NULL,
    "servesPeople" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "imageUrl" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pizza_sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flavors" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "FlavorType" NOT NULL,
    "extraPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flavors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borders" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "type" "FlavorType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "borders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "servesPeople" INTEGER,
    "imageUrl" TEXT,
    "category" "ProductCategory" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "deliveryType" "DeliveryType" NOT NULL DEFAULT 'ENTREGA',
    "paymentMethod" TEXT NOT NULL,
    "notes" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDENTE',
    "deliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "flavors" JSONB,
    "borderName" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "observations" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "whatsapp" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "ifoodUrl" TEXT,
    "instagramUrl" TEXT,
    "facebookUrl" TEXT,
    "openingHours" JSONB NOT NULL,
    "minDeliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 10,
    "maxDeliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 20,
    "minDeliveryTime" INTEGER NOT NULL DEFAULT 40,
    "maxDeliveryTime" INTEGER NOT NULL DEFAULT 70,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pizza_sizes_slug_key" ON "pizza_sizes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
