import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as crypto from "node:crypto";
import * as net from "node:net";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type * as limiter from "../lib/auth/password-reset-rate-limit";

type Bucket = { attempts: number; expiresAt: Date };
function harness(options: { headers?: Record<string, string>; missingRows?: boolean } = {}) {
  const buckets = new Map<string, Bucket>();
  const queries: Array<{ scope: string; identifierHash: string; expiresAt: Date; ceiling: number; values: unknown[]; text: string }> = [];
  const headerStore = { get: (name: string) => options.headers?.[name] ?? (name === "x-real-ip" ? "192.0.2.1" : null) };
  const transaction = { $queryRaw: async (query: { strings: readonly string[]; values: unknown[] }) => {
    const [scope, identifierHash, expiresAt, ceiling] = query.values as [string, string, Date, number];
    queries.push({ scope, identifierHash, expiresAt, ceiling, values: query.values, text: query.strings.join("?") });
    if (options.missingRows) return [];
    const key = `${scope}:${identifierHash}`;
    const current = buckets.get(key);
    const row = !current || current.expiresAt <= new Date() ? { attempts: 1, expiresAt } : { ...current, attempts: Math.min(current.attempts + 1, ceiling) };
    buckets.set(key, row);
    return [{ attempts: row.attempts }];
  } };
  const modules: Record<string, unknown> = {
    "node:crypto": crypto, "node:net": net, "next/headers": { headers: async () => headerStore },
    "@/lib/generated/prisma/client": { Prisma: { sql: (strings: readonly string[], ...values: unknown[]) => ({ strings, values }) } },
    "@/lib/prisma": { prisma: { $transaction: async (callback: (tx: typeof transaction) => Promise<boolean>) => callback(transaction) } },
  };
  const compiled = ts.transpileModule(readFileSync(new URL("../lib/auth/password-reset-rate-limit.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  const loaded = { exports: {} };
  runInNewContext(compiled, { module: loaded, exports: loaded.exports, Date,
    require: (name: string) => { assert.ok(name in modules, "Unexpected limiter dependency " + name); return modules[name]; } });
  return { service: loaded.exports as typeof limiter, buckets, queries };
}

test("reset IP extraction follows valid forwarded and real-IP header conventions", () => {
  const subject = harness();
  for (const [headers, expected] of [
    [{ "x-forwarded-for": "invalid, 198.51.100.3, 192.0.2.4", "x-real-ip": "192.0.2.9" }, "198.51.100.3"],
    [{ "x-forwarded-for": "invalid", "x-real-ip": " 2001:DB8::1 " }, "2001:db8::1"],
    [{ "x-forwarded-for": "hostname", "x-real-ip": "not-an-ip" }, "unknown"], [{}, "unknown"],
  ] as const) {
    assert.equal(subject.service.extractPasswordResetClientIp({ get: (name) => (headers as Record<string, string>)[name] ?? null }), expected);
  }
});

test("reset buckets hash identifiers, use separate scopes and enforce five email attempts per 15 minutes", async () => {
  const subject = harness();
  for (let index = 0; index < 5; index++) assert.equal(await subject.service.recordPasswordResetAttempt("person@example.test"), true);
  assert.equal(await subject.service.recordPasswordResetAttempt("person@example.test"), false);
  assert.equal(subject.queries[0].scope, "passwordResetIp");
  assert.equal(subject.queries[1].scope, "passwordResetEmail");
  for (const query of subject.queries) {
    assert.match(query.identifierHash, /^[a-f0-9]{64}$/);
    assert.equal(query.values.includes("person@example.test"), false);
    assert.equal(query.values.includes("192.0.2.1"), false);
    assert.ok(+query.expiresAt - Date.now() > 899_000 && +query.expiresAt - Date.now() <= 900_000);
    assert.match(query.text, /ON CONFLICT \("scope", "identifier_hash"\) DO UPDATE/);
    assert.match(query.text, /RETURNING "attempts"/);
  }
  for (const bucket of subject.buckets.values()) bucket.expiresAt = new Date(0);
  assert.equal(await subject.service.recordPasswordResetAttempt("person@example.test"), true);
});

test("blocked IPs cannot create new random-email buckets and IP counters stop at the denial threshold", async () => {
  const subject = harness();
  for (let index = 0; index < 20; index++) assert.equal(await subject.service.recordPasswordResetAttempt(`person${index}@example.test`), true);
  const before = subject.buckets.size;
  assert.equal(before, 21);
  assert.equal(await subject.service.recordPasswordResetAttempt("new-address@example.test"), false);
  assert.equal(subject.buckets.size, before);
  assert.equal(subject.queries.at(-1)?.scope, "passwordResetIp");
  assert.equal(await subject.service.recordPasswordResetAttempt("yet-another@example.test"), false);
  const ipHash = createHash("sha256").update("passwordResetIp:192.0.2.1").digest("hex");
  assert.equal(subject.buckets.get(`passwordResetIp:${ipHash}`)?.attempts, 21);
});

test("rate buckets fail closed when the database returns no attempt count", async () => {
  const subject = harness({ missingRows: true });
  assert.equal(await subject.service.recordPasswordResetAttempt("person@example.test"), false);
  assert.equal(subject.queries.length, 1);
});
