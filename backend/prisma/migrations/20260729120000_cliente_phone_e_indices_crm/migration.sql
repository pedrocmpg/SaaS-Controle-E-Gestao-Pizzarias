-- Spec-8: tela de clientes (CRM).

-- Telefone criptografado no Cliente. phoneHash é HMAC irreversível: serve para
-- ACHAR o cliente, nunca para exibir o número. Sem esta coluna, a tela de CRM não
-- teria como mostrar o telefone de quem já é cliente.
-- Nullable: os clientes criados antes desta migration ficam sem telefone até o
-- próximo pedido (o upsert em POST /api/orders preenche). O backfill abaixo cobre
-- os que já têm histórico.
ALTER TABLE "clientes" ADD COLUMN "phone" TEXT;

-- Últimos 4 dígitos EM CLARO, para busca por final ("o cliente do 1234").
-- phone/Order.phone usam AES com IV aleatório: a mesma entrada gera cifras
-- diferentes, então LIKE sobre o cifrado é impossível. 4 dígitos isolados não
-- identificam ninguém e o número completo permanece criptografado.
-- Preenchido pelo script de backfill (exige descriptografar, o que SQL não faz).
ALTER TABLE "clientes" ADD COLUMN "phoneLast4" TEXT;

-- Backfill: recupera o telefone do pedido mais recente de cada cliente.
-- Order.phone usa AES-256-CBC com IV aleatório por registro, então o valor copiado
-- continua válido e não expõe nada novo — é o mesmo dado, com a mesma chave, no
-- lugar onde a tela consegue lê-lo.
UPDATE "clientes" c
SET "phone" = o."phone"
FROM (
    SELECT DISTINCT ON ("clienteId") "clienteId", "phone"
    FROM "orders"
    WHERE "clienteId" IS NOT NULL
    ORDER BY "clienteId", "createdAt" DESC
) o
WHERE c."id" = o."clienteId";

-- Ordenação da lista de clientes por nome dentro da loja. O índice existente é só
-- em (lojaId), e a tela ordena/filtra por nome com frequência.
CREATE INDEX "clientes_lojaId_name_idx" ON "clientes"("lojaId", "name");

-- Busca por final do telefone dentro da loja.
CREATE INDEX "clientes_lojaId_phoneLast4_idx" ON "clientes"("lojaId", "phoneLast4");

-- Agregados por cliente (total gasto, nº de pedidos, último pedido) varrem os
-- pedidos da loja agrupando por clienteId. O índice existente (clienteId) não cobre
-- o recorte por loja, que é o caminho de toda query do CRM.
CREATE INDEX "orders_lojaId_clienteId_idx" ON "orders"("lojaId", "clienteId");
