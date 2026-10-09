"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./SiteHeader.module.css";

export default function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.navigation} aria-label="Primary navigation">
      <Link
        href="/"
        className={pathname === "/" ? styles.activeLink : undefined}
        aria-current={pathname === "/" ? "page" : undefined}
      >
        Home
      </Link>

      <Link
        href="/recipes"
        className={
          pathname.startsWith("/recipes") ? styles.activeLink : undefined
        }
        aria-current={
          pathname.startsWith("/recipes") ? "page" : undefined
        }
      >
        Recipes
      </Link>

      <span className={styles.disabledLink} aria-disabled="true">
        Collections
      </span>
    </nav>
  );
}
