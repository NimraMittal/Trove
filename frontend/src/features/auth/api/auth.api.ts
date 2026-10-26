import type {
  AuthUser,
  LoginInput,
} from "../types/auth.types";

import type { SignupInput } from "../types/auth.types";

type LoginResponse = {
  user: AuthUser;
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAuthUser(
  value: unknown,
): value is AuthUser {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.email === "string" &&
    typeof value.displayName === "string"
  );
}

function isLoginResponse(
  value: unknown,
): value is LoginResponse {
  return (
    isRecord(value) &&
    isAuthUser(value.user)
  );
}

function getErrorMessage(
  value: unknown,
): string | null {
  if (
    isRecord(value) &&
    typeof value.message === "string"
  ) {
    return value.message;
  }

  return null;
}

export async function login(
  input: LoginInput,
): Promise<AuthUser> {
  const response = await fetch(
    "/api/auth/login",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      credentials: "include",

      body: JSON.stringify(input),
    },
  );

  const body: unknown =
    await response.json();

  if (!response.ok) {
    throw new Error(
      getErrorMessage(body) ??
        "Unable to sign in.",
    );
  }

  if (!isLoginResponse(body)) {
    throw new Error(
      "The server returned an unexpected response.",
    );
  }

  return body.user;
}

function getGoogleAuthenticationError(status: number): string {
  switch (status) {
    case 400:
    case 415:
      return "Google sign-in sent an invalid request. Please try again.";
    case 401:
      return "Google could not verify this sign-in. Please try again.";
    case 403:
      return (
        "This Google account cannot create a Trove account automatically. " +
        "Use another Google account or continue with email and password."
      );
    case 409:
      return (
        "This email already has a Trove account. " +
        "Sign in with your existing method."
      );
    case 429:
      return "Too many Google sign-in attempts. Please wait and try again.";
    case 503:
      return "Google sign-in is temporarily unavailable. Please try again later.";
    default:
      return "Google sign-in is unavailable. Please try again.";
  }
}

export async function authenticateWithGoogle(
  credential: string,
  signal?: AbortSignal,
): Promise<AuthUser> {
  const response = await fetch("/api/auth/google", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },

    credentials: "same-origin",
    cache: "no-store",
    signal,

    body: JSON.stringify({ credential }),
  }).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "Could not reach Trove. Check your connection and try Google sign-in again.",
    );
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getGoogleAuthenticationError(response.status));
  }

  if (!isLoginResponse(body)) {
    throw new Error(
      "Trove returned an unexpected Google sign-in response. Please try again.",
    );
  }

  return body.user;
}

export async function register(
  input: SignupInput,
): Promise<void> {
  const response = await fetch("/api/auth/register", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },

    credentials: "same-origin",

    body: JSON.stringify(input),
  }).catch(() => {
    throw new Error(
      "Could not reach Trove. Check your connection and try again.",
    );
  });

  // A proxy or server failure might return HTML instead of JSON.
  const body: unknown = await response.json().catch(() => null);

  const responseMessage =
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
      ? body.message
      : null;

  if (!response.ok) {
    if (response.status === 400) {
      throw new Error(
        "Check your name, email, and password. Your name must be " +
          "2–80 characters and your password 15–128 characters.",
      );
    }

    throw new Error(
      responseMessage ??
        `Registration is unavailable (HTTP ${response.status}).`,
    );
  }

  if (!responseMessage) {
    throw new Error(
      "Trove returned an unexpected response. Try signing in " +
        "before submitting registration again.",
    );
  }
}

export async function getCurrentUser(
  signal?: AbortSignal,
): Promise<AuthUser | null> {
  const response = await fetch("/api/auth/me", {
    method: "GET",

    headers: {
      Accept: "application/json",
    },

    credentials: "same-origin",
    cache: "no-store",
    signal: signal ?? null,
  });

  // A visitor without a valid session is a normal signed-out state.
  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Unable to check your account right now.");
  }

  const body: unknown = await response.json().catch(() => null);

  if (!isLoginResponse(body)) {
    throw new Error("The server returned an unexpected account response.");
  }

  return body.user;
}

export async function logout(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",

    headers: {
      Accept: "application/json",
    },

    credentials: "same-origin",
    cache: "no-store",
  }).catch(() => {
    throw new Error(
      "Could not reach Trove. Please try logging out again.",
    );
  });

  // Our logout endpoint returns success without a response body.
  if (response.status === 204) {
    return;
  }

  const body: unknown = await response.json().catch(() => null);

  throw new Error(
    getErrorMessage(body) ??
      "Logout could not be confirmed. Please try again.",
  );
}
