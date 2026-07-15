# Hub de Gestão para Pizzarias

Hub interno de gestão (staff-facing, tipo "TEKNISA simplificado") para pizzarias.
Modelo de negócio: mensalidade de R$500–1000/mês por pizzaria. Cliente-piloto: rede
de 3-4 unidades no Rio Grande do Sul.

> **Não é** um site/carrinho público para cliente final. Esse fluxo (vitrine,
> monta-pizza, checkout self-service) existiu numa versão anterior do projeto e
> foi arquivado — comentado no código, não deletado — após o pivô decidido em
> conversa com o cliente-piloto. Não reativar sem pedido explícito.

- **Frontend**: React + Vite (SPA) + React Router + Tailwind CSS
- **Backend**: Node.js + Express + Prisma
- **Banco de dados**: PostgreSQL puro via `DATABASE_URL` (sem Supabase Auth nem
  Supabase Storage)

Para o contexto completo do projeto (arquitetura, decisões, pendências), ver
[`CLAUDE.md`](./CLAUDE.md). Specs dos módulos:
[`spec-1-modulo-pedidos-tele-entrega-spec.md`](./spec-1-modulo-pedidos-tele-entrega-spec.md),
[`spec-2-modulo-pdv-salao-spec.md`](./spec-2-modulo-pdv-salao-spec.md),
[`spec-3-modulo-motoboy-spec.md`](./spec-3-modulo-motoboy-spec.md).

---

## ⚠️ Arquitetura: multi-tenant real, não é rede matriz+filiais

Os tenants são **pizzarias independentes**, concorrentes entre si na mesma
região — não uma única rede com matriz e filiais. Isolamento de dados entre
pizzarias diferentes é obrigatório e não-negociável.

Desenvolvimento atual é focado em 1 pizzaria (o piloto), mas schema e
arquitetura precisam já nascer prontos para receber outras pizzarias sem
refatoração grande.

**Pendência técnica ativa:** o cardápio (`PizzaSize`, `Flavor`, `Border`,
`Product`) hoje é GLOBAL no banco, sem `lojaId`. Precisa ser corrigido antes de
expandir para outro tenant — é o primeiro item da ordem de trabalho abaixo.

---

## Os 3 módulos do hub

| Módulo | Status |
|---|---|
| **1. Pedidos / Tele-entrega** | Pronto pra atacar — spec completo disponível |
| **2. PDV — Salão/Rodízio** | Escopo a confirmar com cliente (rodízio por pessoa ou fixo, catálogo de bebidas, caixa único ou separado) |
| **3. Motoboy** — despacho + fechamento/sangria | 🚫 Bloqueado — aguardando 4 respostas do cliente sobre a lógica de fechamento |

### Ordem de trabalho sugerida
1. Adicionar `lojaId` ao cardápio — destrava multi-tenant real
2. Módulo Pedidos/tele-entrega completo
3. Módulo PDV/salão
4. Módulo Motoboy — só quando o cliente responder as 4 perguntas de fechamento

---

## Estrutura do projeto

```
.
├── backend/     API REST (Express + Prisma)
└── frontend/    Hub de gestão (React + Vite + Tailwind)
```

---

## 1. Configurando o banco de dados

O projeto usa PostgreSQL puro (não depende de Supabase Auth/Storage — só do
Postgres via `DATABASE_URL`). Pode ser uma instância local, um Postgres gerenciado
(Supabase, Railway, RDS etc.) ou qualquer outro provedor — o que importa é a
connection string.

---

## 2. Configurando e rodando o backend

```bash
cd backend
cp .env.example .env
```

Edite o arquivo `backend/.env` e preencha pelo menos:

```
DATABASE_URL="postgresql://usuario:senha@host:porta/banco"
JWT_SECRET="gere-uma-string-aleatoria-longa-aqui"   # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
FRONTEND_URL="http://localhost:5173"
REDIS_URL="redis://localhost:6379"
```

Veja `backend/.env.example` para a lista completa de variáveis (CORS whitelist,
2FA/TOTP, Redis para blacklist de tokens, etc.).

Instale as dependências e crie as tabelas no banco:

```bash
npm install
npm run prisma:migrate   # cria/atualiza as tabelas
npm run seed              # popula dados iniciais + cria o admin
```

Inicie o servidor:

```bash
npm run dev
```

A API roda em `http://localhost:3333`. Teste em `http://localhost:3333/api/health`.

---

## 3. Configurando e rodando o frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

O hub abre em `http://localhost:5173`. Se `VITE_API_URL` não apontar para o
backend correto, edite `frontend/.env`:

```
VITE_API_URL=http://localhost:3333/api
```

---

## 4. Autenticação e papéis (roles)

Auth própria (JWT em cookie HttpOnly + Bearer opcional), bcrypt, 2FA via TOTP
com backup codes. Audit log (`AuditLog`) registra ações de admins.

Roles: `SUPER_ADMIN`, `ADMIN`, `GERENTE`, `ATENDENTE`.

- `GERENTE` e `ATENDENTE` já têm acesso liberado nas rotas operacionais
  (`/admin/dashboard`, `/operacao/*`, incluindo `/operacao/pedidos`).
- Só `/admin/operadores` (cadastro de operadores) é restrita a `SUPER_ADMIN`.

Login em `http://localhost:5173/admin` com e-mail/senha definidos em
`ADMIN_EMAIL` / `ADMIN_PASSWORD` (usados no `npm run seed`).

---

## 5. Deploy (sugestão)

- **Backend**: Render ou Railway
- **Frontend**: Vercel ou Netlify
- **Banco**: qualquer Postgres gerenciado

Configure as variáveis de ambiente (`DATABASE_URL`, `JWT_SECRET`,
`FRONTEND_URL`, `REDIS_URL`) no serviço de hospedagem do backend, e
`VITE_API_URL` apontando para a URL pública da API no serviço do frontend.

---

## 6. Scripts úteis

**Backend** (`backend/`):
```bash
npm run dev              # servidor em modo desenvolvimento
npm run prisma:migrate   # cria/atualiza tabelas no banco (dev)
npm run prisma:deploy    # aplica migrations (produção)
npm run seed              # popula dados iniciais e recria o admin
```

**Frontend** (`frontend/`):
```bash
npm run dev      # servidor de desenvolvimento
npm run build    # build de produção (gera pasta dist/)
npm run lint     # verifica problemas no código
```

---

## Fora de escopo (não construir sem pedir)

- Emissão fiscal (NFC-e/NF-e)
- Integração real com Microsip (CTI), iFood, Anota Aí, WhatsApp Business API —
  tudo fase 2
- Qualquer coisa do fluxo de cliente final (vitrine pública, carrinho
  self-service) — arquivada, comentada no código, não deletada
