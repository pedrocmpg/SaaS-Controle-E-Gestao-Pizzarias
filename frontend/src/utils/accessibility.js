/**
 * Utilitários para acessibilidade e WCAG compliance
 */

/**
 * Classes para focus states acessíveis
 */
export const focusClasses = {
  ring: "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500",
  ringSecondary: "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-700",
  ringSmall: "focus:outline-none focus:ring-2 focus:ring-accent-500",
};

/**
 * Gera um ID único para associar label com input
 */
export function generateInputId(name) {
  return `input_${name}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Converte número para texto legível por screen reader
 * Ex: 1234.56 -> "mil duzentos e trinta e quatro reais e cinquenta e seis centavos"
 */
export function priceToWords(price) {
  const parts = price.toFixed(2).split(".");
  const reais = parseInt(parts[0]);
  const centavos = parseInt(parts[1]);

  let reaisText = numberToWords(reais) + " real" + (reais !== 1 ? "is" : "");
  let centavosText =
    centavos > 0
      ? numberToWords(centavos) + " centavo" + (centavos !== 1 ? "s" : "")
      : "";

  return centavosText ? `${reaisText} e ${centavosText}` : reaisText;
}

function numberToWords(num) {
  const ones = [
    "",
    "um",
    "dois",
    "três",
    "quatro",
    "cinco",
    "seis",
    "sete",
    "oito",
    "nove",
  ];
  const teens = [
    "dez",
    "onze",
    "doze",
    "treze",
    "quatorze",
    "quinze",
    "dezesseis",
    "dezessete",
    "dezoito",
    "dezenove",
  ];
  const tens = [
    "",
    "",
    "vinte",
    "trinta",
    "quarenta",
    "cinquenta",
    "sessenta",
    "setenta",
    "oitenta",
    "noventa",
  ];
  const scales = ["", "mil", "milhão", "bilhão"];

  if (num === 0) return "zero";

  let words = [];
  let scaleIndex = 0;

  while (num > 0) {
    const group = num % 1000;
    if (group !== 0) {
      words.unshift(
        groupToWords(group, ones, teens, tens) + (scales[scaleIndex] ? ` ${scales[scaleIndex]}` : "")
      );
    }
    num = Math.floor(num / 1000);
    scaleIndex++;
  }

  return words.join(" ");
}

function groupToWords(group, ones, teens, tens) {
  const hundreds = Math.floor(group / 100);
  const remainder = group % 100;
  const tenValue = Math.floor(remainder / 10);
  const oneValue = remainder % 10;

  let result = "";

  if (hundreds > 0) {
    const hundredsWords = [
      "",
      "cem",
      "duzentos",
      "trezentos",
      "quatrocentos",
      "quinhentos",
      "seiscentos",
      "setecentos",
      "oitocentos",
      "novecentos",
    ];
    result += hundredsWords[hundreds];
  }

  if (remainder >= 10) {
    if (remainder < 20) {
      if (result) result += " e ";
      result += teens[remainder - 10];
    } else {
      if (result) result += " e ";
      result += tens[tenValue];
      if (oneValue > 0) {
        result += " e " + ones[oneValue];
      }
    }
  } else if (oneValue > 0) {
    if (result) result += " e ";
    result += ones[oneValue];
  }

  return result;
}

/**
 * Cria atributo aria-label semanticamente correto
 */
export const ariaLabels = {
  cartItems: (count) => `Carrinho com ${count} item${count !== 1 ? "s" : ""}`,
  addItem: (name) => `Adicionar ${name} ao carrinho`,
  removeItem: (name) => `Remover ${name} do carrinho`,
  increaseQty: "Aumentar quantidade",
  decreaseQty: "Diminuir quantidade",
  closeDialog: "Fechar",
  openMenu: "Abrir menu de navegação",
  closeMenu: "Fechar menu de navegação",
};

/**
 * Skip link para acessibilidade - pula para conteúdo principal
 */
export const skipLinkHTML = `
  <a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-0 focus:left-0 focus:bg-brand-700 focus:text-white focus:p-3 focus:z-50">
    Pular para conteúdo principal
  </a>
`;
