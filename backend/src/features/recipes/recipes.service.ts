import {
  findAccessibleRecipeDetail,
} from "./recipes.repository.js";

import type {
  RecipeDetail,
} from "./types/recipe.types.js";

export type AccessibleRecipeFinder =
  typeof findAccessibleRecipeDetail;

export async function getRecipeDetail(
  recipeId: string,
  viewerId: string | null,
  findRecipe: AccessibleRecipeFinder = findAccessibleRecipeDetail,
): Promise<RecipeDetail | null> {
  const recipe = await findRecipe(recipeId, viewerId);

  if (!recipe) {
    return null;
  }

  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    category: recipe.category,
    visibility: recipe.visibility,
    createdAt: recipe.createdAt.toISOString(),
    updatedAt: recipe.updatedAt.toISOString(),
    ownerId: recipe.ownerId,
    creator: {
      displayName: recipe.owner.displayName,
    },
    ingredients: recipe.ingredients.map((ingredient) => ({
      id: ingredient.id,
      name: ingredient.name,
      quantity: ingredient.quantity?.toString() ?? null,
      unit: ingredient.unit,
      notes: ingredient.notes,
      position: ingredient.position,
    })),
    steps: recipe.steps.map((step) => ({
      id: step.id,
      instruction: step.instruction,
      position: step.position,
    })),
  };
}
