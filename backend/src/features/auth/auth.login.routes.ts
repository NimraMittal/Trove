import "dotenv/config";

import express, { Router } from "express";
import { rateLimit } from "express-rate-limit";

import { loginUser } from "./auth.login.service.js";
import { loginSchema } from "./auth.validation.js";
import { getSessionCookieName } from "./auth.session.js";

const loginRouter = Router();

const configuredOrigin = process.env.APP_ORIGIN;

if (!configuredOrigin) {
  throw new Error("APP_ORIGIN is not configured.");
}

const applicationUrl = new URL(configuredOrigin);
const allowedOrigin = applicationUrl.origin;

const isProduction = process.env.NODE_ENV === "production";

if (isProduction && applicationUrl.protocol !== "https:") {
  throw new Error("APP_ORIGIN must use HTTPS in production.");
}

const sessionCookieName = getSessionCookieName();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    message: "Too many login attempts. Please try again later.",
  },
});

loginRouter.post(
  "/login",

  (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");

    if (req.get("origin") !== allowedOrigin) {
      res.status(403).json({
        message: "Request origin is not allowed.",
      });
      return;
    }

    if (!req.is("application/json")) {
      res.status(415).json({
        message: "Send the request using application/json.",
      });
      return;
    }

    next();
  },

  loginLimiter,

  express.json({ limit: "16kb" }),

  async (req, res) => {
    const body: unknown = req.body;
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Provide a valid email and password.",
      });
      return;
    }

    const result = await loginUser(parsed.data);

    if (!result) {
      res.status(401).json({
        message: "Invalid email or password.",
      });
      return;
    }

    res.cookie(sessionCookieName, result.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      expires: result.expiresAt,
    });

    res.status(200).json({
      user: result.user,
    });
  },
);

export default loginRouter;
