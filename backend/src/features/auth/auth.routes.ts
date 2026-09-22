import express, { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";

import { registerUser } from "./auth.service.js";
import { registrationSchema } from "./auth.validation.js";

const authRouter = Router();

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    message: "Too many registration attempts. Please try again later.",
  },
});

authRouter.post(
  "/register",
  registrationLimiter,
  express.json({ limit: "16kb" }),

  async (req, res) => {
    res.setHeader("Cache-Control", "no-store");

    if (!req.is("application/json")) {
      res.status(415).json({
        message: "Send the request using application/json.",
      });
      return;
    }

    const body: unknown = req.body;
    const result = registrationSchema.safeParse(body);

    if (!result.success) {
      res.status(400).json({
        message: "Check the registration fields.",
        errors: z.flattenError(result.error),
      });
      return;
    }

    await registerUser(result.data);

    res.status(200).json({
      message: "Registration request processed.",
    });
  },
);

export default authRouter;
