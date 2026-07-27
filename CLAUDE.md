# Hub de Gestão para Pizzarias

Guia de contexto para o Claude Code trabalhar neste projeto. Leia isto antes de mexer em
qualquer módulo.

> **Última verificação contra o código: 2026-07-27.** Este arquivo já esteve
> significativamente desatualizado no passado (descrevia como "pendente" coisa que já
> estava pronta, causando retrabalho). Se você encontrar divergência entre este arquivo e
> o código, **o código vence** — e atualize este arquivo na mesma sessão.

## O que é o projeto

Hub interno de gestão (staff-facing, tipo "TEKNISA simplificado") para pizzarias. **NÃO é**
um site/carrinho público pra cliente final — esse fluxo foi arquivado (comentado em
`frontend/src/App.jsx`, não deletado) porque o projeto pivotou depois de conversa com o
cliente-piloto.

- **Modelo de negócio:** mensalidade de R$500–1000/mês por pizzaria (não é pagamento único).
- **Cliente-piloto:** rede de 3-4 unidades no Rio Grande do Sul, já contatada.
- **Time:** dev solo. Preferir soluções simples e incrementais a arquiteturas grandes prematuras.

## ⚠️ Arquitetura: multi-tenant real, não é rede matriz+filiais

Ponto mais importante do projeto, não pode ser esquecido em nenhuma decisão de schema:

- Os tenants são **pizzarias INDEPENDENTES**, concorrentes entre si na mesma região — não
  uma única rede com matriz e filiais.
- Isolamento de dados entre pizzarias é **obrigatório e não-negociável**. Dados de uma
  pizzaria nunca podem se cruzar com os de outra, mesmo que seja o mesmo cliente final
  pedindo nas duas (telefone e endereço não podem vazar entre tenants).
- Hoje existe **1 loja em produção** (o piloto), mas o schema já nasceu multi-tenant.

**Como aplicar:** toda query nova leva `lojaId`. O ponto único de resolução de tenant é
`resolveLojaId` (`backend/src/lib/lojaScope.js`), consumido pelo middleware `attachLojaId`
que cada arquivo de rotas define. Nunca assumir dado global.

**Risco ativo conhecido:** `resolveLojaId` tem um `fallbackToFirst` que, quando não
consegue resolver a loja, cai silenciosamente na loja de **menor id**. Inofensivo com uma
loja só; vira vazamento entre tenants com duas. Corrigido pelo
[spec-6](specs/spec-6-fundacao-multitenant-e-integridade-financeira.md) — **não vender
para a segunda pizzaria antes disso**.

## Stack real

- **Frontend:** React 18 + Vite (SPA), React Router, Tailwind CSS, socket.io-client, axios
- **Backend:** Express.js + Prisma 5, socket.io, Joi (validação), Winston (log), Redis
  (blacklist de token / cache)
- **Banco:** PostgreSQL puro via `DATABASE_URL`. **NÃO usa Supabase Auth nem Supabase
  Storage** (se alguma doc antiga disser isso, está errada — não confundir com o projeto
  FluxCash, que usa Supabase de verdade).
- **Pacotes:** npm (`npm run dev` em `backend/` e `frontend/`)

## Autenticação e autorização

- Auth própria: JWT em cookie HttpOnly (+ Bearer opcional), bcrypt, 2FA via TOTP com
  backup codes. O payload do JWT carrega `id`, `role` e `lojaId`.
- Roles: `SUPER_ADMIN`, `ADMIN`, `GERENTE`, `ATENDENTE`, `MOTOBOY` (+ `VIEWER` legado).
- `GERENTE` e `ATENDENTE` **já têm acesso liberado** nas rotas operacionais
  (`/admin/dashboard`, `/operacao/*`). Só `/admin/operadores` é restrita a `SUPER_ADMIN`.
  Isso **não** é um bloqueio pendente.
- O mapa `ROLES.permissions` em `middleware/authorization.js` existe mas é usado só por
  `requirePermission`. As rotas usam `requireAnyRole`, que olha **só a role** — não confie
  em `permissions: []` como se fosse bloqueio.
- Audit log (`AuditLog`) + security log (`securityLogger`) registrando ações sensíveis.
- Middlewares de segurança já montados: helmet, CORS com whitelist, CSRF, rate limiting,
  sanitização, content-length.

## Estado real dos módulos

Os 3 módulos estão **implementados** (schema + rotas + telas). O gargalo hoje **não é
construção de base** — é profundidade funcional e validação.

### 1. Pedidos / Tele-entrega — ✅ implementado
- `POST /api/orders` **está ativa** (fluxo do atendente autenticado, não o checkout
  público antigo). Rotas em `backend/src/routes/orders.routes.js`.
- `Order` + `OrderItem` + enum `OrderStatus` (`RECEBIDO → EM_PREPARO → SAIU_PARA_ENTREGA
  → ENTREGUE → CANCELADO`), com validação de transição.
- `Cliente` por loja com `phoneHash` (HMAC determinístico, pesquisável) — histórico e
  auto-preenchimento de endereço já funcionam. Telefone e endereço criptografados.
- Campo `origem` (`TELEFONE`/`IFOOD`/`ANOTA_AI`/`WHATSAPP`/`BALCAO`) já reservado.
- Relatório gerencial: `GET /api/orders/reports/summary` (por período, agrega tele-entrega
  + salão) + tela `OperacaoRelatorio.jsx` com gráfico.
- WebSocket funcionando: `emitPedidoNovo`, `emitPedidoStatus` em
  `backend/src/lib/socket.js`, com rooms por loja (`loja:{lojaId}`).

### 2. PDV — Salão/Rodízio — ✅ implementado
- Grade configurável por loja (`GrupoPDV`, `BotaoPDV`, `LojaConfig`) — o sistema **nasce
  vazio**, sem seed. Cadastro em `CadastroGradePDV.jsx`.
- `Comanda`/`ComandaItem`, montador de pizza, `ComandaModal.jsx` reescrito como PDV de
  tela cheia (grade visível, stepper de quantidade, cálculo de troco).
- Caixa: `CaixaSessao` + `MovimentoCaixa` (sangria/suprimento), com fluxo
  abrir → movimentos → fechar → conferir.
- Caixa do salão e da tele-entrega são **fundos separados** (`TipoCaixa`).

### 3. Motoboy — ✅ implementado, ⚠️ **não validado**
- `TurnoMotoboy` + `ExtraMotoboy`, rotas em `motoboy.routes.js`, telas
  `OperacaoDespacho.jsx` e `OperacaoMotoboyTurno.jsx`. Migration aplicada em produção em
  2026-07-16.
- `Order.turnoMotoboyId` é FK direta (não janela de tempo) — um motoboy pode ter mais de um
  turno no mesmo dia, e sem a FK um pedido entregue com atraso cairia no turno errado.
- Índice único parcial `turno_motoboy_um_aberto_por_motoboy` cobre a corrida de abrir turno.
- **As fórmulas de fechamento são suposições ainda não confirmadas formalmente pelo
  cliente-piloto**, e o módulo **nunca foi testado ponta a ponta**. É a maior pendência
  aberta do projeto — e não é de código.

## Backlog priorizado

Ver [`specs/README.md`](specs/README.md) para o índice completo e o caminho crítico.

1. **[spec-6](specs/spec-6-fundacao-multitenant-e-integridade-financeira.md)** — fundação:
   matar o fallback de `lojaId`, transacionalidade nos fechamentos, testes das fórmulas
   financeiras, enum de forma de pagamento. **Bloqueia tudo.**
2. **[spec-7](specs/spec-7-impressao-termica.md)** — impressão térmica via agente local.
   Bloqueador comercial.
3. **[spec-8](specs/spec-8-clientes-e-kds.md)** — tela de clientes (CRM) e KDS de cozinha.
4. **[spec-9](specs/spec-9-onboarding-assinatura-e-controle-interno.md)** — onboarding de
   loja, assinatura, e correção do controle interno do motoboy.
5. **[spec-10](specs/spec-10-estoque-e-ficha-tecnica.md)** — estoque/CMV. Só após validar
   com o piloto.

## Riscos técnicos conhecidos (não corrigidos ainda)

- **Zero testes automatizados e zero CI** em ~8.600 linhas que calculam dinheiro real
  entre pizzaria, motoboys e clientes. Maior risco técnico do projeto. Endereçado no spec-6.
- **Fechamentos financeiros não são transacionais** (`caixa`, `motoboy`, `comanda`) — duplo
  clique pode recalcular. Endereçado no spec-6.
- **Motoboy pode fechar o próprio turno** e lançar os próprios extras (`MOTOBOY` está em
  `TURNO_MOTOBOY_ROLES`). Furo de controle interno. Endereçado no spec-9.
- **Não existe impressão** de nada. Endereçado no spec-7.
- **Não existe assinatura/onboarding** — adicionar uma loja hoje é `INSERT` manual.
  Endereçado no spec-9.
- `attachLojaId` está **duplicado** em 5 arquivos de rotas. Unificado no spec-6.

## Fora de escopo (não construir sem pedir)

- Emissão fiscal (NFC-e/NF-e) — se precisar, usar API tipo Focus NFe/PlugNotas, não
  construir do zero.
- Integração real com Microsip (CTI), iFood, Anota Aí, WhatsApp Business API — tudo fase 2.
  iFood exige homologação formal (CNPJ com CNAE de tecnologia + reunião de validação);
  Anota Aí foi comprada pelo iFood em 2022 e não tem API pública amigável. O hook
  `cmdIncomingCall` do Microsip é o caminho viável quando a fase 2 chegar (ver spec-1).
- Gateway de pagamento para a mensalidade — cobrança é manual nesta fase.
- Qualquer coisa do fluxo de cliente final (vitrine pública, carrinho self-service) — está
  arquivada, comentada, não deletada. Não reativar sem pedido explícito.

## Convenções gerais

- Sempre considerar isolamento por `lojaId` em qualquer query nova.
- **Cadastro e parametrização é lei geral do projeto:** nada de apresentação (grupos,
  botões, cores, rótulos, mesa/borda, máx. de sabores) é fixo em código — tudo é dado
  configurável por loja, e o sistema nasce vazio.
- Reaproveitar infraestrutura existente (models, WebSocket, roles, middlewares) antes de
  criar do zero — o repo tem mais pronto do que a documentação antiga sugere.
- Cálculo financeiro deve morar em função pura testável (`backend/src/lib/`), não embutido
  no handler Express.
- Registrar alterações relevantes no segundo cérebro
  (`C:\Users\User\Documents\Projetos\segundo-cerebro\Projetos\Hub-Pizzarias`).
