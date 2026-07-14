# Projeto: SaaS Pizzarias

Sistema web full-stack para pizzarias (mercado-alvo: redes regionais de 3-4 unidades, RS).

## Stack
- Back-end: Supabase (auth, DB, storage)
- Front-end: React
- Estética: minnimalist, clean

## Regras de negócio
- Cliente final compra SEM login: carrinho salvo em localStorage
- Checkout salva dados de entrega na tabela `pedidos` (Supabase) e dispara mensagem estruturada pro WhatsApp da pizzaria
- Rota `/admin` já tem login com hash + validação de senha
- Falta: tela pro Admin Master cadastrar novos funcionários (gerentes/atendentes) sem deslogar o Admin atual

## Convenções
- gerenciador de pacotes — npm
- comando de rodar dev — npm run dev


## O que NÃO fazer
- Não adicionar login obrigatório no fluxo de compra do cliente final
- Não mexer em arquivos gerados/migrations do Supabase sem confirmar antes
