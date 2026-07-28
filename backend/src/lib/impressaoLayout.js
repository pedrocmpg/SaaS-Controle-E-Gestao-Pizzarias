/**
 * Layouts de impressão térmica — funções PURAS.
 *
 * Renderizam o payload que o agente local imprime. Nada aqui importa Prisma, faz I/O ou
 * toca em `req`/`res`: o handler lê do banco, chama estas funções e persiste o resultado
 * em JobImpressao.payload.
 *
 * A renderização mora no backend (e não no agente) por dois motivos: o agente não pode
 * conhecer regra de negócio, e o romaneio precisa bater EXATAMENTE com os números que a
 * tela do turno mostra — isso só é testável aqui.
 *
 * Formato do payload:
 *   { titulo, tipo, linhas: [{ texto, estilo }] }
 * Estilos que o agente entende: "normal" | "titulo" | "destaque" | "item" | "separador".
 * O agente só decide fonte/negrito/tamanho a partir do estilo — nunca reinterpreta o texto.
 */

/** Larguras suportadas: 48 col (80mm) e 32 col (58mm). */
const LARGURA_PADRAO = 48;

const num = (v) => Number(v ?? 0);

/** "R$ 12,50" — sempre em pt-BR, porque quem lê é o cliente e o motoboy. */
const money = (v) => `R$ ${num(v).toFixed(2).replace(".", ",")}`;

/** HH:MM de uma data. */
function hora(data) {
  const d = new Date(data);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** DD/MM/AAAA HH:MM. */
function dataHora(data) {
  const d = new Date(data);
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getFullYear()} ${hora(d)}`;
}

const linha = (texto = "", estilo = "normal") => ({ texto, estilo });
const separador = (largura, char = "-") => linha(char.repeat(largura), "separador");

/** Centraliza dentro da largura; texto maior que a largura passa direto (o agente quebra). */
function centralizar(texto, largura) {
  if (texto.length >= largura) return texto;
  const esquerda = Math.floor((largura - texto.length) / 2);
  return " ".repeat(esquerda) + texto;
}

/**
 * "Item.................R$ 10,00" — rótulo à esquerda, valor à direita.
 * Se não couber na mesma linha, o valor cai sozinho alinhado à direita.
 */
function doisLados(esquerda, direita, largura) {
  const espaco = largura - esquerda.length - direita.length;
  if (espaco < 1) return `${esquerda}\n${direita.padStart(largura)}`;
  return esquerda + " ".repeat(espaco) + direita;
}

/**
 * Quebra um texto longo em linhas de no máximo `largura`, sem cortar palavra no meio.
 *
 * `prefixo` abre a primeira linha; `continuacao` abre as demais. Para um marcador que se
 * repete (`"    > "`) os dois são iguais; para um rótulo (`" Endereco: "`) a continuação é
 * só o recuo — senão o papel sai com "Endereco:" repetido em cada linha do endereço.
 */
function quebrar(texto, largura, prefixo = "", continuacao = prefixo) {
  const palavras = String(texto).split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = prefixo;
  let abertura = prefixo;

  for (const palavra of palavras) {
    const candidata = atual === abertura ? atual + palavra : `${atual} ${palavra}`;
    if (candidata.length > largura && atual !== abertura) {
      linhas.push(atual);
      abertura = continuacao;
      atual = continuacao + palavra;
    } else {
      atual = candidata;
    }
  }
  if (atual !== abertura || linhas.length === 0) linhas.push(atual);
  return linhas;
}

/** Recuo do mesmo tamanho de um rótulo, para alinhar a continuação sob ele. */
const recuo = (rotulo) => " ".repeat(rotulo.length);

const DELIVERY_LABEL = { ENTREGA: "TELE-ENTREGA", RETIRADA: "RETIRADA NO BALCAO" };

const PAGAMENTO_LABEL = {
  DINHEIRO: "Dinheiro",
  PIX: "PIX",
  CARTAO_CREDITO: "Cartao de credito",
  CARTAO_DEBITO: "Cartao de debito",
};

const EXTRA_LABEL = {
  ENTREGA_LONGA: "Entrega longa",
  GORJETA: "Gorjeta",
  AJUDA_CUSTO: "Ajuda de custo",
  OUTRO: "Outro",
};

/**
 * Comanda de cozinha — o layout mais crítico do sistema.
 *
 * Lido em ambiente quente, com pressa e pouca luz. Por isso: SEM valores (a cozinha não
 * precisa saber preço e o número atrapalha a leitura) e observação do item em destaque,
 * que é a fonte nº1 de retrabalho.
 *
 * @param {object} order  Pedido com { id, createdAt, deliveryType, customerName, notes, items[] }
 * @param {object} opts   { largura }
 */
function renderComandaCozinha(order, { largura = LARGURA_PADRAO } = {}) {
  const linhas = [];

  linhas.push(separador(largura, "="));
  linhas.push(linha(centralizar(`PEDIDO #${order.id}  -  ${hora(order.createdAt)}`, largura), "titulo"));
  linhas.push(separador(largura, "="));

  linhas.push(linha(` ${DELIVERY_LABEL[order.deliveryType] || order.deliveryType}`, "destaque"));
  if (order.customerName) linhas.push(linha(` Cliente: ${order.customerName}`));

  for (const item of order.items || []) {
    linhas.push(separador(largura));
    linhas.push(linha(` ${item.quantity}x ${String(item.itemName).toUpperCase()}`, "item"));

    // Sabores: gravados como Json (array de nomes ou de objetos { nome }).
    const sabores = normalizarSabores(item.flavors);
    if (sabores.length > 0) {
      quebrar(sabores.join(" / "), largura, "    > ").forEach((l) => linhas.push(linha(l)));
    }
    if (item.borderName) linhas.push(linha(`    > Borda: ${item.borderName}`));

    // Observação do item em destaque — é o que mais gera pizza refeita.
    if (item.observations) {
      quebrar(String(item.observations).toUpperCase(), largura, "    OBS: ", recuo("    OBS: ")).forEach((l) =>
        linhas.push(linha(l, "destaque"))
      );
    }
  }

  // Observação do pedido inteiro (ex.: "cliente alérgico"), depois dos itens.
  if (order.notes) {
    linhas.push(separador(largura));
    quebrar(String(order.notes).toUpperCase(), largura, " OBS PEDIDO: ", recuo(" OBS PEDIDO: ")).forEach((l) =>
      linhas.push(linha(l, "destaque"))
    );
  }

  linhas.push(separador(largura, "="));

  return { tipo: "COMANDA_COZINHA", titulo: `Pedido #${order.id} - Cozinha`, linhas };
}

/** Sabores vêm de um campo Json: aceita ["Calabresa"] ou [{ nome: "Calabresa" }]. */
function normalizarSabores(flavors) {
  if (!Array.isArray(flavors)) return [];
  return flavors
    .map((f) => (typeof f === "string" ? f : f && (f.nome || f.name)))
    .filter(Boolean);
}

/**
 * Cupom do cliente — a via que acompanha o pedido.
 *
 * Traz valores, forma de pagamento, taxa e endereço completo (é o que o motoboy usa para
 * achar a casa). NÃO é documento fiscal: o rodapé "DOCUMENTO NAO FISCAL" é obrigatório,
 * emissão fiscal está fora de escopo do projeto.
 *
 * @param {object} order  Pedido já com phone/address DESCRIPTOGRAFADOS pelo handler.
 * @param {object} opts   { largura, nomeLoja, valorPago }
 */
function renderCupomCliente(order, { largura = LARGURA_PADRAO, nomeLoja = "", valorPago } = {}) {
  const linhas = [];

  linhas.push(separador(largura, "="));
  if (nomeLoja) linhas.push(linha(centralizar(String(nomeLoja).toUpperCase(), largura), "titulo"));
  linhas.push(linha(centralizar(`PEDIDO #${order.id}`, largura), "titulo"));
  linhas.push(linha(centralizar(dataHora(order.createdAt), largura)));
  linhas.push(separador(largura, "="));

  linhas.push(linha(` ${DELIVERY_LABEL[order.deliveryType] || order.deliveryType}`, "destaque"));
  if (order.customerName) linhas.push(linha(` Cliente: ${order.customerName}`));
  if (order.phone) linhas.push(linha(` Fone: ${order.phone}`));
  if (order.address) {
    quebrar(order.address, largura, " Endereco: ", recuo(" Endereco: ")).forEach((l) => linhas.push(linha(l)));
  }
  linhas.push(separador(largura));

  let subtotal = 0;
  for (const item of order.items || []) {
    const valorItem = num(item.subtotal);
    subtotal += valorItem;
    linhas.push(linha(doisLados(` ${item.quantity}x ${item.itemName}`, money(valorItem), largura), "item"));

    const sabores = normalizarSabores(item.flavors);
    if (sabores.length > 0) {
      quebrar(sabores.join(" / "), largura, "    ").forEach((l) => linhas.push(linha(l)));
    }
    if (item.borderName) linhas.push(linha(`    Borda: ${item.borderName}`));
  }

  linhas.push(separador(largura));
  linhas.push(linha(doisLados(" Subtotal", money(subtotal), largura)));
  linhas.push(linha(doisLados(" Taxa de entrega", money(order.deliveryFee), largura)));
  linhas.push(linha(doisLados(" TOTAL", money(order.totalPrice), largura), "titulo"));
  linhas.push(separador(largura));

  linhas.push(linha(` Pagamento: ${PAGAMENTO_LABEL[order.paymentMethod] || order.paymentMethod}`, "destaque"));

  // Troco só faz sentido em dinheiro e quando o atendente registrou com quanto o cliente paga.
  if (order.paymentMethod === "DINHEIRO" && valorPago != null && num(valorPago) > 0) {
    linhas.push(linha(doisLados(" Valor pago", money(valorPago), largura)));
    linhas.push(linha(doisLados(" TROCO", money(num(valorPago) - num(order.totalPrice)), largura), "destaque"));
  }

  linhas.push(separador(largura, "="));
  linhas.push(linha(centralizar("DOCUMENTO NAO FISCAL", largura), "destaque"));
  linhas.push(separador(largura, "="));

  return { tipo: "CUPOM_CLIENTE", titulo: `Pedido #${order.id} - Cupom`, linhas };
}

/**
 * Romaneio do motoboy — comprovante físico do acerto em dinheiro.
 *
 * Impresso no fechamento do turno, em duas vias com linha de assinatura: é o documento que
 * a pizzaria arquiva. Os números têm que bater EXATAMENTE com os de TurnoMotoboy, que é o
 * que a tela mostra — por isso este layout apenas formata, nunca recalcula.
 *
 * @param {object} turno  TurnoMotoboy já fechado (com os campos de fechamento preenchidos).
 * @param {object} opts   { largura, motoboyNome, pedidos, extras, vias }
 */
function renderRomaneioMotoboy(turno, { largura = LARGURA_PADRAO, motoboyNome = "", pedidos = [], extras = [], vias = 2 } = {}) {
  const umaVia = (via) => {
    const linhas = [];

    linhas.push(separador(largura, "="));
    linhas.push(linha(centralizar("ROMANEIO DE MOTOBOY", largura), "titulo"));
    linhas.push(linha(centralizar(`${via}a VIA`, largura)));
    linhas.push(separador(largura, "="));

    linhas.push(linha(` Motoboy: ${motoboyNome || turno.motoboyId}`, "destaque"));
    linhas.push(linha(` Turno #${turno.id}`));
    linhas.push(linha(` Aberto:  ${dataHora(turno.abertoEm)}`));
    if (turno.fechadoEm) linhas.push(linha(` Fechado: ${dataHora(turno.fechadoEm)}`));

    linhas.push(separador(largura));
    linhas.push(linha(" ENTREGAS", "destaque"));
    for (const p of pedidos) {
      const rotulo = ` #${p.id} ${PAGAMENTO_LABEL[p.paymentMethod] || p.paymentMethod}`;
      linhas.push(linha(doisLados(rotulo, money(p.totalPrice), largura)));
    }
    linhas.push(linha(doisLados(" Total de entregas", String(turno.totalEntregas ?? pedidos.length), largura)));

    if (extras.length > 0) {
      linhas.push(separador(largura));
      linhas.push(linha(" EXTRAS", "destaque"));
      for (const e of extras) {
        linhas.push(linha(doisLados(` ${EXTRA_LABEL[e.tipo] || e.tipo}`, money(e.valor), largura)));
        if (e.motivo) quebrar(e.motivo, largura, "    ").forEach((l) => linhas.push(linha(l)));
      }
    }

    linhas.push(separador(largura));
    linhas.push(linha(" A RECEBER PELA NOITE", "destaque"));
    linhas.push(
      linha(doisLados(`  ${turno.totalEntregas ?? 0} entregas x ${money(turno.valorPorEntrega)}`, money(num(turno.totalEntregas) * num(turno.valorPorEntrega)), largura))
    );
    linhas.push(linha(doisLados("  Extras", money(turno.totalExtras), largura)));
    linhas.push(linha(doisLados("  Aluguel da moto", money(turno.valorAluguelMoto), largura)));
    linhas.push(linha(doisLados(" VALOR DA NOITE", money(turno.valorDaNoite), largura), "titulo"));

    linhas.push(separador(largura));
    linhas.push(linha(" DINHEIRO EM MAOS", "destaque"));
    linhas.push(linha(doisLados("  Fundo de troco", money(turno.fundoTroco), largura)));
    linhas.push(linha(doisLados("  Recebido em dinheiro", money(turno.totalRecebidoDinheiro), largura)));
    linhas.push(linha(doisLados("  Recebido em cartao", money(turno.totalRecebidoCartao), largura)));
    linhas.push(linha(doisLados("  Recebido em PIX", money(turno.totalRecebidoPix), largura)));

    linhas.push(separador(largura));
    const acerto = num(turno.acerto);
    linhas.push(linha(doisLados(" ACERTO", money(acerto), largura), "titulo"));
    // O sinal do acerto decide quem paga quem. Escrito por extenso porque é o ponto do
    // documento que gera discussão entre a pizzaria e o motoboy.
    linhas.push(
      linha(
        acerto > 0
          ? centralizar("MOTOBOY REPASSA AO CAIXA", largura)
          : acerto < 0
            ? centralizar("PIZZARIA PAGA AO MOTOBOY", largura)
            : centralizar("NADA A ACERTAR", largura),
        "destaque"
      )
    );
    linhas.push(linha(doisLados(" Sangria", money(turno.sangria), largura)));

    linhas.push(separador(largura, "="));
    linhas.push(linha(""));
    linhas.push(linha(centralizar("_".repeat(Math.min(30, largura - 4)), largura)));
    linhas.push(linha(centralizar("Assinatura do motoboy", largura)));
    linhas.push(linha(""));
    linhas.push(linha(centralizar("_".repeat(Math.min(30, largura - 4)), largura)));
    linhas.push(linha(centralizar("Assinatura do responsavel", largura)));
    linhas.push(separador(largura, "="));

    return linhas;
  };

  const linhas = [];
  for (let via = 1; via <= vias; via++) {
    linhas.push(...umaVia(via));
    if (via < vias) linhas.push(linha("", "corte"));
  }

  return { tipo: "ROMANEIO_MOTOBOY", titulo: `Romaneio turno #${turno.id}`, linhas };
}

/**
 * Cupom de uma comanda de salão. Mesmo contrato do cupom de tele-entrega (inclusive o
 * rodapé não-fiscal), sem endereço/taxa — o cliente está na mesa.
 */
function renderCupomComanda(comanda, { largura = LARGURA_PADRAO, nomeLoja = "" } = {}) {
  const linhas = [];

  linhas.push(separador(largura, "="));
  if (nomeLoja) linhas.push(linha(centralizar(String(nomeLoja).toUpperCase(), largura), "titulo"));
  linhas.push(linha(centralizar(`COMANDA #${comanda.id}`, largura), "titulo"));
  if (comanda.numeroMesa != null) linhas.push(linha(centralizar(`MESA ${comanda.numeroMesa}`, largura), "destaque"));
  linhas.push(linha(centralizar(dataHora(comanda.fechadaEm || comanda.abertaEm), largura)));
  linhas.push(separador(largura, "="));

  for (const item of comanda.itens || []) {
    const valorItem = num(item.unitPrice) * num(item.quantidade);
    linhas.push(linha(doisLados(` ${item.quantidade}x ${item.descricao}`, money(valorItem), largura), "item"));
    const sabores = normalizarSabores(item.sabroesSnapshot);
    if (sabores.length > 0) {
      quebrar(sabores.join(" / "), largura, "    ").forEach((l) => linhas.push(linha(l)));
    }
  }

  linhas.push(separador(largura));
  linhas.push(linha(doisLados(" TOTAL", money(comanda.totalPrice), largura), "titulo"));
  if (comanda.paymentMethod) {
    linhas.push(linha(` Pagamento: ${PAGAMENTO_LABEL[comanda.paymentMethod] || comanda.paymentMethod}`, "destaque"));
  }

  linhas.push(separador(largura, "="));
  linhas.push(linha(centralizar("DOCUMENTO NAO FISCAL", largura), "destaque"));
  linhas.push(separador(largura, "="));

  return { tipo: "CUPOM_CLIENTE", titulo: `Comanda #${comanda.id} - Cupom`, linhas };
}

module.exports = {
  LARGURA_PADRAO,
  renderComandaCozinha,
  renderCupomCliente,
  renderCupomComanda,
  renderRomaneioMotoboy,
  // exportados para teste
  centralizar,
  doisLados,
  quebrar,
};
