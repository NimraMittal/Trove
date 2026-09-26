import Image from "next/image";
import Link from "next/link";

import SiteHeader from "@/shared/components/SiteHeader/SiteHeader";

import styles from "../home.module.css";

const features = [
  {
    title: "Discover",
    description:
      "Explore recipes from passionate home cooks and food lovers.",
    symbol: "✦",
  },
  {
    title: "Save",
    description:
      "Keep recipes you love and organize them into your personal Trove.",
    symbol: "♡",
  },
  {
    title: "Cook",
    description:
      "Try recipes, learn from each attempt, and improve over time.",
    symbol: "◌",
  },
  {
    title: "Share",
    description:
      "Create your own recipes and share your kitchen discoveries.",
    symbol: "↗",
  },
];

export default function LandingPage() {
  return (
    <>
      <SiteHeader />

      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>
              COOK · BAKE · EXPLORE · SAVE
            </p>

            <h1 className={styles.heading}>
              Your next favorite{" "}
              <em>recipe</em>{" "}
              starts here.
            </h1>

            <p className={styles.description}>
              Discover recipes, collect inspiration, and document
              the experiments that make every kitchen your own.
            </p>

            <div className={styles.heroActions}>
              <Link
                href="/recipes"
                className={styles.primaryButton}
              >
                Browse Recipes
              </Link>

              <a
                href="#features"
                className={styles.secondaryButton}
              >
                Explore Trove
              </a>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.imageFrame}>
              <Image
                src="/images/trove-hero.jpg"
                alt="A prepared dish representing recipe discovery on Trove"
                fill
                priority
                sizes="(max-width: 800px) 100vw, 50vw"
                className={styles.heroImage}
              />
            </div>

            <div className={styles.handwrittenNote}>
              Good food.
              <br />
              Brighter days.
            </div>
          </div>
        </section>

        <section
          id="features"
          className={styles.features}
          aria-labelledby="features-heading"
        >
          <div className={styles.sectionIntro}>
            <p className={styles.sectionEyebrow}>
              YOUR KITCHEN, ORGANIZED
            </p>

            <h2 id="features-heading">
              More than a recipe box.
            </h2>
          </div>

          <div className={styles.featureGrid}>
            {features.map((feature) => (
              <article
                key={feature.title}
                className={styles.featureCard}
              >
                <div className={styles.featureIcon}>
                  {feature.symbol}
                </div>

                <h3>{feature.title}</h3>

                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}