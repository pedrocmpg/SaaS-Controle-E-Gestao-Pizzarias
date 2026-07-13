export default function Logo({ variant = "full", className = "" }) {
  if (variant === "icon") {
    return <LogoIcon className={className} />;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LogoIcon className="w-12 h-12 shrink-0" />
      <div className="leading-tight">
        <p className="text-xs font-semibold text-gray-700">
          E Tenho Ditto Pizzaria
        </p>
        <p className="text-[0.65rem] text-gray-500 font-normal">
          Pizzaria artesanal
        </p>
      </div>
    </div>
  );
}

function LogoIcon({ className = "" }) {
  return (
    <img
      src="/images/logo.png"
      alt="Logo E Tenho Ditto Pizzaria"
      className={className}
    />
  );
}
