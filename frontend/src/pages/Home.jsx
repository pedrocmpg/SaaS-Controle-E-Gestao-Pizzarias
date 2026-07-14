import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { catalogService } from "../services/api";
import PizzaBuilderModal from "../components/PizzaBuilderModal";

const differentiators = [
  {
    title: "Massa Artesanal",
    description: "Feita todos os dias, com fermentação lenta para dar mais sabor e leveza.",
    icon: "🍕",
  },
  {
    title: "Mais de 80 Sabores",
    description: "Salgados e doces para todos os gostos, incluindo opções gourmet.",
    icon: "😋",
  },
  {
    title: "Entrega Rápida",
    description: "Delivery ágil direto para sua casa, com acompanhamento pelo WhatsApp.",
    icon: "🛵",
  },
  {
    title: "Ingredientes Selecionados",
    description: "Trabalhamos com marcas de confiança para garantir a melhor qualidade.",
    icon: "✅",
  },
];

export default function Home() {
  const { settings } = useStore();
  const [catalog, setCatalog] = useState(null);
  const [buildingSize, setBuildingSize] = useState(null);

  useEffect(() => {
    catalogService.getAll().then(setCatalog).catch(() => {});
  }, []);

  return (
    <div>
      {/* Hero - Com imagem de pizza como fundo */}
      <section 
        className="relative w-full h-screen md:h-auto md:py-20 overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/pizza-hero.jpg')",
          backgroundAttachment: 'fixed',
        }}
      >
        {/* Gradiente branco sobre a imagem */}
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-white/20" />
        
        {/* Conteúdo */}
        <div className="container-app py-12 md:py-20 relative flex items-center min-h-screen md:min-h-auto md:h-auto">
          {/* Coluna esquerda - Texto */}
          <div className="z-10 flex flex-col justify-center max-w-2xl">
            {/* Rating Badge */}
            <span className="inline-flex items-center gap-2 bg-char text-flour text-xs font-bold px-4 py-2 rounded-full w-fit mb-6">
              <span className="text-sm">★ 4.8 NO DELIVERY</span>
            </span>

            {/* Headline - Com fonte serif */}
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-semibold text-char leading-tight mb-2">
              Sua Marca
            </h1>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-semibold font-serif text-ember-500 mb-4">
              Aqui
            </h2>

            {/* Descrição */}
            <p className="text-gray-700 text-base md:text-lg max-w-md mb-6 leading-relaxed">
              Pizzas artesanais na sua região. Monte a sua, escolha uma borda recheada e receba em casa.
            </p>

            {/* Info de entrega */}
            <div className="flex flex-wrap gap-6 text-sm mb-8">
              <div className="flex items-center gap-2 text-gray-700">
                <span className="text-lg">⏱</span>
                <span>{settings.minDeliveryTime}-{settings.maxDeliveryTime} min</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <span className="text-lg">💰</span>
                <span className="font-price">R$ {Number(settings.minDeliveryFee).toFixed(2)} a R$ {Number(settings.maxDeliveryFee).toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <span className="text-lg">📍</span>
                <span>{settings.city}, {settings.state}</span>
              </div>
            </div>

            {/* Botões CTA */}
            <div className="flex flex-wrap gap-4">
              <Link to="/cardapio" className="btn-primary">
                Monte sua pizza
              </Link>
              <a
                href={settings.ifoodUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline"
              >
                Pedir no iFood
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Diferenciais */}
      <section className="container-app py-16">
        <h2 className="section-title text-center">Por que escolher a Ditto?</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {differentiators.map((d) => (
            <div key={d.title} className="card p-6 text-center">
              <span className="text-4xl">{d.icon}</span>
              <h3 className="mt-4 font-semibold text-brand-900">{d.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{d.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Localização */}
      <section className="container-app py-16 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h2 className="section-title">Onde Estamos</h2>
          <p className="mt-4 text-gray-600">
            {settings.address} - {settings.city}, {settings.state} - CEP{" "}
            {settings.zipCode}
          </p>
          <a
            href="https://www.google.com/maps/search/?api=1&query=Praça+da+Sé,+São+Paulo,+SP"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline mt-6 inline-block"
          >
            Ver no Google Maps
          </a>
        </div>
        <div className="rounded-2xl overflow-hidden border border-[#EAE1D3] h-72">
          <iframe
            title="Mapa"
            className="w-full h-full border-0"
            loading="lazy"
            src="https://www.google.com/maps?q=Pra%C3%A7a+da+S%C3%A9%2C+S%C3%A3o+Paulo%2C+SP&output=embed"
          />
        </div>
      </section>

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
