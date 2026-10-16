import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as utils from "../lib/utils";
import * as validation from "../lib/validation";
import * as studentFields from "../lib/admission/student-fields";
import * as schoolIdentity from "../lib/admission/last-school-identity";
import { studentUpdateSelect } from "../lib/admission/records";
import { verifyPassword } from "../lib/auth/credentials";
import * as enums from "../lib/generated/prisma/enums";
import { Prisma } from "../lib/generated/prisma/client";
import * as academicLevels from "../lib/academic-levels";
import type * as updateServices from "../lib/admission/student-update";
import type * as passwordServices from "../lib/admission/student-password-reset";

const studentId = 9007199254740993n;
const jti = "11111111-1111-4111-8111-111111111111";
const secret = "student-verification-test-secret";
const password = { password: "StudentPass1!", confirmPassword: "StudentPass1!" };
type TokenRow = {
  jti: string; purpose: string; userId: bigint | null; employeeId: bigint | null;
  expiresAt: Date; consumedAt: Date | null;
};
type Account = { id: bigint; email: string; role: string; emailVerified: boolean; sessionVersion: number; passwordHash: string };
type StudentApplication = {
  id: bigint; branchId: bigint; programId: bigint; academicLevel: enums.AcademicLevel;
  programType: enums.ProgramType; applicationStatus: enums.ApplicationStatus; submittedAt: Date | null;
  lastSchoolId: bigint | null; lastSchool: null;
  branch: { title: string }; program: { label: string };
};
type Query = { where?: Record<string, unknown>; data?: Record<string, unknown>; select?: Record<string, unknown> };
type Call = { method: string; query: Query };

function compile(path: string) {
  return ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
}
const updateCode = compile("../lib/admission/student-update.ts");
const passwordCode = compile("../lib/admission/student-password-reset.ts");
const schoolStoreCode = compile("../lib/admission/last-school-store.ts");

function signedToken(claims: Record<string, unknown> = {}) {
  const encoded = Buffer.from(JSON.stringify({
    scope: "student-update", studentId: studentId.toString(), jti, exp: Date.now() + 3600000, ...claims,
  })).toString("base64url");
  return `${encoded}.${crypto.createHmac("sha256", secret).update(encoded).digest("base64url")}`;
}

function profileInput(): studentFields.UpdateStudentRecordInput {
  return {
    ...Object.fromEntries(studentFields.studentUpdateFields.map((field) => [field, ""])),
    firstName: "Maria", lastName: "Santos", birthDate: "2008-02-29", email: "student@example.com",
    addressBarangay: "Central", addressCity: "Manila", addressProvince: "Metro Manila",
    guardianFirstName: "Ana", guardianLastName: "Santos", guardianRelationship: "Mother",
    guardianContactNumber: "09171234567", lastSchoolName: "Central School", lastSchoolType: "Public",
    lastSchoolBarangay: "West", lastSchoolCity: "Manila", lastSchoolProvince: "Metro Manila",
    lastSchoolYear: "2025-2026", lastSchoolYearLevel: "Grade 12",
  } as studentFields.UpdateStudentRecordInput;
}

function harness(options: {
  token?: Partial<TokenRow>; studentEmail?: string; studentImage?: string | null;
  account?: Omit<Account, "sessionVersion" | "passwordHash"> & Partial<Pick<Account, "sessionVersion" | "passwordHash">>;
  consumeConflict?: boolean; userWriteError?: boolean; noAccount?: boolean; allowProfileEdits?: boolean;
  application?: StudentApplication;
  noApplication?: boolean;
  userUpdateMiss?: boolean;
  profileUpdateMiss?: boolean;
  reusableSchoolId?: bigint;
} = {}) {
  let tokenRow: TokenRow = {
    jti, purpose: "studentUpdate", userId: 7n, employeeId: null,
    consumedAt: null, expiresAt: new Date(Date.now() + 3600000), ...options.token,
  };
  const student = {
    userImage: options.studentImage ?? null,
    id: studentId, firstName: "Maria", middleName: null, lastName: "Santos", suffix: null,
    email: options.studentEmail ?? "student@example.com", addressId: null, guardians: [],
    applications: options.noApplication ? [] : [structuredClone(options.application ?? {
      id: 3n, branchId: 10n, programId: 11n, academicLevel: "FirstYear", programType: "Bachelor",
      applicationStatus: "reviewing", submittedAt: new Date("2026-01-01T00:00:00.000Z"),
      lastSchoolId: null, lastSchool: null,
      branch: { title: "Main Campus" }, program: { label: "Information Technology" },
    } satisfies StudentApplication)],
  };
  const accounts: Account[] = options.noAccount ? [] : [structuredClone({ sessionVersion: 0, passwordHash: "original-password-hash", ...(options.account ?? {
    id: 7n, email: options.studentEmail ?? "student@example.com", role: "student", emailVerified: false,
  }) })];
  const calls: Call[] = [];
  const events: string[] = [];
  const hashedPasswords: string[] = [];
  const logs: unknown[][] = [];
  function record(method: string, query: Query) { calls.push({ method, query: structuredClone(query) }); }
  function matchesToken(where: Record<string, unknown> = {}) {
    return Object.entries(where).every(([key, value]) => key === "expiresAt"
      ? tokenRow.expiresAt > (value as { gt: Date }).gt
      : tokenRow[key as keyof TokenRow] === value);
  }
  const verificationToken = {
    async create(query: Query) { record("token.create", query); return { id: 1n }; },
    async findFirst(query: Query) {
      record("token.findFirst", query);
      return matchesToken(query.where) ? structuredClone(tokenRow) : null;
    },
    async updateMany(query: Query) {
      record("token.updateMany", query);
      if (!matchesToken(query.where) || (options.consumeConflict && query.data?.consumedAt !== null)) return { count: 0 };
      Object.assign(tokenRow, query.data);
      events.push(query.data?.consumedAt === null ? "lock" : "consume");
      return { count: 1 };
    },
  };
  const user = {
    async findUnique(query: Query) {
      record("user.findUnique", query);
      return structuredClone(accounts.find((account) => account.id === query.where?.id) ?? null);
    },
    async findFirst(query: Query) {
      record("user.findFirst", query);
      const email = (query.where?.email as { equals: string }).equals;
      return structuredClone(accounts.find((account) => utils.normalizeEmail(account.email) === email) ?? null);
    },
    async create(query: Query) {
      record("user.create", query);
      if (options.userWriteError) throw new Error("User write failed");
      events.push("save");
      const account = { id: 7n, sessionVersion: 0, ...query.data } as Account;
      accounts.push(account);
      return structuredClone(account);
    },
    async updateMany(query: Query) {
      record("user.updateMany", query);
      if (query.data?.passwordHash && options.userWriteError) throw new Error("Private account details and passwordHash should not be logged");
      if (query.data?.passwordHash && options.userUpdateMiss) return { count: 0 };
      if (query.data?.email && options.profileUpdateMiss) return { count: 0 };
      const account = accounts.find((value) => Object.entries(query.where ?? {}).every(([field, expected]) => value[field as keyof Account] === expected));
      if (!account) return { count: 0 };
      if (accounts.some((value) => value.id !== account.id && value.email === query.data?.email)) throw new Error("Email conflict");
      const { sessionVersion, ...values } = query.data ?? {};
      Object.assign(account, values);
      if (sessionVersion !== undefined) account.sessionVersion += Number((sessionVersion as { increment: number }).increment);
      if (query.data?.passwordHash) events.push("save");
      return { count: 1 };
    },
  };
  const delegates = {
    verificationToken, user,
    student: {
      findUnique: async (query: Query) => { record("student.findUnique", query); return query.where?.id === studentId ? structuredClone(student) : null; },
      update: async (query: Query) => { record("student.update", query); Object.assign(student, query.data); return structuredClone(student); },
    },
    admissionApplication: {
      update: async (query: Query) => {
        record("application.update", query);
        const application = student.applications.find((value) => value.id === query.where?.id);
        assert.ok(application, "Updating an admission record must target the student's saved application");
        Object.assign(application, query.data);
        return structuredClone(application);
      },
    },
    ...Object.fromEntries(["address", "guardian", "studentGuardian", "lastSchool"].map((delegate) => [delegate, {
      create: async (query: Query) => { record(delegate + ".create", query); return { id: 1n }; },
      findUnique: async () => null,
    }])),
    $queryRaw: async (query: Prisma.Sql) => {
      record("lastSchool.lookup", { where: { normalizedValues: query.values } });
      return options.reusableSchoolId ? [{ id: options.reusableSchoolId }] : [];
    },
  };
  const database = {
    ...delegates,
    async $transaction(callback: (tx: typeof delegates) => Promise<unknown>) {
      const before = structuredClone(tokenRow);
      const beforeAccounts = structuredClone(accounts);
      const beforeStudent = structuredClone(student);
      try { return await callback(delegates); }
      catch (error) { tokenRow = before; Object.assign(student, beforeStudent); accounts.splice(0, accounts.length, ...beforeAccounts); events.push("rollback"); throw error; }
    },
  };
  const modules: Record<string, unknown> = {
    "@/lib/prisma": { prisma: database },
    "@/lib/utils": utils,
    "@/lib/academic-levels": academicLevels,
    "@/lib/validation": validation,
    "@/lib/generated/prisma/enums": enums,
    "@/lib/generated/prisma/client": { Prisma },
    "@/lib/auth": { hashPassword: async (value: string) => { hashedPasswords.push(value); return "bcrypt-test-hash"; } },
    "@/lib/admission/records": { studentUpdateSelect, studentProfileFromRecord: () => ({}) },
    "./student-fields": { ...studentFields, ...(options.allowProfileEdits ? {} : Object.fromEntries([
      "addressDataFromProfile", "guardianDataFromProfile", "lastSchoolDataFromProfile", "studentDataFromProfile",
    ].map((name) => [name, () => assert.fail("Revoked token reached a profile write")]))) },
    "./last-school-identity": schoolIdentity,
    "node:crypto": crypto,
  };
  function load(code: string) {
    const loaded = { exports: {} };
    runInNewContext(code, {
      module: loaded, exports: loaded.exports, Buffer, TextEncoder, URL,
      process: { env: { STUDENT_UPDATE_LINK_SECRET: secret, APP_URL: "https://example.test", NODE_ENV: "test" } },
      console: { error: (...values: unknown[]) => logs.push(values) },
      require: (name: string) => {
        assert.ok(name in modules, `Unexpected student token dependency: ${name}`);
        return modules[name];
      },
    });
    return loaded.exports;
  }
  modules["./last-school-store"] = load(schoolStoreCode);
  const updates = load(updateCode) as typeof updateServices;
  modules["./student-update"] = updates;
  const passwords = load(passwordCode) as typeof passwordServices;
  return { updates, passwords, calls, events, accounts, student, hashedPasswords, logs, tokenRow: () => tokenRow };
}

function userWrite(calls: Call[]) {
  return calls.find((call) => call.method === "user.create" || call.method === "user.updateMany" && call.query.data?.passwordHash)?.query;
}

test("student links use account IDs and signed email snapshots without email or student columns", async () => {
  const service = harness({ studentEmail: " Student@Example.COM " });
  const url = await service.updates.createStudentUpdateUrl(studentId.toString(), "student@example.com");
  assert.equal(new URL(url).pathname, "/admission/update");
  const payload = service.updates.verifyStudentUpdateToken(new URL(url).searchParams.get("token")!);
  assert.equal(payload?.studentId, studentId.toString());
  const data = service.calls.find((call) => call.method === "token.create")?.query.data;
  assert.equal(data?.purpose, "studentUpdate");
  assert.equal(payload?.email, "student@example.com");
  assert.equal(payload?.userId, "7");
  assert.equal(payload?.sessionVersion, 0);
  assert.equal(data?.userId, 7n);
  assert.equal("email" in data!, false);
  assert.equal("studentId" in data!, false);
});

test("legacy tokens still permit password setup without granting unproven email verification", async () => {
  const service = harness();
  const token = signedToken();
  assert.equal((await service.updates.getStudentUpdateRecord(token))?.studentId, studentId.toString());
  assert.equal((await service.passwords.getStudentUpdatePasswordRecord(token))?.studentId, studentId.toString());
  const result = await service.passwords.setStudentPortalPasswordFromToken(token, password);
  assert.equal(result.success, true);
  assert.equal(userWrite(service.calls)?.data?.emailVerified, false);
  assert.deepEqual(service.events, ["consume", "save"]);
  assert.ok(service.tokenRow().consumedAt);
  assert.equal(await service.updates.getStudentUpdateRecord(token), null);
  const reused = await service.passwords.setStudentPortalPasswordFromToken(token, password);
  assert.equal(reused.success, false);
  assert.equal(service.calls.filter((call) => call.method === "user.updateMany" && call.query.data?.passwordHash).length, 1);
  assert.equal(service.accounts[0].sessionVersion, 1);
});

test("cross-purpose, consumed, expired, wrong-target and revoked rows block profile and password access", async () => {
  const revoked: Partial<TokenRow>[] = [
    { purpose: "emailVerification", userId: 7n },
    { purpose: "teacherSetup", userId: null, employeeId: 44n },
    { userId: null }, { employeeId: 44n },
    { consumedAt: new Date() }, { expiresAt: new Date(Date.now() - 1000) },
    { userId: 1n }, { jti: "22222222-2222-4222-8222-222222222222" },
  ];
  for (const token of revoked) {
    const service = harness({ token });
    const signed = signedToken({ userId: "7", email: "student@example.com" });
    assert.equal(await service.passwords.getStudentUpdatePasswordRecord(signed), null);
    assert.equal(await service.updates.getStudentUpdateRecord(signed), null);
    assert.equal((await service.passwords.setStudentPortalPasswordFromToken(signed, password)).success, false);
    assert.equal((await service.updates.updateStudentRecordFromToken(signed, profileInput())).success, false);
    assert.equal(service.calls.some((call) => call.method === "student.findUnique"), false);
    assert.equal(userWrite(service.calls), undefined);
    assert.equal(service.events.includes("consume"), false);
  }
});

test("only the current email snapshot proves a new address while prior verification is retained", async () => {
  const cases = [
    { snapshot: "student@example.com", current: "student@example.com", verified: true },
    { snapshot: "old@example.com", current: "new@example.com", verified: false },
    { snapshot: null, current: "student@example.com", verified: false },
  ];
  for (const { snapshot, current, verified } of cases) {
    const service = harness({ studentEmail: current });
    const link = signedToken(snapshot === null ? {} : { userId: "7", email: snapshot });
    assert.equal((await service.passwords.setStudentPortalPasswordFromToken(link, password)).success, true);
    assert.equal(userWrite(service.calls)?.data?.emailVerified, verified);
    assert.equal(service.accounts[0].email, current);
  }
  const service = harness({ account: { id: 7n, email: "student@example.com", role: "student", emailVerified: true } });
  assert.equal((await service.passwords.setStudentPortalPasswordFromToken(signedToken(), password)).success, true);
  assert.equal(userWrite(service.calls)?.data?.emailVerified, true);
  assert.deepEqual(userWrite(service.calls)?.where, { id: 7n, email: "student@example.com", role: "student", passwordHash: "original-password-hash", sessionVersion: 0 });
});

test("legacy student links reject an unassigned shared token before profile or account access", async () => {
  const service = harness({ token: { userId: null } });
  const token = signedToken();
  assert.equal(await service.updates.getStudentUpdateRecord(token), null);
  assert.equal(await service.passwords.getStudentUpdatePasswordRecord(token), null);
  assert.equal((await service.passwords.setStudentPortalPasswordFromToken(token, password)).success, false);
  assert.equal((await service.updates.updateStudentRecordFromToken(token, profileInput())).success, false);
  assert.equal(service.calls.some((call) => call.method === "student.findUnique" || call.method === "user.findUnique"), false);
  assert.equal(service.hashedPasswords.length, 0);
  assert.equal(service.tokenRow().consumedAt, null);
});

test("student password setup cannot overwrite a portal account of another role", async () => {
  const service = harness({ account: { id: 7n, email: "student@example.com", role: "teacher", emailVerified: true } });
  const result = await service.passwords.setStudentPortalPasswordFromToken(signedToken(), password);
  assert.equal(result.success, false);
  assert.equal(userWrite(service.calls), undefined);
  assert.equal(service.events.includes("consume"), false);
  assert.equal(service.tokenRow().consumedAt, null);
});

test("token consumption is purpose and user scoped and must win before saving credentials", async () => {
  const service = harness({ consumeConflict: true });
  const result = await service.passwords.setStudentPortalPasswordFromToken(signedToken(), password);
  assert.equal(result.success, false);
  assert.equal(userWrite(service.calls), undefined);
  const where = service.calls.find((call) => call.method === "token.updateMany")?.query.where;
  assert.equal(where?.purpose, "studentUpdate");
  assert.equal(where?.userId, 7n);
  assert.equal("studentId" in where!, false);
  assert.equal("email" in where!, false);
  assert.equal(where?.consumedAt, null);
});

test("failed credential writes roll back consumption so setup can be retried safely", async () => {
  const service = harness({ userWriteError: true });
  const result = await service.passwords.setStudentPortalPasswordFromToken(signedToken(), password);
  assert.equal(result.success, false);
  assert.deepEqual(service.events, ["consume", "rollback"]);
  assert.equal(service.tokenRow().consumedAt, null);
});

test("account creation requires the actual recipient and leaves password setup pending", async () => {
  const service = harness({ noAccount: true });
  await service.updates.createStudentUpdateUrl(studentId.toString(), "student@example.com");
  const created = service.calls.find((call) => call.method === "user.create")?.query.data;
  assert.equal(created?.role, "student");
  assert.equal(created?.emailVerified, false);
  assert.equal(await verifyPassword("any guessed password", created?.passwordHash as string), false);
  const changed = harness({ studentEmail: "new@example.com", noAccount: true });
  await assert.rejects(changed.updates.createStudentUpdateUrl(studentId.toString(), "old@example.com"), /email changed/);
  assert.equal(changed.calls.some((call) => call.method === "user.create" || call.method === "token.create"), false);
});

test("student account creation inherits the saved admission photo while retaining password and verification setup", async () => {
  const savedPhoto = "https://res.cloudinary.com/test/image/upload/student-photo.png";
  const h = harness({ noAccount: true, studentImage: savedPhoto });
  await h.updates.createStudentUpdateUrl(studentId.toString(), "student@example.com");
  const created = h.calls.find((call) => call.method === "user.create")?.query.data;
  assert.equal(created?.userImage, savedPhoto); assert.equal(created?.emailVerified, false);
  assert.equal(created?.passwordHash, "!password-setup-required");
});

test("known account claims cannot be partial, malformed, or point to another account", async () => {
  const service = harness();
  for (const claims of [{ userId: "7" }, { email: "student@example.com" },
    { userId: "0", email: "student@example.com" }, { userId: "7", email: "invalid" }]) {
    assert.equal(service.updates.verifyStudentUpdateToken(signedToken(claims)), null);
  }
  const other = signedToken({ userId: "8", email: "student@example.com" });
  assert.equal(await service.updates.getStudentUpdateRecord(other), null);
  assert.equal((await service.passwords.setStudentPortalPasswordFromToken(other, password)).success, false);
  assert.equal(userWrite(service.calls), undefined);
});

test("student link versions are optional for legacy tokens and strictly bounded when present", () => {
  const service = harness();
  assert.ok(service.updates.verifyStudentUpdateToken(signedToken()));
  for (const sessionVersion of [null, -1, 0.5, "0", false, 2147483648, Number.NaN]) {
    assert.equal(service.updates.verifyStudentUpdateToken(signedToken({ sessionVersion })), null);
  }
  for (const sessionVersion of [0, 1, 2147483647]) {
    assert.equal(service.updates.verifyStudentUpdateToken(signedToken({ sessionVersion }))?.sessionVersion, sessionVersion);
  }
});

test("forgot-password revocation blocks old student password setup while retaining profile reads and edits", async () => {
  const service = harness({ allowProfileEdits: true });
  const old = signedToken({ userId: "7", email: "student@example.com", sessionVersion: 0 });
  const legacy = signedToken();
  // Forgot Password changes credentials/version but deliberately retains studentUpdate ledger rows.
  service.accounts[0].sessionVersion = 1;
  service.accounts[0].passwordHash = "password-established-by-forgot-password";
  service.accounts[0].emailVerified = true;
  for (const token of [old, legacy]) {
    assert.equal(await service.passwords.getStudentUpdatePasswordRecord(token), null);
    assert.equal((await service.passwords.setStudentPortalPasswordFromToken(token, password)).success, false);
    assert.equal((await service.updates.getStudentUpdateRecord(token))?.studentId, studentId.toString());
  }
  assert.equal(service.hashedPasswords.length, 0);
  assert.equal(service.tokenRow().consumedAt, null);
  assert.equal((await service.updates.updateStudentRecordFromToken(old, { ...profileInput(), firstName: "Updated" })).success, true);
  assert.equal(service.student.firstName, "Updated");
  assert.equal(service.accounts[0].passwordHash, "password-established-by-forgot-password");
  assert.equal(service.accounts[0].sessionVersion, 1);
  assert.equal(service.tokenRow().consumedAt, null);
});

test("stale student update links cannot move account recovery to a different email after Forgot Password", async () => {
  for (const token of [signedToken(), signedToken({ userId: "7", email: "student@example.com", sessionVersion: 0 })]) {
    const service = harness({ allowProfileEdits: true, account: {
      id: 7n, email: "student@example.com", role: "student", emailVerified: true,
      sessionVersion: 1, passwordHash: "password-established-by-forgot-password",
    } });
    const originalStudent = structuredClone(service.student);
    const originalAccounts = structuredClone(service.accounts);
    const result = await service.updates.updateStudentRecordFromToken(token, {
      ...profileInput(), firstName: "Hijacked", email: "attacker@example.com",
    });
    assert.equal(result.success, false);
    assert.deepEqual(service.student, originalStudent);
    assert.deepEqual(service.accounts, originalAccounts);
    assert.equal(service.tokenRow().consumedAt, null);
    assert.equal(service.calls.some((call) => call.method === "user.updateMany" || call.method === "student.update"), false);
    assert.equal((await service.updates.getStudentUpdateRecord(token))?.studentId, studentId.toString());
    assert.equal((await service.updates.updateStudentRecordFromToken(token, { ...profileInput(), firstName: "Allowed Profile Edit" })).success, true);
    assert.equal(service.student.firstName, "Allowed Profile Edit");
    assert.equal(service.accounts[0].email, "student@example.com");
    assert.equal(service.accounts[0].sessionVersion, 1);
  }
});

test("current-version and legacy version-zero profile links can change email with an original-version write guard", async () => {
  for (const sessionVersion of [0, 4]) {
    const service = harness({ allowProfileEdits: true, account: {
      id: 7n, email: "student@example.com", role: "student", emailVerified: true, sessionVersion,
    } });
    const token = signedToken(sessionVersion === 0 ? {} : { userId: "7", email: "student@example.com", sessionVersion });
    assert.equal((await service.updates.updateStudentRecordFromToken(token, { ...profileInput(), email: "new@example.com" })).success, true);
    assert.equal(service.accounts[0].email, "new@example.com");
    assert.equal(service.student.email, "new@example.com");
    assert.equal(service.accounts[0].emailVerified, false);
    assert.equal(service.accounts[0].sessionVersion, sessionVersion);
    assert.equal(service.calls.find((call) => call.method === "user.updateMany")?.query.where?.sessionVersion, sessionVersion);
  }
});

test("profile email/version write races roll back all student edits", async () => {
  const service = harness({ allowProfileEdits: true, profileUpdateMiss: true });
  const originalAccounts = structuredClone(service.accounts);
  const originalStudent = structuredClone(service.student);
  assert.equal((await service.updates.updateStudentRecordFromToken(signedToken(), { ...profileInput(), email: "new@example.com", firstName: "Changed" })).success, false);
  assert.deepEqual(service.accounts, originalAccounts);
  assert.deepEqual(service.student, originalStudent);
  assert.equal(service.tokenRow().consumedAt, null);
  assert.ok(service.events.includes("rollback"));
});

test("new student links bind the current version and password setup increments it to revoke existing sessions", async () => {
  const service = harness({ account: { id: 7n, email: "student@example.com", role: "student", emailVerified: false, sessionVersion: 5 } });
  const url = await service.updates.createStudentUpdateUrl(studentId.toString(), "student@example.com");
  const token = new URL(url).searchParams.get("token")!;
  const payload = service.updates.verifyStudentUpdateToken(token)!;
  assert.equal(payload.sessionVersion, 5);
  service.tokenRow().jti = payload.jti;
  service.tokenRow().expiresAt = new Date(payload.exp);
  assert.ok(await service.passwords.getStudentUpdatePasswordRecord(token));
  assert.equal((await service.passwords.setStudentPortalPasswordFromToken(token, password)).success, true);
  assert.equal(service.accounts[0].sessionVersion, 6);
  assert.equal(service.accounts[0].passwordHash, "bcrypt-test-hash");
  assert.equal(service.accounts[0].emailVerified, true);
  const written = service.calls.find((call) => call.method === "user.updateMany" && call.query.data?.passwordHash)?.query;
  assert.equal(written?.where?.sessionVersion, 5);
  assert.equal(written?.where?.passwordHash, "original-password-hash");
  assert.deepEqual(written?.data?.sessionVersion, { increment: 1 });
  assert.equal(await service.passwords.getStudentUpdatePasswordRecord(token), null);
});

test("student password setup cannot overflow session versions or accept a stale nonlegacy version", async () => {
  for (const sessionVersion of [1, 2147483647]) {
    const service = harness({ account: { id: 7n, email: "student@example.com", role: "student", emailVerified: true, sessionVersion } });
    const token = signedToken(sessionVersion === 2147483647 ? { sessionVersion } : {});
    assert.equal(await service.passwords.getStudentUpdatePasswordRecord(token), null);
    assert.equal((await service.passwords.setStudentPortalPasswordFromToken(token, password)).success, false);
    assert.equal(service.hashedPasswords.length, 0);
    assert.equal(service.tokenRow().consumedAt, null);
    assert.equal(service.accounts[0].sessionVersion, sessionVersion);
  }
});

test("student account conditional-write races roll back token consumption and omit private error details", async () => {
  for (const options of [{ userUpdateMiss: true }, { userWriteError: true }]) {
    const service = harness(options);
    const before = structuredClone(service.accounts);
    assert.equal((await service.passwords.setStudentPortalPasswordFromToken(signedToken(), password)).success, false);
    assert.deepEqual(service.accounts, before);
    assert.equal(service.tokenRow().consumedAt, null);
    assert.ok(service.events.includes("rollback"));
    assert.deepEqual(service.logs, [["Failed to set student portal password."]]);
    assert.doesNotMatch(JSON.stringify(service.logs), /StudentPass1|original-password-hash|Private/);
  }
});

test("legacy and new links cannot reset a different account after an independent student email change", async () => {
  const service = harness({ studentEmail: "changed@example.com", account: {
    id: 7n, email: "original@example.com", role: "student", emailVerified: true,
  } });
  for (const token of [signedToken(), signedToken({ userId: "7", email: "original@example.com" })]) {
    assert.equal(await service.updates.getStudentUpdateRecord(token), null);
    assert.equal(await service.passwords.getStudentUpdatePasswordRecord(token), null);
    assert.equal((await service.passwords.setStudentPortalPasswordFromToken(token, password)).success, false);
  }
  assert.equal(userWrite(service.calls), undefined);
  assert.equal(service.tokenRow().consumedAt, null);
});

test("authorized profile email changes update the same user and require verification of the new address", async () => {
  const service = harness({ allowProfileEdits: true, account: {
    id: 7n, email: "student@example.com", role: "student", emailVerified: true,
  } });
  const token = signedToken({ userId: "7", email: "student@example.com" });
  const updated = await service.updates.updateStudentRecordFromToken(token, { ...profileInput(), email: " New@Example.COM " });
  assert.equal(updated.success, true);
  assert.equal(service.student.email, "new@example.com");
  assert.equal(service.accounts[0].id, 7n);
  assert.equal(service.accounts[0].email, "new@example.com");
  assert.equal(service.accounts[0].emailVerified, false);
  assert.equal(service.tokenRow().consumedAt, null);
  assert.equal((await service.passwords.setStudentPortalPasswordFromToken(token, password)).success, true);
  assert.equal(service.accounts[0].emailVerified, false);
  assert.equal(service.calls.some((call) => call.method === "user.create" || call.method === "user.findFirst"), false);
});

test("secure student updates sanitize and capitalize submitted profiles without modifying signed tokens", async () => {
  const service = harness({ allowProfileEdits: true });
  const token = signedToken({ userId: "7", email: "student@example.com" });
  const result = await service.updates.updateStudentRecordFromToken(token, {
    ...profileInput(), firstName: " <b>maria</b>\t luz ", lastName: " de la cruz ",
    email: " STUDENT@Example.COM ", addressCity: "<i>quezon city</i>", addressHouseNumber: "12b",
    guardianFirstName: " ana ", guardianRelationship: "mother", guardianOccupation: "software developer",
    lastSchoolName: "central school", lastSchoolShortName: "CSHS", lastSchoolId: "idAb12",
    facebookAccount: "https://facebook.com/Maria.User",
  });
  assert.equal(result.success, true);
  const student = service.calls.find((call) => call.method === "student.update")?.query.data;
  assert.equal(student?.firstName, "Maria Luz");
  assert.equal(student?.lastName, "De La Cruz");
  assert.equal(student?.email, "student@example.com");
  assert.equal(student?.facebookAccount, "https://facebook.com/Maria.User");
  const address = service.calls.find((call) => call.method === "address.create")?.query.data;
  assert.equal(address?.city, "Quezon City");
  assert.equal(address?.houseNumber, "12b");
  const guardian = service.calls.find((call) => call.method === "guardian.create")?.query.data;
  assert.equal(guardian?.firstName, "Ana");
  assert.equal(guardian?.occupation, "Software Developer");
  const school = service.calls.find((call) => call.method === "lastSchool.create")?.query.data;
  assert.equal(school?.schoolName, "Central School");
  assert.equal(school?.shortName, "CSHS");
  assert.equal(school?.schoolId, "idAb12");
  assert.equal(service.updates.verifyStudentUpdateToken(token)?.jti, jti);
  assert.equal(service.tokenRow().consumedAt, null);
});

test("secure updates display saved admission metadata and update that application without enrollment or section tables", async () => {
  const service = harness({ allowProfileEdits: true, application: {
    id: 3n, branchId: 10n, programId: 11n, academicLevel: "ThirdYear", programType: "Bachelor",
    applicationStatus: "approved", submittedAt: new Date("2026-01-01T00:00:00.000Z"),
    lastSchoolId: null, lastSchool: null,
    branch: { title: "Main Campus" }, program: { label: "Information Technology" },
  } });
  const token = signedToken({ userId: "7", email: "student@example.com" });
  const record = await service.updates.getStudentUpdateRecord(token);
  assert.equal(record?.latestAdmissionYearLevel, "Third Year");
  assert.equal(record?.latestAdmissionStatus, "approved");
  assert.equal(record?.latestAdmissionBranch, "Main Campus");
  assert.equal(record?.latestAdmissionProgram, "Information Technology");
  assert.equal(Object.keys(record!).some((key) => key.startsWith("latestEnrollment")), false);
  assert.equal((await service.updates.updateStudentRecordFromToken(token, profileInput())).success, true);
  const updated = service.calls.find((call) => call.method === "application.update")?.query;
  assert.equal(updated?.where?.id, 3n);
  assert.equal(updated?.data?.lastSchoolId, 1n);
  assert.equal(updated?.data?.LSSchoolYearEnd, "2025-2026");
  assert.equal(service.student.applications[0].academicLevel, "ThirdYear");
  assert.equal(service.student.applications[0].applicationStatus, "approved");
  assert.equal(service.student.applications[0].branchId, 10n);
  assert.equal(service.student.applications[0].programId, 11n);
  assert.equal("academicLevelsId" in (updated?.data ?? {}), false);
  for (const call of service.calls.filter((value) => value.method === "student.findUnique")) {
    assert.equal("enrollments" in call.query.select!, false);
    const applicationQuery = call.query.select!.applications as { orderBy: unknown[]; take: number; select: Record<string, unknown> };
    assert.deepEqual(applicationQuery.orderBy, [
      { submittedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" },
    ]);
    assert.equal(applicationQuery.take, 1);
    assert.equal("section" in applicationQuery.select, false);
    assert.equal("schoolYear" in applicationQuery.select, false);
  }
  assert.equal(service.tokenRow().consumedAt, null);
});

test("secure profile updates reuse a matched school while retaining the student's own attendance details", async () => {
  const service = harness({ allowProfileEdits: true, reusableSchoolId: 42n });
  const token = signedToken({ userId: "7", email: "student@example.com" });
  const result = await service.updates.updateStudentRecordFromToken(token, {
    ...profileInput(), lastSchoolName: " central SCHOOL ", lastSchoolYear: "2024-2025", lastSchoolYearLevel: " grade 11 ",
  });
  assert.equal(result.success, true);
  assert.equal(service.calls.some((call) => call.method === "lastSchool.create" || call.method === "lastSchool.update"), false);
  assert.equal(service.calls.filter((call) => call.method === "address.create").length, 1);
  const attendance = service.calls.find((call) => call.method === "application.update")?.query.data;
  assert.equal(attendance?.lastSchoolId, 42n);
  assert.equal(attendance?.LSSchoolYearEnd, "2024-2025");
  assert.equal(attendance?.LSAttainedLevelText, "Grade 11");
  assert.equal(service.student.applications[0].academicLevel, "FirstYear");
  assert.equal(service.student.applications[0].branchId, 10n);
  assert.equal(service.tokenRow().consumedAt, null);
});

test("secure updates promote saved drafts to review without replacing approved admission history", async () => {
  const service = harness({ allowProfileEdits: true, application: {
    id: 3n, branchId: 10n, programId: 11n, academicLevel: "FirstYear", programType: "Bachelor",
    applicationStatus: "draft", submittedAt: null, lastSchoolId: null, lastSchool: null,
    branch: { title: "Main Campus" }, program: { label: "Information Technology" },
  } });
  assert.equal((await service.updates.updateStudentRecordFromToken(signedToken(), profileInput())).success, true);
  const data = service.calls.find((call) => call.method === "application.update")?.query.data;
  assert.equal(data?.applicationStatus, "reviewing");
  assert.ok(data?.submittedAt);
  assert.equal(service.tokenRow().consumedAt, null);
});

test("missing admission history leaves accounts and profiles unchanged without creating orphan school records", async () => {
  const service = harness({ allowProfileEdits: true, noApplication: true });
  const token = signedToken({ userId: "7", email: "student@example.com" });
  const originalAccounts = structuredClone(service.accounts);
  const originalStudent = structuredClone(service.student);
  assert.equal((await service.updates.getStudentUpdateRecord(token))?.latestAdmissionStatus, "");
  assert.equal((await service.updates.updateStudentRecordFromToken(token, { ...profileInput(), email: "new@example.com" })).success, false);
  assert.deepEqual(service.accounts, originalAccounts);
  assert.deepEqual(service.student, originalStudent);
  assert.equal(service.calls.some((call) => call.method.endsWith(".create") || call.method === "student.update" || call.method === "application.update" || call.method === "user.updateMany"), false);
  assert.equal(service.tokenRow().consumedAt, null);
  assert.ok(service.events.includes("rollback"));
});

test("profile email conflicts roll back both account and student changes", async () => {
  const service = harness({ allowProfileEdits: true });
  service.accounts.push({ id: 8n, email: "other@example.com", role: "student", emailVerified: true, sessionVersion: 0, passwordHash: "other-password-hash" });
  const token = signedToken({ userId: "7", email: "student@example.com" });
  const result = await service.updates.updateStudentRecordFromToken(token, { ...profileInput(), email: "other@example.com" });
  assert.equal(result.success, false);
  assert.equal(service.accounts[0].email, "student@example.com");
  assert.equal(service.student.email, "student@example.com");
  assert.equal(service.tokenRow().consumedAt, null);
  assert.ok(service.events.includes("rollback"));
});
