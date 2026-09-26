import Link from "next/link";

import styles from "./SiteHeader.module.css";

export default function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          Trove
        </Link>

        <nav className={styles.navigation} aria-label="Primary navigation">
          <Link href="/">Home</Link>
          <Link href="/recipes">Recipes</Link>

          <span
            className={styles.disabledLink}
            aria-disabled="true"
          >
            Collections
          </span>
        </nav>

        <div className={styles.actions}>
          <span className={styles.comingSoon}>
            Account features coming soon
          </span>
        </div>
      </div>
    </header>
  );
}