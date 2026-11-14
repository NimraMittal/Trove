import Link from "next/link";
import type { RecipeSummary } from "../types/recipe.types";
import styles from "../recipes.module.css";

type RecipeCardProps = {
  recipe: RecipeSummary;
};

export default function RecipeCard({ recipe }: RecipeCardProps) {
  return (
    <article className={styles.card}>
      <p className={styles.category}>{recipe.category}</p>

      <h2 className={styles.cardTitle}>
        <Link className={styles.cardLink} href={`/recipes/${recipe.id}`}>
          {recipe.title}
        </Link>
      </h2>

      <p className={styles.description}>{recipe.description}</p>
    </article>
  );
}
