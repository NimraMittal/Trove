import { OAuth2Client } from "google-auth-library";

export type VerifiedGoogleIdentity = {
  subject: string;
  email?: string;
  emailVerified: boolean;
  hostedDomain?: string;
  displayName?: string;
};

type GoogleIdTokenTicket = {
  getPayload(): {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    hd?: string;
    name?: string;
  } | undefined;
};

export type GoogleIdTokenClient = {
  verifyIdToken(options: {
    idToken: string;
    audience: string;
  }): Promise<GoogleIdTokenTicket>;
};

export class GoogleAuthConfigurationError extends Error {
  constructor() {
    super("Google authentication is not configured.");
    this.name = "GoogleAuthConfigurationError";
  }
}

export class GoogleCredentialRejectedError extends Error {
  constructor() {
    super("The Google credential could not be verified.");
    this.name = "GoogleCredentialRejectedError";
  }
}

const googleIdTokenClient = new OAuth2Client();

function getGoogleWebClientId(): string {
  const clientId = process.env.GOOGLE_WEB_CLIENT_ID?.trim();

  if (
    !clientId ||
    clientId.length > 512 ||
    !clientId.endsWith(".apps.googleusercontent.com")
  ) {
    throw new GoogleAuthConfigurationError();
  }

  return clientId;
}

export async function verifyGoogleCredential(
  credential: string,
  client: GoogleIdTokenClient = googleIdTokenClient,
  audience: string = getGoogleWebClientId(),
): Promise<VerifiedGoogleIdentity> {
  let ticket: GoogleIdTokenTicket;

  try {
    ticket = await client.verifyIdToken({
      idToken: credential,
      audience,
    });
  } catch {
    throw new GoogleCredentialRejectedError();
  }

  const payload = ticket.getPayload();
  const subject = payload?.sub;

  if (
    !payload ||
    typeof subject !== "string" ||
    subject.length === 0 ||
    subject.length > 255
  ) {
    throw new GoogleCredentialRejectedError();
  }

  return {
    subject,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    hostedDomain: payload.hd,
    displayName: payload.name,
  };
}
