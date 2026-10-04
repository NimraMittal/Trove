import "dotenv/config";

import type {
  NextFunction,
  Request,
  Response,
} from "express";

const configuredOrigin =
  process.env.APP_ORIGIN;

if (!configuredOrigin) {
  throw new Error(
    "APP_ORIGIN is not configured.",
  );
}

const applicationUrl =
  new URL(configuredOrigin);

const allowedOrigin =
  applicationUrl.origin;

if (
  process.env.NODE_ENV === "production" &&
  applicationUrl.protocol !== "https:"
) {
  throw new Error(
    "APP_ORIGIN must use HTTPS in production.",
  );
}

export function requireAllowedOrigin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.get("origin") !== allowedOrigin) {
    res.status(403).json({
      message: "Request origin is not allowed.",
    });

    return;
  }

  next();
}