-- Converte Order.paymentMethod e Comanda.paymentMethod de texto livre para o enum
-- FormaPagamento. Os validadores Joi já restringiam os valores, então a conversão deve
-- ser direta; a normalização abaixo é defensiva (seed, correção manual em SQL, import).

CREATE TYPE "FormaPagamento" AS ENUM ('DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO');

-- Normalização defensiva: caixa alta e sem espaços nas pontas.
UPDATE "orders" SET "paymentMethod" = UPPER(TRIM("paymentMethod"));
UPDATE "comandas" SET "paymentMethod" = UPPER(TRIM("paymentMethod")) WHERE "paymentMethod" IS NOT NULL;

-- Falha ruidosamente se sobrar qualquer valor não mapeável. Converter silenciosamente para
-- um default esconderia dinheiro classificado errado — melhor a migration parar aqui.
DO $$
DECLARE invalidos TEXT;
BEGIN
  SELECT string_agg(DISTINCT v, ', ') INTO invalidos FROM (
    SELECT "paymentMethod" AS v FROM "orders"
    UNION
    SELECT "paymentMethod" AS v FROM "comandas" WHERE "paymentMethod" IS NOT NULL
  ) t
  WHERE v NOT IN ('DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO');

  IF invalidos IS NOT NULL THEN
    RAISE EXCEPTION 'Formas de pagamento não mapeáveis para o enum FormaPagamento: %', invalidos;
  END IF;
END $$;

ALTER TABLE "orders"
  ALTER COLUMN "paymentMethod" TYPE "FormaPagamento" USING "paymentMethod"::"FormaPagamento";

ALTER TABLE "comandas"
  ALTER COLUMN "paymentMethod" TYPE "FormaPagamento" USING "paymentMethod"::"FormaPagamento";
