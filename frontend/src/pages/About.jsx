export default function About() {
  return (
    <div className="container-app py-16 max-w-3xl">
      <h1 className="section-title">Sobre a E Tenho Ditto Pizzaria</h1>
      <p className="mt-6 text-gray-600 leading-relaxed">
        A E Tenho Ditto Pizzaria nasceu em Bento Gonçalves com um propósito simples:
        servir pizzas que fazem as pessoas dizerem &ldquo;eu já tenho ditto que essa é a
        melhor pizza da cidade&rdquo;. Trabalhamos com massa artesanal de fermentação
        lenta, ingredientes selecionados e um cardápio com mais de 80 sabores entre
        salgados e doces para agradar todos os paladares.
      </p>
      <p className="mt-4 text-gray-600 leading-relaxed">
        Nossa equipe se dedica todos os dias para entregar não só uma pizza, mas uma
        experiência: do primeiro clique no pedido até a última fatia na sua mesa.
      </p>

      <div className="mt-10 grid sm:grid-cols-3 gap-6 text-center">
        <div className="card p-6">
          <p className="text-3xl font-extrabold text-accent-600">80+</p>
          <p className="text-sm text-gray-500 mt-1">Sabores no cardápio</p>
        </div>
        <div className="card p-6">
          <p className="text-3xl font-extrabold text-accent-600">100%</p>
          <p className="text-sm text-gray-500 mt-1">Massa artesanal</p>
        </div>
        <div className="card p-6">
          <p className="text-3xl font-extrabold text-accent-600">Bento Gonçalves</p>
          <p className="text-sm text-gray-500 mt-1">Coração da Serra Gaúcha</p>
        </div>
      </div>
    </div>
  );
}
