import "server-only";

import type { RecipeSummary } from "../types/recipe.types";

function isRecipeSummary(value: unknown): value is RecipeSummary {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "title" in value &&
    typeof value.title === "string" &&
    "description" in value &&
    typeof value.description === "string" &&
    "category" in value &&
    typeof value.category === "string"
  );
}

export async function getRecipes(): Promise<RecipeSummary[]> {
  const apiUrl = process.env.TROVE_API_URL;

  if (!apiUrl) {
    throw new Error("TROVE_API_URL is not configured.");
  }

  const response = await fetch(new URL("/api/recipes", apiUrl), {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Recipe API returned status ${response.status}.`);
  }

  const data: unknown = await response.json();

  if (!Array.isArray(data) || !data.every(isRecipeSummary)) {
    throw new Error("Recipe API returned an unexpected response.");
  }

  return data;
}