import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import type { TestContext } from "node:test";
import ts from "typescript";
import * as crypto from "node:crypto";
import * as enums from "../lib/generated/prisma/enums";
import * as utils from "../lib/utils";
import * as tokens from "../lib/auth/tokens";
import * as validation from "../lib/auth/password-reset-validation";
import type * as services from "../lib/auth/password-reset";
import type * as teacherServices from "../lib/teachers/activation";

export const testSecret = "password-reset-offline-test-secret-at-least-32-bytes";
const environmentKeys = ["PASSWORD_RESET_SECRET", "TEACHER_INVITATION_SECRET", "JWT_SECRET", "APP_URL", "NEXT_PUBLIC_APP_URL", "VERCEL_URL", "NODE_ENV"] as const;
export function setupEnvironment(t: TestContext) {
  const env = process.env as Record<string, string | undefined>;
  const previous = Object.fromEntries(environmentKeys.map((key) => [key, env[key]]));
  for (const key of environmentKeys) delete env[key];
  Object.assign(env, { PASSWORD_RESET_SECRET: testSecret, JWT_SECRET: testSecret, APP_URL: "https://portal.example.test", NODE_ENV: "production" });
  t.after(() => { for (const key of environmentKeys) { if (previous[key] === undefined) delete env[key]; else env[key] = previous[key]; } });
}
export type Account = { id: bigint; email: string; role: enums.UserRole; passwordHash: string; emailVerified: boolean; sessionVersion: number };
export type Token = { id: bigint; jti: string; userId: bigint | null; employeeId?: bigint | null; purpose: string; createdAt: Date; expiresAt: Date; consumedAt: Date | null };
type Where = Record<string, unknown>;
type Query = { where?: Where; select?: unknown; data?: Record<string, unknown>; take?: number };
type Database = { users: Account[]; tokens: Token[] };
export const state: validation.PasswordResetFormState = { success: false, message: "" };
export function account(overrides: Partial<Account> = {}): Account {
  return { id: 9007199254740993n, email: "person@example.test", role: "teacher", passwordHash: "original-credential-hash", emailVerified: false, sessionVersion: 0, ...overrides };
}
export function form(values: Record<string, string>) {
  const result = new FormData();
  for (const [key, value] of Object.entries(values)) result.set(key, value);
  return result;
}
export function passwordForm(token: string, extras: Record<string, string> = {}) {
  return form({ token, password: " <Strong123!> ", confirmPassword: " <Strong123!> ", ...extras });
}
function insensitiveMatch(value: string, input: string) {
  let expression = "";
  for (let index = 0; index < input.length; index++) {
    let character = input[index];
    if (character === "\\") { character = input[++index]; if (character === undefined) throw new Error("Invalid ILIKE escape"); }
    else if (character === "%") { expression += ".*"; continue; }
    else if (character === "_") { expression += "."; continue; }
    expression += character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + expression + "$", "isu").test(value);
}
function matches(row: Record<string, unknown>, where: Where = {}): boolean {
  return Object.entries(where).every(([field, value]) => {
    const actual = row[field];
    if (value && typeof value === "object" && !(value instanceof Date)) {
      const filter = value as { equals?: unknown; gt?: Date; not?: unknown; mode?: string };
      if (filter.mode === "insensitive") return insensitiveMatch(String(actual), String(filter.equals));
      return (filter.gt === undefined || actual instanceof Date && actual > filter.gt) &&
        (filter.equals === undefined || (actual instanceof Date && filter.equals instanceof Date ? +actual === +filter.equals : actual === filter.equals)) &&
        (filter.not === undefined || actual !== filter.not);
    }
    return actual === value;
  });
}

export function serviceHarness(options: {
  users?: Account[]; tokens?: Token[]; allowed?: boolean; rateFailure?: boolean; deliveryFailure?: boolean; notificationFailure?: boolean;
  createFailure?: boolean; userWriteFailure?: boolean; updateMiss?: boolean; consumeMiss?: boolean; lockMiss?: boolean; lockFailure?: boolean;
  invalidateFailure?: boolean;
  teacherActivation?: Pick<typeof teacherServices, "getTeacherActivationRecord" | "activateTeacher">;
  setupRequest?: (email: string) => Promise<void>;
} = {}) {
  let database: Database = structuredClone({ users: options.users ?? [account()], tokens: options.tokens ?? [] });
  const calls: Array<{ method: string; query: Query }> = [];
  const events: string[] = [];
  const passwords: string[] = [];
  const scheduled: Array<() => Promise<void>> = [];
  const emails: Array<{ to: string; resetUrl: string }> = [];
  const notifications: Array<{ to: string }> = [];
  const delays: number[] = [];
  const logs: unknown[][] = [];
  const setupRequests: string[] = [];
  function record(method: string, query: Query) { calls.push({ method, query: structuredClone(query) }); events.push(method); }
  function delegates(data: Database) {
    return {
      user: {
        async findMany(query: Query) { record("user.findMany", query); return structuredClone(data.users.filter((row) => matches(row, query.where)).slice(0, query.take ?? data.users.length)); },
        async findUnique(query: Query) { record("user.findUnique", query); return structuredClone(data.users.find((row) => matches(row, query.where)) ?? null); },
        async updateMany(query: Query) {
          record("user.updateMany", query);
          if (options.userWriteFailure) throw new Error("Private user and credential details");
          if (options.updateMiss) return { count: 0 };
          const rows = data.users.filter((row) => matches(row, query.where));
          for (const row of rows) {
            if (data.users.some((other) => other.id !== row.id && other.email === query.data?.email)) throw new Error("Unique canonical email conflict");
            row.email = String(query.data?.email);
            row.passwordHash = String(query.data?.passwordHash);
            row.sessionVersion += Number((query.data?.sessionVersion as { increment: number }).increment);
            row.emailVerified = Boolean(query.data?.emailVerified);
          }
          return { count: rows.length };
        },
      },
      verificationToken: {
        async findFirst(query: Query) { record("token.findFirst", query); return structuredClone(data.tokens.find((row) => matches(row, query.where)) ?? null); },
        async findUnique(query: Query) { record("token.findUnique", query); return structuredClone(data.tokens.find((row) => matches(row, query.where)) ?? null); },
        async create(query: Query) {
          record("token.create", query);
          if (options.createFailure) throw new Error("Private token creation error");
          const row = { id: BigInt(data.tokens.length + 1), ...query.data, createdAt: new Date(), consumedAt: null } as Token;
          data.tokens.push(row); return structuredClone(row);
        },
        async updateMany(query: Query) {
          record("token.updateMany", query);
          if (options.consumeMiss && typeof query.where?.jti === "string") return { count: 0 };
          if (options.invalidateFailure && typeof query.where?.jti === "object") throw new Error("Private invalidation details");
          const rows = data.tokens.filter((row) => matches(row, query.where));
          for (const row of rows) row.consumedAt = query.data?.consumedAt as Date;
          return { count: rows.length };
        },
        async deleteMany(query: Query) {
          record("token.deleteMany", query);
          const previous = data.tokens.length;
          data.tokens = data.tokens.filter((row) => !matches(row, query.where));
          return { count: previous - data.tokens.length };
        },
      },
      async $queryRaw(query: { strings: readonly string[]; values: unknown[] }) {
        events.push("user.lock");
        assert.match(query.strings.join("?"), /SELECT "id" FROM "users" WHERE "id" = \? FOR UPDATE/);
        assert.equal(typeof query.values[0], "bigint");
        if (options.lockFailure) throw new Error("Concurrent user update");
        return options.lockMiss ? [] : data.users.filter((row) => row.id === query.values[0]).map(({ id }) => ({ id }));
      },
    };
  }
  const prisma = new Proxy({}, { get(_target, name) {
    if (name === "$transaction") return async (callback: (tx: ReturnType<typeof delegates>) => Promise<unknown>, settings: { isolationLevel: string }) => {
      assert.equal(settings.isolationLevel, "Serializable");
      events.push("transaction");
      const transactionData = structuredClone(database);
      try { const result = await callback(delegates(transactionData)); database = transactionData; events.push("commit"); return result; }
      catch (error) { events.push("rollback"); throw error; }
    };
    return delegates(database)[name as keyof ReturnType<typeof delegates>];
  } });
  const modules: Record<string, unknown> = {
    "node:crypto": crypto, "node:timers/promises": { setTimeout: async (value: number) => { delays.push(value); } },
    "next/server": { after: (callback: () => Promise<void>) => scheduled.push(callback) },
    "@/lib/generated/prisma/client": { Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" }, sql: (strings: readonly string[], ...values: unknown[]) => ({ strings, values }) } },
    "@/lib/generated/prisma/enums": enums, "@/lib/prisma": { prisma }, "@/lib/utils": utils,
    "@/lib/teachers/password-setup": { requestTeacherPasswordSetup: async (email: string) => {
      events.push("teacher.setup-request"); setupRequests.push(email);
      await options.setupRequest?.(email);
    } },
    "@/lib/teachers/activation": options.teacherActivation ?? {
      getTeacherActivationRecord: async () => null,
      activateTeacher: async () => ({ success: false, message: "Invalid teacher setup.", fieldErrors: { token: "Invalid token." } }),
    },
    "./credentials": { hashPassword: async (password: string) => {
      events.push("hash"); passwords.push(password);
      return "offline-bcrypt-hash";
    } },
    "./password-reset-rate-limit": { recordPasswordResetAttempt: async (email: string) => {
      events.push("rate"); assert.equal(email, utils.normalizeEmail(email));
      if (options.rateFailure) throw new Error("Private rate-limit details"); return options.allowed !== false;
    } },
    "./tokens": tokens, "./password-reset-validation": validation,
    "./email": {
      sendPasswordResetEmail: async (message: { to: string; resetUrl: string }) => { events.push("email"); emails.push(structuredClone(message)); if (options.deliveryFailure) throw new Error("Private provider details and " + message.resetUrl); },
      sendPasswordChangedEmail: async (message: { to: string }) => { events.push("notification"); notifications.push(structuredClone(message)); if (options.notificationFailure) throw new Error("Private notification details"); },
    },
  };
  const compiled = ts.transpileModule(readFileSync(new URL("../lib/auth/password-reset.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  const loaded = { exports: {} };
  runInNewContext(compiled, { module: loaded, exports: loaded.exports, Buffer, Date, console: { error: (...values: unknown[]) => logs.push(values) },
    require: (name: string) => { assert.ok(name in modules, "Unexpected password reset dependency " + name); return modules[name]; } });
  const exported = loaded.exports as typeof services;
  // Model serializable action boundaries while keeping the real service implementation isolated.
  const service = {
    requestPasswordReset: async (...args: Parameters<typeof exported.requestPasswordReset>) => structuredClone(await exported.requestPasswordReset(...args)),
    getPasswordResetRecord: async (...args: Parameters<typeof exported.getPasswordResetRecord>) => structuredClone(await exported.getPasswordResetRecord(...args)),
    resetPassword: async (...args: Parameters<typeof exported.resetPassword>) => structuredClone(await exported.resetPassword(...args)),
  };
  return {
    service, get database() { return database; }, calls, events, emails, notifications, passwords, delays, logs, scheduled, setupRequests,
    async runAfter() { while (scheduled.length) await scheduled.shift()!(); },
  };
}

export async function seedReset(subject: ReturnType<typeof serviceHarness>, overrides: Partial<Token> = {}) {
  const user = subject.database.users[0];
  const issued = await tokens.createPasswordResetToken({ id: user.id.toString(), email: utils.normalizeEmail(user.email), passwordHash: user.passwordHash, sessionVersion: user.sessionVersion });
  subject.database.tokens.push({ id: 1n, jti: issued.jti, userId: user.id, purpose: "passwordReset", createdAt: new Date(Date.now() - 120_000), expiresAt: issued.expiresAt, consumedAt: null, ...overrides });
  return issued;
}
