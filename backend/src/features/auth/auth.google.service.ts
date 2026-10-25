import { Prisma } from "../../generated/prisma/client.js";

import {
  createGoogleUser,
  findGoogleUserBySubject,
  findUserIdByEmail,
} from "./auth.repository.js";

import { createUserSession } from "./auth.session.service.js";

import {
  verifyGoogleCredential,
  type VerifiedGoogleIdentity,
} from "./auth.google.verifier.js";

import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254));

const hostedDomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(
    /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
  );

const displayNameSchema = z.string().trim().min(2).max(80);

export class GoogleEmailNotEligibleError extends Error {
  constructor() {
    super("This Google account is not eligible for automatic signup.");
    this.name = "GoogleEmailNotEligibleError";
  }
}

export class GoogleAccountLinkRequiredError extends Error {
  constructor() {
    super("This Google sign-in cannot be completed automatically.");
    this.name = "GoogleAccountLinkRequiredError";
  }
}

export type GoogleCredentialVerifier = (
  credential: string,
) => Promise<VerifiedGoogleIdentity>;

export function getAutomaticSignupEmail(
  identity: VerifiedGoogleIdentity,
): string {
  const parsedEmail = emailSchema.safeParse(identity.email);

  if (!identity.emailVerified || !parsedEmail.success) {
    throw new GoogleEmailNotEligibleError();
  }

  const isGmail = parsedEmail.data.endsWith("@gmail.com");
  const hasWorkspaceDomain = hostedDomainSchema.safeParse(
    identity.hostedDomain,
  ).success;

  if (!isGmail && !hasWorkspaceDomain) {
    throw new GoogleEmailNotEligibleError();
  }

  return parsedEmail.data;
}

function getDisplayName(displayName: string | undefined): string {
  const parsedName = displayNameSchema.safeParse(displayName);
  return parsedName.success ? parsedName.data : "Trove cook";
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function authenticateGoogleUser(
  credential: string,
  verifyCredential: GoogleCredentialVerifier = verifyGoogleCredential,
) {
  const identity = await verifyCredential(credential);
  const existingIdentity = await findGoogleUserBySubject(identity.subject);

  if (existingIdentity) {
    return createUserSession(existingIdentity.user);
  }

  const email = getAutomaticSignupEmail(identity);
  const existingUser = await findUserIdByEmail(email);

  if (existingUser) {
    throw new GoogleAccountLinkRequiredError();
  }

  let user;

  try {
    user = await createGoogleUser({
      email,
      displayName: getDisplayName(identity.displayName),
      subject: identity.subject,
    });
  } catch (error: unknown) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const concurrentlyCreatedIdentity =
      await findGoogleUserBySubject(identity.subject);

    if (concurrentlyCreatedIdentity) {
      return createUserSession(concurrentlyCreatedIdentity.user);
    }

    if (await findUserIdByEmail(email)) {
      throw new GoogleAccountLinkRequiredError();
    }

    throw error;
  }

  return createUserSession(user);
}
