import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import "dotenv/config";
import express from "express";

import app from "../../app.js";
import { AuthProvider } from "../../generated/prisma/client.js";
import { prisma } from "../../shared/database/prisma.js";
import { errorHandler } from "../../shared/middleware/error-handler.js";

import {
  GoogleAccountLinkRequiredError,
  GoogleEmailNotEligibleError,
  authenticateGoogleUser,
  getAutomaticSignupEmail,
} from "./auth.google.service.js";

import {
  GoogleAuthConfigurationError,
  GoogleCredentialRejectedError,
  verifyGoogleCredential,
  type GoogleIdTokenClient,
  type VerifiedGoogleIdentity,
} from "./auth.google.verifier.js";

import {
  createGoogleAuthRouter,
  type GoogleAuthenticationHandler,
} from "./auth.google.routes.js";

import { hashPassword } from "./auth.password.js";

import {
  getSessionCookieName,
  getSessionCookieOptions,
  hashSessionToken,
} from "./auth.session.js";

const databaseUrl = process.env.DATABASE_URL;
const applicationOrigin = process.env.APP_ORIGIN;

if (!databaseUrl || !applicationOrigin) {
  throw new Error("DATABASE_URL and APP_ORIGIN must be configured.");
}

const parsedDatabaseUrl = new URL(databaseUrl);
const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(
  parsedDatabaseUrl.hostname,
);

if (
  !isLoopback ||
  parsedDatabaseUrl.pathname !== "/trove_development"
) {
  throw new Error(
    "Google authentication tests only run against local trove_development.",
  );
}

const allowedOrigin = new URL(applicationOrigin).origin;

const verifiedGmailIdentity = (
  suffix = randomUUID(),
): VerifiedGoogleIdentity => ({
  subject: `google-subject-${suffix}`,
  email: `google-auth-${suffix}@gmail.com`,
  emailVerified: true,
  displayName: "Google Auth Tester",
});

async function withServer(
  testApp: express.Express,
  operation: (baseUrl: string) => Promise<void>,
) {
  const server = testApp.listen(0, "127.0.0.1");

  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address() as AddressInfo;

  try {
    await operation(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

function createGoogleTestApp(authenticate: GoogleAuthenticationHandler) {
  const testApp = express();
  testApp.use("/api/auth", createGoogleAuthRouter(authenticate));
  testApp.use(errorHandler);
  return testApp;
}

async function deleteTestUser(userId: string) {
  await prisma.user.deleteMany({
    where: {
      id: userId,
    },
  });
}

test("Google verifier passes the configured audience and returns required claims", async () => {
  let receivedOptions: {
    idToken: string;
    audience: string;
  } | undefined;

  const client: GoogleIdTokenClient = {
    async verifyIdToken(options) {
      receivedOptions = options;
      return {
        getPayload: () => ({
          sub: "stable-google-subject",
          email: "Cook@gmail.com",
          email_verified: true,
          name: "Trove Cook",
        }),
      };
    },
  };

  const identity = await verifyGoogleCredential(
    "mock-id-token",
    client,
    "test-client.apps.googleusercontent.com",
  );

  assert.deepEqual(receivedOptions, {
    idToken: "mock-id-token",
    audience: "test-client.apps.googleusercontent.com",
  });
  assert.deepEqual(identity, {
    subject: "stable-google-subject",
    email: "Cook@gmail.com",
    emailVerified: true,
    hostedDomain: undefined,
    displayName: "Trove Cook",
  });
});

test("Google verifier rejects invalid, expired, and wrong-audience tokens", async (t) => {
  for (const scenario of ["invalid signature", "expired", "wrong audience"]) {
    await t.test(scenario, async () => {
      const rejectingClient: GoogleIdTokenClient = {
        async verifyIdToken() {
          throw new Error(scenario);
        },
      };

      await assert.rejects(
        verifyGoogleCredential(
          "mock-rejected-token",
          rejectingClient,
          "test-client.apps.googleusercontent.com",
        ),
        GoogleCredentialRejectedError,
      );
    });
  }
});

test("Google verifier rejects a token missing its stable subject", async () => {
  const client: GoogleIdTokenClient = {
    async verifyIdToken() {
      return {
        getPayload: () => ({
          email: "cook@gmail.com",
          email_verified: true,
        }),
      };
    },
  };

  await assert.rejects(
    verifyGoogleCredential(
      "mock-token-without-subject",
      client,
      "test-client.apps.googleusercontent.com",
    ),
    GoogleCredentialRejectedError,
  );
});

test("automatic signup accepts authoritative Gmail and Workspace emails", () => {
  assert.equal(
    getAutomaticSignupEmail({
      subject: "gmail-subject",
      email: " Cook@Gmail.com ",
      emailVerified: true,
    }),
    "cook@gmail.com",
  );

  assert.equal(
    getAutomaticSignupEmail({
      subject: "workspace-subject",
      email: "cook@recipes.example",
      emailVerified: true,
      hostedDomain: "recipes.example",
    }),
    "cook@recipes.example",
  );
});

test("automatic signup rejects unverified and non-authoritative emails", () => {
  const rejectedIdentities: VerifiedGoogleIdentity[] = [
    {
      subject: "unverified-subject",
      email: "cook@gmail.com",
      emailVerified: false,
    },
    {
      subject: "consumer-subject",
      email: "cook@example.com",
      emailVerified: true,
    },
    {
      subject: "missing-email-subject",
      emailVerified: true,
      hostedDomain: "recipes.example",
    },
  ];

  for (const identity of rejectedIdentities) {
    assert.throws(
      () => getAutomaticSignupEmail(identity),
      GoogleEmailNotEligibleError,
    );
  }
});

test("new Google user gets one identity and a hashed Trove session", async () => {
  const identity = verifiedGmailIdentity();
  let userId: string | undefined;

  try {
    const result = await authenticateGoogleUser(
      "mock-valid-token",
      async () => identity,
    );
    userId = result.user.id;

    const storedUser = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        authIdentities: true,
        sessions: true,
        passwordCredential: true,
      },
    });

    assert.equal(storedUser.email, identity.email);
    assert.equal(storedUser.passwordCredential, null);
    assert.equal(storedUser.authIdentities.length, 1);
    assert.equal(storedUser.authIdentities[0]?.provider, AuthProvider.GOOGLE);
    assert.equal(storedUser.authIdentities[0]?.subject, identity.subject);
    assert.equal(storedUser.sessions.length, 1);
    assert.notEqual(storedUser.sessions[0]?.tokenHash, result.token);
    assert.equal(
      storedUser.sessions[0]?.tokenHash,
      hashSessionToken(result.token),
    );
  } finally {
    if (userId) {
      await deleteTestUser(userId);
    }
  }
});

test("returning Google user is found by subject rather than changed email", async () => {
  const identity = verifiedGmailIdentity();
  const user = await prisma.user.create({
    data: {
      email: identity.email!,
      displayName: "Original Name",
      authIdentities: {
        create: {
          provider: AuthProvider.GOOGLE,
          subject: identity.subject,
        },
      },
    },
  });

  try {
    const result = await authenticateGoogleUser(
      "mock-returning-token",
      async () => ({
        ...identity,
        email: "changed@example.com",
        emailVerified: false,
        displayName: "Changed Name",
      }),
    );

    assert.equal(result.user.id, user.id);
    assert.equal(result.user.email, identity.email);
    assert.equal(result.user.displayName, "Original Name");
  } finally {
    await deleteTestUser(user.id);
  }
});

test("existing password-user email collision requires explicit linking", async () => {
  const identity = verifiedGmailIdentity();
  const user = await prisma.user.create({
    data: {
      email: identity.email!,
      displayName: "Password User",
      passwordCredential: {
        create: {
          passwordHash: await hashPassword(
            "Development-only-password-collision!",
          ),
        },
      },
    },
  });

  try {
    await assert.rejects(
      authenticateGoogleUser(
        "mock-collision-token",
        async () => identity,
      ),
      GoogleAccountLinkRequiredError,
    );

    assert.equal(
      await prisma.authIdentity.count({ where: { userId: user.id } }),
      0,
    );
    assert.equal(
      await prisma.session.count({ where: { userId: user.id } }),
      0,
    );
  } finally {
    await deleteTestUser(user.id);
  }
});

test("concurrent Google signup creates one user and one provider identity", async () => {
  const identity = verifiedGmailIdentity();
  const verify = async () => identity;
  let userId: string | undefined;

  try {
    const [first, second] = await Promise.all([
      authenticateGoogleUser("mock-concurrent-token-1", verify),
      authenticateGoogleUser("mock-concurrent-token-2", verify),
    ]);
    userId = first.user.id;

    assert.equal(second.user.id, userId);
    assert.equal(
      await prisma.user.count({ where: { email: identity.email } }),
      1,
    );
    assert.equal(
      await prisma.authIdentity.count({
        where: {
          provider: AuthProvider.GOOGLE,
          subject: identity.subject,
        },
      }),
      1,
    );
    assert.equal(
      await prisma.session.count({ where: { userId } }),
      2,
    );
  } finally {
    if (userId) {
      await deleteTestUser(userId);
    }
  }
});

test("concurrent different subjects sharing one email never auto-link", async () => {
  const firstIdentity = verifiedGmailIdentity();
  const secondIdentity = {
    ...firstIdentity,
    subject: `different-${randomUUID()}`,
  };
  let userId: string | undefined;

  try {
    const results = await Promise.allSettled([
      authenticateGoogleUser(
        "mock-shared-email-token-1",
        async () => firstIdentity,
      ),
      authenticateGoogleUser(
        "mock-shared-email-token-2",
        async () => secondIdentity,
      ),
    ]);

    const fulfilled = results.filter(
      (result) => result.status === "fulfilled",
    );
    const rejected = results.filter(
      (result) => result.status === "rejected",
    );

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);

    const successfulResult = fulfilled[0];
    assert.ok(successfulResult?.status === "fulfilled");
    userId = successfulResult.value.user.id;

    const rejectedResult = rejected[0];
    assert.ok(rejectedResult?.status === "rejected");
    assert.equal(
      rejectedResult.reason instanceof GoogleAccountLinkRequiredError,
      true,
    );

    assert.equal(
      await prisma.user.count({ where: { email: firstIdentity.email } }),
      1,
    );
    assert.equal(
      await prisma.authIdentity.count({ where: { userId } }),
      1,
    );
  } finally {
    if (userId) {
      await deleteTestUser(userId);
    }
  }
});

test("identity uniqueness and user-delete cascade are database enforced", async () => {
  const firstIdentity = verifiedGmailIdentity();
  const secondIdentity = verifiedGmailIdentity();
  const firstUser = await prisma.user.create({
    data: {
      email: firstIdentity.email!,
      displayName: "First Identity User",
      authIdentities: {
        create: {
          provider: AuthProvider.GOOGLE,
          subject: firstIdentity.subject,
        },
      },
    },
  });
  const secondUser = await prisma.user.create({
    data: {
      email: secondIdentity.email!,
      displayName: "Second Identity User",
    },
  });

  try {
    await assert.rejects(
      prisma.authIdentity.create({
        data: {
          userId: secondUser.id,
          provider: AuthProvider.GOOGLE,
          subject: firstIdentity.subject,
        },
      }),
      (error: unknown) =>
        error instanceof Error && "code" in error && error.code === "P2002",
    );

    await assert.rejects(
      prisma.authIdentity.create({
        data: {
          userId: firstUser.id,
          provider: AuthProvider.GOOGLE,
          subject: secondIdentity.subject,
        },
      }),
      (error: unknown) =>
        error instanceof Error && "code" in error && error.code === "P2002",
    );

    await deleteTestUser(firstUser.id);
    assert.equal(
      await prisma.authIdentity.count({ where: { userId: firstUser.id } }),
      0,
    );
  } finally {
    await deleteTestUser(firstUser.id);
    await deleteTestUser(secondUser.id);
  }
});

test("Google route enforces origin and strict JSON validation", async () => {
  let authenticationCalls = 0;
  const authenticate: GoogleAuthenticationHandler = async () => {
    authenticationCalls += 1;
    throw new Error("Authentication should not run for rejected requests.");
  };

  await withServer(createGoogleTestApp(authenticate), async (baseUrl) => {
    const wrongOriginResponse = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://not-trove.example",
      },
      body: JSON.stringify({ credential: "mock-token" }),
    });
    assert.equal(wrongOriginResponse.status, 403);

    const invalidBodyResponse = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: allowedOrigin,
      },
      body: JSON.stringify({
        credential: "mock-token",
        unexpected: true,
      }),
    });
    assert.equal(invalidBodyResponse.status, 400);

    const wrongContentTypeResponse = await fetch(
      `${baseUrl}/api/auth/google`,
      {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          Origin: allowedOrigin,
        },
        body: "mock-token",
      },
    );
    assert.equal(wrongContentTypeResponse.status, 415);
    assert.equal(authenticationCalls, 0);
  });
});

test("Google route sets the existing HttpOnly session cookie", async () => {
  const expiresAt = new Date(Date.now() + 60_000);
  const authenticate: GoogleAuthenticationHandler = async () => ({
    token: "mock-trove-session-token",
    expiresAt,
    user: {
      id: randomUUID(),
      email: "route-tester@gmail.com",
      displayName: "Route Tester",
    },
  });

  await withServer(createGoogleTestApp(authenticate), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: allowedOrigin,
      },
      body: JSON.stringify({ credential: "mock-token" }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");

    const sessionCookie = response.headers.get("set-cookie") ?? "";
    assert.match(sessionCookie, /^trove_session=mock-trove-session-token;/);
    assert.match(sessionCookie, /HttpOnly/i);
    assert.match(sessionCookie, /SameSite=Lax/i);
    assert.match(sessionCookie, /Path=\//i);
  });
});

test("Google route returns controlled credential, collision, and configuration errors", async (t) => {
  const cases: Array<{
    name: string;
    error: Error;
    status: number;
    expectedMessage: string;
  }> = [
    {
      name: "rejected credential",
      error: new GoogleCredentialRejectedError(),
      status: 401,
      expectedMessage: "Google sign-in could not be verified.",
    },
    {
      name: "existing-email collision",
      error: new GoogleAccountLinkRequiredError(),
      status: 409,
      expectedMessage:
        "This Google sign-in cannot be completed automatically. " +
        "Sign in using your existing method, then link Google from " +
        "account settings.",
    },
    {
      name: "missing server configuration",
      error: new GoogleAuthConfigurationError(),
      status: 503,
      expectedMessage: "Google sign-in is temporarily unavailable.",
    },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const authenticate: GoogleAuthenticationHandler = async () => {
        throw testCase.error;
      };

      await withServer(createGoogleTestApp(authenticate), async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/auth/google`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: allowedOrigin,
          },
          body: JSON.stringify({ credential: "mock-token" }),
        });

        assert.equal(response.status, testCase.status);
        assert.deepEqual(await response.json(), {
          message: testCase.expectedMessage,
        });
      });
    });
  }
});

test("production session cookies retain secure __Host attributes", () => {
  const originalNodeEnvironment = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = "production";
    assert.equal(getSessionCookieName(), "__Host-trove_session");
    assert.deepEqual(getSessionCookieOptions(), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  } finally {
    if (originalNodeEnvironment === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnvironment;
    }
  }
});

test("existing password login, current-user, and logout endpoints regress correctly", async () => {
  const password = "Development-only-login-regression!";
  const email = `password-regression-${randomUUID()}@example.com`;
  const user = await prisma.user.create({
    data: {
      email,
      displayName: "Password Regression",
      passwordCredential: {
        create: {
          passwordHash: await hashPassword(password),
        },
      },
    },
  });

  try {
    await withServer(app, async (baseUrl) => {
      const invalidLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: allowedOrigin,
        },
        body: JSON.stringify({ email, password: "incorrect-password" }),
      });
      assert.equal(invalidLoginResponse.status, 401);

      const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: allowedOrigin,
        },
        body: JSON.stringify({ email, password }),
      });
      assert.equal(loginResponse.status, 200);

      const setCookie = loginResponse.headers.get("set-cookie") ?? "";
      const cookieHeader = setCookie.split(";", 1)[0] ?? "";
      assert.match(cookieHeader, /^trove_session=/);

      const currentUserResponse = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Cookie: cookieHeader },
      });
      assert.equal(currentUserResponse.status, 200);
      assert.deepEqual(await currentUserResponse.json(), {
        user: {
          id: user.id,
          email,
          displayName: "Password Regression",
        },
      });

      const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
        method: "POST",
        headers: {
          Cookie: cookieHeader,
          Origin: allowedOrigin,
        },
      });
      assert.equal(logoutResponse.status, 204);

      const revokedResponse = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Cookie: cookieHeader },
      });
      assert.equal(revokedResponse.status, 401);
      assert.equal(
        await prisma.session.count({ where: { userId: user.id } }),
        0,
      );
    });
  } finally {
    await deleteTestUser(user.id);
  }
});
