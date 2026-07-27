# Spec-9 — Onboarding de Loja, Assinatura e Controle Interno

**Prioridade:** 4 (necessário antes do segundo cliente pagante)
**Esforço estimado:** 3 dias
**Depende de:** spec-6 (obrigatório — sem o fim do fallback de `lojaId`, uma segunda loja
é perigosa)

---

## Contexto

O produto é vendido como SaaS por mensalidade de R$500–1000/mês por pizzaria, mas **não
existe nenhum artefato de SaaS no código**: não há model de assinatura, plano, status de
pagamento, nem qualquer fluxo de criação de loja. Hoje, adicionar a segunda pizzaria exige
`INSERT` manual no banco e criação manual do primeiro admin.

Isso significa que, do jeito que está, cada cliente novo é trabalho manual do dev — o que
não escala e é exatamente o oposto do modelo de negócio pretendido. Este spec transforma o
sistema de "instalação única do piloto" em "produto multi-tenant operável".

O spec também inclui uma correção de **controle interno** identificada na revisão de
código: o motoboy pode fechar o próprio turno.

---

## Parte A — Controle interno: motoboy não fecha o próprio turno

### Problema

Em `backend/src/routes/motoboy.routes.js`:

```js
const TURNO_MOTOBOY_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE", "ATENDENTE", "MOTOBOY"];
```

Essa lista governa `POST /turnos/abrir`, `POST /turnos/:id/extras` e
`POST /turnos/:id/fechar`. Como `requireAnyRole` valida apenas a role (ignora o mapa
`permissions`, onde `MOTOBOY` tem `[]`), um motoboy logado pode **fechar o próprio turno**
e **lançar os próprios extras** (gorjeta, ajuda de custo, entrega longa).

Ou seja: a pessoa que está segurando o dinheiro em espécie declara sozinha quanto recebeu e
quanto lhe é devido. Num produto cujo diferencial de venda é justamente o acerto do
motoboy, esse é o tipo de furo que destrói a confiança do cliente na primeira vez que der
divergência de caixa.

Não há indício de que isso tenha sido uma decisão deliberada — o comentário no código
(*"operadores + o próprio motoboy (se logar no sistema)"*) sugere conveniência de acesso,
não uma escolha de controle.

### Mudanças

Separar a lista única em três, por nível de risco:

```js
// Ver o próprio turno / despacho: inclui o motoboy.
const TURNO_LEITURA_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE", "ATENDENTE", "MOTOBOY"];
// Abrir turno e lançar extras: só operadores da loja. Extra é dinheiro — quem lança não é quem recebe.
const TURNO_ESCRITA_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE", "ATENDENTE"];
// Fechar turno (calcula acerto/sangria): GERENTE+.
const TURNO_FECHAMENTO_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE"];
// Conferência do dia seguinte: já está correto.
const CONFERENCIA_MOTOBOY_ROLES = ["SUPER_ADMIN", "ADMIN", "GERENTE"];
```

Aplicar `TURNO_LEITURA_ROLES` nos `GET`, `TURNO_ESCRITA_ROLES` em `/turnos/abrir` e
`/turnos/:id/extras`, `TURNO_FECHAMENTO_ROLES` em `/turnos/:id/fechar`.

**Regra de segregação adicional:** em `/turnos/:id/fechar`, rejeitar com 403 se
`req.admin.id === turno.motoboyId`, mesmo que a role permita. Cobre o caso de um motoboy
que também tenha role de GERENTE (acontece em pizzaria pequena, onde o dono também entrega).

Confirmar com o cliente-piloto se o motoboy chega a logar no sistema. Se não logar, a
role `MOTOBOY` existe só para aparecer no dropdown de atribuição, e o endurecimento acima
não tem custo operacional nenhum.

---

## Parte B — Assinatura e ciclo de vida da loja

### Modelo

```prisma
enum StatusAssinatura {
  TRIAL
  ATIVA
  INADIMPLENTE
  SUSPENSA
  CANCELADA
}

/// Assinatura da pizzaria (SaaS por mensalidade). 1:1 com Loja.
model Assinatura {
  id     Int  @id @default(autoincrement())
  lojaId Int  @unique
  loja   Loja @relation(fields: [lojaId], references: [id])

  status         StatusAssinatura @default(TRIAL)
  valorMensal    Decimal          @db.Decimal(10, 2)
  diaVencimento  Int              @default(10)

  trialAte       DateTime?
  ativaDesde     DateTime?
  suspensaEm     DateTime?
  canceladaEm    DateTime?
  /// Anotação livre do operador do SaaS (ex.: "pagou por PIX dia 12, fora do ciclo").
  observacoes    String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("assinaturas")
}
```

Adicionar em `Loja`: `ativa Boolean @default(true)` e a relação `assinatura Assinatura?`.

**Decisão explícita:** cobrança é **manual** nesta fase (boleto/PIX combinado direto com o
dono). Não integrar gateway de pagamento. Com 1 a 5 clientes, integrar Stripe/Asaas é
custo sem retorno — o campo `status` é atualizado à mão pelo `SUPER_ADMIN`. Quando houver
volume que justifique, o schema já suporta plugar o gateway sem migration estrutural.

### Enforcement

Middleware `backend/src/middleware/assinaturaAtiva.js`, aplicado **depois** de `requireAuth`
nas rotas operacionais:

- `SUSPENSA` ou `CANCELADA` → bloqueia com `402 Payment Required` e mensagem clara
  ("Assinatura suspensa. Entre em contato."). `SUPER_ADMIN` global nunca é bloqueado.
- `INADIMPLENTE` → **não bloqueia**. Retorna um header/flag que o frontend usa para exibir
  um banner de aviso. Cortar o sistema de uma pizzaria no meio da noite de sábado por
  atraso de 2 dias é perder o cliente, não cobrá-lo.
- `TRIAL` expirado → mesmo tratamento de `SUSPENSA`.

Cachear o status da assinatura (Redis já está no projeto, TTL de 5 min) para não consultar
o banco a cada requisição.

---

## Parte C — Onboarding de loja

### Backend — `backend/src/routes/lojas.routes.js`

Restrito a `SUPER_ADMIN` global (`lojaId === null`).

**`POST /api/lojas`** — cria loja + admin inicial + assinatura, em `$transaction`:
1. `Loja` com os dados cadastrais (criptografando `whatsapp`/`phone`/`address`, como já é feito).
2. `LojaConfig` com defaults.
3. `Admin` inicial com role `ADMIN` e `lojaId` da nova loja, com senha temporária gerada.
4. `Assinatura` em `TRIAL`, com `trialAte` = hoje + 14 dias.

Retorna as credenciais iniciais **uma única vez** (não persistir a senha em claro).

**`GET /api/lojas`** — lista todas as lojas com status de assinatura (painel do dono do SaaS).
**`PATCH /api/lojas/:id/assinatura`** — atualiza `status`, `valorMensal`, `observacoes`.
**`PATCH /api/lojas/:id`** — edita dados cadastrais.

### Importante: a loja nasce vazia

Isso é lei registrada do projeto: *"Cadastro e parametrização é uma lei geral para este
projeto, liberdade para o cliente"* e o sistema **nasce vazio, sem seed**. O onboarding
**não** copia cardápio, grade de PDV ou grupos de outra loja. Cada pizzaria monta o seu.
Como as pizzarias são concorrentes na mesma praça, copiar cardápio entre tenants seria
vazamento de dado comercial.

O que o onboarding deve entregar é um **checklist de configuração** na tela, guiando o novo
cliente: cadastrar tamanhos → sabores → bordas → produtos → montar grade do PDV →
cadastrar operadores → cadastrar motoboys → configurar valores do motoboy. Sem isso, o
cliente abre o sistema, vê tudo vazio e não sabe por onde começar — que é o momento de
maior risco de churn.

### Frontend

- `frontend/src/pages/admin/AdminLojas.jsx` — painel do dono do SaaS: lista de lojas,
  status de assinatura, criar loja, alterar status. Rota `admin/lojas`, só `SUPER_ADMIN`.
- Checklist de onboarding no dashboard, exibido enquanto houver itens pendentes (detectado
  por contagem: 0 tamanhos, 0 sabores, 0 botões de PDV, etc.).
- Banner de `INADIMPLENTE` no shell.
- Tela de bloqueio para `SUSPENSA`, com contato.

---

## Parte D — Trocar o seletor de loja do SUPER_ADMIN

Após o spec-6, o `SUPER_ADMIN` global precisa informar `lojaId` explicitamente por body ou
query em toda requisição, o que é inviável na prática pela UI atual.

Adicionar um seletor de loja no header, visível só para `SUPER_ADMIN` global, que guarda a
loja escolhida e a envia automaticamente (interceptor do axios, adicionando `lojaId` na
query). Sem isso, o `SUPER_ADMIN` fica sem conseguir operar depois do spec-6.

---

## Critérios de aceite

- [ ] Motoboy não consegue fechar o próprio turno nem lançar os próprios extras (403).
- [ ] `SUPER_ADMIN` cria uma segunda loja pela UI, com admin inicial funcional.
- [ ] A segunda loja nasce com cardápio, grade e clientes **vazios** — zero cruzamento
      com a loja piloto.
- [ ] Login na loja B não enxerga nenhum dado da loja A (validar em pedidos, comandas,
      caixa, turnos, clientes e cardápio).
- [ ] Assinatura `SUSPENSA` bloqueia com 402; `INADIMPLENTE` só mostra banner.
- [ ] Checklist de onboarding aparece na loja nova e some conforme é preenchido.
- [ ] Seletor de loja funciona para `SUPER_ADMIN`.

---

## Teste obrigatório de isolamento

Antes de considerar este spec concluído, executar manualmente com duas lojas reais no
banco: logar como operador da loja B e tentar acessar, por id direto na URL/API, um pedido,
comanda, sessão de caixa e turno de motoboy da loja A. **Todos devem retornar 404**, nunca
403 e nunca o dado. Documentar o resultado.

Este teste é o que separa "multi-tenant no schema" de "multi-tenant de verdade", e é a
única evidência aceitável para vender ao segundo cliente.

---

## Fora de escopo

- Gateway de pagamento / cobrança automática.
- Autoatendimento de cadastro (a pizzaria não se cadastra sozinha — é venda consultiva).
- Planos com features diferentes. Um plano único por enquanto.
- Domínio/subdomínio por loja.
