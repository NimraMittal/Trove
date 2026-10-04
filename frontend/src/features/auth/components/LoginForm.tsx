"use client";

import type { SubmitEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { login } from "../api/auth.api";

import styles from "../auth.module.css";

export default function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(
    event: SubmitEvent<HTMLFormElement>,
  ): Promise<void> {
    // Stop the browser's normal form submission.
    event.preventDefault();

    // Ignore another submission while this request is in progress.
    if (isSubmitting) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      // The API helper sends the request and validates the response.
      await login({
        email: email.trim().toLowerCase(),
        password,
      });

      // Clear the password from this component's state.
      setPassword("");

      // Navigate only after the login request succeeds.
      router.replace("/recipes");
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to sign in. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className={styles.form}
      method="post"
      action="/api/auth/login"
      onSubmit={handleSubmit}
      aria-busy={isSubmitting}
    >
      <div className={styles.field}>
        <label htmlFor="login-email">
          Email
        </label>

        <input
          id="login-email"
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

      <div className={styles.field}>
        <label htmlFor="login-password">
          Password
        </label>

        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          maxLength={128}
          required
          disabled={isSubmitting}
        />
      </div>

      {error && (
        <p
          className={styles.errorMessage}
          role="alert"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        className={styles.primaryButton}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>

      <noscript>
        <p className={styles.errorMessage}>
          Enable JavaScript to sign in through this form.
        </p>
      </noscript>
    </form>
  );
}