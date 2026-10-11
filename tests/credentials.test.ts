import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { test } from "node:test";
import { getRounds } from "bcryptjs";
import { hashPassword, isBcryptHash, normalizeEmail, passwordHashDefaults, verifyPassword } from "../lib/auth/credentials";

test("credentials normalize email and keep bcrypt password compatibility", async () => {
  assert.equal(normalizeEmail(" Student@Example.COM "), "student@example.com");
  const storedHash = await hashPassword("a valid password");
  assert.equal(getRounds(storedHash), passwordHashDefaults.rounds);
  assert.equal(isBcryptHash(storedHash), true);
  assert.equal(await verifyPassword("a valid password", storedHash), true);
  assert.equal(await verifyPassword("wrong password", storedHash), false);
  assert.equal(await verifyPassword("a valid password", storedHash.replace("$2b$", "$2a$")), true);
  assert.equal(await verifyPassword("unmatched password"), false);
});

test("legacy scrypt passwords verify so existing accounts can migrate on login", async () => {
  const { keyLength, cost: N, blockSize: r, parallelization: p } = passwordHashDefaults.legacyScrypt;
  const salt = Buffer.from("legacy-account-salt");
  const key = scryptSync("legacy password", salt, keyLength, { N, r, p });
  const storedHash = `scrypt$${N}$${r}$${p}$${salt.toString("hex")}$${key.toString("hex")}`;
  assert.equal(isBcryptHash(storedHash), false);
  assert.equal(await verifyPassword("legacy password", storedHash), true);
  assert.equal(await verifyPassword("wrong password", storedHash), false);
});

test("incomplete and noninteger legacy credentials are rejected", async () => {
  for (const storedHash of [
    "", "sha256$16384$8$1$abcd$abcd", "scrypt$16384$8$1$$abcd",
    "scrypt$1e4$8$1$abcd$abcd", "scrypt$16384$0$1$abcd$abcd",
    "scrypt$9007199254740993$8$1$abcd$abcd",
  ]) {
    assert.equal(await verifyPassword("password", storedHash), false, storedHash);
  }
});
