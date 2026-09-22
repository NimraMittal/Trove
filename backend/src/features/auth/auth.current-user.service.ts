import {
  deleteSessionByTokenHash,
  findSessionByTokenHash,
} from "./auth.repository.js";

import { hashSessionToken } from "./auth.session.js";

export async function getUserFromSessionToken(
  token: string,
) {
  const tokenHash = hashSessionToken(token);

  const session = await findSessionByTokenHash(tokenHash);

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await deleteSessionByTokenHash(tokenHash);
    return null;
  }

  return session.user;
}