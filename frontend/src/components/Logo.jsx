export default function Logo({ className = "" }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="leading-tight">
        <p className="text-xs font-semibold text-gray-700">Sua marca aqui</p>
      </div>
    </div>
  );
}
