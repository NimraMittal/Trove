import Link from "next/link";

import AuthLayout from "../components/AuthLayout";
import LoginForm from "../components/LoginForm";

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
          Sign in to continue exploring Trove.
        </p>
      </div>

      <LoginForm />

      <p className={styles.switchText}>
        New to Trove?{" "}
        <Link href="/signup">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}