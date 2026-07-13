/**
 * Monta um link do WhatsApp com mensagem pré-preenchida.
 * @param {string} phone - número no formato internacional só com dígitos (ex: 5554999999999)
 * @param {string} message - texto a ser enviado
 */
export function buildWhatsAppLink(phone, message = "") {
  const cleanPhone = String(phone).replace(/\D/g, "");
  const text = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}${text ? `?text=${text}` : ""}`;
}

/**
 * Formata os itens do carrinho em uma mensagem de texto organizada para o WhatsApp.
 */
export function buildOrderMessage({ customerName, items, deliveryType, address, paymentMethod, notes, deliveryFee, subtotal }) {
  const lines = [];
  lines.push(`*Novo pedido - E Tenho Ditto Pizzaria*`);
  lines.push(`Cliente: ${customerName || "-"}`);
  lines.push("");
  lines.push("*Itens:*");

  items.forEach((item) => {
    lines.push(`• ${item.quantity}x ${item.itemName}`);
    if (item.flavors?.length) {
      lines.push(`   Sabores: ${item.flavors.join(", ")}`);
    }
    if (item.borderName) {
      lines.push(`   Borda: ${item.borderName}`);
    }
    if (item.observations) {
      lines.push(`   Obs: ${item.observations}`);
    }
    lines.push(`   R$ ${(item.unitPrice * item.quantity).toFixed(2)}`);
  });

  lines.push("");
  lines.push(`Subtotal: R$ ${subtotal.toFixed(2)}`);

  if (deliveryType === "ENTREGA") {
    lines.push(`Taxa de entrega: R$ ${Number(deliveryFee || 0).toFixed(2)}`);
    lines.push(`Endereço: ${address || "-"}`);
  } else {
    lines.push("Retirada no local");
  }

  lines.push(`Pagamento: ${paymentMethod || "-"}`);

  if (notes) {
    lines.push(`Observações gerais: ${notes}`);
  }

  return lines.join("\n");
}
