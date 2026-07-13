/**
 * Componentes de loading states
 */

export function Spinner({ size = "md", className = "" }) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  };

  return (
    <div className={`inline-block ${sizeClasses[size]} ${className}`}>
      <svg
        className="animate-spin"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
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
    </div>
  );
}

export function SkeletonLoader({ count = 3, height = "h-20" }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${height} bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg animate-pulse`}
        />
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 3 }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-6 space-y-3">
          <div className="h-6 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
          <div className="h-8 bg-gray-200 rounded animate-pulse mt-4" />
        </div>
      ))}
    </div>
  );
}
