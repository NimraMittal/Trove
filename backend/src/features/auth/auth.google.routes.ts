import express, { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";

import {
  GoogleAccountLinkRequiredError,
  GoogleEmailNotEligibleError,
  authenticateGoogleUser,
} from "./auth.google.service.js";

import {
  GoogleAuthConfigurationError,
  GoogleCredentialRejectedError,
} from "./auth.google.verifier.js";

import { requireAllowedOrigin } from "./auth.origin.middleware.js";

import {
  getSessionCookieName,
  getSessionCookieOptions,
} from "./auth.session.js";

import type { SessionUser } from "./auth.session.service.js";

const googleCredentialSchema = z.strictObject({
  credential: z.string().min(1).max(8192),
});

type GoogleAuthenticationResult = {
  token: string;
  expiresAt: Date;
  user: SessionUser;
};

export type GoogleAuthenticationHandler = (
  credential: string,
) => Promise<GoogleAuthenticationResult>;

export function createGoogleAuthRouter(
  authenticate: GoogleAuthenticationHandler = authenticateGoogleUser,
) {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      message: "Too many Google sign-in attempts. Please try again later.",
    },
  });

  router.post(
    "/google",
    requireAllowedOrigin,

    (req, res, next) => {
      res.setHeader("Cache-Control", "no-store");

      if (!req.is("application/json")) {
        res.status(415).json({
          message: "Send the request using application/json.",
        });
        return;
      }

      next();
    },

    limiter,
    express.json({ limit: "16kb" }),

    async (req, res, next) => {
      const parsed = googleCredentialSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          message: "Provide a valid Google credential.",
        });
        return;
      }

      try {
        const result = await authenticate(parsed.data.credential);

        res.cookie(getSessionCookieName(), result.token, {
          ...getSessionCookieOptions(),
          expires: result.expiresAt,
        });

        res.status(200).json({
          user: result.user,
        });
      } catch (error: unknown) {
        if (error instanceof GoogleCredentialRejectedError) {
          res.status(401).json({
            message: "Google sign-in could not be verified.",
          });
          return;
        }

        if (error instanceof GoogleEmailNotEligibleError) {
          res.status(403).json({
            message:
              "This Google sign-in cannot create an account automatically.",
          });
          return;
        }

        if (error instanceof GoogleAccountLinkRequiredError) {
          res.status(409).json({
            message:
              "This Google sign-in cannot be completed automatically. " +
              "Sign in using your existing method, then link Google from " +
              "account settings.",
          });
          return;
        }

        if (error instanceof GoogleAuthConfigurationError) {
          res.status(503).json({
            message: "Google sign-in is temporarily unavailable.",
          });
          return;
        }

        next(error);
      }
    },
  );

  return router;
}

export default createGoogleAuthRouter();
