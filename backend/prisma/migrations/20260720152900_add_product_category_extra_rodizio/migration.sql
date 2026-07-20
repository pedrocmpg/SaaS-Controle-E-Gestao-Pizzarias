-- Adiciona categorias EXTRA e RODIZIO ao enum ProductCategory. Precisa rodar
-- em migration própria (commitada isoladamente) porque o Postgres não permite
-- usar um valor de enum recém-adicionado na mesma transação que o adicionou.
ALTER TYPE "ProductCategory" ADD VALUE 'EXTRA';
ALTER TYPE "ProductCategory" ADD VALUE 'RODIZIO';
