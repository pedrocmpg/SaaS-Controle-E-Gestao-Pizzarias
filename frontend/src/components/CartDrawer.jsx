import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";

export default function CartDrawer({ open, onClose }) {
  const { items, removeItem, updateQuantity, subtotal } = useCart();

  return (
    <>
      {/* overlay */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        role="presentation"
        aria-hidden={!open}
      />

      {/* drawer */}
      <aside
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-page z-50 shadow-2xl transition-all duration-300 flex flex-col transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
      >
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-black/5">
          <h2 id="cart-title" className="text-lg sm:text-xl font-bold text-brand-900">
            Seu carrinho
          </h2>
          <button
            onClick={onClose}
            aria-label="Fechar carrinho"
            className="text-2xl leading-none text-gray-400 hover:text-gray-600 transition-smooth active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500 rounded p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {items.length === 0 && (
            <p className="text-gray-500 text-center mt-10 text-sm sm:text-base animate-fade-in">
              Seu carrinho está vazio.
            </p>
          )}

          {items.map((item, index) => (
            <div
              key={item.id}
              className="flex gap-3 border-b border-black/5 pb-4 animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-brand-900 text-sm sm:text-base truncate">
                  {item.itemName}
                </p>
                {item.flavors?.length > 0 && (
                  <p className="text-xs sm:text-sm text-gray-500 truncate">
                    {item.flavors.join(", ")}
                  </p>
                )}
                {item.borderName && (
                  <p className="text-xs text-gray-500">Borda: {item.borderName}</p>
                )}
                {item.observations && (
                  <p className="text-xs text-gray-400 italic">Obs: {item.observations}</p>
                )}

                <div className="flex items-center gap-2 sm:gap-3 mt-2">
                  <div className="flex items-center border border-gray-200 rounded-full transition-smooth hover:border-brand-300 bg-gray-50">
                    <button
                      className="w-8 sm:w-9 h-8 sm:h-9 flex items-center justify-center hover:text-accent-600 transition-colors font-bold"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      aria-label="Diminuir quantidade"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">
                      {item.quantity}
                    </span>
                    <button
                      className="w-8 sm:w-9 h-8 sm:h-9 flex items-center justify-center hover:text-accent-600 transition-colors font-bold"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      aria-label="Aumentar quantidade"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-xs text-red-500 hover:text-red-600 hover:underline transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 rounded px-1 py-0.5"
                    aria-label={`Remover ${item.itemName} do carrinho`}
                  >
                    Remover
                  </button>
                </div>
              </div>

              <p className="font-semibold text-accent-600 whitespace-nowrap text-sm sm:text-base flex-shrink-0">
                R$ {(item.unitPrice * item.quantity).toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        <div className="p-4 sm:p-5 border-t border-black/5 bg-page/50 space-y-3 sm:space-y-4">
          <div className="flex justify-between text-base sm:text-lg font-bold text-brand-900">
            <span>Subtotal</span>
            <span className="transition-all duration-300">
              R$ {subtotal.toFixed(2)}
            </span>
          </div>
          <Link
            to="/checkout"
            onClick={onClose}
            className={`btn-primary w-full transition-all duration-300 text-sm sm:text-base py-3 min-h-[48px] flex items-center justify-center ${
              items.length === 0 ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            Finalizar Pedido
          </Link>
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 text-brand-700 hover:bg-white transition-colors text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-700 min-h-[44px]"
          >
            Continuar comprando
          </button>
        </div>
      </aside>
    </>
  );
}
