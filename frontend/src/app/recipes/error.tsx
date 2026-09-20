"use client";

import styles from "@/features/recipes/recipes.module.css";

export default function RecipesError() {
  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>
        Recipes are temporarily unavailable
      </h1>

      <p>Please try loading the page again.</p>

      <button
        type="button"
        className={styles.retryButton}
        onClick={() => window.location.reload()}
      >
        Try again
      </button>
    </main>
  );
}