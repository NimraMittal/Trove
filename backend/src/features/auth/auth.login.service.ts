import { randomBytes } from "node:crypto";

import { hashPassword, verifyPassword } from "./auth.password.js";
import { findPasswordUserByEmail } from "./auth.repository.js";
import { createUserSession } from "./auth.session.service.js";

import type { LoginInput } from "./auth.validation.js";

// Prepared once when this module loads.
// Used to avoid skipping password verification for unknown accounts.
const dummyPasswordHash = await hashPassword(
  randomBytes(32).toString("hex"),
);

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

  return createUserSession({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  });
}
