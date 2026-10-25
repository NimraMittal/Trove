"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { register } from "../api/auth.api";
import PasswordField from "./PasswordField";

import styles from "../auth.module.css";

export default function SignupForm() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmPasswordTouched, setConfirmPasswordTouched] =
    useState(false);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setError(null);

    const trimmedName = displayName.trim();

    if (trimmedName.length < 2 || trimmedName.length > 80) {
      setError("Enter a name containing 2–80 characters.");
      return;
    }

    if (password.length < 15 || password.length > 128) {
      setError("Use a password containing 15–128 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordTouched(true);
      confirmPasswordRef.current?.focus();
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        displayName: trimmedName,
        email: email.trim().toLowerCase(),
        password,
      });

      setPassword("");
      setConfirmPassword("");
      router.replace("/login");
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to process registration. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className={styles.form}
      method="post"
      action="/api/auth/register"
      onSubmit={handleSubmit}
      aria-busy={isSubmitting}
    >
      <div className={styles.field}>
        <label htmlFor="signup-name">Name</label>

        <input
          id="signup-name"
          name="displayName"
          type="text"
          autoComplete="name"
          placeholder="Your name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          minLength={2}
          maxLength={80}
          required
          disabled={isSubmitting}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="signup-email">Email</label>

        <input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={254}
          required
          disabled={isSubmitting}
        />
      </div>

      <PasswordField
        id="signup-password"
        name="password"
        label="Password"
        autoComplete="new-password"
        placeholder="At least 15 characters"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          setError(null);
        }}
        minLength={15}
        maxLength={128}
        description="Use 15–128 characters. A long, memorable passphrase works well."
        descriptionId="signup-password-help"
        required
        disabled={isSubmitting}
      />

      <PasswordField
        id="signup-confirm-password"
        label="Confirm password"
        autoComplete="new-password"
        placeholder="Enter your password again"
        value={confirmPassword}
        onChange={(event) => {
          setConfirmPassword(event.target.value);
          setError(null);
        }}
        onBlur={() => setConfirmPasswordTouched(true)}
        inputRef={confirmPasswordRef}
        minLength={15}
        maxLength={128}
        error={
          confirmPasswordTouched && password !== confirmPassword
            ? "Passwords do not match."
            : null
        }
        errorId="signup-confirm-password-error"
        required
        disabled={isSubmitting}
      />

      {error && (
        <p className={styles.errorMessage} role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        className={styles.primaryButton}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Processing registration..." : "Create account"}
      </button>

      <noscript>
        <p>Enable JavaScript to register through this form.</p>
      </noscript>
    </form>
  );
}
