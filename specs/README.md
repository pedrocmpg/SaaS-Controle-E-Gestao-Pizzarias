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
| 1 | [spec-6 — Fundação multi-tenant e integridade financeira](spec-6-fundacao-multitenant-e-integridade-financeira.md) | 1–1,5 dia | — | Bloqueia o 2º tenant e protege cálculo de dinheiro. Nada novo antes disto. |
| 2 | [spec-7 — Impressão térmica](spec-7-impressao-termica.md) | 2–3 dias | spec-6 | Bloqueador comercial: sem imprimir, o hub é um downgrade vs. o fluxo atual da pizzaria. |
| 3 | [spec-8 — Clientes (CRM) e KDS](spec-8-clientes-e-kds.md) | 2 dias | spec-6 | Maior valor percebido por esforço — o dado e o WebSocket já existem e estão ociosos. |
| 4 | [spec-9 — Onboarding, assinatura e controle interno](spec-9-onboarding-assinatura-e-controle-interno.md) | 3 dias | spec-6 | Necessário antes do 2º cliente pagante. Inclui correção de controle interno do motoboy. |
| 5 | [spec-10 — Estoque e ficha técnica](spec-10-estoque-e-ficha-tecnica.md) | 1–2 semanas | spec-6, spec-8 | Dor real e sustenta a mensalidade a longo prazo, mas caro e depende de validação com o piloto. |

## Caminho crítico

```
spec-6 (fundação)
   ├──> spec-7 (impressão) ─┐
   ├──> spec-8 (CRM + KDS) ─┼──> LANÇAMENTO REAL NO PILOTO
   └──> spec-9 (onboarding) ┴──> 2º CLIENTE PAGANTE
                                        └──> spec-10 (estoque, após validação)
```

Specs 7, 8 e 9 são independentes entre si — podem ser feitas em qualquer ordem depois do
spec-6. A ordem sugerida acima é por risco comercial.

## Ação prioritária que não é código

O módulo Motoboy (spec-3) está implementado e com migration aplicada em produção, mas
**nunca foi testado ponta a ponta** e as 4 perguntas de negócio do fechamento continuam
sem confirmação formal do cliente-piloto.

**Rodar um turno real com o dono da pizzaria ao lado** resolve as 4 perguntas, valida as
fórmulas de acerto/sangria e revela as lacunas de impressão melhor do que qualquer análise
de código. Isso deve acontecer em paralelo ao spec-6 — não depende de nenhum código novo.
