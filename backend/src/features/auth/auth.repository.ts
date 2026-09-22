import { prisma } from "../../shared/database/prisma.js";

type CreatePasswordUserInput = {
  email: string;
  displayName: string;
  passwordHash: string;
};

export function createPasswordUser(input: CreatePasswordUserInput) {
  return prisma.user.create({
    data: {
      email: input.email,
      displayName: input.displayName,

      passwordCredential: {
        create: {
          passwordHash: input.passwordHash,
        },
      },
    },

    select: {
      id: true,
    },
  });
}

export function findUserIdByEmail(email: string) {
  return prisma.user.findUnique({
    where: {
      email,
    },

    select: {
      id: true,
    },
  });
}

export function findPasswordUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: {
      email,
    },

    select: {
      id: true,
      email: true,
      displayName: true,

      passwordCredential: {
        select: {
          passwordHash: true,
        },
      },
    },
  });
}

type CreateSessionInput = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

export function createSession(input: CreateSessionInput) {
  return prisma.session.create({
    data: {
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
    },

    select: {
      id: true,
    },
  });
}