import { useStore } from "../context/StoreContext";
import { buildWhatsAppLink } from "../utils/whatsapp";

const dayLabels = {
  seg: "Segunda-feira",
  ter: "Terça-feira",
  qua: "Quarta-feira",
  qui: "Quinta-feira",
  sex: "Sexta-feira",
  sab: "Sábado",
  dom: "Domingo",
};

export default function Contact() {
  const { settings } = useStore();
  const whatsappLink = buildWhatsAppLink(settings.whatsapp, "Olá! Gostaria de fazer um pedido.");

  return (
    <div className="container-app py-16 grid md:grid-cols-2 gap-12">
      <div>
        <h1 className="section-title">Fale com a gente</h1>
        <p className="text-gray-600 mt-4">
          Dúvidas, sugestões ou quer fazer seu pedido direto? Estamos disponíveis
          pelos canais abaixo.
        </p>

        <div className="mt-8 space-y-4">
          <ContactRow label="Endereço">
            {settings.address} - {settings.city}, {settings.state} - CEP {settings.zipCode}
          </ContactRow>
          <ContactRow label="Telefone / WhatsApp">{settings.phone}</ContactRow>
          {settings.ifoodUrl && (
            <ContactRow label="iFood">
              <a href={settings.ifoodUrl} target="_blank" rel="noopener noreferrer" className="underline text-accent-600">
                Pedir pelo iFood
              </a>
            </ContactRow>
          )}
        </div>

        <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn-primary mt-8 inline-flex">
          Chamar no WhatsApp
        </a>
      </div>

      <div className="card p-6">
        <h2 className="font-bold text-brand-900 mb-4">Horário de Funcionamento</h2>
        <ul className="divide-y divide-black/5">
          {Object.entries(settings.openingHours || {}).map(([day, hours]) => (
            <li key={day} className="flex justify-between py-2 text-sm">
              <span className="text-gray-600">{dayLabels[day] || day}</span>
              <span className="font-medium text-brand-900">
                {hours.open} - {hours.close}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ContactRow({ label, children }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
      <p className="text-gray-700">{children}</p>
    </div>
  );
}
