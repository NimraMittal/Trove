import RecipeCard from "../components/RecipeCard";
import type { RecipeSummary } from "../types/recipe.types";
import styles from "../recipes.module.css";

type DiscoverRecipesPageProps = {
  recipes: RecipeSummary[];
};

export default function DiscoverRecipesPage({
  recipes,
}: DiscoverRecipesPageProps) {
  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Discover recipes</h1>

      <p className={styles.notice}>
          Development recipes stored in PostgreSQL.
      </p>
      {recipes.length === 0 ? (
        <p>No recipes to display.</p>
      ) : (
        <section className={styles.grid} aria-label="Recipes">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </section>
      )}
    </main>
  );
}