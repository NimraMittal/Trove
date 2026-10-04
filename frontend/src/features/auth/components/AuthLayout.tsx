import Image from "next/image";
import Link from "next/link";

import styles from "../auth.module.css";

type AuthLayoutProps = {
  children: React.ReactNode;
};

export default function AuthLayout({
  children,
}: AuthLayoutProps) {
  return (
    <main className={styles.authPage}>
      <section className={styles.authPanel}>
        <div className={styles.formSide}>
          <Link
            href="/"
            className={styles.logoLink}
            aria-label="Return to Trove homepage"
          >
            <Image
              src="/branding/trove-logo.png"
              alt="Trove"
              width={180}
              height={68}
              priority
              className={styles.logo}
            />
          </Link>

          <div className={styles.formContainer}>
            {children}
          </div>
        </div>

        <div className={styles.imageSide}>
          <Image
            src="/images/trove-hero.jpg"
            alt="Fresh food prepared in a home kitchen"
            fill
            priority
            sizes="(max-width: 800px) 0px, 50vw"
            className={styles.authImage}
          />

          <div className={styles.imageOverlay}>
            <p>
              Recipes worth keeping.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}