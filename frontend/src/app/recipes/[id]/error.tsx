"use client";

import RecipeDetailState from "@/features/recipes/components/RecipeDetailState";

export default function Error({ reset }: { reset: () => void }) {
  return <RecipeDetailState title="We couldn’t open this recipe" message="Something went wrong. Please try again." onRetry={reset} />;
}
