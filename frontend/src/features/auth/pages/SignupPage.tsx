import Link from "next/link";

import AuthLayout from "../components/AuthLayout";

import styles from "../auth.module.css";

export default function SignupPage() {
  return (
    <AuthLayout>
      <div className={styles.headingGroup}>
        <p className={styles.eyebrow}>
          JOIN TROVE
        </p>

        <h1>
          Start your recipe collection.
        </h1>

        <p className={styles.subtitle}>
          Create an account to collect recipes,
          record your kitchen experiments, and
          share what you discover.
        </p>
      </div>

      <form className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="displayName">
            Name
          </label>

          <input
            id="displayName"
            name="displayName"
            type="text"
            autoComplete="name"
            placeholder="Your name"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="email">
            Email
          </label>

          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="password">
            Password
          </label>

          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 15 characters"
          />
        </div>

        <button
          type="submit"
          className={styles.primaryButton}
        >
          Create account
        </button>
      </form>

      <p className={styles.switchText}>
        Already have an account?{" "}
        <Link href="/login">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}