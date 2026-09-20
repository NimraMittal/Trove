import express from "express";
import healthRouter from "./features/health/health.routes.js";

const app = express();

app.use("/api/health", healthRouter);

export default app;