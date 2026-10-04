import { Router } from "express";
import * as cookie from "cookie";

import {
  requireAuthentication,
} from "./auth.middleware.js";

import {
  requireAllowedOrigin,
} from "./auth.origin.middleware.js";

import {
  deleteSessionByTokenHash,
} from "./auth.repository.js";

import {
  getSessionCookieName,
  getSessionCookieOptions,
  hashSessionToken,
} from "./auth.session.js";

const sessionRouter = Router();

sessionRouter.get(
  "/me",

  requireAuthentication,

  (_req, res) => {
    res.setHeader(
      "Cache-Control",
      "no-store",
    );

    res.status(200).json({
      user: res.locals.user,
    });
  },
);

sessionRouter.post(
  "/logout",

  requireAllowedOrigin,

  async (req, res) => {
    res.setHeader(
      "Cache-Control",
      "no-store",
    );

    const cookies =
      cookie.parseCookie(
        req.headers.cookie ?? "",
      );

    const cookieName =
      getSessionCookieName();

    const token =
      cookies[cookieName];

    if (token) {
      const tokenHash =
        hashSessionToken(token);

      await deleteSessionByTokenHash(
        tokenHash,
      );
    }

    res.clearCookie(
      cookieName,
      getSessionCookieOptions(),
    );

    res.status(204).end();
  },
);

export default sessionRouter;