import { AuthProvider } from "../../generated/prisma/client.js";
import { prisma } from "../../shared/database/prisma.js";

const sessionUserSelect = {
  id: true,
  email: true,
  displayName: true,
} as const;

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

export function findGoogleUserBySubject(subject: string) {
  return prisma.authIdentity.findUnique({
    where: {
      provider_subject: {
        provider: AuthProvider.GOOGLE,
        subject,
      },
    },

    select: {
      user: {
        select: sessionUserSelect,
      },
    },
  });
}

type CreateGoogleUserInput = {
  email: string;
  displayName: string;
  subject: string;
};

export function createGoogleUser(input: CreateGoogleUserInput) {
  return prisma.user.create({
    data: {
      email: input.email,
      displayName: input.displayName,

      authIdentities: {
        create: {
          provider: AuthProvider.GOOGLE,
          subject: input.subject,
        },
      },
    },

    select: sessionUserSelect,
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

export function findSessionByTokenHash(
  tokenHash: string,
) {
  return prisma.session.findUnique({
    where: {
      tokenHash,
    },

    select: {
      id: true,
      expiresAt: true,

      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
    },
  });
}

export function deleteSessionByTokenHash(
  tokenHash: string,
) {
  return prisma.session.deleteMany({
    where: {
      tokenHash,
    },
  });
}
