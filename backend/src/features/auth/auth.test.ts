import assert from "node:assert/strict";
import { test } from "node:test";

import {
  hashPassword,
  verifyPassword,
} from "./auth.password.js";

import { registrationSchema } from "./auth.validation.js";

const sampleInput = {
  displayName: "  Recipe Tester  ",
  email: "  Tester@Example.com  ",
  password: "Development-only-passphrase!",
};

test("registration normalizes identity fields without changing passwords", () => {
  const result = registrationSchema.parse(sampleInput);

  assert.equal(result.displayName, "Recipe Tester");
  assert.equal(result.email, "tester@example.com");
  assert.equal(result.password, sampleInput.password);
});

test("registration rejects short passwords and unexpected fields", () => {
  assert.equal(
    registrationSchema.safeParse({
      ...sampleInput,
      password: "short",
    }).success,
    false,
  );

  assert.equal(
    registrationSchema.safeParse({
      ...sampleInput,
      role: "admin",
    }).success,
    false,
  );
});

test("password hashing supports verification and uses distinct salts", async () => {
  const firstHash = await hashPassword(sampleInput.password);
  const secondHash = await hashPassword(sampleInput.password);

  assert.notEqual(firstHash, sampleInput.password);
  assert.notEqual(firstHash, secondHash);

  assert.equal(
    await verifyPassword(firstHash, sampleInput.password),
    true,
  );

  assert.equal(
    await verifyPassword(firstHash, "A-different-test-password!"),
    false,
  );
});