/**
 * Calcula o preço final de uma pizza montada no PDV: preço base do tamanho +
 * soma dos adicionais de sabor (modo CHEIO) + adicional de borda, se houver.
 * Único ponto de ramificação do futuro modo PROPORCIONAL (não implementado).
 */
function calcularPrecoPizza({ pizzaSize, flavors, border, modoAdicionalSabor }) {
  if (modoAdicionalSabor !== "CHEIO") {
    throw new Error("Modo de cálculo de adicional de sabor não implementado.");
  }
  const base = Number(pizzaSize.price);
  const somaSabores = flavors.reduce((sum, f) => sum + Number(f.extraPrice), 0);
  const somaBorda = border ? Number(border.price) : 0;
  return base + somaSabores + somaBorda;
}

module.exports = { calcularPrecoPizza };
