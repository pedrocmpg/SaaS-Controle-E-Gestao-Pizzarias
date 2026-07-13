import { forwardRef } from "react";
import { generateInputId, focusClasses } from "../utils/accessibility";

/**
 * Componente Checkbox acessível
 */
const FormCheckbox = forwardRef(
  (
    {
      label,
      name,
      checked = false,
      onChange,
      disabled = false,
      required = false,
      className = "",
      ...props
    },
    ref
  ) => {
    const inputId = generateInputId(name);

    return (
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          type="checkbox"
          id={inputId}
          name={name}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          required={required}
          aria-label={label}
          aria-required={required}
          className={`
            w-5 h-5 rounded border-gray-300 text-accent-600
            ${focusClasses.ring}
            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
            transition-colors
            ${className}
          `}
          {...props}
        />
        {label && (
          <label
            htmlFor={inputId}
            className={`text-sm font-medium text-gray-700 ${
              disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
      </div>
    );
  }
);

FormCheckbox.displayName = "FormCheckbox";

export default FormCheckbox;
