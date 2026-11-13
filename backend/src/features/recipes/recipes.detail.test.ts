import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import "dotenv/config";
import express from "express";

import app from "../../app.js";
import {
  createOptionalAuthentication,
} from "../auth/auth.middleware.js";
import {
  getSessionCookieName,
  hashSessionToken,
} from "../auth/auth.session.js";
import { prisma } from "../../shared/database/prisma.js";
import { errorHandler } from "../../shared/middleware/error-handler.js";
import { createRecipesRouter } from "./recipes.routes.js";

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
    "Recipe detail tests only run against local trove_development.",
  );
}

async function withServer(
  testApp: express.Express,
  operation: (baseUrl: string) => Promise<void>,
) {
  const server = testApp.listen(0, "127.0.0.1");

  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address() as AddressInfo;

  try {
    await operation(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

function getCookieHeader(token: string): string {
  return `${getSessionCookieName()}=${token}`;
}

async function expectJson(
  response: Response,
  status: number,
  body: unknown,
) {
  assert.equal(response.status, status);
  assert.equal(
    response.headers.get("cache-control"),
    "private, no-store",
  );
  assert.deepEqual(await response.json(), body);
}

test("recipe detail endpoint enforces privacy and returns structured content", async (t) => {
  const ownerId = randomUUID();
  const otherUserId = randomUUID();
  const publicRecipeId = randomUUID();
  const privateRecipeId = randomUUID();
  const legacyRecipeId = randomUUID();
  const missingRecipeId = randomUUID();
  const firstIngredientId = randomUUID();
  const secondIngredientId = randomUUID();
  const firstStepId = randomUUID();
  const secondStepId = randomUUID();
  const ownerToken = `recipe-owner-${randomUUID()}`;
  const otherUserToken = `recipe-viewer-${randomUUID()}`;
  const expiredToken = `recipe-expired-${randomUUID()}`;
  const invalidToken = `recipe-invalid-${randomUUID()}`;
  const recipeIds = [publicRecipeId, privateRecipeId, legacyRecipeId];
  const userIds = [ownerId, otherUserId];

  try {
    await prisma.user.createMany({
      data: [
        {
          id: ownerId,
          email: `recipe-owner-${ownerId}@example.test`,
          displayName: "Recipe Detail Owner",
        },
        {
          id: otherUserId,
          email: `recipe-viewer-${otherUserId}@example.test`,
          displayName: "Another Recipe User",
        },
      ],
    });

    const publicRecipe = await prisma.recipe.create({
      data: {
        id: publicRecipeId,
        title: "Structured public recipe",
        description: "A temporary recipe for detail API verification.",
        category: "TEST",
        visibility: "PUBLIC",
        ownerId,

        ingredients: {
          create: [
            {
              id: secondIngredientId,
              name: "Flour",
              quantity: "125.5000",
              unit: "g",
              notes: null,
              position: 1,
            },
            {
              id: firstIngredientId,
              name: "Salt",
              quantity: null,
              unit: null,
              notes: "to taste",
              position: 0,
            },
          ],
        },

        steps: {
          create: [
            {
              id: secondStepId,
              instruction: "Bake until golden.",
              position: 1,
            },
            {
              id: firstStepId,
              instruction: "Combine the ingredients.",
              position: 0,
            },
          ],
        },
      },
    });

    await prisma.recipe.createMany({
      data: [
        {
          id: privateRecipeId,
          title: "Owner-only recipe",
          description: "Private test content.",
          category: "TEST",
          visibility: "PRIVATE",
          ownerId,
        },
        {
          id: legacyRecipeId,
          title: "Legacy recipe",
          description: "A recipe without structured child rows.",
          category: "TEST",
          visibility: "PUBLIC",
          ownerId,
        },
      ],
    });

    await prisma.session.createMany({
      data: [
        {
          tokenHash: hashSessionToken(ownerToken),
          userId: ownerId,
          expiresAt: new Date(Date.now() + 60_000),
        },
        {
          tokenHash: hashSessionToken(otherUserToken),
          userId: otherUserId,
          expiresAt: new Date(Date.now() + 60_000),
        },
        {
          tokenHash: hashSessionToken(expiredToken),
          userId: otherUserId,
          expiresAt: new Date(Date.now() - 60_000),
        },
      ],
    });

    await withServer(app, async (baseUrl) => {
      await t.test("guest can read safe, ordered public detail", async () => {
        const response = await fetch(
          `${baseUrl}/api/recipes/${publicRecipeId}`,
        );
        const body: unknown = await response.json();

        assert.equal(response.status, 200);
        assert.equal(
          response.headers.get("cache-control"),
          "private, no-store",
        );
        assert.deepEqual(body, {
          id: publicRecipeId,
          title: "Structured public recipe",
          description: "A temporary recipe for detail API verification.",
          category: "TEST",
          visibility: "PUBLIC",
          createdAt: publicRecipe.createdAt.toISOString(),
          updatedAt: publicRecipe.updatedAt.toISOString(),
          ownerId,
          creator: {
            displayName: "Recipe Detail Owner",
          },
          ingredients: [
            {
              id: firstIngredientId,
              name: "Salt",
              quantity: null,
              unit: null,
              notes: "to taste",
              position: 0,
            },
            {
              id: secondIngredientId,
              name: "Flour",
              quantity: "125.5",
              unit: "g",
              notes: null,
              position: 1,
            },
          ],
          steps: [
            {
              id: firstStepId,
              instruction: "Combine the ingredients.",
              position: 0,
            },
            {
              id: secondStepId,
              instruction: "Bake until golden.",
              position: 1,
            },
          ],
        });

        assert.equal(
          typeof body === "object" &&
            body !== null &&
            "creator" in body &&
            typeof body.creator === "object" &&
            body.creator !== null &&
            Object.keys(body.creator).length === 1 &&
            "displayName" in body.creator,
          true,
        );
        assert.equal(JSON.stringify(body).includes("@example.test"), false);
      });

      await t.test("authenticated user can read a public recipe", async () => {
        const response = await fetch(
          `${baseUrl}/api/recipes/${publicRecipeId}`,
          {
            headers: {
              Cookie: getCookieHeader(otherUserToken),
            },
          },
        );

        assert.equal(response.status, 200);
        assert.equal(
          response.headers.get("cache-control"),
          "private, no-store",
        );
      });

      await t.test("owner can read their private recipe", async () => {
        const response = await fetch(
          `${baseUrl}/api/recipes/${privateRecipeId}`,
          {
            headers: {
              Cookie: getCookieHeader(ownerToken),
            },
          },
        );
        const body = await response.json() as { visibility?: unknown };

        assert.equal(response.status, 200);
        assert.equal(body.visibility, "PRIVATE");
        assert.equal(
          response.headers.get("cache-control"),
          "private, no-store",
        );
      });

      await t.test("private, missing, and anonymous responses conceal existence", async () => {
        const expectedBody = {
          message: "Recipe not found.",
        };

        const guestResponse = await fetch(
          `${baseUrl}/api/recipes/${privateRecipeId}`,
        );
        await expectJson(guestResponse, 404, expectedBody);

        const otherUserResponse = await fetch(
          `${baseUrl}/api/recipes/${privateRecipeId}`,
          {
            headers: {
              Cookie: getCookieHeader(otherUserToken),
            },
          },
        );
        await expectJson(otherUserResponse, 404, expectedBody);

        const missingResponse = await fetch(
          `${baseUrl}/api/recipes/${missingRecipeId}`,
        );
        await expectJson(missingResponse, 404, expectedBody);
      });

      await t.test("invalid UUID returns a controlled client error", async () => {
        const response = await fetch(
          `${baseUrl}/api/recipes/not-a-uuid`,
        );

        await expectJson(response, 400, {
          message: "Recipe ID must be a valid UUID.",
        });
      });

      await t.test("invalid session continues anonymously", async () => {
        const publicResponse = await fetch(
          `${baseUrl}/api/recipes/${publicRecipeId}`,
          {
            headers: {
              Cookie: getCookieHeader(invalidToken),
            },
          },
        );
        assert.equal(publicResponse.status, 200);

        const privateResponse = await fetch(
          `${baseUrl}/api/recipes/${privateRecipeId}`,
          {
            headers: {
              Cookie: getCookieHeader(invalidToken),
            },
          },
        );
        await expectJson(privateResponse, 404, {
          message: "Recipe not found.",
        });
      });

      await t.test("expired session is cleaned up and continues anonymously", async () => {
        const response = await fetch(
          `${baseUrl}/api/recipes/${privateRecipeId}`,
          {
            headers: {
              Cookie: getCookieHeader(expiredToken),
            },
          },
        );

        await expectJson(response, 404, {
          message: "Recipe not found.",
        });
        assert.equal(
          await prisma.session.count({
            where: {
              tokenHash: hashSessionToken(expiredToken),
            },
          }),
          0,
        );
      });

      await t.test("legacy recipe returns empty structured arrays", async () => {
        const response = await fetch(
          `${baseUrl}/api/recipes/${legacyRecipeId}`,
        );
        const body = await response.json() as {
          ingredients?: unknown;
          steps?: unknown;
        };

        assert.equal(response.status, 200);
        assert.deepEqual(body.ingredients, []);
        assert.deepEqual(body.steps, []);
      });
    });
  } finally {
    try {
      await prisma.recipe.deleteMany({
        where: {
          id: {
            in: recipeIds,
          },
        },
      });
      await prisma.user.deleteMany({
        where: {
          id: {
            in: userIds,
          },
        },
      });
    } finally {
      await prisma.$disconnect();
    }
  }
});

test("recipe detail route controls repository and session failures", async (t) => {
  const recipeId = randomUUID();
  const genericFailure = {
    message: "Something went wrong. Please try again later.",
  };

  await t.test("repository failure", async () => {
    const testApp = express();
    testApp.use(
      "/api/recipes",
      createRecipesRouter({
        loadRecipeDetail: async () => {
          throw new Error("Sensitive database failure detail");
        },
      }),
    );
    testApp.use(errorHandler);

    await withServer(testApp, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/recipes/${recipeId}`);
      await expectJson(response, 500, genericFailure);
    });
  });

  await t.test("session resolution failure", async () => {
    const testApp = express();
    testApp.use(
      "/api/recipes",
      createRecipesRouter({
        optionalAuthentication: createOptionalAuthentication(async () => {
          throw new Error("Sensitive session failure detail");
        }),
        loadRecipeDetail: async () => {
          assert.fail("Recipe lookup must not run after a session failure.");
        },
      }),
    );
    testApp.use(errorHandler);

    await withServer(testApp, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/recipes/${recipeId}`, {
        headers: {
          Cookie: getCookieHeader("session-database-failure"),
        },
      });
      await expectJson(response, 500, genericFailure);
    });
  });
});
