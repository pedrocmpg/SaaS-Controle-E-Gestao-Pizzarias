# Módulo: PDV — Salão/Rodízio + Caixa + Lucro — Spec para Claude Code

> Spec autocontido. Um dos 3 módulos do hub. Pode ser lido isolado.

## Contexto compartilhado do projeto
- **Stack real:** PostgreSQL via **Prisma + Express** + React/Vite. NÃO usa Supabase Auth nem
  Storage (o CLAUDE.md está desatualizado dizendo Supabase — ignorar).
- **Multi-tenant real:** cada pizzaria é um tenant INDEPENDENTE (concorrentes da região, não
  matriz+filiais). Isolamento de dados entre lojas é obrigatório. Começa por 1 pizzaria
  (piloto no RS); expandir é objetivo futuro.
- **Roles já existem:** SUPER_ADMIN, ADMIN, GERENTE, ATENDENTE. GERENTE/ATENDENTE já têm
  acesso às rotas operacionais (`/operacao/*`) — não é bloqueante.
- Emissão fiscal (NFC-e/NF-e) → fora de escopo. Integrações externas → fase 2.

## ⚠️ Escopo deste módulo (delimitação importante)
Entendimento do usuário (a CONFIRMAR com o cliente): o **PDV cobre SÓ as vendas do
salão/restaurante** — rodízio + bebidas consumidas no local (água, refri). As
**tele-entregas NÃO passam pelo PDV** — são um fluxo separado (módulo Pedidos) que fecha pelo
Motoboy. Então este módulo é a frente de caixa do SALÃO, não do delivery.

## Objetivo
Frente de caixa do salão: registrar consumo de mesa (rodízio + bebidas), fechar a conta da
mesa, e controlar o caixa do salão (abertura, sangria, suprimento, fechamento) por turno, com
visão de lucro/margem.

## Funcionalidades núcleo
1. **Venda de mesa/comanda do salão:** abrir mesa, lançar rodízio (por pessoa?) + bebidas,
   fechar conta, registrar forma de pagamento (uma por venda — mesma regra do módulo Pedidos).
2. **Caixa do salão (sessão por turno):** `abertura` (fundo de troco) → movimentos → sangria →
   suprimento → `fechamento`. Turno 19h–meia-noite = uma sessão. Fechar na hora, permitir
   conferência no dia seguinte ("fechada, aguardando conferência").
3. **Lucro/margem:** o módulo se chama "PDV+lucro+caixa" — precisa de custo por item pra
   calcular margem. Ver perguntas em aberto (custo de insumo do rodízio é difícil de ratear).

## Reaproveitamento de código
- Cardápio já existe (`PizzaSize`, `Flavor`, `Border`, `Product`) mas é GLOBAL, sem `lojaId`.
  ⚠️ Como cardápio é separado por loja (concorrentes), adicionar `lojaId` a esses models é
  pré-requisito. Vale conferir se rodízio/bebidas do salão usam esses mesmos models ou
  precisam de um catálogo próprio de "itens de salão".
- WebSocket já existe (`backend/src/lib/socket.js`) — reaproveitar se precisar de tela de
  cozinha/atualização em tempo real.

## Perguntas em aberto (confirmar com o cliente)
1. Rodízio é cobrado por pessoa (valor fixo por cabeça) ou tem variações (criança, meia)?
2. Bebidas do salão saem do mesmo cadastro de produtos ou é um catálogo à parte?
3. O caixa do salão e o da tele-entrega são fundos de troco SEPARADOS de verdade, ou juntam
   num caixa só no fim da noite? (Define 1 ou 2 sessões de caixa.)
4. "Lucro/margem" precisa de custo por item cadastrado? Como eles querem ver isso — margem por
   produto, lucro do turno, relatório? Rodízio dificulta rateio de custo — como pensam nisso?
5. Precisa de controle de mesas (mapa de mesas) ou é comanda avulsa/numerada?
6. Precisa integração com impressora (conta da mesa / comanda de cozinha do salão)?
7. Sangria/suprimento do salão: quem pode fazer (só gerente? atendente?) e precisa registrar
   motivo?
8. Precisa fechamento em Z/relatório de fechamento no fim do turno? Que números o dono quer ver?

## Fora de escopo
- Tele-entrega (módulo Pedidos) e fechamento de motoboy (módulo Motoboy)
- Emissão fiscal
- Integrações externas (fase 2)
