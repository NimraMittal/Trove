import type { RequestHandler } from "express";
import { Router } from "express";
import { z } from "zod";

import {
  resolveOptionalAuthentication,
} from "../auth/auth.middleware.js";

import { findPublicRecipeSummaries } from "./recipes.repository.js";
import { getRecipeDetail } from "./recipes.service.js";

import type {
  RecipeDetail,
} from "./types/recipe.types.js";

const recipeIdSchema = z.uuid();

export type RecipeDetailLoader = (
  recipeId: string,
  viewerId: string | null,
) => Promise<RecipeDetail | null>;

type RecipeRouterDependencies = {
  loadRecipeDetail?: RecipeDetailLoader;
  optionalAuthentication?: RequestHandler;
};

export function createRecipesRouter(
  dependencies: RecipeRouterDependencies = {},
) {
  const recipesRouter = Router();
  const loadRecipeDetail =
    dependencies.loadRecipeDetail ?? getRecipeDetail;
  const optionalAuthentication =
    dependencies.optionalAuthentication ?? resolveOptionalAuthentication;

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

  recipesRouter.get(
    "/:id",

    (_req, res, next) => {
      res.setHeader("Cache-Control", "private, no-store");
      next();
    },

    (req, res, next) => {
      const parsedRecipeId = recipeIdSchema.safeParse(req.params.id);

      if (!parsedRecipeId.success) {
        res.status(400).json({
          message: "Recipe ID must be a valid UUID.",
        });
        return;
      }

      res.locals.recipeId = parsedRecipeId.data;
      next();
    },

    optionalAuthentication,

    async (_req, res, next) => {
      try {
        const recipe = await loadRecipeDetail(
          res.locals.recipeId,
          res.locals.user?.id ?? null,
        );

        if (!recipe) {
          res.status(404).json({
            message: "Recipe not found.",
          });
          return;
        }

        res.status(200).json(recipe);
      } catch (error: unknown) {
        next(error);
      }
    },
  );

  return recipesRouter;
}

export default createRecipesRouter();
