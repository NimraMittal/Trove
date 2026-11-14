import { prisma } from "../../shared/database/prisma.js";
import type { RecipeSummary } from "./types/recipe.types.js";

export async function findPublicRecipeSummaries(): Promise<
  RecipeSummary[]
> {
  return prisma.recipe.findMany({
    where: {
      visibility: "PUBLIC",
    },

    select: {
      id: true,
      title: true,
      description: true,
      category: true,
    },

    orderBy: [
      { createdAt: "desc" },
      { id: "asc" },
    ],

    take: 24,
  });
}

export function findAccessibleRecipeDetail(
  recipeId: string,
  viewerId: string | null,
) {
  return prisma.recipe.findFirst({
    where: {
      id: recipeId,

      OR: viewerId
        ? [
            { visibility: "PUBLIC" },
            { ownerId: viewerId },
          ]
        : [{ visibility: "PUBLIC" }],
    },

    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      visibility: true,
      createdAt: true,
      updatedAt: true,
      ownerId: true,

      owner: {
        select: {
          displayName: true,
        },
      },

      ingredients: {
        select: {
          id: true,
          name: true,
          quantity: true,
          unit: true,
          notes: true,
          position: true,
        },

        orderBy: {
          position: "asc",
        },
      },

      steps: {
        select: {
          id: true,
          instruction: true,
          position: true,
        },

        orderBy: {
          position: "asc",
        },
      },
    },
  });
}
