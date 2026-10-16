import { nonPhotoServiceModules } from "./profile-image-harness";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import { Prisma } from "../lib/generated/prisma/client";
import * as enums from "../lib/generated/prisma/enums";
import * as utils from "../lib/utils";
import * as validation from "../lib/validation";
import * as levels from "../lib/academic-levels";
import * as fields from "../lib/admission/student-fields";
import * as records from "../lib/admission/records";
import type * as admin from "../lib/admission/admin";
import { ProfileIdentityError } from "../lib/users/profiles";

type Account = { id: bigint; email: string; role: enums.UserRole; sessionVersion: number; emailVerified: boolean; passwordHash: string; userImage: string | null };
type Student = { id: bigint; email: string; addressId: bigint | null; guardians: []; userImage?: string | null; firstName?: string; lastName?: string; birthDate?: Date };
type Query = { where: { id?: bigint; studentId?: bigint; applicationStatus?: string; email?: unknown; role?: string; sessionVersion?: number; userImage?: string | null; NOT?: { id: bigint }; userId?: bigint }; data?: Record<string, unknown>; take?: number };

const source = ts.transpileModule(readFileSync(new URL("../lib/admission/admin.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText;

function account(overrides: Partial<Account> = {}): Account {
  return { id: 10n, email: "maria@example.test", role: "student", sessionVersion: 3, emailVerified: true,
    passwordHash: "existing-password-hash", userImage: "https://res.cloudinary.com/demo/image/upload/photo.jpg", ...overrides };
}

function harness(options: { accounts?: Account[]; students?: Student[]; applicationStatus?: enums.ApplicationStatus; concurrentAccountChange?: boolean; failStudentWrite?: boolean; denied?: boolean; uploadFailure?: boolean } = {}) {
  let accounts = structuredClone(options.accounts ?? [account()]);
  let students: Student[] = structuredClone((options.students ?? [{ id: 4n, email: "maria@example.test", addressId: null, guardians: [] }]).map(
    (student) => ({ firstName: "Maria", lastName: "Santos", birthDate: new Date("2008-02-29T00:00:00Z"), ...student }),
  ));
  let tokens = [{ id: 1n, userId: 10n }, { id: 2n, userId: 11n }];
  const writes: Array<{ method: string; query?: Query }> = [];
  const userReads: Query[] = [];
  const paths: string[] = [];
  const errors: unknown[] = [];
  const uploads: string[] = [], cleaned: unknown[] = [];
  function matchesEmail(value: string, filter: unknown) {
    const condition = filter as { equals: string; mode: string };
    assert.equal(condition.mode, "insensitive");
    return value.toLowerCase() === condition.equals.replace(/\\([\\%_])/g, "$1").toLowerCase();
  }
  const transaction = {
    student: {
      count: async () => 1,
      findUnique: async ({ where }: Query) => students.find((student) => student.id === where.id) ?? null,
      findFirst: async ({ where }: Query) => students.find((student) => student.id !== where.NOT?.id && matchesEmail(student.email, where.email)) ?? null,
      findMany: async ({ where, take }: Query) => students.filter((student) => matchesEmail(student.email, where.email)).slice(0, take),
      update: async (query: Query) => {
        writes.push({ method: "student.update", query: structuredClone(query) });
        if (options.failStudentWrite) throw new Error("Profile write failed");
        const student = students.find((candidate) => candidate.id === query.where.id);
        assert.ok(student);
        Object.assign(student, query.data);
        return student;
      },
    },
    admissionApplication: {
      findFirst: async ({ where }: Query) => where.id === 5n &&
        (where.studentId === undefined || where.studentId === 4n) &&
        (where.applicationStatus === undefined || where.applicationStatus === (options.applicationStatus ?? "approved"))
        ? { id: 5n, applicantType: "new", branchId: 1n, programId: 2n, academicLevel: "FirstYear", lastSchoolId: null, lastSchool: null } : null,
      update: async (query: Query) => { writes.push({ method: "application.update", query }); return { id: 5n }; },
    },
    user: {
      findMany: async (query: Query) => {
        userReads.push(structuredClone(query));
        return accounts.filter((candidate) => matchesEmail(candidate.email, query.where.email)).slice(0, query.take);
      },
      findFirst: async (query: Query) => {
        userReads.push(structuredClone(query));
        return accounts.find((candidate) => candidate.id !== query.where.NOT?.id && matchesEmail(candidate.email, query.where.email)) ?? null;
      },
      updateMany: async (query: Query) => {
        writes.push({ method: "user.updateMany", query: structuredClone(query) });
        const saved = accounts.find((candidate) => candidate.id === query.where.id && candidate.email === query.where.email &&
          candidate.role === query.where.role && (query.where.sessionVersion === undefined || candidate.sessionVersion === query.where.sessionVersion) &&
          (query.where.userImage === undefined || candidate.userImage === query.where.userImage));
        if (!saved || options.concurrentAccountChange) return { count: 0 };
        if (Object.hasOwn(query.data ?? {}, "userImage")) {
          assert.deepEqual(Object.keys(query.data ?? {}), ["userImage"]);
          saved.userImage = query.data!.userImage as string | null; return { count: 1 };
        }
        assert.deepEqual(Object.keys(query.data ?? {}).sort(), ["email", "emailVerified", "sessionVersion"]);
        saved.email = query.data?.email as string;
        saved.emailVerified = query.data?.emailVerified as boolean;
        saved.sessionVersion += (query.data?.sessionVersion as { increment: number }).increment;
        return { count: 1 };
      },
    },
    verificationToken: {
      deleteMany: async (query: Query) => {
        writes.push({ method: "verificationToken.deleteMany", query: structuredClone(query) });
        const before = tokens.length;
        tokens = tokens.filter((token) => token.userId !== query.where.userId);
        return { count: before - tokens.length };
      },
    },
    address: { create: async (query: Query) => { writes.push({ method: "address.create", query }); return { id: 6n }; }, update: async () => ({ id: 6n }) },
    lastSchool: { count: async () => 0 },
    guardian: { create: async (query: Query) => { writes.push({ method: "guardian.create", query }); return { id: 7n }; } },
    studentGuardian: { create: async (query: Query) => { writes.push({ method: "studentGuardian.create", query }); return { id: 8n }; } },
  };
  const modules: Record<string, unknown> = {
    ...nonPhotoServiceModules(),
    "@/lib/users/profiles": { ProfileIdentityError, getUserForProfile: async (_tx: unknown, ref: { id: bigint; kind: string }) => {
      assert.equal(ref.kind, "student");
      const saved = students.find((student) => student.id === ref.id);
      const found = accounts.filter((candidate) => candidate.role === "student" && utils.normalizeEmail(candidate.email) === utils.normalizeEmail(saved?.email ?? ""));
      if (found.length > 1) throw new ProfileIdentityError();
      return structuredClone(found[0] ?? null);
    } },
    "@/lib/users/profile-image": {
      prepareProfileImage: async (data: FormData, scope: string) => {
        const image = data.get("image");
        if (image instanceof File && image.size) {
          uploads.push(scope);
          if (options.uploadFailure) return { success: false, message: "Upload failed.", fieldErrors: { image: "Upload failed." } };
          return { success: true, change: { value: "https://res.cloudinary.com/test/student.png", upload: { scope } } };
        }
        return { success: true, ...(data.get("removeImage") === "true" ? { change: { value: null } } : {}) };
      },
      cleanupProfileImage: async (change: unknown) => { if (change) cleaned.push(change); },
    },
    "./records": records, "next/cache": { revalidatePath: (path: string) => paths.push(path) }, "xlsx": {},
    "@/lib/academic-levels": levels, "@/lib/auth": { requireAdmin: async () => { if (options.denied) throw new Error("Admin required"); } },
    "@/lib/generated/prisma/enums": enums, "@/lib/generated/prisma/client": { Prisma },
    "@/lib/validation": validation, "./student-fields": fields, "@/lib/utils": utils,
    "@/lib/prisma": { prisma: {
      ...transaction,
      branch: { findUnique: async ({ where }: Query) => where.id === 1n ? { id: 1n } : null },
      program: { findUnique: async ({ where }: Query) => where.id === 2n ? { id: 2n, programType: "Bachelor" } : null },
    } },
    "./last-school-store": {
      resolveLastSchool: async () => ({ id: 9n }),
      runLastSchoolTransaction: async (callback: (tx: typeof transaction) => Promise<unknown>) => {
        const before = structuredClone({ accounts, students, tokens });
        try { return await callback(transaction); } catch (error) {
          ({ accounts, students, tokens } = before);
          throw error;
        }
      },
    },
  };
  const loaded = { exports: {} };
  runInNewContext(source, { module: loaded, exports: loaded.exports, Date, console: { error: (...args: unknown[]) => errors.push(args) }, require: (name: string) => {
    assert.ok(name in modules, `Unexpected student-account dependency: ${name}`);
    return modules[name];
  } });
  return { service: loaded.exports as typeof admin, writes, userReads, paths, errors, uploads, cleaned,
    snapshot: () => structuredClone({ accounts, students, tokens }) };
}

test("student photo edits save the profile and linked account together without changing credentials or verification", async () => {
  const h = harness(), data = form("maria@example.test"), before = h.snapshot();
  data.set("image", new File(["synthetic"], "photo.png", { type: "image/png" }));
  const result = await h.service.editManagedStudentAction({ success: false, message: "" }, data);
  assert.equal(result.success, true, result.message + " " + h.errors.map(String).join(" "));
  const saved = h.snapshot();
  assert.equal(saved.students[0].userImage, "https://res.cloudinary.com/test/student.png");
  assert.deepEqual(saved.accounts[0], { ...before.accounts[0], userImage: saved.students[0].userImage });
  assert.deepEqual(saved.tokens, before.tokens); assert.deepEqual(h.uploads, ["student:4"]); assert.equal(h.cleaned.length, 0);
  assert.ok(h.paths.includes("/portal/users"));
  const removal = form("maria@example.test"); removal.set("removeImage", "true");
  assert.equal((await h.service.editManagedStudentAction({ success: false, message: "" }, removal)).success, true);
  assert.equal(h.snapshot().students[0].userImage, null); assert.equal(h.snapshot().accounts[0].userImage, null);
});

test("students without accounts can save a profile photo without creating portal credentials", async () => {
  const h = harness({ accounts: [] }), data = form("maria@example.test");
  data.set("image", new File(["synthetic"], "photo.png", { type: "image/png" }));
  assert.equal((await h.service.editManagedStudentAction({ success: false, message: "" }, data)).success, true);
  assert.equal(h.snapshot().students[0].userImage, "https://res.cloudinary.com/test/student.png");
  assert.deepEqual(h.snapshot().accounts, []);
});

test("failed student photo saves roll back linked account updates and clean only the newly uploaded image", async () => {
  for (const options of [{ failStudentWrite: true }, { uploadFailure: true }]) {
    const h = harness(options), before = h.snapshot(), data = form("maria@example.test");
    data.set("image", new File(["synthetic"], "photo.png", { type: "image/png" }));
    assert.equal((await h.service.editManagedStudentAction({ success: false, message: "" }, data)).success, false);
    assert.deepEqual(h.snapshot(), before);
    assert.equal(h.cleaned.length, options.failStudentWrite ? 1 : 0);
  }
  const denied = harness({ denied: true }), data = form(); data.set("image", new File(["x"], "photo.png", { type: "image/png" }));
  await assert.rejects(denied.service.editManagedStudentAction({ success: false, message: "" }, data), /Admin required/);
  assert.equal(denied.uploads.length, 0);
});

function form(email = "new@example.test") {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    ...Object.fromEntries(fields.studentUpdateFields.map((field) => [field, ""])),
    studentId: "4", applicationId: "5", studentNumber: "0007", applicantType: "new", branchId: "1", programId: "2", academicLevel: "FirstYear",
    firstName: "maria", lastName: "santos", birthDate: "2008-02-29", gender: "Female", birthplace: "Manila", email, phone: "09171234567",
    addressBarangay: "Central", addressCity: "Manila", addressProvince: "Metro Manila", guardianFirstName: "Ana", guardianLastName: "Santos",
    guardianRelationship: "Mother", guardianContactNumber: "09171234567", lastSchoolName: "Previous School", lastSchoolType: "Public",
    lastSchoolBarangay: "Central", lastSchoolCity: "Manila", lastSchoolProvince: "Metro Manila", lastSchoolYear: "2025-2026", lastSchoolYearLevel: "Grade 12",
  })) data.set(key, value);
  return data;
}

function incompleteForm(overrides: Record<string, string | undefined> = {}) {
  const data = new FormData();
  for (const [name, value] of Object.entries({ studentId: "4", applicationId: "5", ...overrides })) {
    if (value !== undefined) data.set(name, value);
  }
  return data;
}

test("Admissions can save an incomplete student while preserving core identity and avoiding empty related records", async () => {
  const h = harness({ applicationStatus: "draft" }), before = h.snapshot();
  const result = await h.service.editAdmittedStudentAction({ success: false, message: "" }, incompleteForm({ religion: " <b>roman catholic</b> " }));
  assert.equal(result.success, true, result.message + " " + h.errors.map(String).join(" "));
  const saved = h.snapshot();
  assert.equal(saved.students[0].firstName, "Maria");
  assert.equal(saved.students[0].lastName, "Santos");
  assert.equal(saved.students[0].email, "maria@example.test");
  assert.deepEqual(saved.students[0].birthDate, before.students[0].birthDate);
  assert.deepEqual(saved.accounts, before.accounts);
  assert.deepEqual(saved.tokens, before.tokens);
  const studentWrite = h.writes.find((call) => call.method === "student.update")!.query!.data!;
  assert.equal(studentWrite.religion, "Roman Catholic");
  assert.equal(studentWrite.studentNumber, null);
  assert.equal(studentWrite.gender, null);
  assert.equal(studentWrite.phone, null);
  assert.equal(studentWrite.addressId, null);
  assert.equal(h.writes.some((call) => /^(address|guardian|studentGuardian)\./.test(call.method)), false);
  const applicationWrite = h.writes.find((call) => call.method === "application.update")!.query!.data!;
  assert.equal(applicationWrite.applicantType, "new");
  assert.equal(applicationWrite.branchId, 1n);
  assert.equal(applicationWrite.programId, 2n);
  assert.equal(applicationWrite.academicLevel, "FirstYear");
  assert.equal(Object.hasOwn(applicationWrite, "lastSchoolId"), false);
  assert.equal(applicationWrite.LSSchoolYearEnd, null);
  assert.equal(applicationWrite.LSAttainedLevelText, null);
  assert.equal(applicationWrite.LSGraduationDate, null);
});

test("Admissions partial address and guardian details can save without requiring the other fields", async () => {
  const h = harness();
  const result = await h.service.editAdmittedStudentAction({ success: false, message: "" }, incompleteForm({ addressCity: " makati ", guardianFirstName: " ana " }));
  assert.equal(result.success, true, result.message);
  const address = h.writes.find((call) => call.method === "address.create")!.query!.data!;
  assert.equal(address.city, "Makati"); assert.equal(address.barangay, ""); assert.equal(address.province, "");
  const guardian = h.writes.find((call) => call.method === "guardian.create")!.query!.data!;
  assert.equal(guardian.firstName, "Ana"); assert.equal(guardian.lastName, ""); assert.equal(guardian.contactNumber, "");
});

test("only Admissions relaxes missing fields and it still rejects invalid provided information and foreign selections", async () => {
  const strict = harness();
  const strictResult = await strict.service.editManagedStudentAction({ success: false, message: "" }, incompleteForm());
  assert.equal(strictResult.success, false); assert.match(strictResult.message, /required fields/); assert.equal(strict.writes.length, 0);
  for (const fields of [
    { email: "invalid" }, { phone: "bad" }, { guardianContactNumber: "bad" },
    { birthDate: "2008-02-30" }, { lastSchoolGraduationDate: "2008-02-30" },
    { gender: "invalid" }, { civilStatus: "invalid" }, { applicantType: "invalid" },
    { lastSchoolType: "invalid" }, { lastSchoolYear: "nonsense" },
    { branchId: "invalid" }, { branchId: "0" }, { programId: "0" }, { academicLevel: "invalid" },
    { branchId: "9223372036854775808" }, { programId: "9223372036854775808" },
    { branchId: "999" }, { programId: "999" }, { academicLevel: "Grade11" },
  ]) {
    const h = harness();
    assert.equal((await h.service.editAdmittedStudentAction({ success: false, message: "" }, incompleteForm(fields))).success, false, JSON.stringify(fields));
    assert.equal(h.writes.length, 0, JSON.stringify(fields));
  }
});

test("incomplete Admissions saves retain authorization and application ownership checks", async () => {
  const denied = harness({ denied: true });
  await assert.rejects(denied.service.editAdmittedStudentAction({ success: false, message: "" }, incompleteForm()), /Admin required/);
  assert.equal(denied.writes.length, 0);
  for (const fields of [{ applicationId: "6" }, { studentId: "99" }, { studentId: "0" }]) {
    const h = harness();
    assert.equal((await h.service.editAdmittedStudentAction({ success: false, message: "" }, incompleteForm(fields))).success, false);
    assert.equal(h.writes.length, 0);
  }
});

test("admin student email edits move only the existing student account, revoke sessions/tokens and require fresh verification", async () => {
  for (const method of ["editManagedStudentAction", "editAdmittedStudentAction"] as const) {
    const service = harness();
    const before = service.snapshot();
    const result = await service.service[method]({ success: false, message: "" }, form(" NEW@EXAMPLE.TEST "));
    assert.equal(result.success, true);
    assert.match(result.message, /sign in with the new email and verify/);
    const saved = service.snapshot();
    assert.equal(saved.students[0].email, "new@example.test");
    assert.deepEqual(saved.accounts[0], { ...before.accounts[0], email: "new@example.test", emailVerified: false, sessionVersion: 4 });
    assert.deepEqual(saved.tokens, [{ id: 2n, userId: 11n }]);
    const write = service.writes.find((call) => call.method === "user.updateMany")?.query;
    assert.deepEqual(write?.where, { id: 10n, email: "maria@example.test", role: "student", sessionVersion: 3 });
    assert.ok(service.writes.findIndex((call) => call.method === "verificationToken.deleteMany") < service.writes.findIndex((call) => call.method === "address.create"));
  }
});

test("unchanged and case-only student email edits keep verification, sessions and tokens intact", async () => {
  for (const email of ["maria@example.test", " MARIA@EXAMPLE.TEST "]) {
    const service = harness({ accounts: [account({ email: "MARIA@Example.Test" })] });
    const before = service.snapshot();
    const result = await service.service.editManagedStudentAction({ success: false, message: "" }, form(email));
    assert.equal(result.success, true);
    assert.equal(result.message, "Student details updated.");
    assert.deepEqual(service.snapshot().accounts, before.accounts);
    assert.deepEqual(service.snapshot().tokens, before.tokens);
    assert.equal(service.writes.some((call) => call.method.startsWith("user.") || call.method.startsWith("verificationToken.")), false);
  }
});

test("editing a student without an account updates details without creating or modifying portal accounts", async () => {
  const service = harness({ accounts: [] });
  assert.equal((await service.service.editManagedStudentAction({ success: false, message: "" }, form())).success, true);
  assert.equal(service.snapshot().students[0].email, "new@example.test");
  assert.deepEqual(service.snapshot().accounts, []);
  assert.equal(service.writes.some((call) => call.method.startsWith("user.") || call.method.startsWith("verificationToken.")), false);
});

test("student email edits reject existing accounts, duplicate student addresses and ambiguous old associations before any writes", async () => {
  for (const options of [
    { accounts: [account(), account({ id: 11n, email: "NEW@EXAMPLE.TEST", role: "teacher" })] },
    { accounts: [account(), account({ id: 11n, email: "MARIA@EXAMPLE.TEST" })] },
    { accounts: [account({ role: "superAdmin" })] },
    { accounts: [account({ role: "teacher" })] },
    { accounts: [], students: [{ id: 4n, email: "maria@example.test", addressId: null, guardians: [] }, { id: 8n, email: "NEW@EXAMPLE.TEST", addressId: null, guardians: [] }] },
    { students: [{ id: 4n, email: "maria@example.test", addressId: null, guardians: [] }, { id: 8n, email: "MARIA@EXAMPLE.TEST", addressId: null, guardians: [] }] },
  ] satisfies Array<Parameters<typeof harness>[0]>) {
    const service = harness(options);
    const before = service.snapshot();
    const result = await service.service.editManagedStudentAction({ success: false, message: "" }, form());
    assert.equal(result.success, false);
    assert.match(result.message, /Choose a different email|conflicting portal records/);
    assert.equal(service.writes.length, 0);
    assert.deepEqual(service.snapshot(), before);
    assert.equal(service.errors.length, 0);
    assert.equal(service.paths.length, 0);
  }
});

test("student-account guards fail safely for concurrent account changes and roll back account changes if profile writes fail", async () => {
  for (const options of [{ concurrentAccountChange: true }, { failStudentWrite: true }]) {
    const service = harness(options);
    const before = service.snapshot();
    const result = await service.service.editManagedStudentAction({ success: false, message: "" }, form());
    assert.equal(result.success, false);
    assert.deepEqual(service.snapshot(), before);
    assert.equal(service.paths.length, 0);
    if (options.concurrentAccountChange) {
      assert.match(result.message, /account changed.*Reload/);
      assert.equal(service.writes.some((call) => call.method === "address.create" || call.method === "verificationToken.deleteMany"), false);
    }
  }
});

test("student-account email matching treats percent, underscore and backslash as literal characters", async () => {
  const original = "maria_%\\name@example.test";
  const replacement = "new_%\\name@example.test";
  const service = harness({
    accounts: [account({ email: original }), account({ id: 11n, email: "newABCxname@example.test", role: "superAdmin" })],
    students: [{ id: 4n, email: original, addressId: null, guardians: [] }],
  });
  assert.equal((await service.service.editManagedStudentAction({ success: false, message: "" }, form(replacement))).success, true);
  assert.equal(service.snapshot().accounts[0].email, replacement);
  assert.equal(service.snapshot().accounts[1].email, "newABCxname@example.test");
  assert.deepEqual(service.userReads[0].where.email, { equals: "maria\\_\\%\\\\name@example.test", mode: "insensitive" });
});
