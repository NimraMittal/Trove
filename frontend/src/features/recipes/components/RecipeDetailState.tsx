import Link from "next/link";
import styles from "../recipe-detail.module.css";

type Props = {
  title: string;
  message: string;
  loading?: boolean;
  onRetry?: () => void;
};

export default function RecipeDetailState({ title, message, loading, onRetry }: Props) {
  return (
    <main className={styles.page} aria-busy={loading || undefined}>
      <div className={styles.container}>
        <Link className={styles.backLink} href="/recipes">← Back to recipes</Link>
        <section className={styles.state} aria-labelledby="recipe-state-title">
          <p className={styles.eyebrow}>From the Trove kitchen</p>
          <h1 id="recipe-state-title" className={styles.stateTitle}>{title}</h1>
          <p role={loading ? "status" : "alert"}>{message}</p>
          {onRetry && <button className={styles.retryButton} type="button" onClick={onRetry}>Try again</button>}
        </section>
      </div>
    </main>
  );
}
