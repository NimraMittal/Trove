import { randomBytes } from "node:crypto";

import { hashPassword, verifyPassword } from "./auth.password.js";

import {
  createSession,
  findPasswordUserByEmail,
} from "./auth.repository.js";

import type { LoginInput } from "./auth.validation.js";

import {
  createSessionToken,
  hashSessionToken,
  SESSION_LIFETIME_MS,
} from "./auth.session.js";

// Prepared once when this module loads.
// Used to avoid skipping password verification for unknown accounts.
const dummyPasswordHash = await hashPassword(
  randomBytes(32).toString("hex"),
);

// Initial product decision: a session lasts at most 24 hours.

export async function loginUser(input: LoginInput) {
  const user = await findPasswordUserByEmail(input.email);

  const passwordHash =
    user?.passwordCredential?.passwordHash ?? dummyPasswordHash;

  const passwordMatches = await verifyPassword(
    passwordHash,
    input.password,
  );

  if (!user || !user.passwordCredential || !passwordMatches) {
    return null;
  }

  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);

  const expiresAt = new Date(
    Date.now() + SESSION_LIFETIME_MS,
  );

  await createSession({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  return {
    token,
    expiresAt,

    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
  };
}

