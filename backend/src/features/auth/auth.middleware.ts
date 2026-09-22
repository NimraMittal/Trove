import type {
  NextFunction,
  Request,
  Response,
} from "express";

import * as cookie from "cookie";

import { getUserFromSessionToken } from "./auth.current-user.service.js";
import { getSessionCookieName } from "./auth.session.js";

export async function requireAuthentication(
  req: Request,
  res: Response,
  next: NextFunction,
) {
   const cookies = cookie.parseCookie(
  req.headers.cookie ?? "",
);
  const sessionToken =
    cookies[getSessionCookieName()];

  if (!sessionToken) {
    res.status(401).json({
      message: "Authentication required.",
    });

    return;
  }

  const user = await getUserFromSessionToken(
    sessionToken,
  );

  if (!user) {
    res.status(401).json({
      message: "Authentication required.",
    });

    return;
  }

  res.locals.user = user;

  next();
}