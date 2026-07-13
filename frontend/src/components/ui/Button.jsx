import { forwardRef } from "react";

/**
 * Componente Button centralizado com suporte a variants, sizes e states
 */

const Button = forwardRef(
  (
    {
      children,
      variant = "primary",
      size = "md",
      disabled = false,
      loading = false,
      className = "",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer relative";

    const variants = {
      primary:
        "bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-700 focus:ring-accent-500 disabled:hover:bg-accent-500",
      secondary:
        "bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 focus:ring-brand-700 disabled:hover:bg-brand-700",
      outline:
        "border-2 border-brand-600 text-brand-700 hover:bg-brand-50 active:bg-brand-100 focus:ring-brand-600",
      ghost: "text-brand-700 hover:bg-brand-50 active:bg-brand-100 focus:ring-brand-600",
      danger: "bg-red-500 text-white hover:bg-red-600 active:bg-red-700 focus:ring-red-500 disabled:hover:bg-red-500",
    };

    const sizes = {
      xs: "px-3 py-1.5 text-xs min-h-8",
      sm: "px-4 py-2 text-sm min-h-9",
      md: "px-6 py-3 text-base min-h-10",
      lg: "px-8 py-4 text-lg min-h-12",
      icon: "w-10 h-10 p-0 min-h-10",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
              opacity="0.2"
            />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
        <span className={loading ? "sr-only" : ""}>{children}</span>
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
