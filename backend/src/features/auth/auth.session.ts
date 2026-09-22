import { createHash, randomBytes } from "node:crypto";

export const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export function getSessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? "__Host-trove_session"
    : "trove_session";
}