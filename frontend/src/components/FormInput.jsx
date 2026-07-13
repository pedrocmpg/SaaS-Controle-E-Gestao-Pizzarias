import { forwardRef } from "react";
import { generateInputId, focusClasses } from "../utils/accessibility";

/**
 * Componente Input acessível com label, error handling e ARIA attributes
 */
const FormInput = forwardRef(
  (
    {
      label,
      name,
      type = "text",
      placeholder,
      value,
      onChange,
      onBlur,
      error,
      required = false,
      disabled = false,
      helperText,
      className = "",
      ...props
    },
    ref
  ) => {
    const inputId = generateInputId(name);
    const errorId = `${inputId}_error`;
    const helperId = `${inputId}_helper`;

    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1" aria-label="obrigatório">*</span>}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          name={name}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          aria-label={label || placeholder}
          aria-describedby={
            error ? errorId : helperText ? helperId : undefined
          }
          aria-invalid={error ? "true" : "false"}
          aria-required={required}
          className={`
            w-full px-4 py-2.5 border rounded-lg transition-colors
            ${focusClasses.ring}
            ${error ? "border-red-500 bg-red-50" : "border-gray-200 bg-white"}
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
            ${className}
          `}
          {...props}
        />

        {error && (
          <p id={errorId} className="text-sm text-red-600 flex items-center gap-1">
            <span aria-label="erro">⚠</span>
            {error}
          </p>
        )}

        {helperText && !error && (
          <p id={helperId} className="text-sm text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

FormInput.displayName = "FormInput";

export default FormInput;
