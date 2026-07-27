/**
 * Cálculos financeiros de fechamento — funções PURAS.
 *
 * Nada aqui pode importar Prisma, fazer I/O ou tocar em `req`/`res`: são os números que
 * viram dinheiro real entre a pizzaria, os motoboys e os clientes, e precisam ser
 * testáveis sem subir servidor nem banco. Os handlers leem do banco, chamam estas
 * funções e gravam o resultado.
 */

/** O que conta como cartão. Definido aqui para que caixa e motoboy nunca divirjam. */
const CARTAO_METHODS = ["CARTAO_CREDITO", "CARTAO_DEBITO"];

/** Decimal do Prisma, string ou número → number. */
const num = (v) => Number(v ?? 0);

/**
 * Fechamento do turno do motoboy.
 *
 * @param {object} params
 * @param {*} params.fundoTroco          Fundo de troco entregue na abertura do turno.
 * @param {Array} params.pedidos         Pedidos ENTREGUE do turno ({ paymentMethod, cobradoNaEntrega, totalPrice }).
 * @param {Array} params.extras          Extras lançados no turno ({ valor }).
 * @param {*} params.valorPorEntrega     Valor pago ao motoboy por entrega.
 * @param {*} params.valorAluguelMoto    Aluguel da moto na noite.
 * @returns {{ totalEntregas: number, totalExtras: number, valorDaNoite: number,
 *            totalRecebidoDinheiro: number, acerto: number, sangria: number }}
 */
function calcularFechamentoTurno({ fundoTroco, pedidos = [], extras = [], valorPorEntrega, valorAluguelMoto }) {
  const fundo = num(fundoTroco);
  const totalEntregas = pedidos.length;
  const totalExtras = extras.reduce((sum, e) => sum + num(e.valor), 0);
  const valorDaNoite = totalEntregas * num(valorPorEntrega) + totalExtras + num(valorAluguelMoto);

  // Dinheiro físico que o motoboy está segurando = fundo de troco inicial + entregas cobradas
  // em dinheiro NA ENTREGA. Pedido pago antecipado (PIX/online) não gera espécie na mão dele,
  // mesmo que o paymentMethod seja DINHEIRO.
  const recebidoEmEspecie = pedidos
    .filter((p) => p.cobradoNaEntrega && p.paymentMethod === "DINHEIRO")
    .reduce((sum, p) => sum + num(p.totalPrice), 0);
  const totalRecebidoDinheiro = fundo + recebidoEmEspecie;

  // O fundo de troco é capital de giro e sempre volta inteiro — é descontado antes de
  // comparar com o valorDaNoite para que nunca vire ganho de ninguém.
  const acerto = totalRecebidoDinheiro - fundo - valorDaNoite;
  // acerto > 0: motoboy está com mais dinheiro do que devia → repassa a diferença (sangria).
  // acerto <= 0: pizzaria deve ao motoboy → nunca vira sangria.
  const sangria = acerto > 0 ? acerto : 0;

  return { totalEntregas, totalExtras, valorDaNoite, totalRecebidoDinheiro, acerto, sangria };
}

/**
 * Fechamento da sessão de caixa.
 *
 * @param {object} params
 * @param {*} params.fundoTroco     Fundo de troco da abertura.
 * @param {Array} params.comandas   Comandas da sessão ({ paymentMethod, totalPrice }).
 * @param {Array} params.movimentos Movimentos da sessão ({ tipo: SANGRIA|SUPRIMENTO, valor }).
 * @returns {{ totalVendasDinheiro: number, totalVendasCartao: number, totalVendasPix: number,
 *            totalSangrias: number, totalSuprimentos: number, saldoFinalCalculado: number }}
 */
function calcularFechamentoCaixa({ fundoTroco, comandas = [], movimentos = [] }) {
  const somarPor = (metodos) =>
    comandas.filter((c) => metodos.includes(c.paymentMethod)).reduce((sum, c) => sum + num(c.totalPrice), 0);
  const somarMovimento = (tipo) =>
    movimentos.filter((m) => m.tipo === tipo).reduce((sum, m) => sum + num(m.valor), 0);

  const totalVendasDinheiro = somarPor(["DINHEIRO"]);
  const totalVendasCartao = somarPor(CARTAO_METHODS);
  const totalVendasPix = somarPor(["PIX"]);
  const totalSangrias = somarMovimento("SANGRIA");
  const totalSuprimentos = somarMovimento("SUPRIMENTO");

  // Cartão/PIX nunca entram na gaveta — só dinheiro compõe o saldo em espécie esperado.
  const saldoFinalCalculado = num(fundoTroco) + totalVendasDinheiro - totalSangrias + totalSuprimentos;

  return {
    totalVendasDinheiro,
    totalVendasCartao,
    totalVendasPix,
    totalSangrias,
    totalSuprimentos,
    saldoFinalCalculado,
  };
}

module.exports = { CARTAO_METHODS, calcularFechamentoTurno, calcularFechamentoCaixa };
