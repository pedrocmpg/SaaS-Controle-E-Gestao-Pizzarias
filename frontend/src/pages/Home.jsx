import { Link } from "react-router-dom";
import { useStore } from "../context/StoreContext";

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
            <span className="inline-flex items-center gap-2 bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-full w-fit mb-6">
              <span className="text-sm">★ 4.8 NO DELIVERY</span>
            </span>

            {/* Headline - Com fonte serif */}
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-black text-gray-900 leading-tight mb-2">
              E Tenho Ditto
            </h1>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-red-600 mb-4">
              Pizzaria
            </h2>

            {/* Descrição */}
            <p className="text-gray-700 text-base md:text-lg max-w-md mb-6 leading-relaxed">
              Pizzas artesanais em Bento Gonçalves e Garibaldi. Monte a sua, escolha uma borda recheada e receba em casa.
            </p>

            {/* Info de entrega */}
            <div className="flex flex-wrap gap-6 text-sm mb-8">
              <div className="flex items-center gap-2 text-gray-700">
                <span className="text-lg">⏱</span>
                <span>{settings.minDeliveryTime}-{settings.maxDeliveryTime} min</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <span className="text-lg">💰</span>
                <span>R$ {Number(settings.minDeliveryFee).toFixed(2)} a R$ {Number(settings.maxDeliveryFee).toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-700">
                <span className="text-lg">📍</span>
                <span>Bento Gonçalves, RS</span>
              </div>
            </div>

            {/* Botões CTA */}
            <div className="flex flex-wrap gap-4">
              <Link to="/cardapio" className="btn-primary bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                Monte sua pizza
              </Link>
              <a
                href="https://www.ifood.com.br/delivery/bento-goncalves-rs/e-tenho-ditto-pizzaria---bento-goncalves-e-garibaldi-humaita/9e21dfe2-99f6-4abc-9b51-3e4433336bfb"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline border-2 border-gray-400 text-gray-700 font-bold py-3 px-6 rounded-lg hover:bg-gray-100 transition-colors"
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

      {/* Destaques */}
      <section className="bg-brand-50 py-16">
        <div className="container-app">
          <h2 className="section-title text-center">Destaques da Casa</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="card p-8 flex flex-col justify-between bg-gradient-to-br from-red-600 to-red-700 text-white">
              <div>
                <h3 className="text-2xl font-bold">Combo Família</h3>
                <p className="mt-2 text-red-100">
                  1 Pizza Grande (4 sabores) + 1 Pizza Broto por apenas R$ 29,90
                </p>
              </div>
              <p className="mt-6 text-3xl font-extrabold">R$ 134,90</p>
              <Link to="/cardapio" className="mt-4 btn-secondary bg-white text-red-600 hover:bg-red-50 w-fit font-bold">
                Pedir agora
              </Link>
            </div>

            <div className="card p-8 flex flex-col justify-between bg-gradient-to-br from-gray-800 to-gray-900 text-white">
              <div>
                <h3 className="text-2xl font-bold">Pizza Vulcão 🌋</h3>
                <p className="mt-2 text-gray-200">
                  Novidade! Pizza Grande com borda vulcão e até 3 sabores.
                </p>
              </div>
              <p className="mt-6 text-3xl font-extrabold">R$ 142,00</p>
              <Link to="/cardapio" className="mt-4 btn-secondary bg-white text-gray-900 hover:bg-gray-100 w-fit font-bold">
                Pedir agora
              </Link>
            </div>
          </div>
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
          <p className="mt-2 text-gray-600">Bairro Humaitá</p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              `${settings.address}, ${settings.city}, ${settings.state}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline mt-6 inline-block"
          >
            Ver no Google Maps
          </a>
        </div>
        <div className="rounded-2xl overflow-hidden shadow-card h-72">
          <iframe
            title="Mapa - E Tenho Ditto Pizzaria"
            className="w-full h-full border-0"
            loading="lazy"
            src={`https://www.google.com/maps?q=${encodeURIComponent(
              `${settings.address}, ${settings.city}, ${settings.state}`
            )}&output=embed`}
          />
        </div>
      </section>
    </div>
  );
}
