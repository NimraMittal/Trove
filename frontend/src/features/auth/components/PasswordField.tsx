"use client";

import type {
  ChangeEventHandler,
  FocusEventHandler,
  ReactNode,
  Ref,
} from "react";
import { useState } from "react";

import styles from "../auth.module.css";

type PasswordFieldProps = {
  id: string;
  label: string;
  name?: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
  disabled?: boolean;
  description?: ReactNode;
  descriptionId?: string;
  error?: string | null;
  errorId?: string;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  inputRef?: Ref<HTMLInputElement>;
};

export default function PasswordField({
  id,
  label,
  name,
  value,
  onChange,
  autoComplete,
  placeholder,
  minLength,
  maxLength,
  required,
  disabled,
  description,
  descriptionId,
  error,
  errorId,
  onBlur,
  inputRef,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const describedBy = [
    description ? descriptionId : null,
    error ? errorId : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>

      <div className={styles.passwordInputWrapper}>
        <input
          ref={inputRef}
          id={id}
          name={name}
          type={isVisible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          minLength={minLength}
          maxLength={maxLength}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          required={required}
          disabled={disabled}
          className={styles.passwordInput}
        />

        <button
          type="button"
          className={styles.passwordToggle}
          aria-label={isVisible ? "Hide password" : "Show password"}
          aria-controls={id}
          aria-pressed={isVisible}
          disabled={disabled}
          onClick={() => setIsVisible((visible) => !visible)}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
            <circle cx="12" cy="12" r="2.5" />
            {isVisible && <path d="m4 4 16 16" />}
          </svg>
        </button>
      </div>

      {description && descriptionId && (
        <small id={descriptionId} className={styles.fieldHelp}>
          {description}
        </small>
      )}

      {error && errorId && (
        <p id={errorId} className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
