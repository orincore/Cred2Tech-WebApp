import React from 'react';
import { AlertCircle } from 'lucide-react';

const FormField = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder = '',
  error,
  hint,
  required = false,
  disabled = false,
  children, // for custom input (select, etc.)
}) => (
  <div className="form-group">
    {label && (
      <label className="form-label" htmlFor={name}>
        {label}
        {required && <span className="required">*</span>}
      </label>
    )}
    {children ? (
      children
    ) : (
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`form-control${error ? ' error-input' : ''}`}
        autoComplete={type === 'password' ? 'current-password' : 'off'}
      />
    )}
    {hint && !error && <span className="form-hint">{hint}</span>}
    {error && (
      <span className="form-error">
        <AlertCircle size={12} />
        {error}
      </span>
    )}
  </div>
);

export default FormField;
