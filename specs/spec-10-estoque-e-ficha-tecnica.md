# Spec-10 — Estoque e Ficha Técnica (CMV)

**Prioridade:** 5 (última — não iniciar antes de validar com o piloto)
**Esforço estimado:** 1 a 2 semanas
**Depende de:** spec-6, spec-8. Idealmente também de um turno real rodado com o piloto.

---

## ⚠️ Pré-requisito de negócio, não técnico

**Não começar este spec sem confirmação do cliente-piloto.**

Estoque é a dor real que sustenta uma mensalidade de R$500–1000 a longo prazo — é o que
separa "sistema de pedidos" de "sistema de gestão" e é o que o TEKNISA faz. Mas é também,
de longe, o módulo mais caro deste backlog, e o único cujo valor depende inteiramente de
uma coisa que o software não controla: **a disciplina de quem cadastra e faz contagem**.

Um módulo de estoque em que ninguém lança a entrada de mercadoria produz números errados,
e números errados são piores que número nenhum — o dono perde confiança no sistema inteiro,
não só no módulo.

O projeto é mantido por um dev solo. Duas semanas construindo isso "no escuro" é o maior
risco de desperdício do backlog.

### Perguntas a responder antes de escrever código

1. Hoje o dono controla estoque de alguma forma? (Caderno? Planilha? Nada?)
2. Quem receberia a mercadoria e lançaria a entrada no sistema? Essa pessoa existe e tem
   tempo no meio do movimento?
3. Ele quer **controle de quantidade** (quantos kg de queijo tenho) ou **CMV/margem**
   (quanto custa e quanto lucro por pizza)? São problemas diferentes e o segundo é bem
   mais simples de entregar.
4. Aceita margem aproximada no rodízio, ou exige exatidão?

Se a resposta de (3) for "quero saber minha margem", **implementar só a Fase 1 abaixo e
parar**. Entrega 80% do valor por 20% do esforço.

---

## Fase 1 — Ficha técnica e CMV (sem controle de saldo)

Esta fase responde "quanto custa e quanto lucro em cada item" sem exigir contagem física
nem lançamento de entrada. É puramente cadastral e imediatamente útil.

### Modelo

```prisma
enum UnidadeMedida {
  GRAMA
  MILILITRO
  UNIDADE
}

/// Insumo/matéria-prima. Custo é o custo médio de compra por unidade base.
model Insumo {
  id     Int  @id @default(autoincrement())
  lojaId Int
  loja   Loja @relation(fields: [lojaId], references: [id])

  nome          String
  unidade       UnidadeMedida
  /// Custo por unidade base (por grama, por ml, por unidade).
  custoUnitario Decimal @db.Decimal(10, 4)
  ativo         Boolean @default(true)

  itensFicha ItemFichaTecnica[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([lojaId])
  @@map("insumos")
}

/// Composição de um item vendável. Aponta para Flavor, Product ou PizzaSize
/// (massa/molho base do tamanho) — exatamente um deles.
model FichaTecnica {
  id     Int  @id @default(autoincrement())
  lojaId Int
  loja   Loja @relation(fields: [lojaId], references: [id])

  flavorId    Int?       @unique
  flavor      Flavor?    @relation(fields: [flavorId], references: [id])
  productId   Int?       @unique
  product     Product?   @relation(fields: [productId], references: [id])
  pizzaSizeId Int?       @unique
  pizzaSize   PizzaSize? @relation(fields: [pizzaSizeId], references: [id])

  itens ItemFichaTecnica[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([lojaId])
  @@map("fichas_tecnicas")
}

model ItemFichaTecnica {
  id             Int          @id @default(autoincrement())
  fichaTecnicaId Int
  fichaTecnica   FichaTecnica @relation(fields: [fichaTecnicaId], references: [id], onDelete: Cascade)
  insumoId       Int
  insumo         Insumo       @relation(fields: [insumoId], references: [id], onDelete: Restrict)
  /// Quantidade na unidade base do insumo.
  quantidade     Decimal      @db.Decimal(10, 3)

  @@unique([fichaTecnicaId, insumoId])
  @@map("itens_ficha_tecnica")
}
```

**Decisão de modelagem:** a ficha da pizza é composta — `PizzaSize` carrega massa e molho
(o que varia por tamanho), e cada `Flavor` carrega sua cobertura. O custo de uma pizza
montada é `ficha(PizzaSize) + Σ ficha(Flavor de cada sabor)`. Isso evita a explosão
combinatória de criar uma ficha por combinação de sabores.

Para pizza meio-a-meio, ratear a cobertura de cada sabor pela fração
(`1/nº de sabores`). Aproximação aceitável e consistente.

### Backend

- CRUD de `Insumo` e `FichaTecnica` (`backend/src/routes/estoque.routes.js`), isolado por
  loja, com auditoria (`auditCatalogChange`), seguindo o padrão de `catalog.routes.js`.
- `backend/src/lib/custos.js` — funções **puras** (mesma disciplina do `financeiro.js` do
  spec-6, e testadas junto): `calcularCustoPizza`, `calcularCustoProduto`,
  `calcularCustoPedido`.
- Estender `GET /api/orders/reports/summary` com `custoTotal`, `margemBruta` e
  `margemPercentual`, e incluir custo/margem no ranking de `topItens`.

### Frontend

- `admin/insumos` — CRUD de insumos.
- Aba de ficha técnica dentro das telas de cadastro de sabores/produtos/tamanhos que já
  existem. **Não criar uma tela nova de "fichas"** — o dono pensa em "o custo da calabresa",
  não em "a ficha técnica nº 12".
- Exibir custo e margem calculados ao vivo na tela de cadastro. Feedback imediato é o que
  faz o dono realmente preencher as fichas.
- No relatório: colunas de custo e margem; ranking de itens por margem (não só por volume) —
  a pergunta que o dono realmente tem é "o que dá dinheiro", não "o que vende mais".

### Rodízio

O rodízio inviabiliza rateio preciso por natureza (consumo por pessoa é variável). Tratar
como **custo médio por pessoa**, configurável na `LojaConfig`, ajustado por observação ao
longo do tempo. Não tentar exatidão aqui — documentar explicitamente na UI que o número é
estimado, para não induzir a decisões erradas.

---

## Fase 2 — Saldo de estoque e baixa automática

**Só implementar se a Fase 1 estiver em uso real e o cliente pedir.**

### Modelo adicional

```prisma
enum TipoMovimentoEstoque {
  ENTRADA
  BAIXA_VENDA
  PERDA
  AJUSTE_INVENTARIO
}

model MovimentoEstoque {
  id       Int                  @id @default(autoincrement())
  lojaId   Int
  loja     Loja                 @relation(fields: [lojaId], references: [id])
  insumoId Int
  insumo   Insumo               @relation(fields: [insumoId], references: [id])
  tipo     TipoMovimentoEstoque
  /// Positiva em ENTRADA/AJUSTE para cima; negativa em BAIXA_VENDA/PERDA.
  quantidade    Decimal  @db.Decimal(10, 3)
  custoUnitario Decimal? @db.Decimal(10, 4)
  motivo        String?
  /// Order.id ou Comanda.id que originou a baixa (sem FK — o movimento sobrevive à origem).
  origemId      Int?
  adminId       Int
  admin         Admin    @relation(fields: [adminId], references: [id])
  createdAt     DateTime @default(now())

  @@index([lojaId, insumoId])
  @@map("movimentos_estoque")
}
```

Adicionar em `Insumo`: `saldoAtual Decimal @default(0)` e `estoqueMinimo Decimal?`.

### Regras

- **Saldo é derivado, mas materializado.** `saldoAtual` é atualizado na mesma transação do
  movimento; `MovimentoEstoque` é a fonte da verdade para reconstrução. Nunca atualizar
  `saldoAtual` fora de uma transação com o movimento correspondente.
- **Baixa automática na venda:** ao criar `Order` e ao fechar `Comanda`, gerar
  `BAIXA_VENDA` para cada insumo das fichas dos itens vendidos.
- **Baixa nunca bloqueia a venda.** Insumo sem ficha, ficha incompleta ou saldo negativo →
  registra o movimento, permite saldo negativo e emite alerta. Uma pizzaria em plena sexta
  à noite não pode ter a venda recusada porque alguém esqueceu de lançar a entrada do queijo.
  Saldo negativo é um sinal de gestão, não um erro de sistema.
- **Inventário:** tela de contagem física que gera `AJUSTE_INVENTARIO` pela diferença,
  registrando quem contou e quando.
- **Alertas:** insumos abaixo do `estoqueMinimo` no dashboard.

### Cuidado de performance

A baixa automática gera N movimentos por pedido. Em pico de sexta à noite isso multiplica a
escrita por pedido. Fazer a baixa de forma assíncrona (fila em memória processada logo após
a resposta) para não somar latência ao caminho crítico da criação do pedido.

---

## Critérios de aceite

**Fase 1:**
- [ ] CRUD de insumos e fichas funcionando, isolado por loja.
- [ ] Custo de pizza montada = ficha do tamanho + fichas dos sabores, com rateio correto
      em meio-a-meio.
- [ ] `custos.js` é puro e tem testes (mesmos moldes do `financeiro.js`).
- [ ] Relatório mostra custo, margem bruta e margem %.
- [ ] Item sem ficha não quebra o relatório — aparece com custo nulo e sinalizado.

**Fase 2:**
- [ ] Venda gera baixa correta de todos os insumos.
- [ ] Venda **nunca** é bloqueada por problema de estoque.
- [ ] Saldo reconstruído a partir dos movimentos bate com `saldoAtual`.
- [ ] Inventário gera ajuste e registra o responsável.
- [ ] Criação de pedido não fica mensuravelmente mais lenta.

---

## Fora de escopo

- Ordem de compra / integração com fornecedor.
- Controle de validade e lote.
- Previsão de demanda.
- Custo médio ponderado móvel (usar custo médio simples do `Insumo`; migrar só se o
  cliente reclamar da distorção).
