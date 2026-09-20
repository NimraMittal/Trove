import styles from "@/features/recipes/recipes.module.css";

export default function RecipesLoading() {
  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Discover recipes</h1>
      <p role="status">Loading recipes...</p>
    </main>
  );
}