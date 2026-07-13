/**
 * Badges para tags, labels e status
 */

export function Badge({ children, variant = "default", size = "md", className = "" }) {
  const baseStyles =
    "inline-flex items-center font-semibold rounded-full whitespace-nowrap";

  const variants = {
    default: "bg-gray-100 text-gray-700",
    primary: "bg-brand-100 text-brand-700",
    accent: "bg-accent-100 text-accent-700",
    success: "bg-green-100 text-green-700",
    warning: "bg-yellow-100 text-yellow-700",
    error: "bg-red-100 text-red-700",
    outline: "border border-gray-300 text-gray-700",
  };

  const sizes = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  return (
    <span
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const statusConfig = {
    pending: { label: "Pendente", variant: "warning" },
    confirmed: { label: "Confirmado", variant: "info" },
    preparing: { label: "Preparando", variant: "accent" },
    ready: { label: "Pronto", variant: "success" },
    delivered: { label: "Entregue", variant: "success" },
    cancelled: { label: "Cancelado", variant: "error" },
  };

  const config = statusConfig[status] || { label: status, variant: "default" };

  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
}
