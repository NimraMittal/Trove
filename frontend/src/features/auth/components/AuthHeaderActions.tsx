"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentUser, logout } from "../api/auth.api";
import type { AuthUser } from "../types/auth.types";

import styles from "./AuthHeaderActions.module.css";

type AccountState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "authenticated"; user: AuthUser }
  | { status: "error" };

export default function AuthHeaderActions() {
  const pathname = usePathname();

  // Start a fresh account check when the pathname changes.
  return <SessionActions key={pathname} />;
}

function SessionActions() {
  const router = useRouter();

  const [account, setAccount] = useState<AccountState>({
    status: "loading",
  });

  const [retryCount, setRetryCount] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAccount() {
      try {
        const user = await getCurrentUser(controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        if (user) {
          setAccount({
            status: "authenticated",
            user,
          });
        } else {
          setAccount({
            status: "guest",
          });
        }
      } catch {
        if (!controller.signal.aborted) {
          setAccount({
            status: "error",
          });
        }
      }
    }

    void loadAccount();

    return () => {
      controller.abort();
    };
  }, [retryCount]);

  function handleRetry() {
    setAccount({ status: "loading" });
    setRetryCount((count) => count + 1);
  }

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setLogoutError(null);
    setIsLoggingOut(true);

    try {
      await logout();

      // Change the UI only after the backend confirms logout.
      setAccount({ status: "guest" });

      router.replace("/");
    } catch (error: unknown) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : "Logout could not be confirmed. Please try again.",
      );
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (account.status === "loading") {
    return (
      <div className={styles.controls}>
        <span className={styles.message} role="status">
          Checking account…
        </span>
      </div>
    );
  }

  if (account.status === "error") {
    return (
      <div className={styles.controls}>
        <span className={styles.message} role="status">
          Account unavailable.
        </span>

        <button
          type="button"
          className={styles.outlineButton}
          onClick={handleRetry}
        >
          Retry
        </button>
      </div>
    );
  }

  if (account.status === "guest") {
    return (
      <nav
        className={styles.controls}
        aria-label="Account navigation"
      >
        <Link href="/login" className={styles.textLink}>
          Log in
        </Link>

        <Link href="/signup" className={styles.button}>
          Sign up
        </Link>
      </nav>
    );
  }

  return (
    <div
      className={styles.controls}
      aria-busy={isLoggingOut}
    >
      <span
        className={styles.name}
        title={account.user.displayName}
      >
        {account.user.displayName}
      </span>

      <button
        type="button"
        className={styles.button}
        onClick={handleLogout}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? "Logging out…" : "Log out"}
      </button>

      {logoutError && (
        <p className={styles.error} role="alert">
          {logoutError}
        </p>
      )}
    </div>
  );
}