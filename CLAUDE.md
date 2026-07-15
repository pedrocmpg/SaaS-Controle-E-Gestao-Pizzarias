# Hub de Gestão para Pizzarias

Guia de contexto para o Claude Code trabalhar neste projeto. Leia isto antes de mexer em
qualquer módulo.

## O que é o projeto

Hub interno de gestão (staff-facing, tipo "TEKNISA simplificado") para pizzarias. **NÃO é**
mais um site/carrinho público pra cliente final — esse fluxo foi arquivado (comentado, não
deletado) porque o projeto pivotou depois de conversa com o cliente-piloto.

**Modelo de negócio:** mensalidade de R$500–1000/mês por pizzaria (não é mais pagamento único).

**Cliente-piloto:** rede de 3-4 unidades no Rio Grande do Sul, já contatada.

## ⚠️ Arquitetura: multi-tenant real, não é rede matriz+filiais

Isso é o ponto mais importante do projeto e não pode ser esquecido em nenhuma decisão de
schema:

- Os tenants são **pizzarias INDEPENDENTES**, concorrentes entre si na mesma região — não uma
  única rede com matriz e filiais.
- Isolamento de dados entre pizzarias diferentes é **obrigatório e não-negociável**. Dados de
  uma pizzaria nunca podem se cruzar com os de outra, mesmo que seja o mesmo cliente final
  pedindo nas duas.
- Desenvolvimento atual é focado em 1 pizzaria (o piloto), mas o schema e a arquitetura têm
  que já nascer prontos pra receber outras pizzarias da região no futuro, sem refatoração
  grande.
- **Pendência técnica ativa:** o cardápio (`PizzaSize`, `Flavor`, `Border`, `Product`) hoje é
  GLOBAL no banco, sem `lojaId`. Isso precisa ser corrigido — cada pizzaria concorrente não
  pode compartilhar cardápio. Tratar como pré-requisito antes de expandir pra outro tenant.

## Stack real (não confiar cegamente em versões antigas deste arquivo)

- **Frontend:** React + Vite (SPA), React Router, Tailwind CSS
- **Backend:** Express.js + Prisma
- **Banco:** PostgreSQL. **NÃO usa Supabase Auth nem Supabase Storage** — só Postgres puro via
  `DATABASE_URL`. Se alguma versão anterior deste arquivo dizia Supabase Auth, estava errada.
- **Pacotes:** npm (`npm run dev`)

## Autenticação e autorização

- Auth própria (JWT em cookie HttpOnly + Bearer opcional), bcrypt, 2FA via TOTP com backup codes
- Roles: `SUPER_ADMIN`, `ADMIN`, `GERENTE`, `ATENDENTE`
- **GERENTE e ATENDENTE já têm acesso liberado** nas rotas operacionais (`/admin/dashboard`,
  `/operacao/*`, incluindo `/operacao/pedidos`). Só `/admin/operadores` (cadastro de
  operadores) é restrita a `SUPER_ADMIN`. Backend confirma via `ORDER_ROLES`. Isso NÃO é mais
  um bloqueio pendente.
- Audit log (`AuditLog`) registrando ações de admins

## Os 3 módulos do hub

### 1. Pedidos / Tele-entrega — pronto pra atacar
Central de pedidos por telefone, operada pelo ATENDENTE. Ver
`modulo-pedidos-tele-entrega-spec.md` para o spec completo. Resumo:
- Fase 1 = **só telefone via Microsip**. iFood e Anota Aí ficam de fora até fase 2 (eles já
  imprimem sozinhos na térmica hoje, não precisam de redigitação manual).
- Model `Order` e enum `OrderStatus` (`RECEBIDO → EM_PREPARO → SAIU_PARA_ENTREGA → ENTREGUE
  → CANCELADO`) já existem — reaproveitar, não recriar.
- A rota `POST /api/orders` está comentada (era do checkout público) — precisa ser reescrita
  pro fluxo de atendente autenticado.
- WebSocket já existe (`backend/src/lib/socket.js`, `emitPedidoNovo`, `emitPedidoStatus`) —
  reaproveitar para tempo real.
- Integração Microsip via hook `cmdIncomingCall` no `microsip.ini` → script dispara POST no
  backend → backend busca cliente por telefone → empurra via WebSocket pra aba do atendente
  (zero-clique). Detalhes completos no spec do módulo.

### 2. PDV — Salão/Rodízio — tem perguntas de negócio em aberto
**Escopo delimitado** (a confirmar com cliente): PDV cobre SÓ vendas do salão/restaurante
(rodízio + bebidas tipo água/refri). **Tele-entrega é fluxo separado**, não passa pelo PDV — é
o módulo Motoboy que fecha ela. Ver `modulo-pdv-salao-spec.md`. Ainda faltam definir: rodízio
por pessoa ou fixo, catálogo de bebidas, se caixa do salão e da tele-entrega são fundos
separados, como calcular margem/lucro.

### 3. Motoboy — despacho + fechamento/sangria — BLOQUEADO
🚫 **Não implementar ainda.** É o diferencial do projeto, mas depende de 4 respostas do
cliente sobre a lógica de fechamento (ver `modulo-motoboy-spec.md`). Não existe código deste
módulo no repo hoje — o HTML de fechamento mencionado em conversas é uma peça isolada, não
commitada, e a funcionalidade completa é mais complexa que aquilo.

Lógica de fechamento já validada com o cliente (mas com 4 perguntas pendentes antes de virar
código): separar comandas por forma de pagamento (antecipado online/PIX vs cobrado na
entrega); isolar dinheiro em espécie (total cobrado na entrega menos relatório da maquininha);
ganho do motoboy = nº entregas × R$14 + extras + R$20 aluguel da moto; acerto = diferença
entre dinheiro que o motoboy segura e o total da noite; sangria = só a parte do pagamento do
motoboy que saiu em espécie do caixa (PIX nunca conta como sangria).

## Ordem de trabalho sugerida
1. Adicionar `lojaId` ao cardápio (`PizzaSize`/`Flavor`/`Border`/`Product`) — destrava
   multi-tenant real
2. Módulo Pedidos/tele-entrega completo
3. Módulo PDV/salão
4. Módulo Motoboy — só quando o cliente responder as 4 perguntas de fechamento

## Fora de escopo (não construir sem pedir)
- Emissão fiscal (NFC-e/NF-e) — se precisar no futuro, usar API tipo Focus NFe/PlugNotas, não
  construir do zero
- Integração real com Microsip (CTI), iFood, Anota Aí, WhatsApp Business API — tudo fase 2.
  iFood exige homologação formal (CNPJ com CNAE de tecnologia + reunião de validação); Anota
  Aí foi comprada pelo iFood em 2022 e não tem API pública amigável.
- Qualquer coisa do fluxo de cliente final (vitrine pública, carrinho self-service) — está
  arquivada, comentada no código, não deletada. Não reativar sem pedido explícito.

## Convenções gerais
- Sempre considerar isolamento por `lojaId`/tenant em qualquer query nova — nunca assumir
  dado global quando o dado é por pizzaria
- Reaproveitar infraestrutura existente (models, WebSocket, roles) antes de criar do zero —
  o repo tem mais pronto do que a documentação antiga sugere
- Projeto é mantido por um dev solo; preferir soluções simples e incrementais a
  arquiteturas grandes prematuras