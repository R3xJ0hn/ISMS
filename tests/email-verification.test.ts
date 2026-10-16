import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { type TestContext } from "node:test";
import { runInNewContext } from "node:vm";
import { SignJWT } from "jose";
import ts from "typescript";
import * as tokens from "../lib/auth/tokens";
import { buildEmailVerificationEmail } from "../lib/auth/email";
import * as enums from "../lib/generated/prisma/enums";
import * as utils from "../lib/utils";
import type * as verificationService from "../lib/auth/email-verification";

const testSecret = "offline-email-verification-secret-32-bytes";
const environmentKeys = ["EMAIL_VERIFICATION_SECRET", "JWT_SECRET", "APP_URL", "NEXT_PUBLIC_APP_URL", "VERCEL_URL", "NODE_ENV"] as const;
const environment = process.env as Record<string, string | undefined>;
const state = { success: false, message: "" };

test("shared token handling keeps verification, password reset and teacher setup isolated with the same fallback secret", async (t) => {
  const keys = ["EMAIL_VERIFICATION_SECRET", "PASSWORD_RESET_SECRET", "TEACHER_INVITATION_SECRET", "JWT_SECRET"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, environment[key]]));
  for (const key of keys) delete environment[key];
  environment.JWT_SECRET = testSecret;
  t.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete environment[key];
      else environment[key] = previous[key];
    }
  });
  const issued = await Promise.all([
    tokens.createEmailVerificationToken("1", "person@example.test"),
    tokens.createPasswordResetToken({ id: "1", email: "person@example.test", passwordHash: "offline-credential", sessionVersion: 0 }),
    tokens.createTeacherInvitationToken("1", "person@example.test"),
  ]);
  const verifiers = [tokens.verifyEmailVerificationToken, tokens.verifyPasswordResetToken, tokens.verifyTeacherInvitationToken];
  for (const [issuedIndex, { token }] of issued.entries()) {
    for (const [verifierIndex, verify] of verifiers.entries()) {
      assert.equal((await verify(token)) !== null, issuedIndex === verifierIndex);
    }
  }
  environment.EMAIL_VERIFICATION_SECRET = "a-distinct-verification-secret-at-least-32-bytes";
  assert.equal(await tokens.verifyEmailVerificationToken(issued[0].token), null);
  assert.ok(await tokens.verifyPasswordResetToken(issued[1].token));
  assert.ok(await tokens.verifyTeacherInvitationToken(issued[2].token));
});

function configure(t: TestContext) {
  const previous = Object.fromEntries(environmentKeys.map((key) => [key, environment[key]]));
  for (const key of environmentKeys) delete environment[key];
  Object.assign(environment, { EMAIL_VERIFICATION_SECRET: testSecret, APP_URL: "https://portal.example.test", NODE_ENV: "production" });
  t.after(() => {
    for (const key of environmentKeys) {
      if (previous[key] === undefined) delete environment[key];
      else environment[key] = previous[key];
    }
  });
}

async function signedToken(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    scope: "email-verification", purpose: "emailVerification", email: "person@example.com",
    sub: "9007199254740993", jti: "12345678-1234-4234-8234-123456789abc", iat: now, exp: now + 3600,
    iss: "isms", aud: "email-verification", ...overrides,
  }).setProtectedHeader({ alg: "HS256" }).sign(new TextEncoder().encode(testSecret));
}

type User = { id: bigint; email: string; role: string; emailVerified: boolean; passwordHash: string };
type TokenRecord = {
  id: bigint; jti: string; purpose: string; userId: bigint | null; employeeId?: bigint | null;
  createdAt: Date; expiresAt: Date; consumedAt: Date | null;
};
type Query = { where?: Record<string, unknown>; data?: Record<string, unknown>; select?: Record<string, boolean> };
const account: User = {
  id: 9007199254740993n, email: "person@example.com", role: "teacher", emailVerified: false, passwordHash: "existing-password-hash",
};

const code = ts.transpileModule(readFileSync(new URL("../lib/auth/email-verification.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText;

function matches(record: object, where: Record<string, unknown> = {}) {
  return Object.entries(where).every(([key, expected]) => {
    const actual = Reflect.get(record, key);
    if (typeof expected === "object" && expected !== null && "gt" in expected) {
      return Number(actual) > Number(expected.gt);
    }
    return actual === expected;
  });
}

function harness(options: {
  denied?: boolean; sessionId?: string; sessionEmail?: string; user?: User;
  sendFailure?: boolean; userUpdateZero?: boolean; transactionFailure?: boolean;
} = {}) {
  const store = { users: [structuredClone(options.user ?? account)], tokens: [] as TokenRecord[] };
  const calls: Array<{ method: string; query: Query }> = [];
  const events: string[] = [];
  const emails: Array<{ to: string; verificationUrl: string }> = [];
  const revalidated: Array<[string, string | undefined]> = [];
  function record(method: string, query: Query) { calls.push({ method, query: structuredClone(query) }); }
  const user = {
    async findUnique(query: Query) { record("user.findUnique", query); return store.users.find((row) => matches(row, query.where)) ?? null; },
    async updateMany(query: Query) {
      record("user.updateMany", query);
      if (options.userUpdateZero) return { count: 0 };
      const rows = store.users.filter((row) => matches(row, query.where));
      for (const row of rows) Object.assign(row, query.data);
      return { count: rows.length };
    },
  };
  const verificationToken = {
    async findUnique(query: Query) { record("token.findUnique", query); return store.tokens.find((row) => matches(row, query.where)) ?? null; },
    async findFirst(query: Query) { record("token.findFirst", query); return store.tokens.find((row) => matches(row, query.where)) ?? null; },
    async updateMany(query: Query) {
      record("token.updateMany", query);
      const rows = store.tokens.filter((row) => matches(row, query.where));
      for (const row of rows) Object.assign(row, query.data);
      return { count: rows.length };
    },
    async create(query: Query) {
      record("token.create", query);
      const row = { id: BigInt(store.tokens.length + 1), createdAt: new Date(), consumedAt: null, ...query.data } as TokenRecord;
      store.tokens.push(row);
      return row;
    },
    async deleteMany(query: Query) {
      record("token.deleteMany", query);
      const before = store.tokens.length;
      store.tokens = store.tokens.filter((row) => !matches(row, query.where));
      return { count: before - store.tokens.length };
    },
  };
  const modules: Record<string, unknown> = {
    "@/lib/auth": { requireAuthenticatedSession: async () => {
      events.push("authenticate");
      if (options.denied) throw new Error("Login required");
      return { id: options.sessionId ?? store.users[0].id.toString(), email: options.sessionEmail ?? store.users[0].email };
    } },
    "@/lib/generated/prisma/client": { Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } } },
    "@/lib/generated/prisma/enums": enums,
    "@/lib/utils": utils,
    "@/lib/prisma": { prisma: {
      user, verificationToken,
      $transaction: async (callback: (tx: { user: typeof user; verificationToken: typeof verificationToken }) => Promise<unknown>, txOptions: { isolationLevel: string }) => {
        events.push("transaction");
        assert.equal(txOptions.isolationLevel, "Serializable");
        const before = structuredClone(store);
        try {
          const result = await callback({ user, verificationToken });
          if (options.transactionFailure) throw new Error("Private database details and token URL");
          events.push("commit");
          return result;
        } catch (error) {
          Object.assign(store, before);
          events.push("rollback");
          throw error;
        }
      },
    } },
    "./tokens": tokens,
    "./email": { sendEmailVerificationEmail: async (email: typeof emails[number]) => {
      events.push("email");
      emails.push(email);
      if (options.sendFailure) throw new Error("Provider failure containing " + email.verificationUrl);
    } },
    "next/cache": { revalidatePath: (path: string, type?: string) => revalidated.push([path, type]) },
  };
  const loaded = { exports: {} };
  runInNewContext(code, {
    module: loaded, exports: loaded.exports,
    require: (name: string) => {
      assert.ok(name in modules, "Unexpected verification dependency: " + name);
      return modules[name];
    },
  });
  return { service: loaded.exports as typeof verificationService, store, calls, events, emails, revalidated, options };
}

async function seedToken(subject: ReturnType<typeof harness>, overrides: Partial<TokenRecord> = {}) {
  const user = subject.store.users[0];
  const issued = await tokens.createEmailVerificationToken(user.id.toString(), user.email);
  subject.store.tokens.push({
    id: 1n, jti: issued.jti, purpose: "emailVerification", userId: user.id,
    createdAt: new Date(Date.now() - 120_000), expiresAt: issued.expiresAt, consumedAt: null, ...overrides,
  });
  return issued;
}

function tokenForm(token: string) { const form = new FormData(); form.set("token", token); return form; }
function mutations(subject: ReturnType<typeof harness>) { return subject.calls.filter(({ method }) => /\.(create|updateMany|deleteMany)$/.test(method)); }

test("verification JWTs bind account/email and reject forged, session, wrong-purpose and expired tokens", async (t) => {
  configure(t);
  const issued = await tokens.createEmailVerificationToken(account.id.toString(), account.email);
  const claims = await tokens.verifyEmailVerificationToken(issued.token);
  assert.equal(claims?.userId, account.id.toString());
  assert.equal(claims?.email, account.email);
  assert.equal(claims?.jti, issued.jti);
  assert.equal(claims?.expiresAt.getTime(), issued.expiresAt.getTime());
  const now = Math.floor(Date.now() / 1000);
  for (const invalid of [
    issued.token.slice(0, -3) + "xxx", "legacy.payload.signature",
    await signedToken({ scope: "student-update", purpose: "studentUpdate" }),
    await signedToken({ aud: "session" }), await signedToken({ iss: "another-issuer" }),
    await signedToken({ iat: now - 4000, exp: now - 400 }), await signedToken({ sub: "0" }),
    await signedToken({ iat: now + 60, exp: now + 3660 }), await signedToken({ exp: now + 7200 }),
    await signedToken({ sub: "9223372036854775808" }), await signedToken({ jti: "not-a-uuid" }),
    await signedToken({ email: "a".repeat(321) + "@example.com" }),
  ]) assert.equal(await tokens.verifyEmailVerificationToken(invalid), null);
  const sessionToken = await new SignJWT({ email: account.email, role: "teacher", emailVerified: false })
    .setProtectedHeader({ alg: "HS256" }).setSubject(account.id.toString()).setExpirationTime("1h")
    .sign(new TextEncoder().encode(testSecret));
  assert.equal(await tokens.verifyEmailVerificationToken(sessionToken), null);
});

test("verification secret fallback enforces 32 bytes and public links use HTTPS outside development", async (t) => {
  configure(t);
  delete environment.EMAIL_VERIFICATION_SECRET;
  environment.JWT_SECRET = testSecret;
  const issued = await tokens.createEmailVerificationToken("1", "person@example.com");
  assert.ok(await tokens.verifyEmailVerificationToken(issued.token));
  environment.JWT_SECRET = "short";
  await assert.rejects(tokens.createEmailVerificationToken("1", "person@example.com"), /at least 32 bytes/);
  assert.equal(await tokens.verifyEmailVerificationToken(issued.token), null);
  environment.APP_URL = "https://portal.example.test/old?query=discard#old";
  assert.equal(tokens.createEmailVerificationUrl("test&token"), "https://portal.example.test/verify-email?token=test%26token");
  environment.APP_URL = "http://localhost:3000";
  assert.throws(() => tokens.createEmailVerificationUrl("test"), /HTTPS/);
  environment.NODE_ENV = "development";
  assert.equal(tokens.createEmailVerificationUrl("test"), "http://localhost:3000/verify-email?token=test");
});

test("verification email escapes the account address and link without unsafe HTML", (t) => {
  configure(t);
  const message = buildEmailVerificationEmail("person&<tag>\"@example.com", "https://portal.example.test/verify-email?token=abc&mode=confirm");
  assert.match(message.html, /person&amp;&lt;tag&gt;&quot;@example.com/);
  assert.match(message.html, /token=abc&amp;mode=confirm/);
  assert.doesNotMatch(message.html, /<tag>/);
  assert.match(message.text, /expires in 1 hour/);
  assert.throws(() => buildEmailVerificationEmail(account.email, "javascript:alert(1)"), /Invalid/);
});

test("requesting verification requires authentication before any database or email operation", async (t) => {
  configure(t);
  const subject = harness({ denied: true });
  await assert.rejects(subject.service.sendEmailVerification(state, new FormData()), /Login required/);
  assert.deepEqual(subject.events, ["authenticate"]);
  assert.equal(subject.calls.length, 0);
  assert.equal(subject.emails.length, 0);
  const malformed = harness({ sessionId: "not-a-database-id" });
  assert.equal((await malformed.service.sendEmailVerification(state, new FormData())).success, false);
  assert.equal(malformed.calls.length, 0);
});

test("every account role can request its own email verification without trusting submitted identities", async (t) => {
  configure(t);
  for (const role of ["superAdmin", "admin", "registrar", "teacher", "student"]) {
    const subject = harness({ user: { ...account, role } });
    const form = new FormData(); form.set("email", "attacker@example.com"); form.set("userId", "2");
    const result = await subject.service.sendEmailVerification(state, form);
    assert.equal(result.success, true, role);
    assert.deepEqual(subject.events, ["authenticate", "transaction", "commit", "email"]);
    assert.equal(subject.emails[0].to, account.email);
    assert.equal(subject.store.tokens[0].purpose, "emailVerification");
    assert.equal(subject.store.tokens[0].userId, account.id);
    assert.equal("studentId" in subject.store.tokens[0], false);
    assert.equal("email" in subject.store.tokens[0], false);
    const linkToken = new URL(subject.emails[0].verificationUrl).searchParams.get("token");
    assert.ok(linkToken);
    assert.equal((await subject.service.confirmEmailVerification(state, tokenForm(linkToken))).success, true, role);
    assert.equal(subject.store.users[0].emailVerified, true);
    assert.equal(subject.store.users[0].role, role);
    assert.equal(subject.store.users[0].passwordHash, account.passwordHash);
    assert.equal(JSON.stringify(result).includes("token="), false);
  }
});

test("new requests revoke only old email-purpose tokens and a 60-second cooldown prevents repeated sends", async (t) => {
  configure(t);
  const subject = harness();
  await seedToken(subject);
  const oldJti = subject.store.tokens[0].jti;
  subject.store.tokens.push({
    ...subject.store.tokens[0], id: 2n, jti: "12345678-1234-4234-8234-123456789abc",
    purpose: "studentUpdate", userId: account.id,
  });
  const setup = {
    ...subject.store.tokens[0], id: 3n, jti: "12345678-1234-4234-8234-123456789abd",
    purpose: "teacherSetup", userId: null, employeeId: 44n,
  };
  subject.store.tokens.push(setup);
  const setupBefore = structuredClone(setup);
  assert.equal((await subject.service.sendEmailVerification(state, new FormData())).success, true);
  assert.ok(subject.store.tokens.find((row) => row.jti === oldJti)?.consumedAt);
  assert.equal(subject.store.tokens.find((row) => row.purpose === "studentUpdate")?.consumedAt, null);
  assert.deepEqual(subject.store.tokens.find((row) => row.purpose === "teacherSetup"), setupBefore);
  const again = await subject.service.sendEmailVerification(state, new FormData());
  assert.equal(again.success, false);
  assert.match(again.message, /60 seconds/);
  assert.equal(subject.emails.length, 1);
});

test("already verified and changed-email accounts do not issue or send another token", async (t) => {
  configure(t);
  const verified = harness({ user: { ...account, emailVerified: true } });
  const result = await verified.service.sendEmailVerification(state, new FormData());
  assert.equal(result.success, true);
  assert.match(result.message, /already verified/);
  assert.equal(mutations(verified).length, 0);
  const stale = harness({ sessionEmail: "old@example.com" });
  assert.equal((await stale.service.sendEmailVerification(state, new FormData())).success, false);
  assert.equal(mutations(stale).length, 0);
  assert.equal(stale.emails.length, 0);
});

test("failed delivery cleans up only its new token and allows a safe retry", async (t) => {
  configure(t);
  const subject = harness({ sendFailure: true });
  await seedToken(subject);
  const oldJti = subject.store.tokens[0].jti;
  const result = await subject.service.sendEmailVerification(state, new FormData());
  assert.equal(result.success, false);
  assert.equal(JSON.stringify(result).includes("token="), false);
  const cleanup = subject.calls.find((call) => call.method === "token.deleteMany");
  assert.equal(typeof cleanup?.query.where?.jti, "string");
  assert.notEqual(cleanup?.query.where?.jti, oldJti);
  assert.equal(cleanup?.query.where?.purpose, "emailVerification");
  assert.equal(subject.store.tokens.length, 1);
  assert.equal(subject.store.tokens[0].jti, oldJti);
  subject.options.sendFailure = false;
  assert.equal((await subject.service.sendEmailVerification(state, new FormData())).success, true);
});

test("GET preview performs no writes and explicit confirmation verifies once without changing credentials or role", async (t) => {
  configure(t);
  const subject = harness();
  const issued = await seedToken(subject);
  const preview = await subject.service.getEmailVerificationRecord(issued.token);
  assert.equal(preview?.email, account.email);
  assert.deepEqual(Object.keys(preview ?? {}), ["email"]);
  assert.equal(mutations(subject).length, 0);
  assert.equal(subject.emails.length, 0);
  const confirmed = await subject.service.confirmEmailVerification(state, tokenForm(issued.token));
  assert.equal(confirmed.success, true);
  assert.equal(subject.store.users[0].emailVerified, true);
  assert.equal(subject.store.users[0].role, account.role);
  assert.equal(subject.store.users[0].passwordHash, account.passwordHash);
  assert.ok(subject.store.tokens[0].consumedAt);
  assert.deepEqual(subject.calls.find((call) => call.method === "user.updateMany")?.query.data, { emailVerified: true });
  assert.deepEqual(subject.revalidated, [["/portal", "layout"]]);
  assert.equal((await subject.service.confirmEmailVerification(state, tokenForm(issued.token))).success, false);
  assert.equal(await subject.service.getEmailVerificationRecord(issued.token), null);
});

test("stale email, wrong ledger purpose, used and expired records cannot verify an account", async (t) => {
  configure(t);
  for (const bad of ["email", "purpose", "teacherSetup", "missingUser", "used", "expired", "owner", "expiryMismatch"]) {
    const subject = harness();
    const issued = await seedToken(subject);
    if (bad === "email") subject.store.users[0].email = "changed@example.com";
    if (bad === "purpose") subject.store.tokens[0].purpose = "studentUpdate";
    if (bad === "teacherSetup") Object.assign(subject.store.tokens[0], { purpose: "teacherSetup", userId: null, employeeId: 44n });
    if (bad === "missingUser") subject.store.tokens[0].userId = null;
    if (bad === "used") subject.store.tokens[0].consumedAt = new Date();
    if (bad === "expired") subject.store.tokens[0].expiresAt = new Date(Date.now() - 1000);
    if (bad === "owner") subject.store.tokens[0].userId = 2n;
    if (bad === "expiryMismatch") subject.store.tokens[0].expiresAt = new Date(issued.expiresAt.getTime() + 1000);
    assert.equal(await subject.service.getEmailVerificationRecord(issued.token), null, bad);
    assert.equal((await subject.service.confirmEmailVerification(state, tokenForm(issued.token))).success, false, bad);
    assert.equal(subject.store.users[0].emailVerified, false);
    assert.equal(mutations(subject).length, 0);
    assert.equal(subject.revalidated.length, 0);
  }
});

test("a concurrent account change rolls back token consumption and database errors do not expose internals", async (t) => {
  configure(t);
  const concurrent = harness({ userUpdateZero: true });
  const issued = await seedToken(concurrent);
  assert.equal((await concurrent.service.confirmEmailVerification(state, tokenForm(issued.token))).success, false);
  assert.equal(concurrent.store.tokens[0].consumedAt, null);
  assert.equal(concurrent.store.users[0].emailVerified, false);
  assert.ok(concurrent.events.includes("rollback"));
  const failed = harness({ transactionFailure: true });
  const failedIssue = await seedToken(failed);
  for (const result of [
    await failed.service.sendEmailVerification(state, new FormData()),
    await failed.service.confirmEmailVerification(state, tokenForm(failedIssue.token)),
  ]) {
    assert.equal(result.success, false);
    assert.doesNotMatch(result.message, /Private|token URL/);
  }
  assert.equal(failed.store.users[0].emailVerified, false);
  assert.equal(failed.emails.length, 0);
});
