# Spec-6 — Fundação: Isolamento Multi-Tenant e Integridade Financeira

**Prioridade:** 1 (bloqueador — executar antes de qualquer feature nova)
**Esforço estimado:** 1 a 1,5 dia
**Depende de:** nada
**Bloqueia:** spec-9 (onboarding de loja), qualquer venda para uma segunda pizzaria

---

## Contexto

O backend está funcional e em uso com **uma única loja** (o piloto). Toda a lógica
de isolamento por `lojaId` já existe e está aplicada nas rotas (`resolveLojaId` +
`attachLojaId`, filtros `where: { lojaId }` em todas as queries). O problema não é
ausência de isolamento — é que existem **fallbacks silenciosos** que só são inofensivos
enquanto houver exatamente uma loja no banco, e **cálculos financeiros não-transacionais**
que só são inofensivos enquanto houver um operador clicando por vez.

Este spec fecha essas duas classes de risco. Nenhum deles é um bug visível hoje; todos
viram incidente de dado no dia em que a segunda pizzaria entrar ou em que dois atendentes
clicarem ao mesmo tempo.

**Ordem de execução dentro do spec:** parte A → parte C → parte B → parte D. A parte C
(testes) vem antes da B porque os testes da parte C são o que dá confiança para mexer na
lógica de fechamento na parte B.

---

## Parte A — Matar o fallback silencioso de `lojaId`

### Problema

`backend/src/lib/lojaScope.js`:

```js
if (fallbackToFirst) {
  const loja = await prisma.loja.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
  return loja ? loja.id : null;
}
```

Quando a resolução por `req.admin.lojaId` / body / query falha, a requisição cai
**silenciosamente na loja de menor id** — que será sempre a pizzaria piloto. Com duas
lojas no banco, uma requisição malformada de um admin sem `lojaId` grava dado de um
tenant dentro do outro, sem erro e sem log. Isso viola diretamente a regra
não-negociável do projeto.

Problema secundário: um `SUPER_ADMIN` global pode passar qualquer `lojaId` por body ou
query e o valor é aceito sem verificar se aquela loja existe (`parseInt` de um id
inexistente vira uma FK violation genérica 500, não um 400 legível).

### Mudanças

**1. `backend/src/lib/lojaScope.js` — remover `fallbackToFirst`**

Nova assinatura e comportamento:

- Operador vinculado (`req.admin.lojaId != null`) → sempre essa loja. Body/query são
  **ignorados** (comportamento atual, mantido).
- `SUPER_ADMIN` global (`lojaId === null`) → usa `lojaId` de body ou query. Deve
  **validar que a loja existe** (`prisma.loja.findUnique`), retornando `null` se não.
- Nenhuma das duas resolveu → retorna `null`. **Sem fallback.**
- Remover o parâmetro `fallbackToFirst` inteiro (não deixar como opção desativada — é
  uma armadilha para o próximo dev).

Quando `resolveLojaId` retorna `null`, os handlers já respondem
`400 { error: "Nenhuma loja associada a esta requisição." }` — esse comportamento se
mantém e passa a ser o caminho real em vez de teórico.

**2. Extrair `attachLojaId` para middleware compartilhado**

Hoje a função `attachLojaId` está **duplicada literalmente** em `caixa.routes.js`,
`salao.routes.js`, `catalog.routes.js`, `motoboy.routes.js` e `pdvConfig.routes.js`.
Criar `backend/src/middleware/attachLojaId.js` com a implementação única e importar nos
cinco arquivos. `orders.routes.js` chama `resolveLojaId` inline em vários handlers —
migrar também para o middleware, para que exista **um único ponto** de resolução de
tenant no sistema inteiro.

**3. Log de segurança na falha de resolução**

Quando `resolveLojaId` retornar `null`, emitir
`logSecurityEvent("LOJA_NAO_RESOLVIDA", { adminId, path }, ip)` antes do 400. Sem isso
a falha é invisível na operação.

**4. Garantir que todo `Admin` operacional tenha `lojaId`**

Verificar em produção (`SELECT id, email, role, "lojaId" FROM admins WHERE "lojaId" IS NULL`)
e vincular todos os operadores à loja piloto. Apenas `SUPER_ADMIN` pode permanecer com
`lojaId` null. Após a remoção do fallback, um `ADMIN`/`GERENTE`/`ATENDENTE` sem `lojaId`
fica **incapaz de operar** — essa checagem tem que ser feita antes do deploy, não depois.

### Critérios de aceite

- [ ] `grep -rn "fallbackToFirst" backend/` não retorna nada.
- [ ] `attachLojaId` existe em exatamente um arquivo e é importado pelos demais.
- [ ] `SUPER_ADMIN` passando `lojaId` de loja inexistente recebe 400, não 500.
- [ ] Operador com `lojaId` recebe sua loja mesmo enviando outro `lojaId` no body.
- [ ] Nenhum admin não-`SUPER_ADMIN` com `lojaId` null em produção.

---

## Parte B — Transacionalidade e trava nos fechamentos financeiros

### Problema

Tanto `POST /api/caixa/:id/fechar` quanto `POST /api/motoboy/turnos/:id/fechar` seguem
o padrão: lê estado → confere `status !== "ABERTO"` → calcula em JS → `update`. As três
etapas não estão em transação e não há lock de linha.

Dois cliques rápidos no botão "fechar" (ou duplo-clique num tablet lento na cozinha)
podem **ambos** passar pelo check de status antes do primeiro `update` commitar. O
resultado é o cálculo rodando duas vezes; no caso do caixa, com movimentos de sangria
lançados no intervalo, os dois fechamentos gravam valores diferentes e o último vence.

O projeto já resolveu corretamente essa classe de problema no *abrir* turno (índice
único parcial `turno_motoboy_um_aberto_por_motoboy` + tratamento de `P2002`). Falta o
equivalente no *fechar*.

O mesmo se aplica a `POST /api/salao/comandas/:id/fechar`, que lê a comanda, busca a
sessão de caixa aberta e grava — sem transação.

### Mudanças

**1. Envolver os três fechamentos em `prisma.$transaction`**

Para cada um de `caixa.routes.js` (`/:id/fechar`), `motoboy.routes.js`
(`/turnos/:id/fechar`) e `salao.routes.js` (`/comandas/:id/fechar`):

```js
const atualizado = await prisma.$transaction(async (tx) => {
  // 1. Re-ler a entidade DENTRO da transação
  // 2. Conferir o status DENTRO da transação — se já não estiver ABERTO, lançar erro de conflito
  // 3. Ler os agregados (comandas/pedidos/movimentos/extras) via tx
  // 4. Calcular
  // 5. tx.update(...)
});
```

Usar `isolationLevel: "Serializable"` nas transações de fechamento. São operações raras
(algumas por noite) e o custo de contenção é irrelevante perto do custo de um acerto
financeiro errado.

**2. Padronizar o erro de conflito**

Criar uma classe/sentinela simples (ex.: lançar um objeto com `httpStatus: 409`) para que
o check de status dentro da transação vire um 409 limpo no handler, em vez de vazar como
500 pelo `errorHandler`.

**3. Idempotência no frontend**

Em `OperacaoCaixa.jsx`, `OperacaoMotoboyTurno.jsx` e `ComandaModal.jsx`: desabilitar o
botão de fechar enquanto a requisição está em voo (estado `submitting`). Trava barata que
elimina 95% dos casos reais antes de chegarem ao backend.

### Critérios de aceite

- [ ] Os três handlers de fechamento usam `$transaction` com `Serializable`.
- [ ] Re-checagem de status acontece **dentro** da transação.
- [ ] Duas requisições simultâneas de fechamento no mesmo id → uma 200, uma 409. Nunca duas 200.
- [ ] Botões de fechar desabilitam durante o envio.

---

## Parte C — Testes das fórmulas financeiras

### Problema

`backend/package.json` não tem runner de teste, não existe nenhum arquivo de teste no
repo, e não existe CI. São ~8.600 linhas que calculam dinheiro real entre a pizzaria, os
motoboys e os clientes. O histórico do projeto já registra que o módulo Caixa exigiu
correção de fórmula financeira uma vez.

Não é necessário cobertura ampla. É necessário blindar **as três funções que produzem
números que viram dinheiro**.

### Mudanças

**1. Adicionar Vitest ao backend**

`vitest` como devDependency, `"test": "vitest run"` e `"test:watch": "vitest"` nos
scripts. Vitest (não Jest) porque o frontend já usa Vite — mesma família de config, uma
ferramenta a menos para manter.

**2. Extrair os cálculos para funções puras**

Este é o ponto central da parte C: hoje a matemática está embutida nos handlers Express,
misturada com Prisma e `res.json`, o que a torna intestável sem subir servidor e banco.

Criar `backend/src/lib/financeiro.js` exportando funções puras (sem Prisma, sem I/O):

```js
/** Fechamento do turno do motoboy. Recebe dados já lidos, devolve os números. */
function calcularFechamentoTurno({ fundoTroco, pedidos, extras, valorPorEntrega, valorAluguelMoto })
// → { totalEntregas, totalExtras, valorDaNoite, totalRecebidoDinheiro, acerto, sangria }

/** Fechamento da sessão de caixa. */
function calcularFechamentoCaixa({ fundoTroco, comandas, movimentos })
// → { totalVendasDinheiro, totalVendasCartao, totalVendasPix, totalSangrias, totalSuprimentos, saldoFinalCalculado }
```

Os handlers passam a ler do banco, chamar a função pura e gravar. A lógica de negócio sai
da camada HTTP — melhora o design e torna testável.

**3. Casos de teste obrigatórios**

`backend/src/lib/__tests__/financeiro.test.js`:

*Fechamento de turno do motoboy:*
- Turno sem entregas e sem extras → `valorDaNoite` = só o aluguel; `acerto` negativo
  (pizzaria deve ao motoboy); `sangria` = 0.
- Entregas em dinheiro suficientes para cobrir `valorDaNoite` → `acerto` > 0 e
  `sangria === acerto`.
- `acerto` exatamente 0 → `sangria` = 0 (não negativo, não `-0`).
- **Fundo de troco nunca vira ganho:** dois cenários idênticos com `fundoTroco`
  diferente devem produzir o mesmo `acerto`. Este é o teste mais importante do arquivo.
- Pedidos com `cobradoNaEntrega: false` (pago antecipado via PIX/online) **não** entram
  em `totalRecebidoDinheiro`, mesmo com `paymentMethod: "DINHEIRO"`.
- Pedidos com `paymentMethod` de cartão não entram no dinheiro em espécie.
- Extras de todos os quatro tipos somam corretamente em `totalExtras`.

*Fechamento de caixa:*
- Breakdown correto por método (`DINHEIRO` / `PIX` / `CARTAO_CREDITO` + `CARTAO_DEBITO`).
- Cartão e PIX **não** entram em `saldoFinalCalculado` (só dinheiro compõe a gaveta).
- Sangria subtrai e suprimento soma no saldo esperado.
- Caixa sem nenhuma comanda → `saldoFinalCalculado === fundoTroco`.

*Precificação (`pdvPricing.js`, já é função pura):*
- Preço base + adicionais de sabor + borda.
- Pizza sem borda não soma borda.
- `modoAdicionalSabor` diferente de `CHEIO` lança erro.

**4. GitHub Action**

`.github/workflows/ci.yml`, rodando em push e PR para `main`:
`npm ci` → `npx prisma validate` → `npm test` (backend) → `npm run lint` (frontend).

### Critérios de aceite

- [ ] `npm test` no backend roda e passa.
- [ ] `backend/src/lib/financeiro.js` não importa Prisma nem nada de I/O.
- [ ] Todos os casos listados acima têm teste.
- [ ] CI verde no GitHub.

---

## Parte D — Endurecer o tratamento de forma de pagamento

### Contexto (corrigindo uma suposição)

`paymentMethod` é `String` livre no schema Prisma, mas **os validadores Joi já restringem**
a `DINHEIRO | PIX | CARTAO_CREDITO | CARTAO_DEBITO` tanto em `createOrderSchema` quanto
em `fecharComandaSchema`. Ou seja: dado criado pela API está consistente hoje, e as
comparações por string em `caixa.routes.js` (`CARTAO_METHODS`) e `motoboy.routes.js`
(`p.paymentMethod === "DINHEIRO"`) funcionam corretamente.

O risco é de **erosão**, não de bug ativo: o banco aceita qualquer string, então um seed,
uma correção manual em SQL, um import futuro ou uma integração de fase 2 (iFood/Anota Aí)
pode inserir `"Dinheiro"` ou `"dinheiro"` e o pedido **desaparece silenciosamente** do
cálculo de acerto do motoboy — sem erro, sem log, só dinheiro a menos na conta.

Esta parte é preventiva e barata. Não é emergência, mas é o tipo de coisa muito mais
cara de consertar depois que dado ruim já entrou.

### Mudanças

**1. Enum no schema**

```prisma
enum FormaPagamento {
  DINHEIRO
  PIX
  CARTAO_CREDITO
  CARTAO_DEBITO
}
```

Trocar `Order.paymentMethod` e `Comanda.paymentMethod` de `String`/`String?` para
`FormaPagamento`/`FormaPagamento?`. O banco passa a rejeitar valores fora da lista.

**2. Migration**

Como os valores existentes já estão restritos pelo Joi, a conversão deve ser direta. Ainda
assim, a migration precisa rodar `UPDATE` de normalização defensiva (upper case, trim)
**antes** do `ALTER TYPE`, e a migration deve falhar ruidosamente se sobrar qualquer valor
não mapeável — nunca converter silenciosamente para um default.

Conferir antes de gerar a migration:
```sql
SELECT DISTINCT "paymentMethod" FROM orders;
SELECT DISTINCT "paymentMethod" FROM comandas WHERE "paymentMethod" IS NOT NULL;
```

**3. Centralizar as constantes**

Mover `CARTAO_METHODS` de dentro de `caixa.routes.js` para `backend/src/lib/financeiro.js`
e usar a mesma constante nos dois módulos, para que caixa e motoboy nunca divirjam sobre
o que conta como cartão.

### Critérios de aceite

- [ ] `paymentMethod` é enum no schema em `Order` e `Comanda`.
- [ ] Migration aplicada; `SELECT DISTINCT` retorna só os 4 valores válidos.
- [ ] `CARTAO_METHODS` definido em um só lugar.
- [ ] Testes da parte C continuam passando.

---

## Fora de escopo deste spec

- Impressão térmica (spec-7).
- Qualquer tela nova (spec-8).
- Assinatura/onboarding de loja (spec-9).
- Refatorar o modelo de permissões do `MOTOBOY` (spec-9, parte de controle interno).
