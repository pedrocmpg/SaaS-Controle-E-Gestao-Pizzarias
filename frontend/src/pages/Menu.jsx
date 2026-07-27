import { useEffect, useState } from "react";
import { catalogService } from "../services/api";
import { useCart } from "../context/CartContext";
import { CardSkeleton } from "../components/ui";
import { useToast } from "../components/ui";
import PizzaBuilderModal from "../components/PizzaBuilderModal";

export default function Menu() {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [buildingSize, setBuildingSize] = useState(null);
  const { addItem } = useCart();
  const toast = useToast();

  useEffect(() => {
    catalogService
      .getAll()
      .then(setCatalog)
      .catch(() => {
        setError(true);
        toast.error("Erro ao carregar o cardápio");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="container-app py-20">
        <h1 className="section-title text-center mb-6">Monte sua Pizza</h1>
        <CardSkeleton count={3} />
      </div>
    );
  }

  if (error || !catalog) {
    return (
      <div className="container-app py-20 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
          <p className="text-red-600 font-semibold">Oops! Erro ao carregar</p>
          <p className="text-red-500 text-sm mt-2">
            Verifique se o backend está rodando e o banco de dados está configurado.
          </p>
        </div>
      </div>
    );
  }

  const drinks = catalog.products.filter((p) => p.category === "BEBIDA");

  return (
    <div className="container-app py-16">
      <div className="text-center animate-fade-in">
        <h1 className="section-title">Monte sua Pizza</h1>
        <p className="text-center text-gray-600 mt-3 max-w-xl mx-auto">
          Escolha o tamanho, os sabores e a borda. Todos os sabores salgados levam
          mussarela, molho de tomate e orégano.
        </p>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {catalog.pizzaSizes.map((size, index) => (
          <div
            key={size.id}
            className="card p-6 flex flex-col hover-lift hover-glow animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <h3 className="font-bold text-lg text-char">{size.name}</h3>
            <p className="text-sm text-gray-500 mt-1 flex-1">{size.description}</p>
            <p className="text-xs text-gray-400 mt-2">Serve {size.servesPeople} pessoas</p>
            <p className="font-price text-2xl font-medium text-ember-600 mt-3">
              R$ {Number(size.price).toFixed(2)}
            </p>
            <button
              onClick={() => setBuildingSize(size)}
              className="btn-primary mt-4 transition-all duration-300"
            >
              Montar Pizza
            </button>
          </div>
        ))}
      </div>

      {drinks.length > 0 && (
        <>
          <h2 className="section-title text-center mt-20 animate-fade-in">Bebidas</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {drinks.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                onAdd={addItem}
                index={index}
                compact
              />
            ))}
          </div>
        </>
      )}

      {buildingSize && (
        <PizzaBuilderModal
          size={buildingSize}
          flavors={catalog.flavors}
          borders={catalog.borders}
          onClose={() => setBuildingSize(null)}
        />
      )}
    </div>
  );
}

function ProductCard({ product, onAdd, index = 0, compact = false }) {
  function handleAdd() {
    onAdd({
      itemName: product.name,
      itemType: product.category,
      flavors: null,
      borderName: null,
      quantity: 1,
      unitPrice: Number(product.price),
      observations: "",
    });
  }

  return (
    <div
      className={`card p-5 flex flex-col hover-lift hover-glow transition-all duration-300 animate-fade-in ${
        compact ? "" : "p-6"
      }`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <h3 className="font-bold text-char">{product.name}</h3>
      {product.description && (
        <p className="text-sm text-gray-500 mt-1 flex-1">{product.description}</p>
      )}
      {product.servesPeople && (
        <p className="text-xs text-gray-400 mt-2">Serve {product.servesPeople} pessoas</p>
      )}
      <p className="font-price text-xl font-medium text-ember-600 mt-3">
        R$ {Number(product.price).toFixed(2)}
      </p>
      <button onClick={handleAdd} className="btn-secondary mt-4 transition-all duration-300">
        Adicionar
      </button>
    </div>
  );
}
