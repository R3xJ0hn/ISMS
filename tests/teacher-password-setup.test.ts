import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as enums from "../lib/generated/prisma/enums";
import * as utils from "../lib/utils";
import * as tokens from "../lib/auth/tokens";
import * as records from "../lib/teachers/records";
import type * as service from "../lib/teachers/password-setup";
import { account, employee, setupEnvironment, type Account, type Employee, type Invitation, type Teacher } from "./teacher-services-harness";

type Where = Record<string, unknown>;
type Query = { where?: Where; select?: Record<string, unknown>; take?: number; data?: Record<string, unknown> };
type Database = { employees: Employee[]; users: Account[]; tokens: Invitation[]; teachers: Teacher[] };
type Options = Partial<Database> & {
  deliveryFailure?: boolean; cleanupFailure?: boolean; createFailure?: boolean; lockMiss?: boolean; lockFailure?: boolean;
  employeeAfterLock?: Partial<Employee>; employeesAfterLock?: Employee[]; usersAfterLock?: Account[]; teachersAfterLock?: Teacher[];
  consumedDuringDelivery?: boolean;
};

function emailMatches(address: string, filter: { equals: string; mode: string }) {
  assert.equal(filter.mode, "insensitive");
  let pattern = "";
  for (let index = 0; index < filter.equals.length; index++) {
    let character = filter.equals[index];
    if (character === "\\") character = filter.equals[++index];
    else if (character === "%") { pattern += ".*"; continue; }
    else if (character === "_") { pattern += "."; continue; }
    pattern += character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + pattern + "$", "i").test(address);
}

function matches(row: Record<string, unknown>, where: Where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object" && !(value instanceof Date)) {
      const filter = value as { equals?: string; mode?: string; gt?: Date };
      if (filter.mode) return emailMatches(String(row[key]), filter as { equals: string; mode: string });
      if (filter.gt) return row[key] instanceof Date && row[key] > filter.gt;
    }
    return row[key] === value;
  });
}

function harness(options: Options = {}) {
  let database: Database = structuredClone({
    employees: options.employees ?? [employee()], users: options.users ?? [], tokens: options.tokens ?? [], teachers: options.teachers ?? [],
  });
  const calls: Array<{ method: string; query: Query }> = [];
  const events: string[] = [];
  const emails: Array<{ to: string; resetUrl: string }> = [];
  function record(method: string, query: Query) { calls.push({ method, query: structuredClone(query) }); events.push(method); }
  function selected(row: Record<string, unknown>, query: Query) {
    assert.ok(query.select);
    return Object.fromEntries(Object.entries(query.select).filter(([, enabled]) => enabled).map(([key]) => [key, row[key]]));
  }
  function delegates(data: Database) {
    return {
      employee: {
        async findMany(query: Query) {
          record("employee.findMany", query);
          return data.employees.filter((row) => matches(row, query.where)).slice(0, query.take).map((row) => selected(row, query));
        },
        async findUnique(query: Query) {
          record("employee.findUnique", query);
          const row = data.employees.find((item) => matches(item, query.where));
          if (!row) return null;
          const teacher = data.teachers.find((item) => item.employeeId === row.id);
          return selected({ ...row, teacher: teacher ? { userId: teacher.userId } : null }, query);
        },
      },
      user: {
        async findFirst(query: Query) {
          record("user.findFirst", query);
          const row = data.users.find((item) => matches(item, query.where));
          return row ? selected(row, query) : null;
        },
      },
      verificationToken: {
        async findFirst(query: Query) {
          record("token.findFirst", query);
          const row = data.tokens.find((item) => matches(item, query.where));
          return row ? selected(row, query) : null;
        },
        async updateMany(query: Query) {
          record("token.updateMany", query);
          const rows = data.tokens.filter((row) => matches(row, query.where));
          for (const row of rows) row.consumedAt = query.data!.consumedAt as Date;
          return { count: rows.length };
        },
        async create(query: Query) {
          record("token.create", query);
          if (options.createFailure) throw new Error("Private token creation details");
          const created = { ...query.data, id: BigInt(data.tokens.length + 1), createdAt: new Date(), consumedAt: null } as Invitation;
          data.tokens.push(created);
          return structuredClone(created);
        },
        async deleteMany(query: Query) {
          record("token.deleteMany", query);
          if (options.cleanupFailure) throw new Error("Private cleanup details");
          const before = data.tokens.length;
          data.tokens = data.tokens.filter((row) => !matches(row, query.where));
          return { count: before - data.tokens.length };
        },
      },
      async $queryRaw(query: { strings: readonly string[]; values: unknown[] }) {
        events.push("employee.lock");
        assert.equal(query.strings.join("?"), 'SELECT "id" FROM "employees" WHERE "id" = ? FOR UPDATE');
        assert.deepEqual(query.values, [employee().id]);
        if (options.lockFailure) throw new Error("Private database details");
        const row = data.employees.find((item) => item.id === query.values[0]);
        if (row && options.employeeAfterLock) Object.assign(row, options.employeeAfterLock);
        if (options.employeesAfterLock) data.employees = structuredClone(options.employeesAfterLock);
        if (options.usersAfterLock) data.users = structuredClone(options.usersAfterLock);
        if (options.teachersAfterLock) data.teachers = structuredClone(options.teachersAfterLock);
        return options.lockMiss || !row ? [] : [{ id: row.id }];
      },
    };
  }
  let queue = Promise.resolve();
  const prisma = new Proxy({}, { get(_target, name) {
    if (name === "$transaction") return async (callback: (tx: ReturnType<typeof delegates>) => Promise<unknown>, settings: { isolationLevel: string }) => {
      assert.equal(settings.isolationLevel, "Serializable");
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      events.push("transaction");
      const transactionData = structuredClone(database);
      try {
        const result = await callback(delegates(transactionData));
        database = transactionData;
        events.push("commit");
        return result;
      } catch (error) { events.push("rollback"); throw error; }
      finally { release(); }
    };
    return delegates(database)[name as keyof ReturnType<typeof delegates>];
  } });
  const modules: Record<string, unknown> = {
    "@/lib/generated/prisma/client": { Prisma: {
      TransactionIsolationLevel: { Serializable: "Serializable" },
      sql: (strings: readonly string[], ...values: unknown[]) => ({ strings, values }),
    } },
    "@/lib/generated/prisma/enums": enums, "@/lib/prisma": { prisma }, "@/lib/utils": utils,
    "@/lib/auth/email": { sendPasswordResetEmail: async (message: { to: string; resetUrl: string }) => {
      events.push("email"); emails.push(structuredClone(message));
      if (options.consumedDuringDelivery) database.tokens.at(-1)!.consumedAt = new Date();
      if (options.deliveryFailure) throw new Error("Private provider details and " + message.resetUrl);
    } },
    "@/lib/auth/tokens": tokens, "./records": records,
  };
  const compiled = ts.transpileModule(readFileSync(new URL("../lib/teachers/password-setup.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  const loaded = { exports: {} };
  runInNewContext(compiled, { module: loaded, exports: loaded.exports, Date, require: (name: string) => {
    assert.ok(name in modules, "Unexpected teacher password setup dependency " + name);
    return modules[name];
  } });
  return { service: loaded.exports as typeof service, get database() { return database; }, calls, events, emails };
}

function pending(overrides: Partial<Invitation> = {}): Invitation {
  return { id: 1n, jti: randomUUID(), employeeId: employee().id, userId: null, purpose: "teacherSetup",
    createdAt: new Date(Date.now() - 120_000), expiresAt: new Date(Date.now() + 3_600_000), consumedAt: null, ...overrides };
}

test("an eligible saved teacher gets a 30-minute reset-page setup email without creating an account", async (t) => {
  setupEnvironment(t);
  const subject = harness({ employees: [employee({ emailAddress: "Maria@Example.Test" })] });
  await subject.service.requestTeacherPasswordSetup(" MARIA@EXAMPLE.TEST ");
  assert.equal(subject.emails.length, 1);
  const email = subject.emails[0];
  assert.equal(email.to, "maria@example.test");
  const url = new URL(email.resetUrl);
  assert.equal(url.origin, "https://portal.example.test");
  assert.equal(url.pathname, "/reset-password");
  const claims = await tokens.verifyTeacherInvitationToken(url.searchParams.get("token")!);
  assert.ok(claims);
  assert.equal(claims.employeeRecordId, employee().id.toString());
  assert.equal(claims.email, email.to);
  assert.ok(claims.expiresAt.getTime() - Date.now() <= 1800_000);
  assert.ok(claims.expiresAt.getTime() - Date.now() > 1795_000);
  assert.deepEqual(subject.database.users, []);
  assert.deepEqual(subject.database.teachers, []);
  assert.equal(subject.database.tokens.length, 1);
  assert.equal(subject.database.tokens[0].purpose, "teacherSetup");
  assert.equal(subject.database.tokens[0].userId, null);
  assert.equal(subject.database.tokens[0].employeeId, employee().id);
  assert.equal(subject.database.tokens[0].jti, claims.jti);
  assert.ok(subject.events.indexOf("employee.lock") < subject.events.indexOf("employee.findUnique"));
  assert.ok(subject.events.indexOf("commit") < subject.events.indexOf("email"));
  const read = subject.calls.find((call) => call.method === "employee.findUnique")!;
  assert.deepEqual(Object.keys(read.query.select!).sort(), ["emailAddress", "id", "role", "status", "teacher"]);
  const first = subject.calls.find((call) => call.method === "employee.findMany")!;
  assert.deepEqual(first.query.select, { id: true });
  assert.equal(first.query.take, 2);
});

test("teacher setup refuses missing, resigned, non-teaching, linked, and ambiguous employee profiles", async (t) => {
  setupEnvironment(t);
  const variants: Options[] = [
    { employees: [] },
    ...(["admin", "registrar", "nonTeaching"] as const).map((role) => ({ employees: [employee({ role })] })),
    { employees: [employee({ status: "Resigned" })] },
    { teachers: [{ employeeId: employee().id, userId: 25n }] },
    { employees: [employee(), employee({ id: 2n, emailAddress: "MARIA@EXAMPLE.TEST", role: "nonTeaching" })] },
  ];
  for (const options of variants) {
    const subject = harness(options);
    await subject.service.requestTeacherPasswordSetup(employee().emailAddress);
    assert.equal(subject.emails.length, 0);
    assert.equal(subject.database.tokens.length, 0);
    assert.equal(subject.calls.some((call) => call.method === "token.create"), false);
  }
});

test("regular, probationary, and contractual teachers can request their first password", async (t) => {
  setupEnvironment(t);
  for (const status of ["Regular", "Probationary", "Contractual"] as const) {
    const subject = harness({ employees: [employee({ status })] });
    await subject.service.requestTeacherPasswordSetup(employee().emailAddress);
    assert.equal(subject.emails.length, 1);
  }
});

test("an existing email in any portal role prevents teacher account setup", async (t) => {
  setupEnvironment(t);
  for (const role of Object.values(enums.UserRole)) {
    const subject = harness({ users: [account({ email: "MARIA@EXAMPLE.TEST", role })] });
    await subject.service.requestTeacherPasswordSetup(employee().emailAddress);
    assert.equal(subject.emails.length, 0);
    assert.equal(subject.database.tokens.length, 0);
  }
});

test("percent and underscore characters match literal employee and user email addresses", async (t) => {
  setupEnvironment(t);
  const exact = "ma_ria%school@example.test";
  const profile = employee({ emailAddress: exact });
  const subject = harness({ employees: [profile, employee({ id: 2n, emailAddress: "maxriaxxschool@example.test" })],
    users: [account({ email: "maxriaxxschool@example.test" })] });
  await subject.service.requestTeacherPasswordSetup(exact);
  assert.equal(subject.emails.length, 1);
  assert.equal(subject.emails[0].to, exact);
  const conflict = harness({ employees: [profile], users: [account({ email: exact.toUpperCase() })] });
  await conflict.service.requestTeacherPasswordSetup(exact);
  assert.equal(conflict.emails.length, 0);
});

test("employee eligibility and email conflicts are rechecked after the employee lock", async (t) => {
  setupEnvironment(t);
  const variants: Options[] = [
    { employeeAfterLock: { emailAddress: "changed@example.test" } },
    { employeeAfterLock: { role: "nonTeaching" } },
    { employeeAfterLock: { status: "Resigned" } },
    { employeesAfterLock: [] },
    { employeesAfterLock: [employee(), employee({ id: 2n, emailAddress: "MARIA@EXAMPLE.TEST" })] },
    { usersAfterLock: [account({ email: "MARIA@EXAMPLE.TEST" })] },
    { teachersAfterLock: [{ employeeId: employee().id, userId: 25n }] },
    { lockMiss: true }, { lockFailure: true },
  ];
  for (const options of variants) {
    const subject = harness(options);
    await subject.service.requestTeacherPasswordSetup(employee().emailAddress);
    assert.equal(subject.emails.length, 0);
    assert.equal(subject.calls.some((call) => call.method === "token.create"), false);
  }
});

test("the 60-second cooldown includes admin invitations and consumed setup tokens", async (t) => {
  setupEnvironment(t);
  for (const consumedAt of [null, new Date()]) {
    const recent = pending({ createdAt: new Date(), consumedAt });
    const subject = harness({ tokens: [recent] });
    await subject.service.requestTeacherPasswordSetup(employee().emailAddress);
    assert.equal(subject.emails.length, 0);
    assert.equal(subject.database.tokens.length, 1);
    assert.equal(subject.database.tokens[0].jti, recent.jti);
  }
});

test("only previous unused setup tokens for the same employee are replaced", async (t) => {
  setupEnvironment(t);
  const prior = pending();
  const retained = [
    pending({ id: 2n, employeeId: 2n, createdAt: new Date() }),
    pending({ id: 3n, userId: 25n, employeeId: null, purpose: "passwordReset", createdAt: new Date() }),
    pending({ id: 4n, consumedAt: new Date(Date.now() - 1000) }),
  ];
  const subject = harness({ tokens: [prior, ...retained] });
  await subject.service.requestTeacherPasswordSetup(employee().emailAddress);
  assert.equal(subject.emails.length, 1);
  assert.ok(subject.database.tokens[0].consumedAt);
  assert.deepEqual(subject.database.tokens.slice(1, 4), retained);
  assert.equal(subject.database.tokens.at(-1)!.consumedAt, null);
});

test("simultaneous requests share the employee lock and send only one setup email", async (t) => {
  setupEnvironment(t);
  const subject = harness();
  await Promise.all([subject.service.requestTeacherPasswordSetup(employee().emailAddress), subject.service.requestTeacherPasswordSetup(employee().emailAddress)]);
  assert.equal(subject.emails.length, 1);
  assert.equal(subject.database.tokens.length, 1);
  assert.equal(subject.database.users.length, 0);
});

test("failed delivery removes only the newly issued unused token", async (t) => {
  setupEnvironment(t);
  const prior = pending();
  const unrelated = pending({ id: 2n, employeeId: 2n });
  const subject = harness({ tokens: [prior, unrelated], deliveryFailure: true });
  await subject.service.requestTeacherPasswordSetup(employee().emailAddress);
  assert.equal(subject.database.tokens.length, 2);
  assert.ok(subject.database.tokens[0].consumedAt);
  assert.deepEqual(subject.database.tokens[1], unrelated);
  const cleanup = subject.calls.find((call) => call.method === "token.deleteMany")!;
  assert.equal(cleanup.query.where!.employeeId, employee().id);
  assert.equal(cleanup.query.where!.userId, null);
  assert.equal(cleanup.query.where!.purpose, "teacherSetup");
  assert.equal(cleanup.query.where!.consumedAt, null);
  assert.notEqual(cleanup.query.where!.jti, prior.jti);
  const used = harness({ deliveryFailure: true, consumedDuringDelivery: true });
  await used.service.requestTeacherPasswordSetup(employee().emailAddress);
  assert.equal(used.database.tokens.length, 1);
  assert.ok(used.database.tokens[0].consumedAt);
  const unavailableCleanup = harness({ deliveryFailure: true, cleanupFailure: true });
  await assert.doesNotReject(unavailableCleanup.service.requestTeacherPasswordSetup(employee().emailAddress));
});

test("token write and URL configuration failures roll back replacement and send no email", async (t) => {
  setupEnvironment(t);
  const prior = pending();
  const subject = harness({ tokens: [prior], createFailure: true });
  await subject.service.requestTeacherPasswordSetup(employee().emailAddress);
  assert.deepEqual(subject.database.tokens, [prior]);
  assert.equal(subject.emails.length, 0);
  assert.ok(subject.events.includes("rollback"));
  process.env.APP_URL = "http://portal.example.test";
  const badUrl = harness({ tokens: [prior] });
  await badUrl.service.requestTeacherPasswordSetup(employee().emailAddress);
  assert.deepEqual(badUrl.database.tokens, [prior]);
  assert.equal(badUrl.emails.length, 0);
});

test("invalid email input is rejected without consulting the database", async () => {
  for (const email of ["", "bad-email", "person\u0000@example.test"]) {
    const subject = harness();
    await subject.service.requestTeacherPasswordSetup(email);
    assert.deepEqual(subject.events, []);
  }
});
