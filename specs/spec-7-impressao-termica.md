# Spec-7 — Impressão Térmica (Agente Local ESC/POS)

**Prioridade:** 2 (bloqueador comercial)
**Esforço estimado:** 2 a 3 dias
**Depende de:** spec-6 (não estritamente, mas não começar antes de a fundação estar fechada)
**Bloqueia:** lançamento real no cliente-piloto

---

## Contexto

O `CLAUDE.md` do projeto registra como decisão confirmada com o cliente:
*"Impressão de comanda pra cozinha na térmica é obrigatória."* Não existe uma linha de
código de impressão no repositório (`grep -rni "imprim|print|termica|escpos"` só acha
`printf` do Winston).

Isso é um **bloqueador comercial, não uma feature**. Hoje a pizzaria recebe pedidos do
iFood e do Anota Aí que imprimem sozinhos na térmica. O hub, no estado atual, exige que
alguém leia a tela e comunique verbalmente à cozinha — ou seja, oferece um **downgrade
operacional** justamente no fluxo mais crítico do negócio. Nenhuma pizzaria troca um
fluxo que imprime sozinho por um que não imprime.

### Restrição arquitetural

A impressora térmica é um dispositivo **USB ou de rede local**, dentro da pizzaria. O
backend Express roda na nuvem. Um servidor na nuvem não alcança uma impressora USB na
cozinha. Portanto: **é obrigatório um agente local** rodando no PC do caixa.

Isso não é custo extra: o mesmo PC já vai precisar rodar o script do hook `cmdIncomingCall`
do Microsip na fase 2. O agente local é a mesma peça, e este spec o estabelece.

---

## Arquitetura

```
Backend (nuvem) ──WebSocket──> Agente local (PC do caixa) ──USB/rede──> Impressora térmica
```

O agente local **não expõe portas** e **não recebe conexões de entrada**. Ele se conecta
como cliente ao WebSocket que já existe (`backend/src/lib/socket.js`), autenticando com o
mesmo JWT. Isso evita configuração de firewall/NAT na pizzaria e reaproveita toda a
infraestrutura de auth e de rooms por loja que já está pronta.

Fila e retry ficam no agente: se a impressora estiver sem papel ou desligada, o job fica
numa fila local em disco e é retentado. O backend nunca fica bloqueado esperando papel.

---

## Parte A — Backend: eventos e modelo de job

### Novo model

```prisma
enum TipoImpressao {
  COMANDA_COZINHA
  CUPOM_CLIENTE
  ROMANEIO_MOTOBOY
}

enum StatusImpressao {
  PENDENTE
  IMPRESSO
  ERRO
}

/// Job de impressão. Persistido para permitir reimpressão e diagnóstico
/// ("o pedido 412 saiu na cozinha?") sem depender do agente estar online.
model JobImpressao {
  id        Int             @id @default(autoincrement())
  lojaId    Int
  loja      Loja            @relation(fields: [lojaId], references: [id])
  tipo      TipoImpressao
  status    StatusImpressao @default(PENDENTE)

  /// Payload já renderizado em estrutura de linhas — o agente não conhece regra de negócio.
  payload   Json
  /// Referência solta à origem (Order.id, Comanda.id ou TurnoMotoboy.id), sem FK:
  /// o job sobrevive à origem e o tipo diz qual tabela consultar.
  origemId  Int?

  tentativas Int      @default(0)
  erro       String?
  impressoEm DateTime?
  createdAt  DateTime @default(now())

  @@index([lojaId, status])
  @@map("jobs_impressao")
}
```

### Novas rotas — `backend/src/routes/impressao.routes.js`

Todas com `requireAuth` + `attachLojaId` (o middleware unificado do spec-6):

- `POST /api/impressao/comanda/:orderId` — enfileira comanda de cozinha de um pedido.
- `POST /api/impressao/cupom/:comandaId` — enfileira cupom de uma comanda de salão.
- `POST /api/impressao/romaneio/:turnoId` — enfileira romaneio de um turno de motoboy.
- `GET /api/impressao/pendentes` — jobs `PENDENTE` da loja (o agente busca no reconnect,
  para não perder job gerado enquanto estava offline).
- `POST /api/impressao/:id/confirmar` — agente confirma impressão (`IMPRESSO`).
- `POST /api/impressao/:id/erro` — agente reporta falha (`ERRO` + mensagem, incrementa `tentativas`).

Roles: enfileirar e reimprimir liberado para `ORDER_ROLES` (o atendente precisa poder
reimprimir uma comanda que saiu borrada). Confirmar/erro é chamado pelo agente, que
autentica com um usuário de serviço.

### Impressão automática

O disparo mais importante é o automático, não o botão:

- `POST /api/orders` → após criar, enfileira `COMANDA_COZINHA` automaticamente.
- `PATCH /api/orders/:id/status` para `SAIU_PARA_ENTREGA` → enfileira `CUPOM_CLIENTE`
  (a via que vai junto com o pedido).
- `POST /api/motoboy/turnos/:id/fechar` → enfileira `ROMANEIO_MOTOBOY` com o acerto.

O botão de reimprimir na UI existe como recurso de recuperação, não como fluxo principal.
Se o atendente precisar clicar para a cozinha saber do pedido, o problema não foi resolvido.

### Novo evento de socket

Em `backend/src/lib/socket.js`, seguindo o padrão dos `emit*` existentes:

```js
function emitImpressaoJob(lojaId, job) {
  if (io) io.to(`loja:${lojaId}`).emit("impressao:job", job);
}
```

O agente entra na room `loja:{lojaId}` automaticamente, pela lógica de conexão que já
existe — nenhuma mudança necessária no `initSocket`.

---

## Parte B — Agente local

Novo diretório na raiz: `agente-local/`. Projeto Node separado, com `package.json`
próprio. **Não** é workspace do backend — é distribuído e instalado na pizzaria.

### Stack

- `socket.io-client` (mesma versão do frontend).
- `node-thermal-printer` — ESC/POS, suporta USB, rede e Windows shared printer.
- Fila em disco: um JSON simples em `./fila.json`. Não usar banco embarcado — o agente
  precisa ser trivial de instalar e diagnosticar por telefone.

### Configuração — `agente-local/.env`

```
BACKEND_URL=https://...
AGENTE_TOKEN=<JWT do usuário de serviço da loja>
IMPRESSORA_TIPO=epson          # epson | star
IMPRESSORA_INTERFACE=          # ex: printer:POS-80 | tcp://192.168.0.100:9100 | usb
LARGURA_COLUNAS=48             # 48 para 80mm, 32 para 58mm
```

### Comportamento

1. Conecta ao WebSocket com o token. Em falha, retenta com backoff exponencial (máx. 30s).
2. No connect (e reconnect), chama `GET /api/impressao/pendentes` e enfileira tudo —
   garante que nada gerado durante uma queda de internet seja perdido.
3. Ao receber `impressao:job`, adiciona à fila e processa.
4. Processa a fila serialmente. Sucesso → `POST /confirmar` e remove da fila. Falha →
   `POST /erro`, mantém na fila, retenta em 10s (máx. 5 tentativas, depois marca `ERRO`
   definitivo e segue para o próximo — uma impressora sem papel não pode travar a fila
   inteira).
5. Loga tudo em `./agente.log` com rotação simples. O suporte vai ser por telefone; o log
   precisa ser legível por quem não é dev.

### Distribuição

`README.md` no diretório com: instalação (`npm ci`), configuração do `.env`, como
descobrir o nome/IP da impressora no Windows, e como registrar como serviço do Windows
para subir junto com o PC (`node-windows` ou Agendador de Tarefas — documentar o caminho
manual, que é mais fácil de dar suporte).

---

## Parte C — Layouts

Módulo `agente-local/layouts.js`. O payload vindo do backend já contém os dados prontos;
o layout só formata para as colunas configuradas.

### 1. Comanda de cozinha (a mais crítica)

Otimizada para leitura rápida em ambiente quente, com pressa e pouca luz. Fonte grande
nos itens, sem informação financeira — a cozinha não precisa saber preço.

```
================================
     PEDIDO #412  -  19:42
================================
 TELE-ENTREGA
 Cliente: Maria Silva
--------------------------------
 1x PIZZA GRANDE
    > Calabresa / Frango c/ Cat.
    > Borda: Catupiry
    OBS: SEM CEBOLA
--------------------------------
 2x REFRIGERANTE 2L
================================
```

Observações do item em destaque (negrito/dobro) — é a fonte nº1 de retrabalho na cozinha.

### 2. Cupom do cliente

Com valores, forma de pagamento, taxa de entrega e total. Se pagamento é `DINHEIRO`,
imprimir o troco. Endereço completo — é o que o motoboy usa para achar a casa.

**Não é documento fiscal.** Imprimir o rodapé `"DOCUMENTO NAO FISCAL"` obrigatoriamente,
para não induzir o cliente a erro (emissão fiscal está explicitamente fora de escopo do
projeto).

### 3. Romaneio do motoboy

Impresso no fechamento do turno. Lista as entregas, o breakdown por forma de pagamento, o
`valorDaNoite`, o `acerto` e a `sangria`. Duas vias com linha de assinatura — é o
comprovante físico do acerto em dinheiro entre a pizzaria e o motoboy, e o cliente-piloto
vai querer isso arquivado.

---

## Parte D — Frontend

- Botão de reimprimir em `OperacaoPedidos.jsx` (comanda + cupom por pedido).
- Botão de reimprimir cupom em `ComandaModal.jsx`, no fechamento.
- Botão de imprimir romaneio em `OperacaoMotoboyTurno.jsx`, após fechar o turno.
- **Indicador de status do agente** no shell da aplicação: um ponto verde/vermelho
  indicando se algum agente da loja está conectado. Se a impressora cair no meio do
  movimento, o atendente precisa descobrir na hora — não quando a cozinha reclamar.

---

## Critérios de aceite

- [ ] Criar um pedido dispara impressão da comanda de cozinha **sem clique adicional**.
- [ ] Agente desligado no momento do pedido → ao ligar, o job pendente imprime.
- [ ] Impressora sem papel → job vai para `ERRO` após 5 tentativas, e os jobs seguintes
      da fila continuam sendo processados.
- [ ] Reimprimir gera um novo job e imprime de novo.
- [ ] Cupom do cliente traz "DOCUMENTO NAO FISCAL".
- [ ] Romaneio bate exatamente com os números de `TurnoMotoboy` (mesmos valores da tela).
- [ ] Indicador de agente conectado reflete o estado real.

---

## Fora de escopo

- Emissão fiscal (NFC-e/NF-e) — decisão registrada do projeto: se um dia for necessário,
  usar API tipo Focus NFe/PlugNotas, nunca construir do zero.
- Impressão de KDS (tela de cozinha é o spec-8; substitui parcialmente o papel, não o elimina).
- Auto-update do agente. Fase 1 é atualização manual.
