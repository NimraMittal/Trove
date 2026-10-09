import Image from "next/image";
import Link from "next/link";

import AuthHeaderActions from "@/features/auth/components/AuthHeaderActions";

import PrimaryNav from "./PrimaryNav";
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

        <PrimaryNav />

        <div className={styles.actions}>
          <AuthHeaderActions />
        </div>
      </div>
    </header>
  );
}
