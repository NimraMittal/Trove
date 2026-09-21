import { prisma } from "../shared/database/prisma.js";

const demoRecipes = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Chocolate Cake",
    description: "A soft chocolate cake for weekend baking.",
    category: "Cakes",
    visibility: "PUBLIC",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    title: "Banana Bread",
    description: "A comforting loaf made with ripe bananas.",
    category: "Breads",
    visibility: "PUBLIC",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    title: "Chocolate Chip Cookies",
    description: "Cookies with crisp edges and soft centers.",
    category: "Cookies",
    visibility: "PUBLIC",
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    title: "Private Development Recipe",
    description: "This record must not appear in public discovery.",
    category: "Desserts",
    visibility: "PRIVATE",
  },
] as const;

async function main() {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");

  const isLocalDevelopmentDatabase =
    ["127.0.0.1", "localhost"].includes(databaseUrl.hostname) &&
    databaseUrl.pathname === "/trove_development";

  if (
    process.env.NODE_ENV === "production" ||
    !isLocalDevelopmentDatabase
  ) {
    throw new Error(
      "This seed script is restricted to the local trove_development database.",
    );
  }

  await prisma.$transaction(async (tx) => {
    const owner = await tx.user.upsert({
      where: {
        email: "demo@trove.example",
      },
      update: {},
      create: {
        email: "demo@trove.example",
        displayName: "Trove Demo Kitchen",
      },
    });

    for (const recipe of demoRecipes) {
      await tx.recipe.upsert({
        where: {
          id: recipe.id,
        },
        update: {},
        create: {
          ...recipe,
          ownerId: owner.id,
        },
      });
    }
  });

  console.log("Development seed completed.");
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error: unknown) => {
    console.error(
      "Seed failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    process.exitCode = 1;
  });