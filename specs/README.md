# Specs — Ordem de Prioridade e Execução

Índice das specs do projeto. Specs 1–5 estão **implementadas**; 6–10 são o backlog
priorizado, gerado a partir da revisão de código de 2026-07-27.

## Implementadas (histórico)

| Spec | Módulo | Estado |
|---|---|---|
| [spec-1](spec-1-modulo-pedidos-tele-entrega-spec.md) | Pedidos / Tele-entrega | ✅ Implementado |
| [spec-2](spec-2-modulo-pdv-salao-spec.md) | PDV Salão (versão original) | ⚠️ Substituído pelo spec-5 |
| [spec-3](spec-3-modulo-motoboy-spec.md) | Motoboy — despacho + fechamento | ✅ Implementado, **sem teste E2E** |
| [spec-4](spec-4-modulo-ui-shell.md) | UI Shell | ✅ Implementado |
| [spec-5](spec-5-modulo-pdv-grade-spec.md) | PDV em grade configurável | ✅ Implementado |

## Backlog priorizado

| # | Spec | Esforço | Depende de | Por que nesta posição |
|---|---|---|---|---|
| ~~1~~ | ~~[spec-6 — Fundação multi-tenant e integridade financeira](spec-6-fundacao-multitenant-e-integridade-financeira.md)~~ | 1–1,5 dia | — | ✅ **Implementado em 2026-07-28.** |
| ~~2~~ | ~~[spec-7 — Impressão térmica](spec-7-impressao-termica.md)~~ | 2–3 dias | spec-6 | ✅ **Implementado em 2026-07-28.** Falta validar com impressora física no piloto. |
| ~~3~~ | ~~[spec-8 — Clientes (CRM) e KDS](spec-8-clientes-e-kds.md)~~ | 2 dias | spec-6 | ✅ **Implementado em 2026-07-29.** Migration aplicada em produção. |
| 4 | [spec-9 — Onboarding, assinatura e controle interno](spec-9-onboarding-assinatura-e-controle-interno.md) | 3 dias | spec-6 | Necessário antes do 2º cliente pagante. Inclui correção de controle interno do motoboy. |
| 5 | [spec-10 — Estoque e ficha técnica](spec-10-estoque-e-ficha-tecnica.md) | 1–2 semanas | spec-6, spec-8 | Dor real e sustenta a mensalidade a longo prazo, mas caro e depende de validação com o piloto. |

## Caminho crítico

```
spec-6 (fundação)      ✅ feito
   ├──> spec-7 (impressão) ✅ feito ─┐
   ├──> spec-8 (CRM + KDS) ✅ feito ─┼──> LANÇAMENTO REAL NO PILOTO
   └──> spec-9 (onboarding) ─────────┴──> 2º CLIENTE PAGANTE
                                        └──> spec-10 (estoque, após validação)
```

**Próxima spec de código: spec-9.** As pendências de validação (turno real do motoboy,
impressora física) continuam sendo o que de fato destrava o lançamento.

### Desvio do spec-8 ao implementar (2026-07-29)

- **`Cliente` não guardava telefone**, só `phoneHash` (HMAC irreversível) — o spec pedia
  telefone mascarado na lista sem notar que não havia número para mascarar. Resolvido com
  duas colunas: `phone` cifrado (exibir) e `phoneLast4` em claro (buscar por final).
- **Busca parcial por telefone foi implementada**, ao contrário do que o spec dizia
  ("impossível, não tentar"). É impossível sobre a cifra, não sobre uma coluna dedicada de
  4 dígitos. Buscar "o cliente do 1234" é como o atendente procura na prática.
- **O KDS não avança até `SAIU_PARA_ENTREGA`.** Essa transição exige motoboy com turno
  aberto, e a cozinha não tem essa informação — quem despacha é a tela de Despacho. A
  cozinha avança só `RECEBIDO → EM_PREPARO`; a terceira coluna é leitura.

**Próximo passo do spec-7 não é código:** o agente local nunca imprimiu em impressora
física. Instalar no PC do piloto (`agente-local/README.md`) e rodar
`npm run testar-impressora` é o que fecha o ciclo.

## Ação prioritária que não é código

O módulo Motoboy (spec-3) está implementado e com migration aplicada em produção, mas
**nunca foi testado ponta a ponta** e as 4 perguntas de negócio do fechamento continuam
sem confirmação formal do cliente-piloto.

**Rodar um turno real com o dono da pizzaria ao lado** resolve as 4 perguntas, valida as
fórmulas de acerto/sangria e revela as lacunas de impressão melhor do que qualquer análise
de código. Isso deve acontecer em paralelo ao spec-6 — não depende de nenhum código novo.
