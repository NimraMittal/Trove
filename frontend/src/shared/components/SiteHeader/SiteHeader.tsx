import Image from "next/image";
import Link from "next/link";

import styles from "./SiteHeader.module.css";

export default function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link
          href="/"
          className={styles.logoLink}
          aria-label="Trove home"
        >
          <Image
            src="/branding/trove-logo.png"
            alt="Trove"
            width={190}
            height={72}
            priority
            className={styles.logoImage}
          />
        </Link>

        <nav
          className={styles.navigation}
          aria-label="Primary navigation"
        >
          <Link href="/">Home</Link>

          <Link href="/recipes">
            Recipes
          </Link>

          <span
            className={styles.disabledLink}
            aria-disabled="true"
          >
            Collections
          </span>
        </nav>

        <div className={styles.actions}>
          <Link
            href="/recipes"
            className={styles.exploreButton}
          >
            Explore Recipes
          </Link>
        </div>
      </div>
    </header>
  );
}