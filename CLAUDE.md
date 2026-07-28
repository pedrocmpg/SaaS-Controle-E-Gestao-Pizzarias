# Hub de Gestão para Pizzarias

Guia de contexto para o Claude Code trabalhar neste projeto. Leia isto antes de mexer em
qualquer módulo.

> **Última verificação contra o código: 2026-07-28.** Este arquivo já esteve
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
`resolveLojaId` (`backend/src/lib/lojaScope.js`), consumido pelo middleware **compartilhado**
`backend/src/middleware/attachLojaId.js` — importe esse, nunca redefina um local. Toda rota
que toca dado de loja monta esse middleware e usa `req.lojaId`. Nunca assumir dado global.

O `fallbackToFirst` que caía silenciosamente na loja de menor id **foi removido**
(spec-6, 2026-07-28): hoje, loja não resolvida = 400 + log de segurança, nunca um palpite.
Os testes em `lib/__tests__/lojaScope.test.js` existem para travar essa regra — se algum
deles começar a falhar, é sinal de que o fallback voltou.

## Stack real

- **Frontend:** React 18 + Vite (SPA), React Router, Tailwind CSS, socket.io-client, axios
- **Backend:** Express.js + Prisma 5, socket.io, Joi (validação), Winston (log), Redis
  (blacklist de token / cache)
- **Banco:** PostgreSQL puro via `DATABASE_URL`. **NÃO usa Supabase Auth nem Supabase
  Storage** (se alguma doc antiga disser isso, está errada — não confundir com o projeto
  FluxCash, que usa Supabase de verdade).
- **Agente local:** `agente-local/` — projeto Node **separado** (package.json próprio, não
  é workspace do backend). Roda no PC do caixa da pizzaria e imprime na térmica via
  ESC/POS. Distribuído ao cliente, não deployado.
- **Pacotes:** npm (`npm run dev` em `backend/` e `frontend/`)
- **Testes:** Vitest no backend (`npm test` em `backend/`), CI no GitHub Actions.

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

Os 4 módulos estão **implementados** (schema + rotas + telas). O gargalo hoje **não é
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

### 3. Impressão térmica — ✅ implementado, ⚠️ **nunca imprimiu em papel real**
- Fila `JobImpressao` no banco + rotas em `impressao.routes.js`. Layout renderizado no
  **backend** (`lib/impressaoLayout.js`, função pura com testes) — o agente não conhece
  regra de negócio, só traduz estilo → ESC/POS.
- **Disparo é automático**, não botão: criar pedido → comanda de cozinha;
  `SAIU_PARA_ENTREGA` → cupom do cliente; fechar turno → romaneio. Os botões de reimprimir
  existem só como recuperação.
- Agente local em `agente-local/` (projeto Node separado, distribuído à pizzaria). Conecta
  como cliente no WebSocket — não abre porta, não exige mexer em firewall/NAT.
- Cupons levam **"DOCUMENTO NAO FISCAL"** obrigatoriamente (emissão fiscal é fora de escopo).
- **Falta validar com impressora física.** Nada nunca saiu em papel de verdade.

### 4. Motoboy — ✅ implementado, ⚠️ **não validado**
- `TurnoMotoboy` + `ExtraMotoboy`, rotas em `motoboy.routes.js`, telas
  `OperacaoDespacho.jsx` e `OperacaoMotoboyTurno.jsx`. Migration aplicada em produção em
  2026-07-16.
- `Order.turnoMotoboyId` é FK direta (não janela de tempo) — um motoboy pode ter mais de um
  turno no mesmo dia, e sem a FK um pedido entregue com atraso cairia no turno errado.
- Índice único parcial `turno_motoboy_um_aberto_por_motoboy` cobre a corrida de abrir turno.
- Cálculo do fechamento vive em `lib/financeiro.js` (função pura, testada) e roda dentro de
  `$transaction` Serializable. Fechar o turno imprime o romaneio automaticamente.
- **As fórmulas de fechamento são suposições ainda não confirmadas formalmente pelo
  cliente-piloto**, e o módulo **nunca foi testado ponta a ponta**. É a maior pendência
  aberta do projeto — e não é de código. Os testes provam que o código calcula o que foi
  especificado; **não** provam que a especificação é o que a pizzaria faz.

## Backlog priorizado

Ver [`specs/README.md`](specs/README.md) para o índice completo e o caminho crítico.

1. ~~**spec-6** — fundação multi-tenant e integridade financeira.~~ ✅ feito em 2026-07-28.
2. ~~**spec-7** — impressão térmica via agente local.~~ ✅ feito em 2026-07-28.
3. **[spec-8](specs/spec-8-clientes-e-kds.md)** — tela de clientes (CRM) e KDS de cozinha.
4. **[spec-9](specs/spec-9-onboarding-assinatura-e-controle-interno.md)** — onboarding de
   loja, assinatura, e correção do controle interno do motoboy.
5. **[spec-10](specs/spec-10-estoque-e-ficha-tecnica.md)** — estoque/CMV. Só após validar
   com o piloto.

## Riscos técnicos conhecidos (não corrigidos ainda)

- **Motoboy pode fechar o próprio turno** e lançar os próprios extras (`MOTOBOY` está em
  `TURNO_MOTOBOY_ROLES`). Furo de controle interno. Endereçado no spec-9.
- **Não existe assinatura/onboarding** — adicionar uma loja hoje é `INSERT` manual.
  Endereçado no spec-9.
- **A impressão nunca rodou em impressora física.** O caminho backend → fila → agente está
  testado, mas ESC/POS em papel real só se valida instalando no PC do piloto.
- Cobertura de teste é dos **cálculos e layouts** (`lib/`, 48 testes). Rotas Express e
  frontend seguem sem teste automatizado.

Resolvidos no spec-6 (2026-07-28): fallback silencioso de `lojaId`, ausência de testes/CI,
não-transacionalidade dos fechamentos, e a duplicação de `attachLojaId` (que estava em 6
arquivos, não 5).

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
