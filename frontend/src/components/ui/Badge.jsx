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
    success: "bg-success-100 text-success-700",
    warning: "bg-warning-100 text-warning-700",
    error: "bg-danger-100 text-danger-700",
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

// StatusBadge é organizado por "domínio" — cada tela usa um vocabulário de
// status diferente (pedido, turno de caixa, ativo/inativo de cadastro), mas
// todas reaproveitam o mesmo componente/paleta em vez de reimplementar cor
// ad hoc (spec-4). O domínio "pedido" mantém 5 tons distintos (não os 4 do
// resto do sistema) porque o Kanban precisa diferenciar EM_PREPARO de
// SAIU_PARA_ENTREGA visualmente — ver frontend/src/services/orderStatus.js,
// que continua sendo a fonte de verdade pro accent de coluna do Kanban.
const STATUS_DOMAINS = {
  pedido: {
    RECEBIDO: { label: "Recebido", classes: "bg-warning-100 text-warning-700" },
    EM_PREPARO: { label: "Em preparo", classes: "bg-accent-100 text-accent-700" },
    SAIU_PARA_ENTREGA: { label: "Saiu para entrega", classes: "bg-purple-100 text-purple-700" },
    ENTREGUE: { label: "Entregue", classes: "bg-success-100 text-success-700" },
    CANCELADO: { label: "Cancelado", classes: "bg-danger-100 text-danger-700" },
  },
  turno: {
    ABERTO: { label: "Aberto", classes: "bg-accent-100 text-accent-700" },
    FECHADO_AGUARDANDO_CONFERENCIA: {
      label: "Aguardando conferência",
      classes: "bg-warning-100 text-warning-700",
    },
    CONFERIDO: { label: "Conferido", classes: "bg-success-100 text-success-700" },
  },
  cadastro: {
    ativo: { label: "Ativo", classes: "bg-success-100 text-success-700" },
    inativo: { label: "Inativo", classes: "bg-neutral-100 text-neutral-700" },
  },
};

/**
 * Badge de status, por domínio: `<StatusBadge domain="pedido" value={order.status} />`.
 */
export function StatusBadge({ domain, value, className = "" }) {
  const config = STATUS_DOMAINS[domain]?.[value];
  const label = config?.label ?? value;
  const classes = config?.classes ?? "bg-neutral-100 text-neutral-700";

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full whitespace-nowrap px-3 py-1.5 text-sm ${classes} ${className}`}
    >
      {label}
    </span>
  );
}
