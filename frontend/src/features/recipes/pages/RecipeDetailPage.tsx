"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getRecipeDetail, RecipeDetailError, type RecipeDetailFailure } from "../api/recipe-detail.api";
import RecipeDetailState from "../components/RecipeDetailState";
import type { RecipeDetail } from "../types/recipe-detail.types";
import styles from "../recipe-detail.module.css";

type DetailState =
  | { status: "loading" }
  | { status: "ready"; recipe: RecipeDetail }
  | { status: "error"; kind: RecipeDetailFailure };

const failures = {
  invalid: { title: "This recipe link isn’t valid", message: "Check the link, or find something to cook in recipe discovery." },
  missing: { title: "Recipe not found", message: "We couldn’t find an available recipe at this link. Explore recipes for more inspiration." },
  network: { title: "We couldn’t reach Trove", message: "Check your connection and try again." },
  server: { title: "Recipes are temporarily unavailable", message: "We couldn’t load this recipe right now. Please try again." },
};

export default function RecipeDetailPage({ id }: { id: string }) {
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let controller: AbortController;
    let hasRecipe = false;
    async function load() {
      controller?.abort();
      hasRecipe = false;
      const request = new AbortController();
      controller = request;
      setState({ status: "loading" });
      try {
        const recipe = await getRecipeDetail(id, request.signal);
        if (!request.signal.aborted) {
          hasRecipe = true;
          setState({ status: "ready", recipe });
        }
      } catch (error: unknown) {
        if (!request.signal.aborted) {
          setState({ status: "error", kind: error instanceof RecipeDetailError ? error.kind : "server" });
        }
      }
    }
    void load();
    // Recheck access when returning from another tab or a restored history page.
    const recheck = () => {
      if (hasRecipe && document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", recheck);
    window.addEventListener("pageshow", recheck);
    return () => {
      controller?.abort();
      window.removeEventListener("focus", recheck);
      window.removeEventListener("pageshow", recheck);
    };
  }, [id, attempt]);

  if (state.status === "loading") {
    return <RecipeDetailState title="A little inspiration is on its way" message="Loading recipe…" loading />;
  }
  if (state.status === "error") {
    const retryable = state.kind === "network" || state.kind === "server";
    return <RecipeDetailState {...failures[state.kind]} onRetry={retryable ? () => setAttempt((value) => value + 1) : undefined} />;
  }

  const { recipe } = state;
  return (
    <main className={styles.page}>
      <article className={styles.container} aria-labelledby="recipe-title">
        <Link href="/recipes" className={styles.backLink}>← Back to recipes</Link>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>{recipe.category}</p>
          <h1 id="recipe-title" className={styles.title}>{recipe.title}</h1>
          <p className={styles.description}>{recipe.description}</p>
          <div className={styles.metadata}>
            <p>By <span className={styles.creator}>{recipe.creator.displayName}</span></p>
            <span className={styles.visibility}>{recipe.visibility === "PRIVATE" ? "Private · Only you" : "Public recipe"}</span>
          </div>
        </header>
        <div className={styles.content}>
          <section className={styles.ingredients} aria-labelledby="ingredients-title">
            <p className={styles.eyebrow}>Gather your ingredients</p>
            <h2 id="ingredients-title">Ingredients</h2>
            {recipe.ingredients.length === 0 ? (
              <p className={styles.empty}>No ingredients have been added to this recipe yet.</p>
            ) : (
              <ul className={styles.ingredientList}>
                {recipe.ingredients.map((ingredient) => (
                  <li key={ingredient.id}>
                    <p>
                      {(ingredient.quantity !== null || ingredient.unit) && (
                        <span className={styles.quantity}>{[ingredient.quantity, ingredient.unit].filter((value) => value !== null && value !== "").join(" ")} </span>
                      )}
                      {ingredient.name}
                    </p>
                    {ingredient.notes && <p className={styles.notes}>{ingredient.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className={styles.instructions} aria-labelledby="instructions-title">
            <p className={styles.eyebrow}>Let’s make it</p>
            <h2 id="instructions-title">Method</h2>
            {recipe.steps.length === 0 ? (
              <p className={styles.empty}>No cooking instructions have been added to this recipe yet.</p>
            ) : (
              <ol className={styles.stepList}>
                {recipe.steps.map((step) => <li key={step.id}><p>{step.instruction}</p></li>)}
              </ol>
            )}
          </section>
        </div>
        <footer className={styles.footer}>Find your next kitchen inspiration. <Link href="/recipes">Explore recipes →</Link></footer>
      </article>
    </main>
  );
}
