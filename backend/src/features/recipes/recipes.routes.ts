import { Router } from "express";

import { findPublicRecipeSummaries } from "./recipes.repository.js";

const recipesRouter = Router();

recipesRouter.get("/", async (_req, res) => {
  try {
    const recipes = await findPublicRecipeSummaries();

    res.status(200).json(recipes);
  } catch (error: unknown) {
    console.error(
      "Public recipe query failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    res.status(500).json({
      message: "Recipes are temporarily unavailable.",
    });
  }
});

export default recipesRouter;