# Módulo: Motoboy — Despacho + Fechamento/Sangria — Spec para Claude Code

> Spec autocontido. É o DIFERENCIAL do projeto. Um dos 3 módulos do hub.
> ⚠️ Status: NÃO iniciar implementação ainda — depende de 4 respostas do cliente (ver fim).
> Existe só um HTML de fechamento feito à parte (não commitado), que é uma peça inicial.

## Contexto compartilhado do projeto
- **Stack real:** PostgreSQL via **Prisma + Express** + React/Vite. NÃO usa Supabase Auth nem
  Storage (CLAUDE.md desatualizado — ignorar).
- **Multi-tenant real:** cada pizzaria é tenant INDEPENDENTE (concorrentes). Isolamento
  obrigatório. Começa por 1 pizzaria (piloto RS).
- **Roles:** SUPER_ADMIN, ADMIN, GERENTE, ATENDENTE (já liberados nas rotas operacionais).
- **NÃO existe código de Motoboy no repo** (busca por motoboy/despacho/sangria/entregador = 0).
  Construir do zero. Consome os pedidos do módulo Pedidos/tele-entrega.
- Emissão fiscal → fora de escopo. Integrações externas → fase 2.

## Objetivo
Duas partes:
1. **Despacho:** pegar pedidos de tele-entrega prontos e associar a um entregador.
2. **Fechamento/sangria (o diferencial):** ao fim do turno, calcular o acerto do motoboy —
   quanto ele deve à pizzaria ou a pizzaria deve a ele — e a sangria correta.

## Integração com o módulo Pedidos
- Consome pedidos no status `SAIU_PARA_ENTREGA` (enum `OrderStatus` já existe:
  `RECEBIDO → EM_PREPARO → SAIU_PARA_ENTREGA → ENTREGUE → CANCELADO`).
- Precisa dos campos do pedido: telefone, endereço, valor total, forma de pagamento, e se foi
  pago online/antecipado ou é pra cobrar na entrega. ⚠️ Confirmar que o módulo Pedidos grava
  se o pagamento é antecipado (online/PIX) ou na entrega (dinheiro/cartão) — é o que a lógica
  de fechamento depende.
- Cada entrega vira uma "comanda" do motoboy, vinculada à sessão/turno de tele-entrega.

## Lógica de fechamento (já trabalhada com o cliente em outra conversa)
Princípios definidos:
- Separar comandas por tipo de pagamento: **pago antecipado (online/PIX)** vs **cobrado na
  entrega (dinheiro ou cartão)**.
- **Isolar o dinheiro em espécie:** do total cobrado na entrega, subtrair o relatório da
  maquininha de cartão → sobra o que é dinheiro vivo na mão do motoboy.
- **Ganho do motoboy na noite:** nº de entregas × R$14 + extras + R$20 de aluguel da moto.
- **Acerto:** diferença entre o dinheiro que o motoboy segura e o total da noite — a pizzaria
  paga ou recebe a diferença.
- **Regra de sangria (unificada):** sangria = SÓ a parte do pagamento do motoboy que saiu
  fisicamente do caixa em dinheiro. Transferência via PIX NUNCA conta como sangria.

## ⚠️ 4 perguntas pendentes com o cliente (bloqueiam a implementação final)
Estas estão no HTML enviado ao cliente e ainda aguardam resposta:
1. `valor_da_noite` inclui extras e aluguel, ou é só (entregas × R$14)?
2. O acerto é feito toda noite ou semanalmente?
3. O aluguel de R$20 da moto é por noite ou por semana — e o dinheiro vai em qual direção
   (motoboy paga a pizzaria, ou vice-versa)?
4. Os valores de cartão são sempre digitados manualmente do relatório da maquininha, ou dá pra
   etiquetar por comanda pra reconciliar automático?

## Perguntas técnicas adicionais (a resolver no design)
5. Um turno pode ter vários motoboys? O fechamento é por motoboy ou consolidado da noite?
6. Precisa de tela de despacho ao vivo (quem tá em rota, quantas entregas cada um) ou só o
   fechamento no fim?
7. Extras (o que são: entregas longas, gorjeta, ajuda de custo?) — como são lançados?
8. O R$14/entrega e o R$20/aluguel são fixos ou configuráveis por loja (pra quando expandir)?

## Fora de escopo
- Emissão fiscal
- Integrações externas (fase 2)
- Roteirização/GPS de entrega (não pedido)
