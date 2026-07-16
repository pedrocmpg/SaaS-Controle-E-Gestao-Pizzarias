import { useMemo, useState } from "react";
import { useCart } from "../context/CartContext";
import { useToast } from "./ui";
import { PizzaPreview } from "./PizzaPreview";

/**
 * Modal "Monte sua Pizza": UX redesignado com preview visual, feedback melhorado
 * Otimizado para mobile com touch targets de 44x44px.
 */
export default function PizzaBuilderModal({ size, flavors, borders, onClose, onAdd }) {
  const { addItem } = useCart();
  const toast = useToast();
  const [flavorType, setFlavorType] = useState("SALGADA");
  const [selectedFlavors, setSelectedFlavors] = useState([]);
  const [selectedBorder, setSelectedBorder] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [observations, setObservations] = useState("");

  const filteredFlavors = useMemo(
    () => flavors.filter((f) => f.type === flavorType),
    [flavors, flavorType]
  );

  const flavorsExtra = selectedFlavors.reduce((sum, f) => sum + Number(f.extraPrice || 0), 0);
  const borderPrice = selectedBorder ? Number(selectedBorder.price) : 0;
  const unitPrice = Number(size.price) + flavorsExtra + borderPrice;

  function toggleFlavor(flavor) {
    setSelectedFlavors((prev) => {
      const exists = prev.find((f) => f.id === flavor.id);
      if (exists) {
        return prev.filter((f) => f.id !== flavor.id);
      }
      if (prev.length >= size.maxFlavors) {
        toast.warning(`Máximo de ${size.maxFlavors} sabores atingido`);
        return prev;
      }
      return [...prev, flavor];
    });
  }

  function handleAddToCart() {
    if (selectedFlavors.length === 0) {
      toast.warning("Selecione pelo menos um sabor");
      return;
    }

    const item = {
      itemName: `Pizza ${size.name} (${selectedFlavors.length} sabor${selectedFlavors.length > 1 ? "es" : ""})`,
      itemType: "MONTAVEL",
      flavors: selectedFlavors.map((f) => f.name),
      borderName: selectedBorder?.name || null,
      quantity,
      unitPrice,
      observations,
    };

    // Fluxo do atendente passa onAdd (lista local do pedido); vitrine pública usa o carrinho.
    if (onAdd) {
      onAdd(item);
    } else {
      addItem(item);
      toast.success("Pizza adicionada ao carrinho!");
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-fade-in">
      <div className="bg-white w-full sm:max-w-3xl sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-hidden animate-slide-in-up sm:animate-scale-in flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white flex items-center justify-between p-4 sm:p-5 border-b border-black/5 z-10 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-brand-900">{size.name}</h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Até {size.maxFlavors} sabor{size.maxFlavors > 1 ? "es" : ""} • {size.slices} fatias
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-gray-400 hover:text-gray-600 transition-smooth active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ember-500 rounded p-1 min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Scroll Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 p-4 sm:p-5">
            {/* Preview na esquerda em desktop */}
            <div className="hidden sm:block sm:border-r sm:border-gray-200 sm:pr-4">
              <PizzaPreview
                size={size}
                selectedFlavors={selectedFlavors}
                selectedBorder={selectedBorder}
              />
            </div>

            {/* Seleção na direita / embaixo em mobile */}
            <div className="space-y-4 sm:space-y-6">
              {/* Preview em mobile */}
              <div className="sm:hidden">
                <PizzaPreview
                  size={size}
                  selectedFlavors={selectedFlavors}
                  selectedBorder={selectedBorder}
                />
              </div>

              {/* Toggle salgado/doce */}
              <div className="flex gap-2">
                {["SALGADA", "DOCE"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFlavorType(type)}
                    className={`flex-1 px-4 py-2.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold border transition-all duration-200 min-h-[44px] flex items-center justify-center ${
                      flavorType === type
                        ? "bg-brand-700 text-white border-brand-700 scale-105"
                        : "border-gray-200 text-gray-600 hover:border-brand-300 hover-lift"
                    }`}
                  >
                    {type === "SALGADA" ? "🍕 Salgados" : "🍫 Doces"}
                  </button>
                ))}
              </div>

              {/* Contador de seleção com visual progress */}
              <div className="flex items-center justify-between px-3 sm:px-4 py-3 bg-gradient-to-r from-ember-50 to-transparent rounded-lg border border-ember-200">
                <p className="text-xs sm:text-sm font-medium text-ember-700">
                  {selectedFlavors.length} / {size.maxFlavors} sabores
                </p>
                <div className="flex gap-1">
                  {Array.from({ length: size.maxFlavors }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        i < selectedFlavors.length ? "bg-ember-500 scale-125" : "bg-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Lista de sabores */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Escolha os sabores
                </h3>
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                  {filteredFlavors.map((flavor, index) => {
                    const isSelected = selectedFlavors.some((f) => f.id === flavor.id);
                    const isDisabled = !isSelected && selectedFlavors.length >= size.maxFlavors;
                    return (
                      <button
                        key={flavor.id}
                        onClick={() => !isDisabled && toggleFlavor(flavor)}
                        disabled={isDisabled}
                        className={`text-left p-3 rounded-lg border text-xs transition-all duration-200 transform min-h-[60px] sm:min-h-auto flex flex-col justify-between ${
                          isSelected
                            ? "border-ember-500 bg-ember-50 ring-2 ring-ember-300 scale-105"
                            : isDisabled
                            ? "border-gray-100 opacity-40 cursor-not-allowed bg-gray-50"
                            : "border-gray-200 hover:border-ember-300 hover-lift"
                        }`}
                        style={{
                          transitionDelay: isSelected ? `${index * 30}ms` : "0ms",
                        }}
                      >
                        <div>
                          <span className="font-semibold text-gray-900 block">{flavor.name}</span>
                          {flavor.description && (
                            <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">
                              {flavor.description}
                            </p>
                          )}
                        </div>
                        {Number(flavor.extraPrice) > 0 && (
                          <span className="font-price text-ember-600 font-medium text-xs mt-1">
                            +R$ {Number(flavor.extraPrice).toFixed(2)}
                          </span>
                        )}
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-ember-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            ✓
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bordas */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Borda (opcional)
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedBorder(null)}
                    className={`px-3 py-2 rounded-full text-xs font-medium border transition-all duration-200 min-h-[40px] flex items-center ${
                      !selectedBorder
                        ? "bg-brand-700 text-white border-brand-700 scale-105"
                        : "border-gray-200 text-gray-600 hover:border-brand-300 hover-lift"
                    }`}
                  >
                    Sem borda
                  </button>
                  {borders.map((border) => (
                    <button
                      key={border.id}
                      onClick={() => setSelectedBorder(border)}
                      className={`px-3 py-2 rounded-full text-xs font-medium border transition-all duration-200 min-h-[40px] flex items-center ${
                        selectedBorder?.id === border.id
                          ? "bg-brand-700 text-white border-brand-700 scale-105 ring-2 ring-offset-2 ring-brand-400"
                          : "border-gray-200 text-gray-600 hover:border-brand-300 hover-lift"
                      }`}
                    >
                      {border.name} <span className="font-price text-melt font-medium ml-1">+R$ {Number(border.price).toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Observações
                </h3>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Ex: sem cebola, cortar em fatias..."
                  className="w-full border border-gray-200 rounded-lg p-3 text-xs sm:text-sm resize-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
                  rows={2}
                  aria-label="Observações do pedido"
                />
              </div>

              {/* Resumo de Preço */}
              <div className="bg-flour-2 rounded-lg p-4 space-y-2 border border-ember-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tamanho:</span>
                  <span className="font-price font-medium">R$ {Number(size.price).toFixed(2)}</span>
                </div>
                {flavorsExtra > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Extras:</span>
                    <span className="font-price font-medium text-ember-600">+R$ {flavorsExtra.toFixed(2)}</span>
                  </div>
                )}
                {borderPrice > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Borda:</span>
                    <span className="font-price font-medium text-melt">+R$ {borderPrice.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-ember-200 pt-2 flex justify-between font-bold">
                  <span>Por unidade:</span>
                  <span className="font-price text-ember-600 text-lg">R$ {unitPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer fixo */}
        <div className="sticky bottom-0 bg-white border-t border-black/5 p-4 sm:p-5 flex items-center justify-between gap-3 sm:gap-4 flex-shrink-0">
          <div className="flex items-center border border-gray-200 rounded-full transition-smooth hover:border-ember-300 bg-gray-50 min-h-[44px]">
            <button
              className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center hover:text-ember-600 transition-colors font-bold"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Diminuir quantidade"
            >
              −
            </button>
            <span className="w-8 text-center font-semibold text-sm">{quantity}</span>
            <button
              className="w-10 h-10 sm:w-9 sm:h-9 flex items-center justify-center hover:text-ember-600 transition-colors font-bold"
              onClick={() => setQuantity((q) => q + 1)}
              aria-label="Aumentar quantidade"
            >
              +
            </button>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={selectedFlavors.length === 0}
            className={`btn-primary flex-1 transition-all duration-300 text-xs sm:text-sm py-3 min-h-[48px] sm:min-h-[44px] flex flex-col items-center justify-center ${
              selectedFlavors.length === 0 ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <span className="font-bold">Adicionar ao carrinho</span>
            <span className="font-price text-xs opacity-90">R$ {(unitPrice * quantity).toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
