import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as enums from "../lib/generated/prisma/enums";
import * as utils from "../lib/utils";
import * as validation from "../lib/validation";
import * as levels from "../lib/academic-levels";
import * as records from "../lib/admission/records";
import * as fields from "../lib/admission/student-fields";
import * as schoolIdentity from "../lib/admission/last-school-identity";
import type * as service from "../lib/admission/student-review";

type Student = records.StudentUpdateQueryResult & {
  studentNumber: string | null;
  addressId: bigint | null;
  guardians: Array<records.StudentUpdateQueryResult["guardians"][number] & { id: bigint; guardianId: bigint }>;
};
type Account = { id: bigint; email: string; role: enums.UserRole; emailVerified: boolean; sessionVersion: number };
type Query = { where: Record<string, unknown>; data?: Record<string, unknown>; take?: number; select?: Record<string, unknown> };
type Call = { method: string; query: Query };
type School = NonNullable<Student["applications"][number]["lastSchool"]> & { id: bigint };

class LastSchoolSelectionError extends Error {}

function student(overrides: Partial<Student> = {}): Student {
  return {
    id: 4n, studentNumber: "2026-0004", firstName: "Maria", lastName: "Santos", middleName: null, suffix: null,
    birthDate: new Date("2008-02-29T00:00:00Z"), gender: "Female", civilStatus: "Single", citizenship: "Filipino",
    birthplace: "Manila", religion: null, email: "maria@example.test", phone: "09123456789", facebookAccount: null,
    addressId: 6n,
    address: { houseNumber: "7", subdivision: "North", street: "One", barangay: "West", city: "Manila", province: "Metro Manila", postalCode: "1000" },
    guardians: [{ id: 8n, guardianId: 7n, isPrimary: true, relationship: "Mother", guardian: {
      firstName: "Ana", lastName: "Santos", middleName: null, suffix: null, contactNumber: "09123456780", occupation: "Teacher",
    } }],
    applications: [{
      id: 5n, branchId: 1n, programId: 2n, academicLevel: "FirstYear", programType: "Bachelor", lastSchoolId: 9n,
      LSSchoolYearEnd: "2025-2026", LSAttainedLevelText: "Grade 12", LSGraduationDate: new Date("2026-04-01T00:00:00Z"),
      applicationStatus: "reviewing", submittedAt: new Date("2026-05-01T00:00:00Z"),
      branch: { title: "Main" }, program: { label: "BSIT" },
      lastSchool: {
        verificationStatus: "verified",
        schoolName: "Central High School", schoolId: "00123", shortName: "CHS", schoolType: "Public",
        address: { houseNumber: "10", subdivision: "East", street: "Two", barangay: "Central", city: "Manila", province: "Metro Manila", postalCode: "1001" },
      },
    }],
    ...overrides,
  };
}

const account: Account = { id: 10n, email: "maria@example.test", role: "student", emailVerified: true, sessionVersion: 3 };
const source = ts.transpileModule(readFileSync(new URL("../lib/admission/student-review.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText;

function matchesEmail(value: string, filter: unknown) {
  const condition = filter as { equals: string; mode: string };
  assert.equal(condition.mode, "insensitive");
  return value.toLowerCase() === condition.equals.replace(/\\([\\%_])/g, "$1").toLowerCase();
}

function harness(options: {
  students?: Student[];
  session?: Partial<Account> | null;
  savedAccount?: Partial<Account> | null;
  sharedAddress?: boolean;
  sharedGuardian?: boolean;
  concurrentApproval?: boolean;
  failStudentWrite?: boolean;
  studentWriteError?: Error;
  photoColumnMissing?: boolean;
  schools?: School[];
} = {}) {
  let students = structuredClone(options.students ?? [student()]);
  const savedAccount = options.savedAccount === null ? null : { ...account, ...options.savedAccount };
  const session = options.session === null ? null : { ...account, ...options.session, id: (options.session?.id ?? account.id).toString() };
  const calls: Call[] = [], lookups: Array<{ email: string; select: Record<string, unknown> }> = [];
  const paths: Array<[string, string | undefined]> = [], errors: unknown[] = [];
  const schoolProfiles: fields.UpdateStudentRecordInput[] = [];
  const schoolSelections: Array<string | undefined> = [];
  const schools = structuredClone(options.schools ?? [{ ...student().applications[0].lastSchool!, id: 9n }]);
  function call(method: string, query: Query) { calls.push({ method, query: structuredClone(query) }); }
  const transaction = {
    user: { findUnique: async (query: Query) => { call("user.findUnique", query); return savedAccount; } },
    student: {
      findMany: async (query: Query) => {
        call("student.findMany", query);
        return structuredClone(students.filter((row) => matchesEmail(row.email, query.where.email)).slice(0, query.take));
      },
      count: async (query: Query) => { call("student.count", query); return options.sharedAddress ? 2 : 1; },
      update: async (query: Query) => {
        call("student.update", query);
        if (options.failStudentWrite) throw new Error("Synthetic write failure");
        if (options.studentWriteError) throw options.studentWriteError;
        if (options.photoColumnMissing && (!query.select || query.select.userImage)) {
          throw Object.assign(new Error("The students.user_image column does not exist."), { code: "P2022" });
        }
        const row = students.find((entry) => entry.id === query.where.id);
        assert.ok(row);
        Object.assign(row, query.data);
        return query.select?.id ? { id: row.id } : row;
      },
    },
    address: {
      create: async (query: Query) => { call("address.create", query); return { id: 60n }; },
      update: async (query: Query) => { call("address.update", query); return { id: query.where.id }; },
    },
    lastSchool: {
      count: async (query: Query) => { call("lastSchool.count", query); return 0; },
      findUnique: async (query: Query) => { call("lastSchool.findUnique", query); return schools.find((school) => school.id === query.where.id) ?? null; },
    },
    guardian: {
      create: async (query: Query) => { call("guardian.create", query); return { id: 70n }; },
      update: async (query: Query) => { call("guardian.update", query); return { id: query.where.id }; },
    },
    studentGuardian: {
      count: async (query: Query) => { call("studentGuardian.count", query); return options.sharedGuardian ? 2 : 1; },
      create: async (query: Query) => { call("studentGuardian.create", query); return { id: 80n }; },
      update: async (query: Query) => { call("studentGuardian.update", query); return { id: query.where.id }; },
    },
    admissionApplication: {
      updateMany: async (query: Query) => {
        call("admissionApplication.updateMany", query);
        const row = students.flatMap((entry) => entry.applications).find((entry) => entry.id === query.where.id);
        if (!row || options.concurrentApproval || row.applicationStatus !== query.where.applicationStatus) return { count: 0 };
        Object.assign(row, query.data);
        return { count: 1 };
      },
    },
  };
  const modules: Record<string, unknown> = {
    "server-only": {},
    "next/cache": { revalidatePath: (path: string, type?: string) => paths.push([path, type]) },
    "next/navigation": { redirect: (path: string) => { throw new Error(`redirect:${path}`); } },
    "@/lib/auth": { requireSession: async () => {
      if (!session) throw new Error("redirect:/login");
      if (!session.emailVerified) throw new Error("redirect:/verify-email");
      return session;
    } },
    "@/lib/academic-levels": levels,
    "@/lib/generated/prisma/enums": enums,
    "@/lib/portal/student": { findStudentByEmail: async (email: string, select: Record<string, unknown>) => {
      lookups.push({ email, select });
      const rows = students.filter((row) => utils.normalizeEmail(row.email) === utils.normalizeEmail(email));
      return rows.length === 1 ? structuredClone(rows[0]) : null;
    } },
    "@/lib/utils": utils, "@/lib/validation": validation,
    "./records": records, "./student-fields": fields, "./last-school-identity": schoolIdentity,
    "./last-school-store": {
      LastSchoolSelectionError,
      resolveLastSchool: async (_tx: unknown, input: fields.UpdateStudentRecordInput, selectedId?: string) => {
        schoolProfiles.push(input);
        schoolSelections.push(selectedId);
        const identity = { ...fields.lastSchoolDataFromProfile(input), address: fields.addressDataFromProfile(input, "lastSchool") };
        const matching = schools.find((school) => schoolIdentity.lastSchoolIdentityKey(school) === schoolIdentity.lastSchoolIdentityKey(identity));
        if (selectedId) {
          const selected = schools.find((school) => school.id.toString() === selectedId);
          if (!selected || schoolIdentity.lastSchoolIdentityKey(selected) !== schoolIdentity.lastSchoolIdentityKey(identity)) throw new LastSchoolSelectionError();
          return { id: selected.id };
        }
        return { id: matching?.id ?? 90n };
      },
      runLastSchoolTransaction: async (callback: (tx: typeof transaction) => Promise<unknown>) => {
        const before = structuredClone(students);
        try { return await callback(transaction); } catch (error) { students = before; throw error; }
      },
    },
  };
  const loaded = { exports: {} };
  runInNewContext(source, {
    module: loaded, exports: loaded.exports, Date,
    console: { error: (...args: unknown[]) => errors.push(args) },
    require: (name: string) => { assert.ok(name in modules, `Unexpected dependency: ${name}`); return modules[name]; },
  });
  return { service: loaded.exports as typeof service, calls, lookups, paths, errors, schoolProfiles, schoolSelections,
    snapshot: () => structuredClone(students), account: savedAccount };
}

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const row = student();
  const profile = records.studentProfileFromRecord(row, row.applications[0]);
  for (const field of fields.studentUpdateFields) data.set(field, profile[field] ?? "");
  data.set("applicationId", "5");
  data.set("lastSchoolRecordId", "9");
  for (const [key, value] of Object.entries(overrides)) data.set(key, value);
  return data;
}

test("only the latest admission determines review landing, with deterministic null-last ordering", async () => {
  const h = harness();
  assert.equal(await h.service.studentNeedsAdmissionReview("maria@example.test"), true);
  const query = h.lookups[0].select.applications as { orderBy: unknown; take: number; where?: unknown };
  assert.deepEqual(query.orderBy, records.studentUpdateSelect.applications.orderBy);
  assert.equal(query.take, 1);
  assert.equal(query.where, undefined);
  const old = student();
  old.applications.unshift({ ...old.applications[0], id: 11n, applicationStatus: "approved" });
  assert.equal(await harness({ students: [old] }).service.studentNeedsAdmissionReview(account.email), false);
  assert.equal(await harness({ students: [] }).service.studentNeedsAdmissionReview(account.email), false);
  assert.equal(await harness({ students: [student(), student({ id: 44n, email: "MARIA@example.test" })] }).service.studentNeedsAdmissionReview(account.email), false);
});

test("review details are serializable and bound to the verified student, with current school information", async () => {
  const h = harness();
  const record = await h.service.getStudentAdmissionReview();
  assert.ok(record);
  assert.equal(record.applicationId, "5");
  assert.equal(record.studentNumber, "2026-0004");
  assert.equal(record.profile.email, account.email);
  assert.equal(record.profile.lastSchoolId, "00123");
  assert.equal(record.lastSchoolRecordId, "9");
  assert.equal(record.profile.birthDate, "2008-02-29");
  assert.equal(record.profile.gender, "Female");
  assert.equal(record.branch, "Main");
  assert.equal(record.program, "BSIT");
  assert.equal(record.academicLevel, "First Year");
  assert.equal(record.status, "reviewing");
  assert.doesNotThrow(() => JSON.stringify(record));
  assert.equal(Object.hasOwn(record, "token"), false);
  assert.equal(h.lookups[0].email, account.email);
  assert.equal(h.lookups[0].select.studentNumber, true);
  const noAdmission = harness({ students: [student({ applications: [] })] });
  assert.equal(await noAdmission.service.getStudentAdmissionReview(), null);
});

test("authentication and email verification run before reading or saving any student information", async () => {
  for (const session of [null, { emailVerified: false }, { role: "teacher" as const }, { role: "admin" as const }]) {
    const h = harness({ session });
    const expected = session === null ? /redirect:\/login/ : session.emailVerified === false ? /redirect:\/verify-email/ : /redirect:\/portal/;
    await assert.rejects(h.service.getStudentAdmissionReview(), expected);
    await assert.rejects(h.service.saveStudentAdmissionReview(form()), expected);
    assert.equal(h.lookups.length, 0);
    assert.equal(h.calls.length, 0);
  }
});

test("saving sanitizes personal details without changing account, identity, enrollment, status or photographs", async () => {
  const h = harness();
  const result = await h.service.saveStudentAdmissionReview(form({
    firstName: "<b>maria</b>", suffix: "n/a", phone: "09123456789", guardianFirstName: "ana", addressCity: "manila",
    email: "attacker@example.test", studentId: "44", userId: "45", studentNumber: "hacked", applicationStatus: "approved",
    branchId: "99", programId: "99", academicLevel: "FourthYear", userImage: "https://evil.test/img.png", password: "hacked",
    lastSchoolId: "FORGED", lastSchoolHouseNumber: "FORGED", lastSchoolSubdivision: "FORGED", lastSchoolStreet: "FORGED",
  }));
  assert.equal(result.success, true, result.message);
  const write = h.calls.find((entry) => entry.method === "student.update")!;
  assert.equal(write.query.where.id, 4n);
  assert.equal(write.query.data?.firstName, "Maria");
  assert.equal(write.query.data?.suffix, null);
  for (const forbidden of ["email", "studentNumber", "userImage", "password", "userId", "applicationStatus", "branchId", "programId", "academicLevel"]) {
    assert.equal(Object.hasOwn(write.query.data!, forbidden), false, forbidden);
  }
  assert.deepEqual(h.account, account);
  assert.equal(h.calls.some((entry) => entry.method.startsWith("user.") && entry.method !== "user.findUnique"), false);
  assert.equal(h.schoolProfiles[0].lastSchoolId, "00123");
  assert.equal(h.schoolProfiles[0].lastSchoolHouseNumber, "10");
  assert.equal(h.schoolProfiles[0].lastSchoolSubdivision, "East");
  assert.equal(h.schoolProfiles[0].lastSchoolStreet, "Two");
  const application = h.snapshot()[0].applications[0];
  assert.equal(application.applicationStatus, "reviewing");
  assert.equal(application.branchId, 1n);
  assert.equal(application.programId, 2n);
  assert.ok(h.paths.some(([path, type]) => path === "/portal" && type === "layout"));
  for (const path of ["/portal/admission-review", "/portal/information", "/portal/admission", "/portal/students", "/portal/admission/5/edit", "/portal/students/5", "/portal/students/5/edit"]) {
    assert.ok(h.paths.some(([saved]) => saved === path), path);
  }
});

test("missing and malformed expected application IDs cannot select or update a student", async () => {
  for (const applicationId of ["", "44", "05", "-5", "9223372036854775808", "5 or 1=1"]) {
    const h = harness(), data = form({ applicationId });
    const result = await h.service.saveStudentAdmissionReview(data);
    assert.equal(result.success, false, applicationId);
    assert.equal(h.calls.some((entry) => entry.method.endsWith(".update") || entry.method.endsWith(".updateMany") || entry.method.endsWith(".create")), false);
    assert.equal(h.paths.length, 0);
  }
});

test("review saves do not depend on the optional photo column in an older database", async () => {
  const h = harness({ photoColumnMissing: true }), before = h.snapshot()[0];
  const result = await h.service.saveStudentAdmissionReview(form({ firstName: " <b>lina</b> ", suffix: "n/a" }));
  assert.equal(result.success, true, result.message);
  const saved = h.snapshot()[0];
  assert.equal(saved.firstName, "Lina");
  assert.equal(saved.suffix, null);
  assert.equal(saved.studentNumber, before.studentNumber);
  assert.equal(saved.email, before.email);
  assert.deepEqual(saved.applications, before.applications);
  assert.deepEqual(h.account, account);
  const write = h.calls.find((entry) => entry.method === "student.update")!;
  assert.deepEqual(write.query.select, { id: true });
  assert.equal(Object.hasOwn(write.query.data!, "userImage"), false);
  for (const lookup of h.calls.filter((entry) => entry.method === "student.findMany")) {
    assert.equal(Object.hasOwn(lookup.query.select!, "userImage"), false);
  }
  assert.equal(h.errors.length, 0);
  assert.ok(h.paths.some(([path]) => path === "/portal/admission-review"));
});

test("current session account and unique student identity are rechecked inside the save transaction", async () => {
  for (const savedAccount of [null, { email: "changed@example.test" }, { role: "teacher" as const }, { emailVerified: false }, { sessionVersion: 4 }]) {
    const h = harness({ savedAccount });
    assert.equal((await h.service.saveStudentAdmissionReview(form())).success, false);
    assert.equal(h.calls.some((entry) => entry.method.endsWith(".update") || entry.method.endsWith(".create")), false);
  }
  for (const students of [[], [student(), student({ id: 44n, email: "MARIA@EXAMPLE.TEST" })]]) {
    const h = harness({ students });
    assert.equal((await h.service.saveStudentAdmissionReview(form())).success, false);
    const lookup = h.calls.find((entry) => entry.method === "student.findMany")!;
    assert.equal(lookup.query.take, 2);
    assert.equal(h.calls.some((entry) => entry.method.endsWith(".update") || entry.method.endsWith(".create")), false);
  }
  const email = "m%_aria@example.test";
  const h = harness({ session: { email }, savedAccount: { email }, students: [student({ email })] });
  assert.equal((await h.service.saveStudentAdmissionReview(form())).success, true);
  const lookup = h.calls.find((entry) => entry.method === "student.findMany")!;
  assert.deepEqual(lookup.query.where.email, { equals: "m\\%\\_aria@example.test", mode: "insensitive" });
});

test("approved, draft, rejected, or missing latest admissions cannot be edited from a stale review page", async () => {
  for (const status of ["approved", "draft", "rejected"] as const) {
    const row = student(); row.applications[0].applicationStatus = status;
    const h = harness({ students: [row] });
    assert.equal(await h.service.getStudentAdmissionReview(), null);
    assert.equal((await h.service.saveStudentAdmissionReview(form())).success, false);
    assert.equal(h.calls.some((entry) => entry.method.endsWith(".update") || entry.method.endsWith(".create")), false);
  }
});

test("required fields, enums, phone numbers, leap dates, school years and optional graduation dates are validated before writes", async () => {
  for (const [field, value] of [
    ["firstName", ""], ["lastName", ""], ["addressCity", ""], ["guardianFirstName", ""], ["lastSchoolName", ""],
    ["birthDate", "2009-02-29"], ["gender", "other-invalid"], ["civilStatus", "other-invalid"],
    ["phone", "abc"], ["guardianContactNumber", "12"], ["lastSchoolType", "invalid"],
    ["lastSchoolYear", "2025-2028"], ["lastSchoolGraduationDate", "2026-02-30"],
  ]) {
    const h = harness();
    const result = await h.service.saveStudentAdmissionReview(form({ lastSchoolRecordId: "", [field]: value }));
    assert.equal(result.success, false, field);
    assert.ok(result.fieldErrors?.[field as fields.StudentUpdateField], field);
    assert.equal(h.calls.some((entry) => entry.method.endsWith(".update") || entry.method.endsWith(".create")), false);
  }
});

test("a selected school's current database identity replaces every submitted school field before validation", async () => {
  const current = student().applications[0].lastSchool!;
  const selected: School = {
    ...current, id: 19n, schoolName: "North Technical School", schoolId: "00019", shortName: "NTS", schoolType: "Private",
    address: { houseNumber: "81", subdivision: "Green", street: "Three", barangay: "North", city: "Quezon City", province: "Metro Manila", postalCode: "1100" },
  };
  const h = harness({ schools: [{ ...current, id: 9n }, selected] });
  const forged = Object.fromEntries(fields.studentUpdateFields.filter((field) => field.startsWith("lastSchool") &&
    !["lastSchoolYear", "lastSchoolYearLevel", "lastSchoolGraduationDate"].includes(field)).map((field) => [field, ""]));
  const result = await h.service.saveStudentAdmissionReview(form({ ...forged, lastSchoolRecordId: "19", lastSchoolName: "Forged school", lastSchoolType: "invalid" }));
  assert.equal(result.success, true, result.message);
  assert.equal(h.schoolProfiles[0].lastSchoolName, selected.schoolName);
  assert.equal(h.schoolProfiles[0].lastSchoolId, "00019");
  assert.equal(h.schoolProfiles[0].lastSchoolShortName, "NTS");
  assert.equal(h.schoolProfiles[0].lastSchoolType, "Private");
  assert.equal(h.schoolProfiles[0].lastSchoolHouseNumber, "81");
  assert.equal(h.schoolProfiles[0].lastSchoolSubdivision, "Green");
  assert.equal(h.schoolProfiles[0].lastSchoolStreet, "Three");
  assert.equal(h.schoolProfiles[0].lastSchoolBarangay, "North");
  assert.equal(h.schoolProfiles[0].lastSchoolCity, "Quezon City");
  assert.equal(h.schoolProfiles[0].lastSchoolProvince, "Metro Manila");
  assert.equal(h.schoolProfiles[0].lastSchoolPostalCode, "1100");
  assert.deepEqual(h.schoolSelections, ["19"]);
  assert.equal(h.snapshot()[0].applications[0].lastSchoolId, 19n);
  const lookup = h.calls.find((entry) => entry.method === "lastSchool.findUnique")!;
  assert.deepEqual(lookup.query.where, { id: 19n });
  assert.deepEqual(lookup.query.select, records.studentUpdateSelect.applications.select.lastSchool.select);
  assert.equal(h.calls.some((entry) => entry.method === "lastSchool.update"), false);
});

test("malformed, unknown, deleted and incomplete saved schools fail on the school picker before writes", async () => {
  for (const lastSchoolRecordId of ["09", "-9", "0", "9 ", "9223372036854775808", "999", "9 or 1=1"]) {
    const h = harness();
    const result = await h.service.saveStudentAdmissionReview(form({ lastSchoolRecordId }));
    assert.equal(result.success, false, lastSchoolRecordId);
    assert.ok(result.fieldErrors?.lastSchoolName, lastSchoolRecordId);
    assert.equal(h.calls.some((entry) => entry.method.endsWith(".update") || entry.method.endsWith(".updateMany") || entry.method.endsWith(".create")), false);
    assert.equal(h.paths.length, 0);
    assert.equal(h.errors.length, 0);
  }
  const current = { ...student().applications[0].lastSchool!, id: 9n };
  for (const schools of [[], [{ ...current, schoolName: "" }], [{ ...current, address: null }], [{ ...current, address: { ...current.address!, city: "" } }]]) {
    const h = harness({ schools });
    const result = await h.service.saveStudentAdmissionReview(form());
    assert.equal(result.success, false);
    assert.ok(result.fieldErrors?.lastSchoolName);
    assert.equal(h.calls.some((entry) => entry.method.endsWith(".update") || entry.method.endsWith(".create")), false);
    assert.equal(h.schoolProfiles.length, 0);
  }
  const h = harness(), malformed = form();
  malformed.set("lastSchoolRecordId", new File(["9"], "forged.txt"));
  assert.ok((await h.service.saveStudentAdmissionReview(malformed)).fieldErrors?.lastSchoolName);
});

test("Other school sanitizes details and reuses its complete identity without stale hidden values from the old school", async () => {
  const current = { ...student().applications[0].lastSchool!, id: 9n };
  const other: School = {
    verificationStatus: "pending",
    id: 29n, schoolName: "New Academy", schoolId: null, shortName: "NA", schoolType: "Private",
    address: { houseNumber: null, subdivision: null, street: "Garden", barangay: "South", city: "Pasig", province: "Metro Manila", postalCode: "1600" },
  };
  const h = harness({ schools: [current, other] });
  const result = await h.service.saveStudentAdmissionReview(form({
    lastSchoolRecordId: "", lastSchoolName: " <b>new academy</b> ", lastSchoolShortName: "na", lastSchoolType: "Private",
    lastSchoolId: "00123", lastSchoolHouseNumber: "10", lastSchoolSubdivision: "East", lastSchoolStreet: "garden",
    lastSchoolBarangay: "south", lastSchoolCity: "pasig", lastSchoolProvince: "metro manila", lastSchoolPostalCode: "1600",
  }));
  assert.equal(result.success, true, result.message);
  assert.equal(h.schoolProfiles[0].lastSchoolName, "New Academy");
  assert.equal(h.schoolProfiles[0].lastSchoolId, "");
  assert.equal(h.schoolProfiles[0].lastSchoolHouseNumber, "");
  assert.equal(h.schoolProfiles[0].lastSchoolSubdivision, "");
  assert.equal(h.schoolProfiles[0].lastSchoolStreet, "Garden");
  assert.equal(h.snapshot()[0].applications[0].lastSchoolId, 29n);
  assert.deepEqual(h.schoolSelections, [""]);
  assert.equal(h.calls.some((entry) => entry.method === "lastSchool.findUnique"), false);
});

test("incomplete legacy school details use Other instead of preselecting an unusable saved school", async () => {
  const row = student();
  row.applications[0].lastSchool!.address = null;
  const record = await harness({ students: [row] }).service.getStudentAdmissionReview();
  assert.ok(record);
  assert.equal(record.lastSchoolRecordId, undefined);
  assert.equal(record.profile.lastSchoolName, "Central High School");
});

test("a student's pending or rejected school is prefilled as an editable suggestion instead of a verified selection", async () => {
  for (const verificationStatus of ["pending", "rejected"] as const) {
    const row = student();
    row.applications[0].lastSchool!.verificationStatus = verificationStatus;
    const h = harness({ students: [row] });
    const record = await h.service.getStudentAdmissionReview();
    assert.ok(record);
    assert.equal(record.lastSchoolRecordId, undefined);
    assert.equal(record.profile.lastSchoolName, "Central High School");
    assert.equal(record.profile.lastSchoolCity, "Manila");
  }
});

test("forged pending or rejected school selections fail before student or related records are changed", async () => {
  for (const verificationStatus of ["pending", "rejected"] as const) {
    const school = { ...student().applications[0].lastSchool!, id: 9n, verificationStatus };
    const h = harness({ schools: [school] });
    const result = await h.service.saveStudentAdmissionReview(form());
    assert.equal(result.success, false, verificationStatus);
    assert.ok(result.fieldErrors?.lastSchoolName);
    assert.equal(h.calls.some((entry) => entry.method.endsWith(".update") || entry.method.endsWith(".updateMany") || entry.method.endsWith(".create")), false);
    assert.equal(h.schoolProfiles.length, 0);
    assert.equal(h.paths.length, 0);
  }
});

test("shared home addresses and guardians are copied before applying student corrections", async () => {
  const h = harness({ sharedAddress: true, sharedGuardian: true });
  assert.equal((await h.service.saveStudentAdmissionReview(form({ addressCity: "Quezon City", guardianFirstName: "Rosa" }))).success, true);
  assert.equal(h.calls.some((entry) => entry.method === "address.update"), false);
  assert.equal(h.calls.some((entry) => entry.method === "guardian.update"), false);
  assert.equal(h.calls.find((entry) => entry.method === "address.create")!.query.data?.city, "Quezon City");
  assert.equal(h.calls.find((entry) => entry.method === "guardian.create")!.query.data?.firstName, "Rosa");
  assert.equal(h.calls.find((entry) => entry.method === "studentGuardian.update")!.query.data?.guardianId, 70n);
  assert.equal(h.calls.find((entry) => entry.method === "student.update")!.query.data?.addressId, 60n);
  assert.equal(h.schoolProfiles.length, 1, "Previous schools use the shared immutable resolver");
});

test("a concurrent admission approval or failed profile save rolls back every write and does not invalidate caches", async () => {
  for (const options of [{ concurrentApproval: true }, { failStudentWrite: true }]) {
    const h = harness(options), before = h.snapshot();
    const result = await h.service.saveStudentAdmissionReview(form({ firstName: "Updated" }));
    assert.equal(result.success, false);
    assert.deepEqual(h.snapshot(), before);
    assert.equal(h.paths.length, 0);
    const guard = h.calls.find((entry) => entry.method === "admissionApplication.updateMany")!;
    assert.deepEqual(guard.query.where, { id: 5n, studentId: 4n, applicationStatus: "reviewing" });
    assert.equal(Object.hasOwn(guard.query.data!, "applicationStatus"), false);
  }
});

test("unexpected review write errors log only the stage and safe database codes", async () => {
  const privateEmail = "private-student@example.test", privatePassword = "password=Secret-123";
  for (const diagnostic of [
    { code: "P2002", meta: { code: "23505" }, expectedCode: "P2002", expectedDatabaseCode: "23505" },
    { code: privateEmail, meta: { code: privatePassword }, expectedCode: "UNKNOWN", expectedDatabaseCode: "UNKNOWN" },
  ]) {
    const studentWriteError = Object.assign(new Error(`Write failed for ${privateEmail}; ${privatePassword}`), diagnostic);
    const h = harness({ studentWriteError }), before = h.snapshot();
    const result = await h.service.saveStudentAdmissionReview(form({ firstName: "Updated" }));
    assert.equal(result.success, false);
    assert.equal(result.message, "We could not save your information right now. Please try again.");
    assert.deepEqual(h.snapshot(), before);
    assert.equal(h.paths.length, 0);
    assert.deepEqual(structuredClone(h.errors), [["Failed to save the signed-in student's admission review.", {
      stage: "save-student", code: diagnostic.expectedCode, databaseCode: diagnostic.expectedDatabaseCode,
    }]]);
    const serialized = JSON.stringify(h.errors);
    assert.equal(serialized.includes(privateEmail), false);
    assert.equal(serialized.includes(privatePassword), false);
    assert.equal(serialized.includes("Write failed"), false);
  }
});
