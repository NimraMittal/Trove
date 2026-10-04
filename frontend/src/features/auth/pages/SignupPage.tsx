import Link from "next/link";

import AuthLayout from "../components/AuthLayout";
import SignupForm from "../components/SignupForm";

import styles from "../auth.module.css";

export default function SignupPage() {
  return (
    <AuthLayout>
      <div className={styles.headingGroup}>
        <p className={styles.eyebrow}>JOIN TROVE</p>

        <h1>Create your Trove account.</h1>

        <p className={styles.subtitle}>
          Submit your registration, then sign in with your email
          and password.
        </p>
      </div>

      <SignupForm />

      <p className={styles.switchText}>
        Already have an account?{" "}
        <Link href="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}