import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { SignJWT, jwtVerify } from "jose";
import { normalizeEmail, parseId } from "../lib/utils";
import type * as authService from "../lib/auth";

const secret = "test-session-secret-at-least-thirty-two-bytes";
const roles = ["superAdmin", "admin", "registrar", "teacher", "student"] as const;
type Account = { id: bigint; email: string; role: typeof roles[number]; emailVerified: boolean; sessionVersion?: number };
const code = ts.transpileModule(
  readFileSync(new URL("../lib/auth.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } },
).outputText;

async function cookieToken(claims: Record<string, unknown> = {}, subject = "1") {
  return new SignJWT({ email: "old@example.com", role: "superAdmin", emailVerified: true, ...claims })
    .setProtectedHeader({ alg: "HS256" }).setSubject(subject)
    .setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(secret));
}

function sessionHarness(token: string | undefined, initial: Account | null) {
  let account = initial;
  const queries: Array<{ where: { id: bigint }; select: Record<string, boolean> }> = [];
  const modules: Record<string, unknown> = {
    "@/lib/auth/credentials": { hashPassword: () => assert.fail("Unexpected credential write"), isBcryptHash: () => true, verifyPassword: () => false },
    "@/lib/utils": { normalizeEmail, parseId },
    "jose": { SignJWT, jwtVerify },
    "next/headers": { cookies: async () => ({ get: () => token ? { value: token } : undefined }) },
    "next/navigation": { redirect: (path: string) => { throw new Error("Redirect " + path); } },
    "@/lib/prisma": { prisma: { user: { findUnique: async (query: typeof queries[number]) => {
      queries.push(query);
      return account && account.id === query.where.id ? { ...account, sessionVersion: account.sessionVersion ?? 0 } : null;
    } } } },
  };
  const loaded = { exports: {} };
  runInNewContext(code, {
    module: loaded, exports: loaded.exports, TextEncoder,
    process: { env: { JWT_SECRET: secret } },
    require: (name: string) => {
      assert.ok(name in modules, "Unexpected authentication dependency: " + name);
      return modules[name];
    },
  });
  return { auth: loaded.exports as typeof authService, queries, setAccount: (next: Account | null) => { account = next; } };
}

test("sessions use current database email, role and verification status instead of old cookie claims", async () => {
  const harness = sessionHarness(await cookieToken(), { id: 1n, email: "current@example.com", role: "teacher", emailVerified: false });
  const session = await harness.auth.getCurrentSession();
  assert.equal(session?.email, "current@example.com");
  assert.equal(session?.role, "teacher");
  assert.equal(session?.emailVerified, false);
  assert.equal(harness.queries[0].where.id, 1n);
  assert.deepEqual(Object.keys(harness.queries[0].select).sort(), ["email", "emailVerified", "id", "role", "sessionVersion"]);
});

test("every unverified role can reach account verification but cannot enter protected portal guards", async () => {
  for (const role of roles) {
    const harness = sessionHarness(await cookieToken(), { id: 1n, email: "current@example.com", role, emailVerified: false });
    assert.equal((await harness.auth.requireAuthenticatedSession()).role, role);
    for (const guard of ["requireSession", "requireAdmin", "requireSuperAdmin", "requireTeacher"] as const) {
      await assert.rejects(harness.auth[guard](), /Redirect \/verify-email/);
    }
  }
});

test("a verified account can enter its portal and still needs the appropriate role", async () => {
  for (const role of roles) {
    const harness = sessionHarness(await cookieToken({ emailVerified: false }), { id: 1n, email: "current@example.com", role, emailVerified: true });
    assert.equal((await harness.auth.requireSession()).emailVerified, true);
    if (role === "teacher") assert.equal((await harness.auth.requireTeacher()).role, role);
    else await assert.rejects(harness.auth.requireTeacher(), /Redirect \/portal/);
    if (role === "superAdmin") assert.equal((await harness.auth.requireSuperAdmin()).role, role);
    else await assert.rejects(harness.auth.requireSuperAdmin(), /Redirect \/portal/);
    if (role === "superAdmin" || role === "admin") assert.equal((await harness.auth.requireAdmin()).role, role);
    else await assert.rejects(harness.auth.requireAdmin(), /Redirect \/portal/);
  }
});

test("verification or email changes take effect without replacing the current cookie", async () => {
  const account: Account = { id: 1n, email: "current@example.com", role: "teacher", emailVerified: false };
  const harness = sessionHarness(await cookieToken({ emailVerified: false }), account);
  await assert.rejects(harness.auth.requireSession(), /Redirect \/verify-email/);
  harness.setAccount({ ...account, emailVerified: true });
  assert.equal((await harness.auth.requireSession()).emailVerified, true);
  harness.setAccount({ ...account, email: "changed@example.com", emailVerified: false });
  await assert.rejects(harness.auth.requireSession(), /Redirect \/verify-email/);
});

test("missing accounts and invalid cookie subjects do not create authenticated sessions", async () => {
  const deleted = sessionHarness(await cookieToken(), null);
  assert.equal(await deleted.auth.getCurrentSession(), null);
  await assert.rejects(deleted.auth.requireAuthenticatedSession(), /Redirect \/login/);
  for (const subject of ["bad", "0", "-1", "9223372036854775808"]) {
    const harness = sessionHarness(await cookieToken({}, subject), null);
    assert.equal(await harness.auth.getCurrentSession(), null);
    assert.equal(harness.queries.length, 0);
  }
  const anonymous = sessionHarness(undefined, null);
  await assert.rejects(anonymous.auth.requireSession(), /Redirect \/login/);
  assert.equal(anonymous.queries.length, 0);
});

test("a verification JWT cannot be reused as a portal session cookie", async () => {
  const token = await new SignJWT({ scope: "email-verification", purpose: "emailVerification", email: "current@example.com" })
    .setProtectedHeader({ alg: "HS256" }).setSubject("1").setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
  const harness = sessionHarness(token, { id: 1n, email: "current@example.com", role: "superAdmin", emailVerified: true });
  assert.equal(await harness.auth.getCurrentSession(), null);
  assert.equal(harness.queries.length, 0);
});

test("password reset revokes legacy and current cookies for every account role", async () => {
  for (const role of roles) {
    const account: Account = { id: 1n, email: "current@example.com", role, emailVerified: true, sessionVersion: 0 };
    for (const claims of [{}, { sessionVersion: 0 }]) {
      const harness = sessionHarness(await cookieToken(claims), account);
      assert.equal((await harness.auth.requireSession()).sessionVersion, 0);
      harness.setAccount({ ...account, sessionVersion: 1 });
      assert.equal(await harness.auth.getCurrentSession(), null);
      await assert.rejects(harness.auth.requireSession(), /Redirect \/login/);
    }
    const fresh = sessionHarness(await cookieToken({ sessionVersion: 1 }), { ...account, sessionVersion: 1 });
    assert.equal((await fresh.auth.requireSession()).role, role);
    assert.equal((await fresh.auth.requireSession()).sessionVersion, 1);
  }
});

test("malformed session versions are rejected before any account lookup", async () => {
  for (const sessionVersion of [-1, 1.5, "0", null, 2147483648]) {
    const harness = sessionHarness(await cookieToken({ sessionVersion }), { id: 1n, email: "current@example.com", role: "teacher", emailVerified: true });
    assert.equal(await harness.auth.getCurrentSession(), null);
    assert.equal(harness.queries.length, 0);
  }
});

test("password reset JWTs cannot be reused as portal sessions", async () => {
  const token = await new SignJWT({ scope: "password-reset", email: "current@example.com", sessionVersion: 0, credentialFingerprint: "a".repeat(64) })
    .setProtectedHeader({ alg: "HS256" }).setSubject("1").setIssuedAt().setExpirationTime("30m").sign(new TextEncoder().encode(secret));
  const harness = sessionHarness(token, { id: 1n, email: "current@example.com", role: "superAdmin", emailVerified: true });
  assert.equal(await harness.auth.getCurrentSession(), null);
  assert.equal(harness.queries.length, 0);
});
