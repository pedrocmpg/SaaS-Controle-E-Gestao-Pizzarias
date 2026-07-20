# Spec-2 Revisado — PDV/Salão com Grade Configurável (Botoeira)

## Contexto

Este spec substitui a implementação atual do PDV/Salão. O PDV vigente foi construído
em cima de uma tela fixa de rodízio (preço por pessoa, faixa adulto/criança/meia,
hard-coded). Essa abordagem está sendo descartada.

**Banco atual: sem movimento real registrado.** Não há uso em produção ainda —
migration livre, sem necessidade de preservar histórico. Antes do lançamento real
para o cliente-piloto, será feito reset manual do banco para garantir estado limpo.
Não tratar esta migration com cautela de dado-em-produção.

**Módulos não afetados por este spec:** Pedidos/tele-entrega (`Order`/`OrderStatus`,
origem TELEFONE/IFOOD/ANOTA_AI/WHATSAPP/BALCAO) permanece intocado. `Comanda`/
`ComandaItem` (este spec) é uma entidade **100% separada** de `Order`/`OrderStatus` —
sem tabela genérica de venda, sem FK cruzada entre os dois. Caixa de salão e caixa
de tele-entrega continuam financeiramente isolados, como já decidido no spec-2
original.

## Princípio geral do projeto (lei — aplica-se a todo este spec)

> "Cadastro e parametrização é uma lei geral para este projeto, liberdade para o
> cliente."

Nenhuma opção de apresentação (grupos, botões, cores, rótulos, presença de
mesa/borda, quantidade máxima de sabores) é fixa em código. Tudo isso é dado
configurável por loja (`lojaId`), e o sistema **nasce vazio** — cada pizzaria
monta sua própria grade do zero. Não há seed/pré-população a partir do cardápio
existente.

Regras de **cálculo** (como o `modoAdicionalSabor`) também são parametrizáveis,
mas cada uma tem custo de implementação real — não são adicionadas "de graça" só
porque a lei geral existe. Neste spec, `modoAdicionarSabor` é implementado com um
único modo (CHEIO) fixo por ora; o campo já existe no schema para permitir
adicionar PROPORCIONAL no futuro sem nova migration, mas a lógica de cálculo do
segundo modo não é implementada nesta fase.

---

## Modelo de dados

### Alterações em models existentes

```prisma
model PizzaSize {
  // ... campos existentes
  codigo         String?  // código livre opcional, ex "01001", só organização/busca
  maxSabores     Int      @default(1) // máx. de sabores simultâneos, configurável por tamanho
  precoDelivery  Decimal? // se null, usa o preço base para delivery
}

model Flavor {
  // ... campos existentes
  codigo    String?  // código livre opcional
  adicional Decimal  @default(0) // soma ao preço da pizza se este sabor for escolhido
}

model Product {
  // ... campos existentes
  // category ganha novos valores de enum: EXTRA, RODIZIO (além de BEBIDA já existente)
  codigo        String?
  precoDelivery Decimal? // se null, usa preco base
}
```

### Novos models

```prisma
model LojaConfig {
  id                 String   @id @default(cuid())
  lojaId             String   @unique
  loja               Loja     @relation(fields: [lojaId], references: [id])

  modoAdicionalSabor ModoAdicionalSabor @default(CHEIO)
  usaBorda           Boolean  @default(false)
  usaMesa            Boolean  @default(true)

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}

enum ModoAdicionalSabor {
  CHEIO
  // PROPORCIONAL — reservado para fase futura, não implementar cálculo agora
}

model GrupoPDV {
  id        String   @id @default(cuid())
  lojaId    String
  loja      Loja     @relation(fields: [lojaId], references: [id])

  nome      String        // ex "REFRIGERANTES", "PIZZAS", "EXTRAS"
  cor       String?       // hex, opcional — default definido no frontend se null
  corFonte  String?       // hex, opcional
  posicao   Int           // ordem de exibição
  ativo     Boolean  @default(true)

  botoes    BotaoPDV[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([lojaId])
}

model BotaoPDV {
  id          String   @id @default(cuid())
  lojaId      String
  loja        Loja     @relation(fields: [lojaId], references: [id])
  grupoId     String
  grupo       GrupoPDV @relation(fields: [grupoId], references: [id])

  posicao     Int
  labelBotao  String        // "Nome no Botão" — pode divergir do nome real do item
  cor         String?

  tipo        TipoBotaoPDV
  pizzaSizeId String?
  pizzaSize   PizzaSize? @relation(fields: [pizzaSizeId], references: [id])
  productId   String?
  product     Product?   @relation(fields: [productId], references: [id])

  ativo       Boolean  @default(true)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([lojaId])
  @@index([grupoId])
}

enum TipoBotaoPDV {
  PIZZA      // aponta para pizzaSizeId, abre o montador de sabores
  PRODUTO    // aponta para productId (bebida, extra, rodízio) — lança direto
}
```

**Regra de integridade** (aplicar em app-level, não dá pra fazer CHECK constraint
simples de "exatamente um FK setado" de forma portável — validar no service layer
do backend antes de criar/atualizar `BotaoPDV`):
- Se `tipo = PIZZA`, `pizzaSizeId` obrigatório e `productId` deve ser null.
- Se `tipo = PRODUTO`, `productId` obrigatório e `pizzaSizeId` deve ser null.

### Comanda (salão) — separado de Order

```prisma
model Comanda {
  id          String   @id @default(cuid())
  lojaId      String
  loja        Loja     @relation(fields: [lojaId], references: [id])

  numeroMesa  Int?          // opcional — permite balcão/avulso sem mesa (usaMesa=false ou venda sem mesa)
  status      ComandaStatus @default(ABERTA)
  turnoId     String        // vínculo ao turno/caixa do salão (model de turno já existente do spec-2 original)

  itens       ComandaItem[]

  abertaEm    DateTime @default(now())
  fechadaEm   DateTime?

  @@index([lojaId])
  @@index([turnoId])
}

enum ComandaStatus {
  ABERTA
  FECHADA
  CANCELADA
}

model ComandaItem {
  id           String   @id @default(cuid())
  comandaId    String
  comanda      Comanda  @relation(fields: [comandaId], references: [id])

  tipo         TipoBotaoPDV     // PIZZA ou PRODUTO, reaproveita o enum
  descricao    String           // snapshot do label/descrição no momento da venda
  unitPrice    Decimal          // snapshot do preço já calculado (base + adicionais), nunca recalculado
  quantidade   Int      @default(1)

  // Para itens PIZZA: registrar os sabores escolhidos como snapshot (não FK viva)
  sabroesSnapshot Json?         // ex [{ "nome": "Calabresa", "adicional": 5.00 }, ...]

  criadoEm     DateTime @default(now())
}
```

`unitPrice` e `sabroesSnapshot` seguem o padrão já estabelecido no projeto
(`TurnoMotoboy.valorPorEntrega`, etc.): valores gravados no momento da transação,
imunes a mudanças futuras de preço no cadastro.

---

## Regra de precificação da pizza (montador)

```
preço_final = PizzaSize.preco (ou precoDelivery se aplicável)
            + soma(Flavor.adicional de cada sabor escolhido)
```

- Sabor sem adicional (`adicional = 0`) não altera o preço.
- Modo CHEIO (único implementado nesta fase): cada sabor escolhido soma seu
  adicional **inteiro**, independente de quantos sabores a pizza tem ou da fração
  que cada um ocupa.
- Quantidade de sabores permitida = `PizzaSize.maxSabores` (configurável por
  tamanho, ex: broto=1, grande=2, família=4).
- Borda: se `LojaConfig.usaBorda = true`, o montador oferece seleção de borda
  (reaproveita model `Border` já existente do módulo Pedidos) com adicional
  próprio, somado ao preço final da mesma forma que os sabores.

---

## Fluxo de telas

### 1. Configuração da Grade (SUPER_ADMIN e GERENTE — não ATENDENTE)

- Tela de gestão de `GrupoPDV`: criar/editar/reordenar grupos (nome, cor opcional,
  posição).
- Dentro de cada grupo, gestão de `BotaoPDV`: adicionar botão apontando para um
  `PizzaSize` ou `Product`, definir label customizado, posição, cor opcional.
- Tela de pré-visualização: renderiza a grade como vai aparecer no PDV real,
  simples validação visual antes de liberar pro atendente.
- Sistema nasce sem nenhum grupo/botão cadastrado — tela vazia até o gerente
  configurar.

### 2. PDV (operação — ATENDENTE e acima)

- Abre/seleciona comanda (mesa, se `usaMesa=true`; ou "balcão" se não).
- Grade de grupos no topo (scroll horizontal ou wrap simples — sem sistema de
  paginação por página como no ERP de referência).
- Clique em grupo → mostra os botões daquele grupo.
- Clique em botão:
  - `tipo=PRODUTO` (bebida, extra, rodízio): lança direto na comanda. Se
    `category=RODIZIO`, abre um input simples de quantidade (nº de pessoas
    naquela faixa) antes de lançar — permite lançar "4 adultos" de uma vez.
  - `tipo=PIZZA`: abre o montador — tela de seleção de sabor(es), respeitando
    `maxSabores`, seguida de borda (se `usaBorda`), calcula o preço pela regra
    acima e lança na comanda como um único `ComandaItem` com `sabroesSnapshot`.
- Item avulso (bebida/extra) pode ser lançado sozinho, sem exigir outros itens
  na comanda.
- Fechamento da comanda: segue o fluxo de fechamento já existente do spec-2
  original (split dinheiro/cartão/PIX, fechamento em Z na tela).

---

## Fora de escopo nesta fase (não implementar)

- Modo PROPORCIONAL de `modoAdicionalSabor` (campo existe no enum, lógica não).
- Paginação por "página" de botões (usar scroll).
- Tradução multi-idioma de labels de botão.
- Preço com vigência/histórico, preço sugerido/subsidiado/variável por horário.
- Pré-população automática da grade a partir do cardápio existente.
- Terminal de auto-atendimento.

---

## Notas para Claude Code (Plan Mode)

- Usar Plan Mode (`opusplan`) dado que este spec adiciona campos a models já em
  produção (`PizzaSize`, `Flavor`, `Product`) e cria models novos com FKs para
  eles.
- Confirmar em plano: nomes de migration, se `GrupoPDV`/`BotaoPDV`/`Comanda`/
  `ComandaItem`/`LojaConfig` precisam de índice composto por `lojaId` além do
  simples (revisar padrão já usado nos models existentes do projeto).
- Validar a regra "exatamente um FK setado em BotaoPDV conforme tipo" via
  service layer (Joi ou equivalente já usado no projeto), não via constraint de
  banco.
- Todos os models novos seguem o padrão de isolamento multi-tenant já
  estabelecido: `lojaId` obrigatório em toda query, sem exceção fora de
  SUPER_ADMIN.
