import { useStore } from "../context/StoreContext";
import { buildWhatsAppLink } from "../utils/whatsapp";

// Botão flutuante fixo para contato rápido via WhatsApp
export default function WhatsAppButton() {
  const { settings } = useStore();
  const link = buildWhatsAppLink(
    settings.whatsapp,
    "Olá! Vim pelo site e gostaria de fazer um pedido 🍕"
  );

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Fale conosco pelo WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-char hover:scale-105 transition-transform"
    >
      <svg viewBox="0 0 24 24" className="w-7 h-7 fill-flour">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-1.746-.873-2.892-1.554-4.043-3.527-.306-.527.306-.489.876-1.628.098-.198.049-.371-.05-.52-.099-.148-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.372-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.05 3.132 4.996 4.27 2.945 1.138 2.945.759 3.482.71.537-.05 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.413-.074-.124-.272-.198-.57-.347z" />
        <path d="M12.004 2.003c-5.514 0-9.997 4.483-9.997 9.997 0 1.767.46 3.428 1.267 4.87L2 22l5.267-1.264a9.937 9.937 0 0 0 4.737 1.264h.004c5.514 0 9.996-4.483 9.996-9.997 0-2.67-1.04-5.18-2.928-7.07a9.93 9.93 0 0 0-7.072-2.93zm0 18.163h-.003a8.16 8.16 0 0 1-4.16-1.14l-.298-.177-3.108.747.759-3.03-.194-.31a8.146 8.146 0 0 1-1.24-4.256c0-4.507 3.669-8.176 8.247-8.176 2.202 0 4.27.86 5.827 2.42a8.146 8.146 0 0 1 2.417 5.826c0 4.507-3.67 8.176-8.247 8.176z" />
      </svg>
    </a>
  );
}
