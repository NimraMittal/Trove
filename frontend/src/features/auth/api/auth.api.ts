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