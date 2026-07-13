import { forwardRef } from "react";
import { generateInputId, focusClasses } from "../utils/accessibility";

/**
 * Componente Select acessível com label e error handling
 */
const FormSelect = forwardRef(
  (
    {
      label,
      name,
      options = [],
      value,
      onChange,
      onBlur,
      error,
      required = false,
      disabled = false,
      placeholder = "Selecione uma opção",
      className = "",
      ...props
    },
    ref
  ) => {
    const inputId = generateInputId(name);
    const errorId = `${inputId}_error`;

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1" aria-label="obrigatório">*</span>}
          </label>
        )}

        <select
          ref={ref}
          id={inputId}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          aria-label={label || placeholder}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? "true" : "false"}
          aria-required={required}
          className={`
            w-full px-4 py-2.5 border rounded-lg transition-colors appearance-none
            ${focusClasses.ring}
            ${error ? "border-red-500 bg-red-50" : "border-gray-200 bg-white"}
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
            ${className}
          `}
          {...props}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {error && (
          <p id={errorId} className="text-sm text-red-600 flex items-center gap-1">
            <span aria-label="erro">⚠</span>
            {error}
          </p>
        )}
      </div>
    );
  }
);

FormSelect.displayName = "FormSelect";

export default FormSelect;
