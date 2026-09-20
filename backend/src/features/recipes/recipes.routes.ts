import { Router } from "express";
import { sampleRecipes } from "./data/sample-recipes.js";

const recipesRouter = Router();

recipesRouter.get("/", (_req, res) => {
  res.status(200).json(sampleRecipes);
});

export default recipesRouter;