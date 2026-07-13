import { useEffect } from "react";

/**
 * Componente Modal reutilizável com backdrop, animações e acessibilidade
 */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer = null,
  size = "md",
  closeButton = true,
}) {
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

  const sizeClasses = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
    xl: "sm:max-w-xl",
    "2xl": "sm:max-w-2xl",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none sm:p-4 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className={`
            bg-white w-full pointer-events-auto sm:rounded-2xl rounded-t-2xl
            shadow-2xl transform transition-all duration-200
            max-h-[90vh] overflow-y-auto
            ${sizeClasses[size]}
            ${open ? "scale-100 sm:translate-y-0 translate-y-0" : "scale-95 sm:translate-y-4 translate-y-8"}
          `}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white flex items-center justify-between p-5 border-b border-black/5 z-10">
            <h2 id="modal-title" className="text-xl font-bold text-brand-900">
              {title}
            </h2>
            {closeButton && (
              <button
                onClick={onClose}
                className="text-2xl leading-none text-gray-400 hover:text-gray-600 transition"
                aria-label="Fechar"
              >
                ✕
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-5">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="sticky bottom-0 bg-white border-t border-black/5 p-5 flex gap-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
