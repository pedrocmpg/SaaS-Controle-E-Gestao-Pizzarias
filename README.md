# E Tenho Ditto Pizzaria - Site + Sistema de Pedidos

Site institucional com cardápio online, monta-pizza, carrinho, checkout via
WhatsApp e painel administrativo para gerenciar pedidos.

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Prisma
- **Banco de dados**: PostgreSQL (hospedado no [Supabase](https://supabase.com))

---

## Estrutura do projeto

```
.
├── backend/     API REST (Express + Prisma)
└── frontend/    Site (React + Vite + Tailwind)
```

---

## 1. Configurando o banco de dados no Supabase

1. Crie uma conta em [supabase.com](https://supabase.com) e crie um novo projeto
   (escolha uma senha forte para o banco - guarde ela).
2. No painel do projeto, vá em **Project Settings → Database**.
3. Copie as duas connection strings:
   - **Connection pooling** (porta `6543`) → vai na variável `DATABASE_URL`
   - **Direct connection** (porta `5432`) → vai na variável `DIRECT_URL`
4. Cole essas strings no arquivo `backend/.env` (veja o passo 2 abaixo).

> A conexão via pooling é usada em produção/runtime. A conexão direta é
> usada apenas pelo Prisma para rodar migrations.

---

## 2. Configurando e rodando o backend

```bash
cd backend
cp .env.example .env
```

Edite o arquivo `backend/.env` e preencha:

```
DATABASE_URL="postgresql://postgres:[SUA_SENHA]@[SEU_PROJETO].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[SUA_SENHA]@db.[SEU_PROJETO].supabase.co:5432/postgres"
JWT_SECRET="gere-uma-string-aleatoria-longa-aqui"
ADMIN_EMAIL="seu-email@exemplo.com"
ADMIN_PASSWORD="uma-senha-forte-para-o-painel"
```

Instale as dependências e crie as tabelas no banco:

```bash
npm install
npm run prisma:migrate   # cria as tabelas no Supabase
npm run seed              # popula o cardápio completo + cria o usuário admin
```

Inicie o servidor:

```bash
npm run dev
```

A API vai rodar em `http://localhost:3333`. Teste em `http://localhost:3333/api/health`.

### Rotas principais da API

| Método | Rota                      | Descrição                              | Protegida |
|--------|---------------------------|-----------------------------------------|-----------|
| GET    | `/api/catalog`             | Tamanhos, sabores, bordas e produtos    | Não       |
| GET    | `/api/settings`            | Dados da loja (endereço, horários...)   | Não       |
| POST   | `/api/orders`               | Cria um novo pedido                     | Não       |
| POST   | `/api/auth/login`           | Login do admin                          | Não       |
| GET    | `/api/orders`               | Lista pedidos                           | Sim       |
| PATCH  | `/api/orders/:id/status`    | Atualiza status de um pedido            | Sim       |
| POST/PUT/DELETE | `/api/catalog/*`  | Gerencia sabores, bordas, produtos      | Sim       |
| PUT    | `/api/settings`             | Atualiza dados da loja                  | Sim       |

---

## 3. Configurando e rodando o frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

O site abre em `http://localhost:5173`.

Se o `VITE_API_URL` no `.env` do frontend não apontar para o backend correto,
edite a linha:

```
VITE_API_URL=http://localhost:3333/api
```

> **Modo vitrine**: se o backend/banco ainda não estiver configurado, o site
> continua funcionando com dados de exemplo fictícios (fallback) para fins de
> apresentação. O cardápio (`/cardapio`) precisa do backend rodando, pois os
> sabores vêm do banco.

---

## 4. Acessando o Painel Administrativo

Acesse `http://localhost:5173/admin` e entre com o e-mail/senha definidos em
`ADMIN_EMAIL` / `ADMIN_PASSWORD` no `.env` do backend (usados no `npm run seed`).

No painel é possível:
- Ver todos os pedidos recebidos
- Filtrar por status
- Atualizar o status do pedido (Pendente → Confirmado → Em preparo → Saiu para entrega → Entregue)

---

## 5. Dados fictícios usados (ajustar antes de publicar)

- **Telefone/WhatsApp**: `5554999999999` — número fictício, atualizar em
  `StoreSettings` (via painel ou editando `backend/prisma/seed.js` e rodando
  `npm run seed` novamente).
- **Taxa de entrega**: R$ 10 a R$ 20 (informado pelo cliente)
- **Tempo de entrega**: 40 a 70 min (informado pelo cliente)

---

## 6. Deploy (sugestão)

- **Backend**: [Render](https://render.com) ou [Railway](https://railway.app) (grátis para projetos pequenos)
- **Frontend**: [Vercel](https://vercel.com) ou [Netlify](https://netlify.com)
- **Banco**: já está no Supabase

Lembre-se de configurar as variáveis de ambiente (`DATABASE_URL`, `DIRECT_URL`,
`JWT_SECRET`, `FRONTEND_URL`) no serviço de hospedagem do backend, e
`VITE_API_URL` apontando para a URL pública da API no serviço do frontend.

---

## 7. Scripts úteis

**Backend** (`backend/`):
```bash
npm run dev              # servidor em modo desenvolvimento
npm run prisma:migrate   # cria/atualiza tabelas no banco
npm run seed              # repopula cardápio e recria o admin
```

**Frontend** (`frontend/`):
```bash
npm run dev      # servidor de desenvolvimento
npm run build    # build de produção (gera pasta dist/)
npm run lint     # verifica problemas no código
```
