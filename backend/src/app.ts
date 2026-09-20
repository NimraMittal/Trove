import express from "express";

import healthRouter from "./features/health/health.routes.js";
import recipesRouter from "./features/recipes/recipes.routes.js";

const app = express();

app.use("/api/health", healthRouter);
app.use("/api/recipes", recipesRouter);

export default app;