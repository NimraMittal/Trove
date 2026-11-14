import type {
  RecipeDetail,
  RecipeIngredientDetail,
  RecipeStepDetail,
} from "../types/recipe-detail.types";

export type RecipeDetailFailure = "invalid" | "missing" | "network" | "server";

export class RecipeDetailError extends Error {
  constructor(public readonly kind: RecipeDetailFailure) {
    super(kind);
    this.name = "RecipeDetailError";
  }
}

// Matches the UUID versions and variants accepted by the backend's z.uuid().
export function isRecipeId(value: string): boolean {
  return /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isPosition(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isIngredient(value: unknown): value is RecipeIngredientDetail {
  return isRecord(value) &&
    typeof value.id === "string" && isRecipeId(value.id) &&
    typeof value.name === "string" &&
    (value.quantity === null ||
      (typeof value.quantity === "string" && /^-?\d+(?:\.\d+)?$/.test(value.quantity))) &&
    isNullableString(value.unit) && isNullableString(value.notes) &&
    isPosition(value.position);
}

function isStep(value: unknown): value is RecipeStepDetail {
  return isRecord(value) &&
    typeof value.id === "string" && isRecipeId(value.id) &&
    typeof value.instruction === "string" && isPosition(value.position);
}

function isOrdered(values: { position: number }[]): boolean {
  return values.every((value, index) => index === 0 || value.position > values[index - 1].position);
}

function isRecipeDetail(value: unknown): value is RecipeDetail {
  return isRecord(value) &&
    typeof value.id === "string" && isRecipeId(value.id) &&
    typeof value.title === "string" && typeof value.description === "string" &&
    typeof value.category === "string" &&
    (value.visibility === "PUBLIC" || value.visibility === "PRIVATE") &&
    typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt)) &&
    typeof value.updatedAt === "string" && Number.isFinite(Date.parse(value.updatedAt)) &&
    typeof value.ownerId === "string" && isRecipeId(value.ownerId) &&
    isRecord(value.creator) && typeof value.creator.displayName === "string" &&
    Array.isArray(value.ingredients) && value.ingredients.every(isIngredient) &&
    isOrdered(value.ingredients) &&
    Array.isArray(value.steps) && value.steps.every(isStep) && isOrdered(value.steps);
}

export async function getRecipeDetail(id: string, signal: AbortSignal): Promise<RecipeDetail> {
  if (!isRecipeId(id)) throw new RecipeDetailError("invalid");

  let response: Response;
  try {
    response = await fetch(`/api/recipes/${encodeURIComponent(id)}`, {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    });
  } catch (error: unknown) {
    if (signal.aborted) throw error;
    throw new RecipeDetailError("network");
  }

  if (response.status === 400) throw new RecipeDetailError("invalid");
  // A private recipe and a missing recipe must remain indistinguishable.
  if ([401, 403, 404].includes(response.status)) throw new RecipeDetailError("missing");
  if (!response.ok) throw new RecipeDetailError("server");

  const body: unknown = await response.json().catch(() => null);
  if (!isRecipeDetail(body) || body.id.toLowerCase() !== id.toLowerCase()) {
    throw new RecipeDetailError("server");
  }
  return body;
}
