import Link from "next/link";

import AuthLayout from "../components/AuthLayout";

import styles from "../auth.module.css";

export default function LoginPage() {
  return (
    <AuthLayout>
      <div className={styles.headingGroup}>
        <p className={styles.eyebrow}>
          WELCOME BACK
        </p>

        <h1>
          Continue your Trove.
        </h1>

        <p className={styles.subtitle}>
          Sign in to save recipes, document attempts,
          and continue building your collection.
        </p>
      </div>

      <form className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="email">
            Email
          </label>

          <input
            id="email"
            type="email"
            name="email"
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
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Your password"
          />
        </div>

        <button
          type="submit"
          className={styles.primaryButton}
        >
          Sign in
        </button>
      </form>

      <p className={styles.switchText}>
        New to Trove?{" "}
        <Link href="/signup">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}