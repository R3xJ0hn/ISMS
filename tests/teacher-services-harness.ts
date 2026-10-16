import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type { TestContext } from "node:test";
import type { EmployeeRole, EmployeeStatus, UserRole } from "../lib/generated/prisma/enums";
import * as enums from "../lib/generated/prisma/enums";
import * as utils from "../lib/utils";
import * as employeeNames from "../lib/employees/names";
import * as validation from "../lib/teachers/validation";
import * as records from "../lib/teachers/records";
import * as tokens from "../lib/auth/tokens";
import type * as admin from "../lib/teachers/admin";
import type * as activation from "../lib/teachers/activation";

export const testSecret = "teacher-account-setup-offline-secret-at-least-32-bytes";
const environmentKeys = ["TEACHER_INVITATION_SECRET", "JWT_SECRET", "APP_URL", "NEXT_PUBLIC_APP_URL", "VERCEL_URL", "NODE_ENV"] as const;
export function setupEnvironment(t: TestContext, values: Record<string, string> = {}) {
  const environment = process.env as Record<string, string | undefined>;
  const previous = Object.fromEntries(environmentKeys.map((key) => [key, environment[key]]));
  for (const key of environmentKeys) delete environment[key];
  Object.assign(environment, { TEACHER_INVITATION_SECRET: testSecret, JWT_SECRET: testSecret, APP_URL: "https://portal.example.test", NODE_ENV: "production", ...values });
  t.after(() => {
    for (const key of environmentKeys) {
      if (previous[key] === undefined) delete environment[key];
      else environment[key] = previous[key];
    }
  });
}

export type Employee = { id: bigint; employeeId: string; firstName: string | null; middleName: string | null; lastName: string | null; suffix: string | null; emailAddress: string; contactNumber: string; status: EmployeeStatus; role: EmployeeRole; userImage: string | null };
export type Account = { id: bigint; email: string; role: UserRole; emailVerified: boolean; passwordHash: string };
export type TokenPurpose = "studentUpdate" | "emailVerification" | "passwordReset" | "teacherSetup";
export type Invitation = { id: bigint; jti: string; purpose: TokenPurpose; userId: bigint | null; employeeId: bigint | null; createdAt: Date; expiresAt: Date; consumedAt: Date | null };
export type Teacher = { employeeId: bigint; userId: bigint };
type Database = { employees: Employee[]; users: Account[]; tokens: Invitation[]; teachers: Teacher[] };
type Where = {
  id?: bigint; role?: UserRole | EmployeeRole; email?: { equals: string; mode: string }; emailAddress?: { equals: string; mode: string }; OR?: Where[]; employeeId?: bigint | null; userId?: bigint | null; purpose?: TokenPurpose; jti?: string;
  NOT?: Where[]; teacher?: { is: { user: { role: UserRole } } };
  consumedAt?: null; createdAt?: { gt: Date }; expiresAt?: { gt: Date; equals?: Date };
};
type Query = { where?: Where; data?: Record<string, unknown>; select?: unknown; orderBy?: unknown; take?: number };
type Call = { method: string; query: Query };

export function employee(overrides: Partial<Employee> = {}): Employee {
  return { id: 9007199254740993n, employeeId: "EMP-0001", firstName: "Maria", middleName: null, lastName: "Santos", suffix: null, emailAddress: "maria@example.test", contactNumber: "09170000000", status: "Regular", role: "teacher", userImage: null, ...overrides };
}
export function account(overrides: Partial<Account> = {}): Account {
  return { id: 25n, email: "existing@example.test", role: "admin", emailVerified: true, passwordHash: "unchanged-account-hash", ...overrides };
}
export function form(values: Record<string, string> = {}): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
export const initialState: validation.TeacherFormState = { success: false, message: "" };

export function userVerificationTokens(): Invitation[] {
  return (["passwordReset", "emailVerification", "studentUpdate"] as const).map((purpose, index) => ({
    id: BigInt(30 + index), jti: randomUUID(), purpose, userId: account().id, employeeId: null,
    createdAt: new Date(), expiresAt: new Date(Date.now() + 3_600_000), consumedAt: null,
  }));
}

function insensitiveMatch(value: string, equality: string) {
  let pattern = "^";
  for (let index = 0; index < equality.length; index++) {
    const character = equality[index];
    if (character === "\\" && index + 1 < equality.length) pattern += equality[++index].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    else if (character === "%") pattern += ".*";
    else if (character === "_") pattern += ".";
    else pattern += character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(pattern + "$", "i").test(value);
}
function invitationMatches(row: Invitation, where: Where = {}) {
  return (!where.jti || row.jti === where.jti) && (where.employeeId === undefined || row.employeeId === where.employeeId) &&
    (where.userId === undefined || row.userId === where.userId) && (!where.purpose || row.purpose === where.purpose) &&
    (where.consumedAt !== null || row.consumedAt === null) && (!where.createdAt || row.createdAt > where.createdAt.gt) &&
    (!where.expiresAt || row.expiresAt > where.expiresAt.gt && (!where.expiresAt.equals || +row.expiresAt === +where.expiresAt.equals));
}

export function serviceHarness(options: {
  denied?: boolean; employees?: Employee[]; users?: Account[]; tokens?: Invitation[]; teachers?: Teacher[];
  deliveryFailure?: boolean; writeFailure?: "invitation" | "user" | "teacher"; consumeMiss?: boolean; lockMiss?: boolean;
  lockFailure?: boolean; employeeAfterLock?: Partial<Employee>; superAdminEmail?: string; unscopedTokenRead?: boolean;
} = {}) {
  let database: Database = structuredClone({ employees: options.employees ?? [employee()], users: options.users ?? [], tokens: options.tokens ?? [], teachers: options.teachers ?? [] });
  const calls: Call[] = [];
  const events: string[] = [];
  const passwords: string[] = [];
  const delivered: Array<{ to: string; fullName: string; invitationUrl: string }> = [];
  const logs: unknown[][] = [];
  const revalidated: string[] = [];
  const isolations: unknown[] = [];
  let guards = 0;
  function delegate(data: Database) {
    function readEmployee(row: Employee, query: Query) {
      const teacher = data.teachers.find((teacher) => teacher.employeeId === row.id);
      const linked = teacher && data.users.find((user) => user.id === teacher.userId);
      const relation = (query.select as { verificationTokens?: { where?: Where; take?: number } } | undefined)?.verificationTokens;
      return { ...structuredClone(row), teacher: teacher && linked ? { userId: teacher.userId, user: { email: linked.email, role: linked.role, emailVerified: linked.emailVerified } } : null,
        verificationTokens: data.tokens.filter((item) => item.employeeId === row.id && invitationMatches(item, relation?.where))
          .sort((a, b) => +b.createdAt - +a.createdAt || Number(b.id - a.id)).slice(0, relation?.take ?? 1).map((item) => structuredClone(item)) };
    }
    const matchesAccount = (row: Account, where: Where = {}): boolean => (!where.role || row.role === where.role) && (where.id === undefined || row.id === where.id) &&
      (!where.email || insensitiveMatch(row.email, where.email.equals)) && (!where.OR || where.OR.some((item) => matchesAccount(row, item)));
    const matchesEmployee = (row: Employee, where: Where = {}): boolean => {
      const teacher = data.teachers.find((item) => item.employeeId === row.id);
      const linkedUser = teacher && data.users.find((item) => item.id === teacher.userId);
      return (!where.role || row.role === where.role) && (where.id === undefined || row.id === where.id) &&
        (!where.emailAddress || insensitiveMatch(row.emailAddress, where.emailAddress.equals)) &&
        (!where.teacher || linkedUser?.role === where.teacher.is.user.role) &&
        (!where.NOT || where.NOT.every((clause) => !matchesEmployee(row, clause)));
    };
    return {
      employee: {
        async findMany(query: Query) { calls.push({ method: "employee.findMany", query }); return data.employees.filter((row) => matchesEmployee(row, query.where)).slice(0, query.take ?? data.employees.length).map((row) => readEmployee(row, query)); },
        async findFirst(query: Query) { calls.push({ method: "employee.findFirst", query }); const found = data.employees.find((row) => matchesEmployee(row, query.where)); return found ? readEmployee(found, query) : null; },
      },
      user: {
        async findMany(query: Query) { calls.push({ method: "user.findMany", query }); return data.users.filter((row) => matchesAccount(row, query.where)).map((row) => ({ email: row.email })); },
        async findFirst(query: Query) { calls.push({ method: "user.findFirst", query }); return data.users.find((row) => matchesAccount(row, query.where)) ?? null; },
        async create(query: Query) {
          calls.push({ method: "user.create", query }); events.push("user.create");
          if (options.writeFailure === "user") throw new Error("Offline user write failure");
          const values = query.data!;
          if (data.users.some((row) => row.email === values.email)) throw new Error("Unique email conflict");
          const created: Account = { id: 100n, email: String(values.email), role: values.role as UserRole, emailVerified: Boolean(values.emailVerified), passwordHash: String(values.passwordHash) };
          data.users.push(created); return { id: created.id };
        },
      },
      verificationToken: {
        async findFirst(query: Query) { calls.push({ method: "verificationToken.findFirst", query }); return data.tokens.find((row) => invitationMatches(row, query.where)) ?? null; },
        async findUnique(query: Query) {
          calls.push({ method: "verificationToken.findUnique", query });
          return data.tokens.find((row) => options.unscopedTokenRead ? row.jti === query.where?.jti : invitationMatches(row, query.where)) ?? null;
        },
        async updateMany(query: Query) {
          calls.push({ method: "verificationToken.updateMany", query });
          if (options.consumeMiss && query.where?.jti) return { count: 0 };
          const rows = data.tokens.filter((row) => invitationMatches(row, query.where));
          for (const row of rows) row.consumedAt = query.data?.consumedAt as Date;
          return { count: rows.length };
        },
        async create(query: Query) {
          calls.push({ method: "verificationToken.create", query }); events.push("token.create");
          if (options.writeFailure === "invitation") throw new Error("Offline invitation write failure");
          const values = query.data!;
          assert.equal(values.purpose, "teacherSetup");
          assert.equal(values.userId, null);
          assert.equal(typeof values.employeeId, "bigint");
          const created: Invitation = { id: BigInt(data.tokens.length + 1), jti: String(values.jti), purpose: values.purpose as TokenPurpose, userId: values.userId as null, employeeId: values.employeeId as bigint, expiresAt: values.expiresAt as Date, consumedAt: null, createdAt: new Date() };
          data.tokens.push(created); return created;
        },
        async deleteMany(query: Query) { calls.push({ method: "verificationToken.deleteMany", query }); const rows = data.tokens.filter((row) => !invitationMatches(row, query.where)); const count = data.tokens.length - rows.length; data.tokens = rows; return { count }; },
      },
      teacher: {
        async create(query: Query) {
          calls.push({ method: "teacher.create", query }); events.push("teacher.create");
          if (options.writeFailure === "teacher") throw new Error("Offline teacher link failure");
          const created: Teacher = { employeeId: query.data!.employeeId as bigint, userId: query.data!.userId as bigint };
          if (data.teachers.some((row) => row.employeeId === created.employeeId || row.userId === created.userId)) throw new Error("Unique teacher link conflict");
          data.teachers.push(created); return created;
        },
      },
      async $queryRaw(query: { strings: readonly string[]; values: unknown[] }) {
        events.push("employee.lock");
        assert.match(query.strings.join("?"), /SELECT "id" FROM "employees" WHERE "id" = \? FOR UPDATE/);
        assert.equal(typeof query.values[0], "bigint");
        if (options.lockFailure) throw new Error("Private employee lock failure");
        const employee = data.employees.find((row) => row.id === query.values[0]);
        if (employee && options.employeeAfterLock) Object.assign(employee, options.employeeAfterLock);
        return options.lockMiss ? [] : data.employees.filter((row) => row.id === query.values[0]).map((row) => ({ id: row.id }));
      },
    };
  }
  let transactionQueue = Promise.resolve();
  const prisma = new Proxy({}, { get(_target, name) {
    if (name === "$transaction") return async (callback: (transaction: ReturnType<typeof delegate>) => Promise<unknown>, settings: { isolationLevel: unknown }) => {
      isolations.push(settings.isolationLevel);
      // Serialize mocked transactions to model the shared Employee row lock.
      const previous = transactionQueue;
      let release!: () => void;
      transactionQueue = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      try {
        const transactionData = structuredClone(database);
        const result = await callback(delegate(transactionData));
        database = transactionData;
        return result;
      } finally { release(); }
    };
    return delegate(database)[name as keyof ReturnType<typeof delegate>];
  } });
  const modules: Record<string, unknown> = {
    "@/lib/auth": { requireSuperAdmin: async () => {
      guards++; events.push("guard"); if (options.denied) throw new Error("Denied");
      return { id: "1", email: options.superAdminEmail ?? "root_user@example.test", role: "superAdmin", emailVerified: true, sessionVersion: 0 };
    } },
    "@/lib/auth/credentials": { hashPassword: async (password: string) => { passwords.push(password); events.push("hash"); return "offline-hash:" + password; } },
    "@/lib/generated/prisma/client": { Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" }, sql: (strings: readonly string[], ...values: unknown[]) => ({ strings, values }) } },
    "@/lib/generated/prisma/enums": enums, "@/lib/prisma": { prisma }, "@/lib/utils": utils,
    "@/lib/employees/names": employeeNames,
    "next/cache": { revalidatePath: (path: string) => revalidated.push(path) },
    "@/lib/auth/tokens": tokens, "./records": records, "./validation": validation,
    "@/lib/auth/email": { sendTeacherInvitationEmail: async (message: { to: string; fullName: string; invitationUrl: string }) => { events.push("send"); if (options.deliveryFailure) throw new Error("Offline delivery failure"); delivered.push(message); } },
  };
  function load(path: string) {
    const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText;
    const loaded = { exports: {} };
    runInNewContext(code, { module: loaded, exports: loaded.exports, Date, BigInt, console: { error: (...values: unknown[]) => logs.push(values) }, require: (name: string) => { assert.ok(name in modules, `Unexpected teacher dependency: ${name}`); return modules[name]; } });
    return loaded.exports;
  }
  return { admin: load("../lib/teachers/admin.ts") as typeof admin, activation: load("../lib/teachers/activation.ts") as typeof activation,
    get database() { return database; }, get guards() { return guards; }, calls, events, passwords, delivered, revalidated, isolations, logs };
}
