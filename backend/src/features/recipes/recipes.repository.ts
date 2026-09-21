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