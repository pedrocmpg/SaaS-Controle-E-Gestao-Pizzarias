import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Painel lateral (slide-over) pro formulário de criação/edição de cadastro.
 * Reaproveita o padrão de backdrop/Escape/scroll-lock do Modal genérico, mas
 * fixado à direita em vez de centralizado (spec-4).
 */
export function CadastroSlideOver({ open, onClose, title, children, footer = null }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "unset";
      };
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white shadow-2xl flex flex-col transform transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slideover-title"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 flex-shrink-0">
          <h2 id="slideover-title" className="text-lg font-display font-semibold text-char">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {footer && (
          <div className="border-t border-black/5 p-5 flex gap-3 flex-shrink-0">{footer}</div>
        )}
      </div>
    </>
  );
}
