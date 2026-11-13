import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";

import * as cookie from "cookie";

import {
  getUserFromSessionToken,
} from "./auth.current-user.service.js";

import {
  getSessionCookieName,
} from "./auth.session.js";

import type { SessionUser } from "./auth.session.service.js";

export type SessionUserResolver = (
  token: string,
) => Promise<SessionUser | null>;

function getSessionToken(req: Request): string | undefined {
  const cookies = cookie.parseCookie(
    req.headers.cookie ?? "",
  );

  return cookies[getSessionCookieName()];
}

export function createOptionalAuthentication(
  resolveUser: SessionUserResolver = getUserFromSessionToken,
): RequestHandler {
  return async function resolveOptionalAuthentication(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const token = getSessionToken(req);

      res.locals.user = token
        ? await resolveUser(token)
        : null;

      next();
    } catch (error: unknown) {
      next(error);
    }
  };
}

export const resolveOptionalAuthentication =
  createOptionalAuthentication();

export async function requireAuthentication(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = getSessionToken(req);

  if (!token) {
    res.status(401).json({
      message: "Authentication required.",
    });

    return;
  }

  const user =
    await getUserFromSessionToken(token);

  if (!user) {
    res.status(401).json({
      message: "Authentication required.",
    });

    return;
  }

  res.locals.user = user;

  next();
}
