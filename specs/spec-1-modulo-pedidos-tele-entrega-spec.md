# Módulo: Pedidos / Tele-entrega — Spec para Claude Code

> Versão consolidada. Já incorpora correções vindas da inspeção do código real e as
> decisões de escopo tomadas. As perguntas em aberto que sobraram estão no final.

## Contexto do projeto
Hub interno de gestão (staff-facing) para pizzarias. **Multi-tenant real**: cada pizzaria é
um tenant INDEPENDENTE (são concorrentes da região, NÃO matriz+filiais). Isolamento de dados
entre pizzarias é obrigatório — dados de uma nunca podem se cruzar com os de outra, mesmo o
mesmo cliente/telefone pedindo em duas.

Desenvolvimento começa por **1 pizzaria (cliente-piloto, rede de 3-4 unidades no RS)**;
expandir pra outras pizzarias é objetivo futuro. Vitrine pública pro cliente final foi
arquivada (não deletada).

Três módulos centrais:
1. **Motoboy** (despacho + fechamento/sangria) — NÃO está pronto e NÃO tem código no repo.
   Existe só um HTML de fechamento/sangria feito à parte (não commitado), que é uma peça
   inicial. A funcionalidade completa é mais complexa e está aguardando resposta do cliente.
2. **Pedidos/tele-entrega** — 🔨 este documento.
3. **PDV + lucro + caixa** — ainda não iniciado.

Integrações externas (Microsip, iFood, Anota Aí, WhatsApp) → **fase 2**.
Emissão fiscal (NFC-e/NF-e) → fora de escopo.

## ✅ Correções sobre estado real do código (não confiar no CLAUDE.md nesses pontos)
- **Stack:** PostgreSQL via **Prisma + Express**. NÃO usa Supabase Auth nem Storage. O
  CLAUDE.md está desatualizado dizendo Supabase — ignorar.
- **Acesso GERENTE/ATENDENTE já está resolvido.** As rotas `/admin/dashboard` e `/operacao/*`
  (inclui `/operacao/pedidos`) já têm `allowedRoles=["SUPER_ADMIN","ADMIN","GERENTE","ATENDENTE"]`.
  Só `/admin/operadores` é restrita a SUPER_ADMIN. Backend confirma (`ORDER_ROLES` inclui
  GERENTE/ATENDENTE). **NÃO é mais um pré-requisito bloqueante** — o "ponto crítico" do spec
  antigo estava errado.
- **Model `Order` já existe** e é praticamente o rascunho que queríamos (ver Reaproveitamento).
- **Enum `OrderStatus` já existe:** `RECEBIDO → EM_PREPARO → SAIU_PARA_ENTREGA → ENTREGUE → CANCELADO`.
  UI já funciona em `OperacaoPedidos.jsx`. Usar esses status, não inventar novos.
- **WebSocket já existe** (`emitPedidoNovo`, `emitPedidoStatus` em `backend/src/lib/socket.js`).
  Reaproveitar pra tempo real na cozinha, não criar do zero.
- **Motoboy não tem código** no repo (busca por motoboy/despacho/sangria/entregador = 0).
  Então o design de Pedidos vem PRIMEIRO e o Motoboy depois consome os status/campos daqui.
  A dependência inverteu (mais fácil).

## Escopo da 1ª versão (decidido)
**Só tele-entrega por telefone (Microsip).** iFood e Anota Aí ficam FORA nesta fase — eles já
imprimem sozinhos na térmica e serão unificados só na fase 2 (integração real). O atendente
NÃO vai redigitar pedido de iFood/Anota Aí à mão nesta versão.

Mesmo assim, criar o campo `origem_pedido` (telefone/ifood/anota_ai/whatsapp/balcao) já
agora, pra não dar retrabalho de schema quando a fase 2 chegar.

## Processo atual (as-is) — o que estamos substituindo
Tele-entrega por telefone hoje é manual e trabalhoso:
1. Ligação entra pelo Microsip (softphone/VoIP)
2. Atendente copia o número na mão
3. Verifica cadastro no sistema antigo
4. Abre a tele-entrega manualmente

## Visão desejada (orienta o design; integração real = fase 2)
- Microsip: quando a ligação entra, puxar o número automaticamente, checar cadastro e abrir a
  tele-entrega pré-preenchida — atendente só confirma num clique.
- (Fase 2) iFood, Anota Aí e WhatsApp aparecendo no mesmo painel, em vez de telas separadas.

## Decisões de comportamento (respostas do cliente)
- **Forma de pagamento:** só UMA por pedido (não dividido).
- **Cardápio:** SEPARADO por loja (são concorrentes). ⚠️ Ver ponto de schema abaixo.
- **Impressão de comanda pra cozinha:** SIM, precisa imprimir na térmica.
- **Editar/cancelar pedido:** só o ATENDENTE. Gerente não mexe (não tem como saber do pedido).
- **Histórico por cliente:** SIM. Guardar cliente por telefone — se já pediu antes, não
  precisa pedir o endereço de novo (auto-preenche). ⚠️ Isolado por loja (ver multi-tenant).
- **Taxa de entrega:** valor fixo digitado manual no pedido (não por bairro/distância).
- **Concorrência:** de 2 a 5 atendentes logados ao mesmo tempo na mesma loja. Precisa de
  trava/controle pra não dar erro em pedidos simultâneos.
- **Tempo real cozinha:** viável via WebSocket já existente.

## Fechamento de caixa — recomendação (revisada)
⚠️ CORREÇÃO IMPORTANTE de escopo (entendimento do usuário, a confirmar com o cliente): o
**PDV cobre SÓ as vendas do salão/restaurante** (rodízio + bebidas). As **tele-entregas são
um fluxo SEPARADO do PDV**, conectado ao Motoboy. Ou seja, provavelmente existem DOIS caixas
distintos, não um só:
- **Caixa do salão (PDV):** vendas de rodízio/bebidas consumidas no local.
- **Fechamento da tele-entrega (via Motoboy):** o dinheiro que o motoboy traz das entregas —
  é o fechamento/sangria do motoboy, que já é o diferencial do projeto.

Mesmo separados, cada um segue o padrão de sessão por turno:
- Uma sessão por loja por turno: `abertura` (fundo de troco) → movimentos → `fechamento`.
- Turno 19h–meia-noite = uma sessão. Fechar na hora, permitir **conferência/acerto no dia
  seguinte** (estado "fechada, aguardando conferência").
- Para ESTE módulo (tele-entrega), o pedido só precisa referenciar a sessão/turno de
  tele-entrega ativa, pra o fechamento do Motoboy conseguir agrupar depois. O caixa do salão
  (PDV) é problema do módulo PDV, não deste.

Ponto a confirmar com o cliente: salão e tele-entrega usam caixas/fundos de troco realmente
separados, ou tudo cai num caixa só no fim da noite? Isso define se são duas `SessaoCaixa`
independentes ou uma só com movimentos etiquetados por origem.

## Reaproveitamento do model `Order` existente
Já existe (Prisma): `id, lojaId, customerName, phone (criptografado), address (criptografado,
opcional), deliveryType (ENTREGA/RETIRADA), paymentMethod (string livre), notes, status
(enum), deliveryFee, totalPrice, items[], createdAt, updatedAt`. `OrderItem` separado, com
snapshot de sabores/borda/quantidade/preço.

Dá pra reaproveitar. Ajustes necessários:
- Adicionar `origem_pedido` e `atendente_id` (quem criou).
- A rota `POST /api/orders` está comentada/desativada junto com o checkout público → precisa
  ser **reescrita pro fluxo de atendente** (autenticado). Avaliar se a criptografia de
  phone/address ainda faz sentido em uso interno ou se atrapalha o histórico/busca por telefone.
- Vincular pedido à `SessaoCaixa` aberta.

## ⚠️ Ponto de schema a resolver: cardápio por loja
Hoje `PizzaSize`, `Flavor`, `Border`, `Product` são **globais** — não têm `lojaId`. Só `Order`
tem. Como o cliente confirmou **cardápio separado por loja** (concorrentes), isso exige
trabalho extra de schema: adicionar `lojaId` a esses models e migrar. Isso é pré-requisito do
multi-tenant real — não dá pra ter pizzarias concorrentes compartilhando cardápio.

## Microsip / screen-pop — RESOLVIDO (como implementar)
Microsip NÃO tem API REST/SDK/webhook. Mas tem o hook nativo `cmdIncomingCall` no
`microsip.ini` (editar com o programa fechado). Ele executa um script passando o **Caller ID
como ARGUMENTO de linha de comando** (`%1` / `argv[1]`) — NÃO como placeholder em URL
(`cmdIncomingCall=https://site?tel=` não funciona).

Fluxo recomendado (zero-clique, não "um clique"):
1. `cmdIncomingCall` aponta pra um script (`.bat`/`.vbs`/`.exe` pequeno).
2. O script recebe o número (`%1`) e faz um `POST` HTTP pro backend Express.
3. Backend normaliza o número, busca o cliente por telefone (isolado por loja) e empurra o
   resultado via **WebSocket/SSE** (infra já existe) pra aba JÁ ABERTA do atendente.
4. Atendente vê a tele-entrega pré-preenchida aparecer sozinha — só confirma.

Existem também `cmdCallStart`, `cmdCallEnd`, `cmdCallAnswer` (e forks têm `cmdCallRing`,
`cmdCallBusy`, `cmdOutgoingCall`) — testar quais respondem na versão instalada.

Pontos de atenção (documentar no setup de implantação):
- Config é **por PC/instalação** — cada máquina que atende precisa editar o `.ini` local.
  Não dá pra centralizar via nuvem.
- **Windows-only** (Linux/macOS só via Wine).
- Formato do número varia por provedor SIP (pode vir com `sip:`, com/sem DDI 55, traços) —
  **normalizar no backend** antes de buscar no banco.
- Testar empiricamente se o número chega com aspas/prefixo — a doc oficial não detalha o formato.

## Referência sobre APIs (fase 2, já pesquisado)
- **iFood:** tem portal de dev (developer.ifood.com.br) com sandbox no self-registration. MAS
  produção exige homologação formal (reunião de validação com o time deles) + CNPJ com CNAE de
  tecnologia. Não é webhook de fim de semana — é virar "integradora homologada".
- **Anota Aí:** portal integracao.anota.ai permite registro/sandbox. Porém foi comprada pelo
  iFood (2022) — não entrega API pública amigável pra "puxar" pedidos.
- Por isso tudo isso é fase 2; agora só reservar `origem_pedido`.

## Fora de escopo (confirmado)
- Integração real com Microsip/iFood/Anota Aí/WhatsApp — fase 2
- Emissão fiscal
- Redigitar pedidos de iFood/Anota Aí na 1ª versão
- Qualquer coisa do fluxo de cliente final (vitrine pública, carrinho self-service)
