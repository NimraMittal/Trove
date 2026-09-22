import express from "express";

import healthRouter from "./features/health/health.routes.js";
import recipesRouter from "./features/recipes/recipes.routes.js";
import authRouter from "./features/auth/auth.routes.js";

import { errorHandler } from "./shared/middleware/error-handler.js";

const app = express();

app.use("/api/health", healthRouter);
app.use("/api/recipes", recipesRouter);
app.use("/api/auth", authRouter);

app.use(errorHandler);

export default app;