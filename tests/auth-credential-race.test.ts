import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { SignJWT, jwtVerify } from "jose";
import { normalizeEmail, parseId } from "../lib/utils";
import type * as authService from "../lib/auth";

const code = ts.transpileModule(readFileSync(new URL("../lib/auth.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText;

test("a legacy credential upgrade cannot overwrite a concurrent password reset", async () => {
  for (const concurrentReset of [false, true]) {
    const user = { id: 1n, email: "legacy@example.test", passwordHash: "old-legacy-hash", role: "teacher" as const, emailVerified: true, sessionVersion: 0 };
    const writes: Array<{ where: { id: bigint; passwordHash: string; sessionVersion: number }; data: { passwordHash: string } }> = [];
    const password = "Raw <Legacy123!> ";
    const modules: Record<string, unknown> = {
      "@/lib/auth/credentials": {
        isBcryptHash: () => false,
        verifyPassword: async (input: string, hash: string) => {
          assert.equal(input, password);
          assert.equal(hash, "old-legacy-hash");
          if (concurrentReset) { user.passwordHash = "new-reset-password-hash"; user.sessionVersion = 1; }
          return true;
        },
        hashPassword: async (input: string) => { assert.equal(input, password); return "upgraded-legacy-password-hash"; },
      },
      "@/lib/utils": { normalizeEmail, parseId },
      jose: { SignJWT, jwtVerify },
      "next/headers": { cookies: async () => ({ get: () => undefined }) },
      "next/navigation": { redirect: () => assert.fail("Unexpected redirect") },
      "@/lib/prisma": { prisma: { user: {
        findUnique: async () => ({ ...user }),
        updateMany: async (query: typeof writes[number]) => {
          writes.push(query);
          if (query.where.id !== user.id || query.where.passwordHash !== user.passwordHash || query.where.sessionVersion !== user.sessionVersion) return { count: 0 };
          user.passwordHash = query.data.passwordHash;
          return { count: 1 };
        },
      } } },
    };
    const loaded = { exports: {} };
    runInNewContext(code, { module: loaded, exports: loaded.exports, TextEncoder, process: { env: {} }, console: { error: () => {} }, require: (name: string) => {
      assert.ok(name in modules, "Unexpected auth dependency: " + name); return modules[name];
    } });
    const result = await (loaded.exports as typeof authService).authenticateUser("LEGACY@example.test", password);
    assert.equal(result.success, true);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].where.sessionVersion, 0);
    assert.equal(writes[0].where.passwordHash, "old-legacy-hash");
    assert.equal(user.passwordHash, concurrentReset ? "new-reset-password-hash" : "upgraded-legacy-password-hash");
    assert.equal(user.sessionVersion, concurrentReset ? 1 : 0);
    if (result.success) assert.equal(result.user.sessionVersion, 0);
  }
});
