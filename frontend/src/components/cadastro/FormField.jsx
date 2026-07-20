export const inputClass =
  "w-full border border-flour-2 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ember-500/30 focus:border-ember-500";

export function Field({ label, required, children }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-ink mb-1">
        {label}
        {required && <span className="text-danger-700"> *</span>}
      </span>
      {children}
    </label>
  );
}
