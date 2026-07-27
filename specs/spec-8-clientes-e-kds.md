# Spec-8 — Tela de Clientes (CRM básico) e KDS (Tela de Cozinha)

**Prioridade:** 3 (alto valor percebido, baixo custo — o dado e a infra já existem)
**Esforço estimado:** 2 dias
**Depende de:** spec-6 (fundação). Independente do spec-7.

---

## Contexto

Estas são as duas features de maior razão valor/esforço no backlog, porque **quase toda a
infraestrutura já está pronta e ociosa**:

- O CRM: `Cliente` (com `phoneHash` pesquisável e `address` criptografado) e `Order` já
  gravam tudo o que é necessário desde o spec-1. `POST /api/orders` já faz `upsert` do
  cliente a cada pedido. **O dado está sendo acumulado e nunca é lido** — só existe o
  lookup por telefone no momento do pedido.
- O KDS: WebSocket com rooms por loja, `OrderStatus` e os eventos `emitPedidoNovo` /
  `emitPedidoStatus` já existem e já funcionam em `OperacaoPedidos.jsx`.

São as duas features que o dono da pizzaria consegue *ver* justificando a mensalidade —
e o KDS especificamente é o tipo de tela que ele mostra para outros donos de pizzaria.

---

## Parte A — Tela de Clientes

### Backend — `backend/src/routes/clientes.routes.js`

Novo arquivo. Todas as rotas com `requireAuth` + `attachLojaId`, isoladas por loja.
Roles: `SUPER_ADMIN`, `ADMIN`, `GERENTE` (o atendente já tem o lookup por telefone que
precisa; a visão agregada é gerencial).

**`GET /api/clientes`** — lista paginada com busca.
- Query: `q` (nome ou telefone), `inativoDias` (filtra quem não pede há N dias),
  `page`, `pageSize` (default 30), `orderBy` (`ultimoPedido` | `totalGasto` | `nome`).
- Retorna por cliente: `id`, `name`, telefone **mascarado** (`(51) ****-1234`),
  `totalPedidos`, `totalGasto`, `ticketMedio`, `ultimoPedidoEm`, `diasSemPedir`.

**`GET /api/clientes/:id`** — detalhe.
- Dados do cliente (telefone e endereço descriptografados — aqui sim, é a tela de
  atendimento), histórico completo de pedidos com itens, e os agregados acima.

**`GET /api/clientes/inativos?dias=30`** — atalho para a lista de recuperação.
- Clientes cujo último pedido é anterior a N dias. Ordenado por `totalGasto` desc — o
  dono quer saber quais clientes *valiosos* sumiram, não qualquer um.

#### Cuidados

**Busca por telefone:** `phone` está criptografado com cifra não-determinística e
`phoneHash` é HMAC determinístico. Portanto busca por telefone **só funciona por match
exato do hash** — aplicar a mesma normalização de `hashPhone` na query e comparar
`phoneHash`. Busca parcial por telefone ("termina em 1234") é impossível sem mudar o
esquema de criptografia; **não tentar implementar**. Busca parcial por nome funciona
normalmente (`name` é texto puro).

**Agregados:** calcular com `groupBy` do Prisma sobre `Order` filtrando
`status: { not: "CANCELADO" }`. Pedido cancelado não conta como faturamento do cliente.

**Performance:** os agregados por cliente em lista paginada podem gerar N+1. Fazer um
`groupBy` único por `clienteId` para a página corrente e fazer o merge em memória.

**Privacidade entre tenants:** a regra não-negociável do projeto se aplica com força
máxima aqui — o mesmo telefone em duas pizzarias são dois `Cliente` distintos, e nenhuma
query pode cruzar. Todos os `where` levam `lojaId`.

### Frontend — `frontend/src/pages/operacao/OperacaoClientes.jsx`

Rota `operacao/clientes` em `App.jsx`, com as mesmas `allowedRoles` das telas gerenciais.

- Campo de busca (nome ou telefone completo).
- Tabela: nome, telefone mascarado, nº de pedidos, total gasto, ticket médio, último pedido,
  "há X dias".
- Chip de filtro rápido: "Sem pedir há 30 dias" / "60 dias".
- Clique na linha → painel lateral com o histórico completo do cliente.
- No painel: botão **"Repetir último pedido"**, que abre o `NovoPedidoModal` pré-preenchido
  com cliente, endereço e itens do último pedido. É o maior ganho operacional da tela —
  um pedido recorrente sai em um clique em vez de digitação completa.

---

## Parte B — KDS (Tela de Cozinha)

### Objetivo

Uma tela em modo TV/tablet, pendurada na cozinha, mostrando os pedidos em produção com
tempo decorrido colorido. Substitui a comanda de papel como *visão geral do movimento*
(o papel do spec-7 continua sendo a instrução por pedido — os dois convivem).

### Frontend — `frontend/src/pages/operacao/OperacaoCozinha.jsx`

Rota `operacao/cozinha`. Roles: todas as operacionais (é uma tela pública dentro da loja).

**Layout:** três colunas, `RECEBIDO` → `EM_PREPARO` → `PRONTO/SAIU`. Cada pedido é um card
grande e legível a 2-3 metros de distância.

**O card mostra:** número do pedido, tipo (ENTREGA/RETIRADA/SALÃO), tempo decorrido desde
`createdAt` em destaque, itens com sabores, e observações em destaque forte.

**Cores por tempo decorrido** (o ponto central da tela):
- < 15 min → verde
- 15–25 min → amarelo
- \> 25 min → vermelho pulsante

Os limiares devem ser constantes num só lugar no topo do arquivo. Não hard-codear
espalhado — vira parametrização por loja no futuro.

**Tempo real:** consumir os eventos `pedido:novo` e `pedido:status_atualizado` que já
existem. Reaproveitar o hook de socket que `OperacaoPedidos.jsx` já usa — **não** criar uma
segunda conexão nem um segundo padrão de consumo.

**Timer:** um único `setInterval` de 30s re-renderizando os tempos. Não um timer por card.

**Interação:** clique no card avança o status (mesma `PATCH /api/orders/:id/status`, que já
valida a transição no backend). Botões grandes — vai ser operado com a mão suja de farinha,
possivelmente por toque.

**Modo TV:** sem sidebar, sem header. Tela cheia. Deve sobreviver a ficar aberta a noite
inteira: cuidar de vazamento de listeners no `useEffect` e reconectar o socket sozinho após
queda de rede.

### Backend

Nenhuma mudança necessária. `GET /api/orders?status=...` e o WebSocket já entregam tudo.

Se a listagem atual não suportar filtro por múltiplos status, adicionar o suporte em
`orders.routes.js` — mudança pequena, não justifica endpoint novo.

---

## Critérios de aceite

**Clientes:**
- [ ] Lista carrega com agregados corretos e paginada.
- [ ] Busca por nome parcial funciona; busca por telefone completo funciona.
- [ ] Pedidos `CANCELADO` não entram em `totalGasto`.
- [ ] Filtro de inativos retorna os clientes certos, ordenados por valor.
- [ ] "Repetir último pedido" abre o modal preenchido corretamente.
- [ ] Telefone aparece mascarado na lista e completo só no detalhe.

**KDS:**
- [ ] Pedido novo aparece na tela sem refresh.
- [ ] Mudança de status em outra aba reflete no KDS em tempo real.
- [ ] Cores mudam conforme o tempo passa.
- [ ] Clique avança o status e persiste.
- [ ] Tela aberta por 4h continua funcionando e reconecta após queda de rede.

---

## Fora de escopo

- Campanhas/disparo de mensagem para clientes inativos (WhatsApp Business API é fase 2,
  decisão registrada do projeto). Esta tela **identifica** os inativos; a comunicação é
  manual por enquanto.
- Programa de fidelidade/pontos.
- Segmentação de clientes além do filtro de inatividade.
- KDS separado por estação (forno/montagem/bebidas) — só se o piloto pedir.
