import { Router } from "express";
import * as cookie from "cookie";

import { requireAuthentication } from "./auth.middleware.js";

import {
  deleteSessionByTokenHash,
} from "./auth.repository.js";

import {
  getSessionCookieName,
  hashSessionToken,
} from "./auth.session.js";

const sessionRouter = Router();

sessionRouter.get(
  "/me",
  
  requireAuthentication,

  (_req, res) => {
    res.setHeader("Cache-Control", "no-store");

    res.status(200).json({
      user: res.locals.user,
    });
  },
);

sessionRouter.post(
  "/logout",

  async (req, res) => {
    res.setHeader("Cache-Control", "no-store");

    const cookies = cookie.parseCookie(
  req.headers.cookie ?? "",
);

    const cookieName = getSessionCookieName();
    const token = cookies[cookieName];

    if (token) {
      const tokenHash = hashSessionToken(token);

      await deleteSessionByTokenHash(tokenHash);
    }

    res.clearCookie(cookieName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    res.status(204).end();
  },
);

export default sessionRouter;