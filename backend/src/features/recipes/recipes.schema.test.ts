import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import "dotenv/config";
import pg from "pg";

import app from "../../app.js";
import { prisma } from "../../shared/database/prisma.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

const parsedDatabaseUrl = new URL(databaseUrl);
const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(
  parsedDatabaseUrl.hostname,
);

if (
  !isLoopback ||
  parsedDatabaseUrl.pathname !== "/trove_development"
) {
  throw new Error(
    "Recipe schema tests only run against local trove_development.",
  );
}

type DatabaseError = {
  code?: string;
  constraint?: string;
};

function isDatabaseError(error: unknown): error is DatabaseError {
  return typeof error === "object" && error !== null;
}

async function expectConstraintViolation(
  operation: () => Promise<unknown>,
  code: "23505" | "23514",
  constraint: string,
) {
  await assert.rejects(operation, (error: unknown) => {
    assert.equal(isDatabaseError(error), true);

    if (!isDatabaseError(error)) {
      return false;
    }

    assert.equal(error.code, code);
    assert.equal(error.constraint, constraint);
    return true;
  });
}

test("structured recipe rows enforce position and cascade rules", async () => {
  const client = new pg.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });

  const userId = randomUUID();
  const firstRecipeId = randomUUID();
  const secondRecipeId = randomUUID();
  const recipeIds = [firstRecipeId, secondRecipeId];

  await client.connect();

  try {
    await client.query(
      `INSERT INTO "users" (
        "id", "email", "displayName", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [userId, `recipe-schema-${userId}@example.test`, "Recipe Schema Test"],
    );

    for (const [index, recipeId] of recipeIds.entries()) {
      await client.query(
        `INSERT INTO "recipes" (
          "id", "title", "description", "category", "visibility",
          "createdAt", "updatedAt", "ownerId"
        ) VALUES ($1, $2, $3, $4, 'PRIVATE',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $5)`,
        [
          recipeId,
          `Schema test recipe ${index + 1}`,
          "Temporary recipe used by the schema integration test.",
          "TEST",
          userId,
        ],
      );
    }

    await client.query(
      `INSERT INTO "recipe_ingredients" (
        "id", "recipeId", "name", "quantity", "unit", "notes", "position"
      ) VALUES
        ($1, $2, 'Flour', 250, 'g', NULL, 1),
        ($3, $2, 'Salt', NULL, NULL, 'to taste', 0)`,
      [randomUUID(), firstRecipeId, randomUUID()],
    );

    await client.query(
      `INSERT INTO "recipe_steps" (
        "id", "recipeId", "instruction", "position"
      ) VALUES
        ($1, $2, 'Bake until golden.', 1),
        ($3, $2, 'Combine the ingredients.', 0)`,
      [randomUUID(), firstRecipeId, randomUUID()],
    );

    const ingredients = await client.query<{
      name: string;
      quantity: string | null;
      unit: string | null;
      notes: string | null;
      position: number;
    }>(
      `SELECT "name", "quantity", "unit", "notes", "position"
       FROM "recipe_ingredients"
       WHERE "recipeId" = $1
       ORDER BY "position" ASC`,
      [firstRecipeId],
    );

    assert.deepEqual(
      ingredients.rows.map(({ name, position }) => ({ name, position })),
      [
        { name: "Salt", position: 0 },
        { name: "Flour", position: 1 },
      ],
    );
    assert.equal(ingredients.rows[0]?.quantity, null);
    assert.equal(ingredients.rows[0]?.unit, null);
    assert.equal(ingredients.rows[0]?.notes, "to taste");
    assert.equal(ingredients.rows[1]?.quantity, "250.0000");

    const steps = await client.query<{
      instruction: string;
      position: number;
    }>(
      `SELECT "instruction", "position"
       FROM "recipe_steps"
       WHERE "recipeId" = $1
       ORDER BY "position" ASC`,
      [firstRecipeId],
    );

    assert.deepEqual(steps.rows, [
      { instruction: "Combine the ingredients.", position: 0 },
      { instruction: "Bake until golden.", position: 1 },
    ]);

    await expectConstraintViolation(
      () => client.query(
        `INSERT INTO "recipe_ingredients" (
          "id", "recipeId", "name", "position"
        ) VALUES ($1, $2, 'Duplicate position', 0)`,
        [randomUUID(), firstRecipeId],
      ),
      "23505",
      "recipe_ingredients_recipeId_position_key",
    );

    await expectConstraintViolation(
      () => client.query(
        `INSERT INTO "recipe_steps" (
          "id", "recipeId", "instruction", "position"
        ) VALUES ($1, $2, 'Duplicate position', 0)`,
        [randomUUID(), firstRecipeId],
      ),
      "23505",
      "recipe_steps_recipeId_position_key",
    );

    await expectConstraintViolation(
      () => client.query(
        `INSERT INTO "recipe_ingredients" (
          "id", "recipeId", "name", "position"
        ) VALUES ($1, $2, 'Negative position', -1)`,
        [randomUUID(), firstRecipeId],
      ),
      "23514",
      "recipe_ingredients_position_nonnegative",
    );

    await expectConstraintViolation(
      () => client.query(
        `INSERT INTO "recipe_steps" (
          "id", "recipeId", "instruction", "position"
        ) VALUES ($1, $2, 'Negative position', -1)`,
        [randomUUID(), firstRecipeId],
      ),
      "23514",
      "recipe_steps_position_nonnegative",
    );

    await client.query(
      `INSERT INTO "recipe_ingredients" (
        "id", "recipeId", "name", "position"
      ) VALUES ($1, $2, 'Same position, another recipe', 0)`,
      [randomUUID(), secondRecipeId],
    );
    await client.query(
      `INSERT INTO "recipe_steps" (
        "id", "recipeId", "instruction", "position"
      ) VALUES ($1, $2, 'Same position, another recipe', 0)`,
      [randomUUID(), secondRecipeId],
    );

    await client.query(
      `DELETE FROM "recipes" WHERE "id" = $1`,
      [firstRecipeId],
    );

    for (const table of ["recipe_ingredients", "recipe_steps"] as const) {
      const result = await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS "count" FROM "${table}"
         WHERE "recipeId" = $1`,
        [firstRecipeId],
      );
      assert.equal(result.rows[0]?.count, 0);
    }
  } finally {
    // Cleanup is explicit and id-scoped; correctness does not depend on rollback.
    await client.query(
      `DELETE FROM "recipes" WHERE "id" = ANY($1::uuid[])`,
      [recipeIds],
    ).catch(() => undefined);
    await client.query(
      `DELETE FROM "users" WHERE "id" = $1`,
      [userId],
    ).catch(() => undefined);
    await client.end().catch(() => undefined);
  }
});

test("public recipe discovery retains its summary response", async () => {
  const client = new pg.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });
  const userId = randomUUID();
  const recipeId = randomUUID();
  let server: ReturnType<typeof app.listen> | undefined;

  await client.connect();

  try {
    await client.query(
      `INSERT INTO "users" (
        "id", "email", "displayName", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [userId, `recipe-api-${userId}@example.test`, "Recipe API Test"],
    );
    await client.query(
      `INSERT INTO "recipes" (
        "id", "title", "description", "category", "visibility",
        "createdAt", "updatedAt", "ownerId"
      ) VALUES ($1, $2, $3, $4, 'PUBLIC',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $5)`,
      [
        recipeId,
        "Public response shape test",
        "Temporary public recipe used by the API integration test.",
        "TEST",
        userId,
      ],
    );

    server = await new Promise<ReturnType<typeof app.listen>>(
      (resolve, reject) => {
        const listeningServer = app.listen(0, "127.0.0.1", () => {
          resolve(listeningServer);
        });
        listeningServer.once("error", reject);
      },
    );

    const address = server.address() as AddressInfo;
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/recipes`,
    );
    const body: unknown = await response.json();

    assert.equal(response.status, 200);
    assert.equal(Array.isArray(body), true);

    if (!Array.isArray(body)) {
      return;
    }

    const recipe = body.find((value: unknown) => (
      typeof value === "object" &&
      value !== null &&
      "id" in value &&
      value.id === recipeId
    ));

    assert.notEqual(recipe, undefined);
    assert.deepEqual(Object.keys(recipe as object).sort(), [
      "category",
      "description",
      "id",
      "title",
    ]);
    assert.deepEqual(recipe, {
      id: recipeId,
      title: "Public response shape test",
      description: "Temporary public recipe used by the API integration test.",
      category: "TEST",
    });
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
    await client.query(
      `DELETE FROM "recipes" WHERE "id" = $1`,
      [recipeId],
    ).catch(() => undefined);
    await client.query(
      `DELETE FROM "users" WHERE "id" = $1`,
      [userId],
    ).catch(() => undefined);
    await client.end().catch(() => undefined);
    await prisma.$disconnect();
  }
});
