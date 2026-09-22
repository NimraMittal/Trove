import { Prisma } from "../../generated/prisma/client.js";

import { hashPassword } from "./auth.password.js";
import {
  createPasswordUser,
  findUserIdByEmail,
} from "./auth.repository.js";

import type { RegistrationInput } from "./auth.validation.js";

export async function registerUser(
  input: RegistrationInput,
): Promise<void> {
  const passwordHash = await hashPassword(input.password);

  try {
    await createPasswordUser({
      email: input.email,
      displayName: input.displayName,
      passwordHash,
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existingUser = await findUserIdByEmail(input.email);

      if (existingUser) {
        return;
      }
    }

    throw error;
  }
}