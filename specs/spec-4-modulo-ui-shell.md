# Módulo: UI Shell — Sidebar Retrátil + Design System — Spec para Claude Code

> Spec autocontida. Cobre só a camada de apresentação/navegação (shell visual), não mexe em
> lógica de negócio dos módulos já em produção (Pedidos, PDV/Salão, Motoboy).

## Contexto compartilhado do projeto
- **Nome do SaaS:** Fornella.
- **Stack real:** React + Vite (frontend), Express + Prisma (backend), PostgreSQL (Supabase
  hospedado, só como banco relacional — NÃO usa Supabase Auth nem Storage).
- **Multi-tenant real:** cada pizzaria é um tenant independente (concorrentes da região, não
  matriz+filiais). Isolamento por `lojaId` obrigatório em qualquer query nova. Hoje rodando
  com 1 loja piloto; expansão pra outras pizzarias é o objetivo futuro — o shell deve já
  prever isso (ver seção Sidebar).
- **Roles:** SUPER_ADMIN, ADMIN, GERENTE, ATENDENTE, MOTOBOY. GERENTE/ATENDENTE já têm acesso
  às rotas operacionais (`/operacao/*`).
- **Módulos já em produção:** Pedidos/tele-entrega, PDV/Salão. Motoboy tem plano técnico
  pronto mas aguarda confirmação do cliente-piloto antes de deploy.
- **Situação atual do menu:** lateral estático, ficando cheio à medida que módulos de
  cadastro (produtos, sabores, tamanhos, ofertas, motoboys) são adicionados.

## Objetivo deste módulo
Criar a casca visual do admin: sidebar retrátil (expande/colapsa) + um componente genérico de
tela de cadastro (tabela + painel lateral de formulário) reaproveitável por todos os módulos
de cadastro, aplicando um design system consistente (cores, tipografia, badges, feedback) em
todo o sistema.

## Fora de escopo aqui
- **Command palette / busca global (Cmd+K)** — descartado por decisão explícita, não
  implementar.
- Alterar lógica de negócio, rotas de API ou models existentes.
- Reativar a vitrine pública/carrinho (arquivada, fora de escopo geral do projeto).

## Design tokens
- **Paleta de acento:** tom terracota/laranja-queimado (referência de fogo de forno) como cor
  de ação primária (botões, itens ativos do menu, links). Cinza neutro para estrutura. Verde
  para status "ativo/sucesso", âmbar para "pendente/atenção", vermelho para "erro/bloqueado".
- **Tipografia:** fonte sans padrão do sistema para UI geral. Fonte monoespaçada (tabular
  nums) para todo valor monetário e numérico em tabelas (preços, totais, saldos) — alinhamento
  visual limpo em colunas de valores, importante nas telas de caixa/fechamento.
- **Tema:** claro fixo, definitivo — não vai ter dark mode. Ainda assim, usar CSS variables
  pra cor em vez de hex solto nos componentes, só por boa prática de manutenção (facilita
  trocar tons depois), não como preparação pra tema escuro.
- **Ícones:** `lucide-react` em todo o sistema (sidebar, botões, badges, estados vazios).
  É outline (sem preenchimento), leve, tree-shakeable e evita a cara "emoji" — cada ícone é
  um componente React (`<Package size={18} />`), sem precisar de fonte externa.

## Sidebar retrátil
- Dois estados: **expandido** (~210–220px, ícone + rótulo) e **colapsado** (~56–64px, só
  ícone). Toggle no topo do menu.
- Persistir o estado colapsado por admin logado (localStorage é suficiente; não precisa
  campo no banco).
- Agrupar itens por seção, nesta ordem (frequência de uso, não alfabética):
  1. **Operação** — Pedidos, PDV/Caixa, Despacho motoboy
  2. **Cadastros** — Produtos, Sabores, Tamanhos e bordas, Ofertas, Motoboys, Operadores
  3. **Financeiro** — Fechamentos/turnos, Sangrias
  4. **Relatórios**
- Item da rota ativa destacado visualmente (cor de acento).
- Rodapé do menu: nome da loja ativa fixado (hoje é sempre a única loja do tenant logado; não
  precisa virar seletor agora — só preparar o espaço visual pra isso, já que a expansão
  multi-tenant é o próximo passo de negócio).
- Ícones: usar uma lib única e consistente em todo o menu (ver pergunta técnica abaixo).

## Padrão único de tela de cadastro
Aplica-se a: Produtos, Sabores, Tamanhos e bordas, Ofertas, Motoboys, Operadores.

- Componente genérico reaproveitável: **tabela** (colunas mínimas: nome, categoria/tipo, valor
  quando aplicável, status) + botão "Novo [item]" + **painel lateral (slide-over)** com o
  formulário de criação/edição.
- Seleção múltipla de linhas + ação em lote "Ativar/desativar selecionados".
- Exclusão sempre passa por modal de confirmação — nunca ação destrutiva direta em um clique.
- Cada módulo de cadastro só define seus próprios campos de formulário e colunas de tabela;
  a estrutura (tabela + slide-over + seleção em massa) é a mesma em todos.

## Feedback visual consistente
- **Badges de status** com cor fixa por significado, reaproveitados em todo o sistema (não só
  nos cadastros): verde = ativo/sucesso, cinza = inativo, âmbar = pendente, vermelho =
  erro/bloqueado. Mesma paleta usada em Pedidos (status do pedido), Caixa (turno
  aberto/fechado) e Cadastros (ativo/inativo).
- **Toasts de confirmação** para ações de salvar/excluir/ativar/desativar, substituindo
  qualquer `alert()`/`confirm()` nativo do navegador que exista hoje nessas telas.

## Escopo técnico sugerido
- Não requer novo model de banco — é só camada de apresentação.
- Componentizar em React: `Sidebar.jsx`, `CadastroTable.jsx` (genérico, recebe colunas +
  dados + handlers como props), `StatusBadge.jsx`, `ToastProvider`/`useToast`. Usar
  `lucide-react` como dependência nova (única lib nova deste módulo).
- **Sem lib de componentes de UI** (nada de shadcn/Material/Ant etc.) — o projeto já é 100%
  Tailwind, e o objetivo aqui é ganhar cara profissional através de consistência visual
  (mesmos tokens, mesmo padrão de tabela/formulário/badge em todo o sistema), não trocar a
  base técnica. Manter tudo em Tailwind puro + os componentes genéricos acima.
- **Escopo desta entrega: tudo em um único prompt.** Não faseado. Inclui: (1) shell (Sidebar +
  tokens + lucide-react), (2) componente genérico de cadastro aplicado às telas novas
  (Produtos, Sabores, Tamanhos/Bordas, Ofertas, Motoboys), (3) migração das telas já
  existentes (Pedidos, PDV, Kanban) pra usar o mesmo shell visual e os mesmos badges/toasts,
  sem alterar a lógica de negócio delas.

## Riscos / cuidados
- Não deixar cada tela de cadastro nova reimplementar tabela/formulário do zero — o ganho
  principal deste módulo é justamente forçar reaproveitamento do componente genérico.
- `lojaId` continua implícito em toda query (nenhum seletor de loja funcional é necessário
  agora); o espaço do seletor no rodapé do menu é só preparação visual.

## Observação de instalação
Única dependência nova deste módulo: `lucide-react` (`npm install lucide-react`). Nenhuma
outra lib de UI/componentes entra no projeto — tudo o resto é Tailwind + componentes React
próprios, como o restante do repo já é feito.
