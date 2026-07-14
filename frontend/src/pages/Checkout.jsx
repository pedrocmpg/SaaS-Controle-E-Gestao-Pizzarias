import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useStore } from "../context/StoreContext";
import { ordersService } from "../services/api";
import { buildOrderMessage, buildWhatsAppLink } from "../utils/whatsapp";

const paymentMethods = ["PIX", "Cartão de Crédito", "Cartão de Débito", "Dinheiro"];

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const { settings } = useStore();
  const navigate = useNavigate();

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState("ENTREGA");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Taxa de entrega estimada (média entre min e max definidos pela loja)
  const deliveryFee = useMemo(() => {
    if (deliveryType === "RETIRADA") return 0;
    return (Number(settings.minDeliveryFee) + Number(settings.maxDeliveryFee)) / 2;
  }, [deliveryType, settings]);

  const total = subtotal + deliveryFee;

  async function handleSubmit(e) {
    e.preventDefault();
    if (items.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);

    const orderPayload = {
      customerName,
      phone,
      address: deliveryType === "ENTREGA" ? address : null,
      deliveryType,
      paymentMethod,
      notes,
      deliveryFee,
      items: items.map((i) => ({
        itemName: i.itemName,
        itemType: i.itemType,
        flavors: i.flavors,
        borderName: i.borderName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        observations: i.observations,
      })),
    };

    const whatsappMessage = buildOrderMessage({
      customerName,
      items,
      deliveryType,
      address,
      paymentMethod,
      notes,
      deliveryFee,
      subtotal,
    });
    const whatsappLink = buildWhatsAppLink(settings.whatsapp, whatsappMessage);

    try {
      // Tenta registrar o pedido no backend (fica salvo no painel admin)
      await ordersService.create(orderPayload);
    } catch (err) {
      // Mesmo se o backend estiver offline, seguimos para o WhatsApp
      setSubmitError(
        "Não foi possível registrar o pedido no sistema, mas você pode enviá-lo direto pelo WhatsApp."
      );
    } finally {
      setSubmitting(false);
    }

    window.open(whatsappLink, "_blank");
    clearCart();
    navigate("/");
  }

  if (items.length === 0) {
    return (
      <div className="container-app py-20 text-center">
        <p className="text-gray-500">Seu carrinho está vazio.</p>
      </div>
    );
  }

  return (
    <div className="container-app py-16 grid md:grid-cols-3 gap-10">
      <form onSubmit={handleSubmit} className="md:col-span-2 space-y-6">
        <h1 className="section-title">Finalizar Pedido</h1>

        <div>
          <label className="block text-sm font-semibold text-brand-900 mb-1">Nome completo</label>
          <input
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl p-3"
            placeholder="Seu nome"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-brand-900 mb-1">Telefone / WhatsApp</label>
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-gray-200 rounded-xl p-3"
            placeholder="(54) 99999-9999"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-brand-900 mb-2">Tipo de entrega</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDeliveryType("ENTREGA")}
              className={`px-4 py-2 rounded-full border text-sm font-semibold ${
                deliveryType === "ENTREGA" ? "bg-brand-700 text-white border-brand-700" : "border-gray-200"
              }`}
            >
              Entrega
            </button>
            <button
              type="button"
              onClick={() => setDeliveryType("RETIRADA")}
              className={`px-4 py-2 rounded-full border text-sm font-semibold ${
                deliveryType === "RETIRADA" ? "bg-brand-700 text-white border-brand-700" : "border-gray-200"
              }`}
            >
              Retirar no local
            </button>
          </div>
        </div>

        {deliveryType === "ENTREGA" && (
          <div>
            <label className="block text-sm font-semibold text-brand-900 mb-1">Endereço de entrega</label>
            <input
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3"
              placeholder="Rua, número, bairro"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-brand-900 mb-2">Forma de pagamento</label>
          <div className="flex flex-wrap gap-2">
            {paymentMethods.map((method) => (
              <button
                type="button"
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`px-4 py-2 rounded-full border text-sm font-semibold ${
                  paymentMethod === method ? "bg-brand-700 text-white border-brand-700" : "border-gray-200"
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-brand-900 mb-1">Observações</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-xl p-3 resize-none"
            placeholder="Ponto de referência, troco, etc."
          />
        </div>

        {submitError && (
          <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-xl">{submitError}</p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Enviando..." : "Enviar pedido pelo WhatsApp"}
        </button>
      </form>

      <aside className="card p-6 self-start">
        <h2 className="font-bold text-brand-900 mb-4">Resumo do pedido</h2>
        <ul className="space-y-3 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between">
              <span>
                {item.quantity}x {item.itemName}
              </span>
              <span className="font-price">R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-black/5 mt-4 pt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-price">R$ {subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Taxa de entrega</span>
            <span className="font-price">R$ {deliveryFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-char text-lg pt-2">
            <span>Total</span>
            <span className="font-price">R$ {total.toFixed(2)}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
