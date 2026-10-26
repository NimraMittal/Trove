"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { authenticateWithGoogle } from "../api/auth.api";

import styles from "../auth.module.css";

const googleScriptUrl = "https://accounts.google.com/gsi/client";
const googleClientId =
  process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? "";

const hasValidGoogleClientId =
  googleClientId.length <= 512 &&
  googleClientId.endsWith(".apps.googleusercontent.com");

type GoogleAuthState = "loading" | "ready" | "submitting" | "error";
type GoogleCredentialHandler = (response: { credential?: string }) => void;

let activeCredentialHandler: GoogleCredentialHandler | null = null;
let initializedGoogleClientId: string | null = null;

function dispatchGoogleCredential(response: { credential?: string }): void {
  activeCredentialHandler?.(response);
}

export default function GoogleAuthSection() {
  const router = useRouter();
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const initializedRef = useRef(false);
  const mountedRef = useRef(false);
  const submissionInProgressRef = useRef(false);
  const renderedWidthRef = useRef(0);

  const [authState, setAuthState] = useState<GoogleAuthState>(
    hasValidGoogleClientId ? "loading" : "error",
  );
  const [message, setMessage] = useState<string | null>(
    hasValidGoogleClientId
      ? null
      : "Google sign-in is unavailable right now. Use email and password instead.",
  );

  const renderGoogleButton = useCallback(() => {
    const container = buttonContainerRef.current;
    const googleIdentity = window.google?.accounts.id;

    if (!container || !googleIdentity || !initializedRef.current) {
      return;
    }

    const width = Math.floor(
      Math.min(400, container.getBoundingClientRect().width),
    );

    if (width < 1) {
      return;
    }

    if (
      renderedWidthRef.current === width &&
      container.childElementCount > 0
    ) {
      return;
    }

    container.replaceChildren();
    googleIdentity.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "left",
      width: String(width),
    });
    renderedWidthRef.current = width;
    setAuthState("ready");
  }, []);

  const handleCredential = useCallback(
    async (response: { credential?: string }): Promise<void> => {
      if (!mountedRef.current || submissionInProgressRef.current) {
        return;
      }

      const credential = response.credential?.trim();

      if (!credential || credential.length > 8192) {
        setAuthState("error");
        setMessage(
          "Google did not return a usable sign-in response. Please try again.",
        );
        return;
      }

      submissionInProgressRef.current = true;
      setAuthState("submitting");
      setMessage("Signing in with Google…");

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      let authenticationSucceeded = false;

      try {
        await authenticateWithGoogle(credential, abortController.signal);
        authenticationSucceeded = true;

        if (mountedRef.current) {
          router.replace("/recipes");
        }
      } catch (error: unknown) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        if (mountedRef.current) {
          setAuthState("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "Google sign-in is unavailable. Please try again.",
          );
        }
      } finally {
        abortControllerRef.current = null;

        if (!authenticationSucceeded) {
          submissionInProgressRef.current = false;
        }
      }
    },
    [router],
  );

  const initializeGoogle = useCallback(() => {
    if (!mountedRef.current || initializedRef.current) {
      return;
    }

    const googleIdentity = window.google?.accounts.id;

    if (!googleIdentity) {
      setAuthState("error");
      setMessage(
        "Google sign-in could not load. Check your connection and refresh the page.",
      );
      return;
    }

    if (
      initializedGoogleClientId !== null &&
      initializedGoogleClientId !== googleClientId
    ) {
      setAuthState("error");
      setMessage(
        "Google sign-in configuration changed. Refresh the page and try again.",
      );
      return;
    }

    if (initializedGoogleClientId === null) {
      googleIdentity.initialize({
        client_id: googleClientId,
        callback: dispatchGoogleCredential,
        auto_select: false,
        button_auto_select: false,
        use_fedcm_for_button: false,
        ux_mode: "popup",
      });
      initializedGoogleClientId = googleClientId;
    }

    initializedRef.current = true;
    renderGoogleButton();
  }, [renderGoogleButton]);

  useEffect(() => {
    mountedRef.current = true;
    activeCredentialHandler = handleCredential;
    const container = buttonContainerRef.current;
    const resizeObserver = new ResizeObserver(renderGoogleButton);
    let initializationFrame: number | null = null;

    if (container) {
      resizeObserver.observe(container);
    }

    if (hasValidGoogleClientId && window.google?.accounts.id) {
      initializationFrame = window.requestAnimationFrame(initializeGoogle);
    }

    return () => {
      mountedRef.current = false;

      if (activeCredentialHandler === handleCredential) {
        activeCredentialHandler = null;
      }

      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      submissionInProgressRef.current = false;
      initializedRef.current = false;
      renderedWidthRef.current = 0;
      resizeObserver.disconnect();

      if (initializationFrame !== null) {
        window.cancelAnimationFrame(initializationFrame);
      }

      container?.replaceChildren();
    };
  }, [handleCredential, initializeGoogle, renderGoogleButton]);

  return (
    <section
      className={styles.googleAuthSection}
      aria-label="Google authentication"
    >
      <div className={styles.authDivider} aria-hidden="true">
        <span>or</span>
      </div>

      <div
        className={styles.googleButtonFrame}
        data-busy={authState === "submitting" ? "true" : "false"}
        aria-busy={authState === "submitting"}
      >
        <div
          ref={buttonContainerRef}
          className={styles.googleButtonContainer}
          data-google-button-container
        />
      </div>

      {(authState === "loading" || message) && (
        <p
          className={
            authState === "error"
              ? styles.googleErrorMessage
              : styles.googleStatusMessage
          }
          role="status"
          aria-live="polite"
          data-google-auth-status
        >
          {message ?? "Loading Google sign-in…"}
        </p>
      )}

      {hasValidGoogleClientId && (
        <Script
          id="google-identity-services"
          src={googleScriptUrl}
          strategy="afterInteractive"
          onReady={initializeGoogle}
          onError={() => {
            if (!mountedRef.current) {
              return;
            }

            setAuthState("error");
            setMessage(
              "Google sign-in could not load. Check your connection and refresh the page.",
            );
          }}
        />
      )}
    </section>
  );
}
