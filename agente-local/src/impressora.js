/**
 * Ponte entre o payload do backend e a impressora ESC/POS.
 *
 * Este módulo NÃO conhece regra de negócio: o backend manda linhas já formatadas, com um
 * estilo cada, e aqui só se decide fonte/negrito/tamanho. Se algum dia o layout mudar,
 * muda no backend (que tem teste) e o agente continua igual.
 */

const { printer: ThermalPrinter, types: PrinterTypes } = require("node-thermal-printer");
const { IMPRESSORA_TIPO, IMPRESSORA_INTERFACE } = require("./config");
const log = require("./log");

const TIPOS = {
  epson: PrinterTypes.EPSON,
  star: PrinterTypes.STAR,
  tanca: PrinterTypes.TANCA,
  daruma: PrinterTypes.DARUMA,
  brother: PrinterTypes.BROTHER,
};

function novaImpressora() {
  const tipo = TIPOS[IMPRESSORA_TIPO];
  if (!tipo) {
    throw new Error(
      `IMPRESSORA_TIPO "${IMPRESSORA_TIPO}" nao e valido. Use um destes: ${Object.keys(TIPOS).join(", ")}`
    );
  }
  return new ThermalPrinter({
    type: tipo,
    interface: IMPRESSORA_INTERFACE,
    removeSpecialCharacters: false,
    options: { timeout: 5000 },
  });
}

/**
 * Aplica o estilo de uma linha. O backend só usa estes nomes; um estilo desconhecido cai
 * em texto normal, para nunca deixar de imprimir por causa de formatação.
 */
function aplicarEstilo(impressora, estilo) {
  impressora.alignLeft();
  impressora.bold(false);
  impressora.setTextNormal();

  switch (estilo) {
    case "titulo":
      impressora.bold(true);
      impressora.setTextSize(1, 1); // dobro de altura e largura
      break;
    case "destaque":
      // Observação do item e avisos: negrito com altura dobrada. É o que a cozinha lê
      // com pressa e pouca luz.
      impressora.bold(true);
      impressora.setTextSize(0, 1);
      break;
    case "item":
      impressora.bold(true);
      break;
    default:
      break;
  }
}

/**
 * Imprime um payload ({ titulo, linhas: [{ texto, estilo }] }).
 * Lança se a impressora não responder — quem trata o retry é a fila.
 */
async function imprimir(payload) {
  const impressora = novaImpressora();

  const conectada = await impressora.isPrinterConnected();
  if (!conectada) {
    throw new Error("A impressora nao respondeu. Verifique se esta ligada, com papel e conectada ao PC.");
  }

  impressora.clear();

  for (const linha of payload.linhas || []) {
    // "corte" separa as vias do romaneio: corta o papel e segue imprimindo a próxima.
    if (linha.estilo === "corte") {
      impressora.cut();
      continue;
    }
    aplicarEstilo(impressora, linha.estilo);
    impressora.println(linha.texto || "");
  }

  // Avanço antes do corte para o papel sair inteiro na serrilha.
  impressora.setTextNormal();
  impressora.newLine();
  impressora.newLine();
  impressora.cut();

  await impressora.execute();
  log.info(`Impresso: ${payload.titulo || payload.tipo}`);
}

/** Teste de impressão usado pelo script de instalação. */
async function imprimirTeste() {
  await imprimir({
    titulo: "Teste de impressao",
    linhas: [
      { texto: "==============================", estilo: "separador" },
      { texto: "     TESTE DE IMPRESSAO", estilo: "titulo" },
      { texto: "==============================", estilo: "separador" },
      { texto: " Se voce esta lendo isto,", estilo: "normal" },
      { texto: " a impressora esta configurada", estilo: "normal" },
      { texto: " corretamente.", estilo: "normal" },
      { texto: " EXEMPLO DE DESTAQUE", estilo: "destaque" },
      { texto: "==============================", estilo: "separador" },
    ],
  });
}

module.exports = { imprimir, imprimirTeste };
