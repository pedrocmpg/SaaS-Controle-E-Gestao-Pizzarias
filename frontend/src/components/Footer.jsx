import { Link } from "react-router-dom";
import Logo from "./Logo";
import { useStore } from "../context/StoreContext";

const dayLabels = {
  seg: "Segunda",
  ter: "Terça",
  qua: "Quarta",
  qui: "Quinta",
  sex: "Sexta",
  sab: "Sábado",
  dom: "Domingo",
};

export default function Footer() {
  const { settings } = useStore();

  return (
    <footer className="bg-brand-900 text-brand-50 mt-20">
      <div className="container-app py-12 grid gap-10 md:grid-cols-3">
        <div>
          <div className="bg-white inline-block rounded-2xl p-3">
            <Logo />
          </div>
          <p className="mt-4 text-brand-200 max-w-xs">
            Pizzas artesanais feitas com carinho em Bento Gonçalves. Peça já e
            receba com rapidez e sabor!
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-white mb-3">Horário de Funcionamento</h3>
          <ul className="space-y-1 text-brand-200 text-sm">
            {Object.entries(settings.openingHours || {}).map(([day, hours]) => (
              <li key={day} className="flex justify-between max-w-[220px]">
                <span>{dayLabels[day] || day}</span>
                <span>
                  {hours.open} - {hours.close}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-white mb-3">Contato</h3>
          <ul className="space-y-2 text-brand-200 text-sm">
            <li>{settings.address}</li>
            <li>
              {settings.city} - {settings.state}, {settings.zipCode}
            </li>
            <li>{settings.phone}</li>
          </ul>

          <div className="flex gap-3 mt-4">
            {settings.ifoodUrl && (
              <a
                href={settings.ifoodUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline text-brand-100 hover:text-white"
              >
                Peça pelo iFood
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 py-4 text-center text-xs text-brand-300">
        <p>
          © {new Date().getFullYear()} E Tenho Ditto Pizzaria - HTC Foods LTDA · CNPJ 57.283.987/0001-16
        </p>
        <p className="mt-1">
          <Link to="/admin" className="hover:text-white underline">
            Área administrativa
          </Link>
        </p>
      </div>
    </footer>
  );
}
