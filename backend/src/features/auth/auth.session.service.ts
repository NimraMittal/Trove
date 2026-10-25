import { createSession } from "./auth.repository.js";

import {
  createSessionToken,
  hashSessionToken,
  SESSION_LIFETIME_MS,
} from "./auth.session.js";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
};

export async function createUserSession(user: SessionUser) {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

  await createSession({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  return {
    token,
    expiresAt,
    user,
  };
}
