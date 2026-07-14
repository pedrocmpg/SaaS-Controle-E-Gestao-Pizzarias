/**
 * Componente visual de preview da pizza sendo montada
 */

// Cores vivas dos sabores (representam ingredientes reais, fora da paleta ember/melt)
const FLAVOR_COLORS = [
  "#FF6B6B", // vermelho
  "#4ECDC4", // teal
  "#FFE66D", // amarelo
  "#95E1D3", // mint
  "#A8E6CF", // verde claro
  "#FFD3B6", // pêssego
  "#FFAAA5", // coral
  "#FF8B94", // rosa
];

// Versão estática e compacta do círculo de pizza, usada como chamada na home
export function HeroPizzaPreview({ slices = 4 }) {
  return (
    <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
      <svg viewBox="0 0 200 200" className="w-full h-full filter drop-shadow-md animate-pulse-soft">
        <circle cx="100" cy="100" r="95" fill="#E8C4A0" stroke="#D4A373" strokeWidth="2" />
        <circle cx="100" cy="100" r="85" fill="#FDD835" opacity="0.9" />
        {Array.from({ length: slices }).map((_, i) => {
          const angle = (360 / slices) * i;
          const color = FLAVOR_COLORS[i % FLAVOR_COLORS.length];
          const startAngle = (angle * Math.PI) / 180;
          const sliceAngle = ((360 / slices) * Math.PI) / 180;

          const x1 = 100 + 85 * Math.cos(startAngle);
          const y1 = 100 + 85 * Math.sin(startAngle);
          const x2 = 100 + 85 * Math.cos(startAngle + sliceAngle);
          const y2 = 100 + 85 * Math.sin(startAngle + sliceAngle);

          const largeArc = sliceAngle > Math.PI ? 1 : 0;

          const pathData = [
            `M 100 100`,
            `L ${x1} ${y1}`,
            `A 85 85 0 ${largeArc} 1 ${x2} ${y2}`,
            `Z`,
          ].join(" ");

          return <path key={i} d={pathData} fill={color} opacity="0.85" stroke="#fff" strokeWidth="1.5" />;
        })}
      </svg>
    </div>
  );
}

export function PizzaPreview({ size, selectedFlavors, selectedBorder }) {
  const flavorCount = selectedFlavors.length;
  const maxFlavors = size.maxFlavors;
  const colors = FLAVOR_COLORS;

  return (
    <div className="flex flex-col items-center justify-center py-6 sm:py-8">
      {/* Pizza Visual */}
      <div className="relative w-48 h-48 sm:w-56 sm:h-56">
        {/* Base da Pizza */}
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full filter drop-shadow-lg"
        >
          {/* Crust */}
          <circle
            cx="100"
            cy="100"
            r="95"
            fill="#E8C4A0"
            stroke="#D4A373"
            strokeWidth="2"
          />

          {/* Cheese base */}
          <circle
            cx="100"
            cy="100"
            r="85"
            fill="#FDD835"
            opacity="0.9"
          />

          {/* Fatias com sabores */}
          {flavorCount > 0 ? (
            Array.from({ length: flavorCount }).map((_, i) => {
              const angle = (360 / maxFlavors) * i;
              const color = colors[i % colors.length];
              const startAngle = (angle * Math.PI) / 180;
              const sliceAngle = ((360 / maxFlavors) * Math.PI) / 180;

              const x1 = 100 + 85 * Math.cos(startAngle);
              const y1 = 100 + 85 * Math.sin(startAngle);
              const x2 = 100 + 85 * Math.cos(startAngle + sliceAngle);
              const y2 = 100 + 85 * Math.sin(startAngle + sliceAngle);

              const largeArc = sliceAngle > Math.PI ? 1 : 0;

              const pathData = [
                `M 100 100`,
                `L ${x1} ${y1}`,
                `A 85 85 0 ${largeArc} 1 ${x2} ${y2}`,
                `Z`,
              ].join(" ");

              return (
                <path
                  key={i}
                  d={pathData}
                  fill={color}
                  opacity="0.85"
                  stroke="#fff"
                  strokeWidth="1.5"
                  className="transition-opacity duration-300 hover:opacity-100"
                />
              );
            })
          ) : (
            // Placeholder quando vazio
            <text
              x="100"
              y="100"
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-sm font-semibold fill-gray-400"
            >
              Escolha sabores
            </text>
          )}
        </svg>

        {/* Borda Visual Indicator */}
        {selectedBorder && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-amber-900 text-white text-xs px-3 py-1 rounded-full whitespace-nowrap">
            Borda: {selectedBorder.name}
          </div>
        )}
      </div>

      {/* Informações */}
      <div className="mt-6 text-center space-y-2">
        <p className="text-sm text-gray-600">
          <span className="font-semibold text-brand-900">{size.name}</span> •{" "}
          <span className="text-xs">{size.slices} fatias</span>
        </p>
        {flavorCount > 0 && (
          <div className="flex flex-wrap gap-1 justify-center">
            {selectedFlavors.map((flavor) => (
              <span
                key={flavor.id}
                className="inline-block bg-accent-100 text-accent-700 text-xs px-2 py-1 rounded-full"
              >
                {flavor.name}
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-3">
          {maxFlavors - flavorCount} sabor{maxFlavors - flavorCount !== 1 ? "es" : ""} restante{maxFlavors - flavorCount !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
