import { createContext, useContext, useEffect, useState } from "react";

/**
 * Sistema de Toast com suporte a múltiplos tipos (success, error, info, warning)
 * Usa Context global para ser acessível em qualquer lugar da app
 */

const TOAST_DURATION = 4000;

export const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = "info", duration = TOAST_DURATION) => {
    const id = Date.now();
    const toast = { id, message, type, duration };
    
    setToasts((prev) => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }

    return id;
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toast = {
    success: (msg, dur) => addToast(msg, "success", dur),
    error: (msg, dur) => addToast(msg, "error", dur),
    info: (msg, dur) => addToast(msg, "info", dur),
    warning: (msg, dur) => addToast(msg, "warning", dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de ToastProvider");
  return ctx;
}

function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="fixed bottom-4 right-4 z-[999] space-y-3 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }) {
  const [isExiting, setIsExiting] = useState(false);

  const typeStyles = {
    success: {
      bg: "bg-green-500",
      icon: "✓",
      text: "text-white",
      role: "status",
    },
    error: {
      bg: "bg-red-500",
      icon: "✕",
      text: "text-white",
      role: "alert",
    },
    info: {
      bg: "bg-blue-500",
      icon: "ℹ",
      text: "text-white",
      role: "status",
    },
    warning: {
      bg: "bg-yellow-500",
      icon: "⚠",
      text: "text-white",
      role: "alert",
    },
  };

  const style = typeStyles[toast.type] || typeStyles.info;

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onRemove, 200);
  };

  return (
    <div
      className={`
        pointer-events-auto flex items-start gap-3 rounded-lg px-4 py-3
        ${style.bg} ${style.text} shadow-lg
        transform transition-all duration-200
        ${isExiting ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"}
      `}
      role={style.role}
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="text-lg font-bold flex-shrink-0 mt-0.5" aria-hidden="true">
        {style.icon}
      </span>
      <p className="text-sm font-medium flex-1">{toast.message}</p>
      <button
        onClick={handleClose}
        className="flex-shrink-0 text-lg leading-none opacity-70 hover:opacity-100 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white rounded"
        aria-label="Fechar notificação"
      >
        ✕
      </button>
    </div>
  );
}
