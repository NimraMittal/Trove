"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

import styles from "./SiteHeader.module.css";

export default function PrimaryNav() {
  const pathname = usePathname();
  return <Navigation key={pathname} pathname={pathname} />;
}

function Navigation({ pathname }: { pathname: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  return (
    <div
      className={styles.navContainer}
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen) {
          setIsOpen(false);
          toggleRef.current?.focus();
        }
      }}
    >
      <button
        ref={toggleRef}
        type="button"
        className={styles.menuToggle}
        aria-expanded={isOpen}
        aria-controls="primary-navigation"
        aria-label={isOpen ? "Close navigation" : "Open navigation"}
        onClick={() => setIsOpen((open) => !open)}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          {isOpen ? (
            <path d="m6 6 12 12M6 18 18 6" />
          ) : (
            <path d="M3 5h18M3 12h18M3 19h18" />
          )}
        </svg>
      </button>
      <nav
        id="primary-navigation"
        className={`${styles.navigation} ${isOpen ? styles.navigationOpen : ""}`}
        aria-label="Primary navigation"
      >
        <Link
          href="/"
          className={pathname === "/" ? styles.activeLink : undefined}
          aria-current={pathname === "/" ? "page" : undefined}
          onClick={() => setIsOpen(false)}
        >
          Home
        </Link>

        <Link
          href="/recipes"
          onClick={() => setIsOpen(false)}
          className={
            pathname.startsWith("/recipes") ? styles.activeLink : undefined
          }
          aria-current={pathname.startsWith("/recipes") ? "page" : undefined}
        >
          Recipes
        </Link>

        <span className={styles.disabledLink} aria-disabled="true">
          Collections
        </span>
      </nav>
    </div>
  );
}
