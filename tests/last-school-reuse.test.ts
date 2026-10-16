import { nonPhotoServiceModules } from "./profile-image-harness";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as XLSX from "xlsx";

import { Prisma } from "../lib/generated/prisma/client";
import * as enums from "../lib/generated/prisma/enums";
import * as utils from "../lib/utils";
import * as validation from "../lib/validation";
import * as academicLevels from "../lib/academic-levels";
import * as constants from "../lib/admission/constants";
import * as studentFields from "../lib/admission/student-fields";
import * as records from "../lib/admission/records";
import * as schoolIdentity from "../lib/admission/last-school-identity";
import type * as schoolStore from "../lib/admission/last-school-store";
import type * as submissionStore from "../lib/admission/submission-store";
import type * as adminService from "../lib/admission/admin";

type Row = Record<string, unknown> & { id: bigint };
type Query = { where?: Record<string, unknown>; data?: Record<string, unknown>; select?: unknown };
type RawQuery = { values: unknown[]; sql: string };

const sources = Object.fromEntries(["last-school-store", "submission-store", "admin"].map((name) => [name,
  ts.transpileModule(readFileSync(new URL(`../lib/admission/${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText,
]));

function profile(overrides: Partial<studentFields.UpdateStudentRecordInput> = {}): studentFields.UpdateStudentRecordInput {
  return {
    ...Object.fromEntries(studentFields.studentUpdateFields.map((field) => [field, ""])),
    firstName: "Maria", lastName: "Santos", birthDate: "2008-02-29", gender: "Female", civilStatus: "Single",
    citizenship: "Filipino", birthplace: "Manila", email: "maria@example.test", phone: "09171234567",
    addressBarangay: "Central", addressCity: "Manila", addressProvince: "Metro Manila",
    guardianFirstName: "Ana", guardianLastName: "Santos", guardianRelationship: "Mother", guardianContactNumber: "09171234567",
    lastSchoolName: "Central School", lastSchoolShortName: "CSHS", lastSchoolId: "00123", lastSchoolType: "Public",
    lastSchoolHouseNumber: "12B", lastSchoolSubdivision: "East Village", lastSchoolStreet: "Main Road",
    lastSchoolBarangay: "Central", lastSchoolCity: "Quezon City", lastSchoolProvince: "Metro Manila", lastSchoolPostalCode: "0100",
    lastSchoolYear: "2025-2026", lastSchoolYearLevel: "Grade 12", ...overrides,
  } as studentFields.UpdateStudentRecordInput;
}

function harness(options: { commitConflicts?: number; failure?: Error } = {}) {
  const tables = {
    address: new Map<bigint, Row>(), lastSchool: new Map<bigint, Row>(), student: new Map<bigint, Row>(),
    guardian: new Map<bigint, Row>(), studentGuardian: new Map<bigint, Row>(), admissionApplication: new Map<bigint, Row>(),
  };
  let nextId = 100n;
  let remainingConflicts = options.commitConflicts ?? 0;
  const calls: string[] = [];
  const rawQueries: RawQuery[] = [];
  const transactionOptions: Array<{ isolationLevel: string }> = [];

  function matches(row: Row, where: Query["where"]) {
    return Object.entries(where ?? {}).every(([field, expected]) => row[field] === expected);
  }
  const delegates = Object.fromEntries(Object.entries(tables).map(([name, table]) => [name, {
    create: async (query: Query) => {
      calls.push(`${name}.create`);
      const row = { ...structuredClone(query.data), id: nextId++ } as Row;
      table.set(row.id, row);
      return structuredClone(row);
    },
    update: async (query: Query) => {
      calls.push(`${name}.update`);
      const row = [...table.values()].find((candidate) => matches(candidate, query.where));
      assert.ok(row, `${name}.update must target a saved record`);
      Object.assign(row, structuredClone(query.data));
      return structuredClone(row);
    },
    count: async (query: Query) => [...table.values()].filter((row) => matches(row, query.where)).length,
    findFirst: async (query: Query) => structuredClone([...table.values()].find((row) => matches(row, query.where)) ?? null),
    findUnique: async (query: Query) => {
      const row = table.get(query.where?.id as bigint);
      if (!row) return null;
      return structuredClone(name === "lastSchool" ? { ...row, address: tables.address.get(row.addressId as bigint) ?? null } : row);
    },
  }]));

  // Model the normalized filters at the database boundary, independently of the product identity helper.
  function databaseComparisonValues(row: Row) {
    const address = tables.address.get(row.addressId as bigint);
    const fields: Array<[unknown, boolean]> = [
      [row.schoolName, false], [row.schoolId, true], [row.shortName, false], [row.schoolType, true],
      [address?.houseNumber, true], [address?.subdivision, false], [address?.street, false], [address?.barangay, false],
      [address?.city, false], [address?.province, false], [address?.postalCode, true],
    ];
    return fields.map(([value, preserveCase]) => {
      const text = String(value ?? "").replace(/\s+/gu, " ").trim();
      return preserveCase ? text : text.toLowerCase();
    });
  }
  Object.assign(delegates, {
    user: { findMany: async () => [], findFirst: async () => null },
    branch: { findUnique: async () => ({ id: 1n, slug: "main", title: "Main Campus" }) },
    program: { findUnique: async () => ({ id: 2n, code: "BSIT", label: "Information Technology", programType: "Bachelor" }) },
    branchProgram: { findUnique: async () => ({ program: { programType: "Bachelor" } }) },
    $queryRaw: async (query: RawQuery) => {
      rawQueries.push(query);
      assert.equal(query.values.length, 11);
      assert.match(query.sql, /LEFT JOIN "addresses"/);
      const needsAddress = query.sql.includes('school."address_id" IS NOT NULL');
      const statusPriority = (row: Row) => row.verificationStatus === "verified" ? 0 : row.verificationStatus === "pending" ? 1 : 2;
      const row = [...tables.lastSchool.values()].sort((left, right) => statusPriority(left) - statusPriority(right) || Number(left.id - right.id)).find((candidate) =>
        (needsAddress ? tables.address.has(candidate.addressId as bigint) : candidate.addressId === null) &&
        databaseComparisonValues(candidate).every((value, index) => value === query.values[index]));
      return row ? [{ id: row.id, verificationStatus: row.verificationStatus }] : [];
    },
  });
  const database = {
    ...delegates,
    $transaction: async (callback: (tx: typeof delegates) => Promise<unknown>, settings: { isolationLevel: string }) => {
      transactionOptions.push(settings);
      const before = Object.fromEntries(Object.entries(tables).map(([name, table]) => [name, structuredClone([...table])])) as Record<string, [bigint, Row][]>;
      try {
        const result = await callback(delegates);
        if (options.failure) throw options.failure;
        if (remainingConflicts-- > 0) throw new Prisma.PrismaClientKnownRequestError("Concurrent admission", { code: "P2034", clientVersion: "test" });
        return result;
      } catch (error) {
        for (const [name, table] of Object.entries(tables)) {
          table.clear();
          for (const [id, row] of before[name]) table.set(id, row);
        }
        throw error;
      }
    },
  };
  const modules: Record<string, unknown> = {
    ...nonPhotoServiceModules(),
    "@/lib/generated/prisma/client": { Prisma }, "@/lib/generated/prisma/enums": enums,
    "@/lib/prisma": { prisma: database }, "@/lib/utils": utils, "@/lib/validation": validation,
    "@/lib/academic-levels": academicLevels, "./student-fields": studentFields,
    "./last-school-identity": schoolIdentity, "./constants": constants, "./records": records,
    "next/cache": { revalidatePath: () => undefined }, "xlsx": XLSX,
    "@/lib/auth": { requireAdmin: async () => undefined },
  };
  function load(name: string) {
    const loaded = { exports: {} };
    runInNewContext(sources[name], {
      module: loaded, exports: loaded.exports, Date, console,
      require: (dependency: string) => {
        assert.ok(dependency in modules, `Unexpected previous-school dependency: ${dependency}`);
        return modules[dependency];
      },
    });
    return loaded.exports;
  }
  const store = load("last-school-store") as typeof schoolStore;
  modules["./last-school-store"] = store;
  return {
    tables, delegates, calls, rawQueries, transactionOptions, store,
    submissions: load("submission-store") as typeof submissionStore,
    admin: load("admin") as typeof adminService,
    seedSchool(input = profile(), id = 71n, verificationStatus: "pending" | "verified" | "rejected" = "verified") {
      tables.address.set(id, { ...studentFields.addressDataFromProfile(input, "lastSchool"), id });
      tables.lastSchool.set(id, { ...studentFields.lastSchoolDataFromProfile(input), addressId: id, id, verificationStatus, reviewedAt: verificationStatus === "pending" ? null : new Date("2026-01-01") });
      return id;
    },
  };
}

function submission(input: studentFields.UpdateStudentRecordInput, selectedId?: string): submissionStore.SaveAdmissionSubmissionInput {
  const fields = Object.fromEntries(Object.entries(studentFields.studentSubmissionFields).map(([field, key]) => [key, String(input[field as studentFields.StudentUpdateField] ?? "")]));
  return {
    submissionId: "12345678", submittedAt: new Date("2026-10-14T00:00:00Z"),
    form: { ...fields, applicant_type: "New Student", last_school_record_id: selectedId ?? "" },
    programSelection: {
      branchId: 1n, branchCode: "main", branchTitle: "Main Campus", programId: 2n, programCode: "BSIT",
      programLabel: "Information Technology", programType: "Bachelor", academicLevel: "FirstYear", academicLevelLabel: "First Year",
    },
  };
}

test("two applicants selecting one school share its record while their academic histories stay separate", async () => {
  const service = harness();
  service.seedSchool();
  await service.submissions.saveAdmissionSubmission(submission(profile(), "71"));
  await service.submissions.saveAdmissionSubmission(submission(profile({ firstName: "Jose", email: "jose@example.test", lastSchoolYear: "2024-2025", lastSchoolYearLevel: "Grade 11" }), "71"));
  assert.equal(service.tables.lastSchool.size, 1);
  assert.equal(service.tables.address.size, 3, "Only each student's own address should be added");
  const applications = [...service.tables.admissionApplication.values()];
  assert.equal(applications.length, 2);
  assert.deepEqual(applications.map((row) => row.lastSchoolId), [71n, 71n]);
  assert.deepEqual(applications.map((row) => row.LSSchoolYearEnd), ["2025-2026", "2024-2025"]);
  assert.deepEqual(applications.map((row) => row.LSAttainedLevelText), ["Grade 12", "Grade 11"]);
  assert.equal(service.rawQueries.length, 0);
  assert.equal(service.calls.includes("lastSchool.create"), false);
});

test("Other school reuses existing records despite human-text case and whitespace differences", async () => {
  const service = harness();
  service.seedSchool();
  Object.assign(service.tables.lastSchool.get(71n)!, { schoolName: "  CENTRAL\tSchool ", shortName: "cshs" });
  Object.assign(service.tables.address.get(71n)!, { street: "MAIN  road", subdivision: "east\tvillage", city: "QUEZON city" });
  const before = structuredClone([...service.tables.lastSchool]);
  await service.submissions.saveAdmissionSubmission(submission(profile({ lastSchoolName: " <b>central</b> school " })));
  assert.equal(service.tables.lastSchool.size, 1);
  assert.equal(service.tables.address.size, 2);
  assert.equal([...service.tables.admissionApplication.values()][0].lastSchoolId, 71n);
  assert.deepEqual([...service.tables.lastSchool], before);
  assert.deepEqual(service.rawQueries[0].values, ["central school", "00123", "cshs", "Public", "12B", "east village", "main road", "central", "quezon city", "metro manila", "0100"]);
});

test("a genuinely new Other school is inserted once and reused by the next application", async () => {
  const service = harness();
  await service.submissions.saveAdmissionSubmission(submission(profile()));
  const schoolId = [...service.tables.lastSchool.keys()][0];
  await service.submissions.saveAdmissionSubmission(submission(profile({ firstName: "Jose", email: "jose@example.test" })));
  assert.equal(service.tables.lastSchool.size, 1);
  assert.equal(service.tables.address.size, 3);
  assert.deepEqual([...service.tables.admissionApplication.values()].map((row) => row.lastSchoolId), [schoolId, schoolId]);
  assert.equal(service.calls.filter((name) => name === "lastSchool.create").length, 1);
  assert.equal(service.tables.lastSchool.get(schoolId)!.verificationStatus, "pending", "A student's school suggestion must await administrator verification");
});

test("pending and rejected school IDs cannot be selected even with an exact matching identity", async () => {
  for (const status of ["pending", "rejected"] as const) {
    const service = harness();
    service.seedSchool(profile(), 71n, status);
    await assert.rejects(service.store.resolveLastSchool(service.delegates as unknown as Prisma.TransactionClient, profile(), "71"), { name: "LastSchoolSelectionError" });
    assert.equal(service.calls.length, 0);
    assert.equal(service.tables.lastSchool.get(71n)!.verificationStatus, status);
  }
});

test("manual exact matches prefer a verified school without promoting or modifying pending duplicates", async () => {
  const service = harness();
  service.seedSchool(profile(), 71n, "pending");
  service.seedSchool(profile(), 72n, "verified");
  service.seedSchool(profile(), 70n, "rejected");
  const result = await service.store.resolveLastSchool(service.delegates as unknown as Prisma.TransactionClient, profile());
  assert.equal(result.id, 72n);
  assert.equal(service.tables.lastSchool.get(71n)!.verificationStatus, "pending");
  assert.equal(service.tables.lastSchool.get(70n)!.verificationStatus, "rejected");
  assert.match(service.rawQueries[0].sql, /ORDER BY CASE school\."verification_status"/);
  assert.equal(service.calls.length, 0);
});

test("manual resubmission of an exact rejected school requests review again without verifying it", async () => {
  const service = harness();
  service.seedSchool(profile(), 71n, "rejected");
  const result = await service.store.resolveLastSchool(service.delegates as unknown as Prisma.TransactionClient, profile());
  assert.equal(result.id, 71n);
  assert.equal(service.tables.lastSchool.size, 1);
  assert.equal(service.tables.lastSchool.get(71n)!.verificationStatus, "pending");
  assert.equal(service.tables.lastSchool.get(71n)!.reviewedAt, null);
  assert.deepEqual(service.calls, ["lastSchool.update"]);
});

test("Admissions partial school records reuse exact identities without creating empty addresses", async () => {
  const service = harness();
  const incomplete = {
    ...Object.fromEntries(studentFields.studentUpdateFields.map((field) => [field, ""])),
    lastSchoolName: " partial school ", lastSchoolType: "Other",
  } as studentFields.UpdateStudentRecordInput;
  const tx = service.delegates as unknown as Prisma.TransactionClient;
  await assert.rejects(service.store.resolveLastSchool(tx, incomplete), { name: "LastSchoolSelectionError" });
  const first = await service.store.resolveLastSchool(tx, incomplete, undefined, { allowIncomplete: true });
  const second = await service.store.resolveLastSchool(tx, { ...incomplete, lastSchoolName: "PARTIAL SCHOOL" }, undefined, { allowIncomplete: true });
  assert.equal(first.id, second.id);
  assert.equal(service.tables.address.size, 0);
  assert.equal(service.tables.lastSchool.size, 1);
  assert.equal(service.tables.lastSchool.get(first.id)!.schoolName, "Partial School");
  assert.equal(service.tables.lastSchool.get(first.id)!.addressId, null);
  await assert.rejects(service.store.resolveLastSchool(tx, incomplete, first.id.toString()), { name: "LastSchoolSelectionError" });

  const partialAddress = { ...incomplete, lastSchoolName: "", lastSchoolCity: " makati " };
  const partial = await service.store.resolveLastSchool(tx, partialAddress, undefined, { allowIncomplete: true });
  assert.equal(service.tables.address.size, 1);
  assert.equal(service.tables.lastSchool.get(partial.id)!.schoolName, "");
  const address = service.tables.address.get(service.tables.lastSchool.get(partial.id)!.addressId as bigint)!;
  assert.equal(address.city, "Makati"); assert.equal(address.barangay, ""); assert.equal(address.province, "");
});

test("Admissions saves partial previous-school information with an honest blank name and default Other type", async () => {
  const service = harness();
  service.tables.student.set(4n, { id: 4n, firstName: "Maria", lastName: "Santos", birthDate: new Date("2008-02-29"), email: "maria@example.test", addressId: null, guardians: [] });
  service.tables.admissionApplication.set(5n, { id: 5n, studentId: 4n, applicantType: "new", branchId: 1n, programId: 2n, academicLevel: "FirstYear" });
  const data = new FormData(); data.set("studentId", "4"); data.set("applicationId", "5"); data.set("lastSchoolCity", " makati ");
  const result = await service.admin.editAdmittedStudentAction({ success: false, message: "" }, data);
  assert.equal(result.success, true, result.message);
  assert.equal(service.tables.lastSchool.size, 1);
  const school = [...service.tables.lastSchool.values()][0];
  assert.equal(school.schoolName, ""); assert.equal(school.schoolType, "Other");
  assert.equal(service.tables.address.size, 1);
  assert.equal(service.tables.address.get(school.addressId as bigint)!.city, "Makati");
  assert.equal(service.tables.student.get(4n)!.addressId, null);
  assert.equal(service.tables.guardian.size, 0);
});

test("blank Admissions related sections preserve existing links and never mutate shared records", async () => {
  const service = harness(); service.seedSchool();
  service.tables.student.set(4n, { id: 4n, firstName: "Maria", lastName: "Santos", birthDate: new Date("2008-02-29"), email: "maria@example.test", addressId: 71n, guardians: [{ id: 72n, guardianId: 73n }] });
  service.tables.guardian.set(73n, { id: 73n, firstName: "Ana", lastName: "Santos", contactNumber: "09171234567" });
  service.tables.studentGuardian.set(72n, { id: 72n, studentId: 4n, guardianId: 73n, relationship: "Mother" });
  service.tables.admissionApplication.set(5n, { id: 5n, studentId: 4n, applicantType: "new", branchId: 1n, programId: 2n, academicLevel: "FirstYear", lastSchoolId: 71n });
  const before = structuredClone([service.tables.address, service.tables.guardian, service.tables.studentGuardian, service.tables.lastSchool]);
  const data = new FormData(); data.set("studentId", "4"); data.set("applicationId", "5"); data.set("religion", " catholic ");
  assert.equal((await service.admin.editAdmittedStudentAction({ success: false, message: "" }, data)).success, true);
  assert.deepEqual([service.tables.address, service.tables.guardian, service.tables.studentGuardian, service.tables.lastSchool], before);
  assert.equal(service.tables.student.get(4n)!.addressId, 71n);
  assert.equal(service.tables.admissionApplication.get(5n)!.lastSchoolId, 71n);
});

test("same-named campuses with different locations and structured IDs remain distinct", async () => {
  const service = harness();
  service.seedSchool();
  for (const overrides of [{ lastSchoolCity: "Makati" }, { lastSchoolId: "00124" }, { lastSchoolHouseNumber: "12b" }, { lastSchoolPostalCode: "100" }]) {
    await service.submissions.saveAdmissionSubmission(submission(profile(overrides)));
  }
  assert.equal(service.tables.lastSchool.size, 5);
  assert.equal(new Set([...service.tables.admissionApplication.values()].map((row) => row.lastSchoolId)).size, 4);
});

test("unknown, malformed, changed or incomplete selected schools are rejected without writing records", async () => {
  const service = harness();
  service.seedSchool();
  for (const selectedId of ["0", "-1", "1.1", "9223372036854775808", "missing", "72"]) {
    await assert.rejects(service.store.resolveLastSchool(service.delegates as unknown as Prisma.TransactionClient, profile(), selectedId), { name: "LastSchoolSelectionError" });
  }
  await assert.rejects(service.store.resolveLastSchool(service.delegates as unknown as Prisma.TransactionClient, profile({ lastSchoolCity: "Makati" }), "71"), { name: "LastSchoolSelectionError" });
  service.tables.address.delete(71n);
  await assert.rejects(service.store.resolveLastSchool(service.delegates as unknown as Prisma.TransactionClient, profile(), "71"), { name: "LastSchoolSelectionError" });
  assert.equal(service.tables.lastSchool.size, 1);
  assert.equal(service.calls.length, 0);
});

test("editing one applicant's shared school details creates a new school without changing another applicant", async () => {
  const service = harness();
  service.seedSchool();
  for (const id of [7n, 8n]) {
    service.tables.student.set(id, { id, email: `student${id}@example.test`, addressId: null, guardians: [] });
    service.tables.admissionApplication.set(id, { id, studentId: id, lastSchoolId: 71n });
  }
  const originalSchool = structuredClone(service.tables.lastSchool.get(71n));
  const originalAddress = structuredClone(service.tables.address.get(71n));
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...profile({ lastSchoolCity: "Makati" }), studentId: "7", applicationId: "7", studentNumber: "S0007", applicantType: "new", branchId: "1", programId: "2", academicLevel: "FirstYear" })) {
    if (typeof value === "string") data.set(key, value);
  }
  assert.equal((await service.admin.editAdmittedStudentAction({ success: false, message: "" }, data)).success, true);
  assert.equal(service.tables.lastSchool.size, 2);
  assert.deepEqual(service.tables.lastSchool.get(71n), originalSchool);
  assert.deepEqual(service.tables.address.get(71n), originalAddress);
  assert.equal(service.tables.admissionApplication.get(8n)?.lastSchoolId, 71n);
  assert.notEqual(service.tables.admissionApplication.get(7n)?.lastSchoolId, 71n);
  assert.equal(service.calls.includes("lastSchool.update"), false);
});

test("school names remain SQL parameters and cannot broaden the school match", async () => {
  const service = harness();
  service.seedSchool();
  const unusualName = "School ' OR 1=1 --";
  await service.submissions.saveAdmissionSubmission(submission(profile({ lastSchoolName: unusualName })));
  assert.equal(service.tables.lastSchool.size, 2);
  assert.equal(service.rawQueries[0].sql.includes(unusualName), false);
  assert.ok(service.rawQueries[0].values.includes(unusualName.toLowerCase()));
  assert.notEqual([...service.tables.admissionApplication.values()][0].lastSchoolId, 71n);
});

test("a student's legacy address shared with a school is copied before editing the student's address", async () => {
  const service = harness();
  service.seedSchool();
  service.tables.student.set(7n, { id: 7n, email: "maria@example.test", addressId: 71n, guardians: [] });
  service.tables.admissionApplication.set(7n, { id: 7n, studentId: 7n, lastSchoolId: 71n });
  const originalSchoolAddress = structuredClone(service.tables.address.get(71n));
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...profile(), studentId: "7", applicationId: "7", studentNumber: "S0007", applicantType: "new", branchId: "1", programId: "2", academicLevel: "FirstYear" })) {
    if (typeof value === "string") data.set(key, value);
  }
  assert.equal((await service.admin.editAdmittedStudentAction({ success: false, message: "" }, data)).success, true);
  assert.deepEqual(service.tables.address.get(71n), originalSchoolAddress);
  assert.equal(service.tables.lastSchool.size, 1);
  assert.equal(service.tables.admissionApplication.get(7n)?.lastSchoolId, 71n);
  assert.notEqual(service.tables.student.get(7n)?.addressId, 71n);
  assert.equal(service.tables.address.get(service.tables.student.get(7n)?.addressId as bigint)?.city, "Manila");
});

test("serialization conflicts roll back school records and retry the complete admission atomically", async () => {
  const service = harness({ commitConflicts: 2 });
  await service.submissions.saveAdmissionSubmission(submission(profile()));
  assert.equal(service.transactionOptions.length, 3);
  assert.ok(service.transactionOptions.every((settings) => settings.isolationLevel === "Serializable"));
  assert.equal(service.tables.lastSchool.size, 1);
  assert.equal(service.tables.address.size, 2);
  assert.equal(service.tables.student.size, 1);
  assert.equal(service.tables.admissionApplication.size, 1);
});

test("persistent conflicts stop after three attempts and unrelated database failures are not retried", async () => {
  const conflicts = harness({ commitConflicts: 3 });
  await assert.rejects(conflicts.submissions.saveAdmissionSubmission(submission(profile())), { code: "P2034" });
  assert.equal(conflicts.transactionOptions.length, 3);
  assert.equal(conflicts.tables.lastSchool.size, 0);
  assert.equal(conflicts.tables.admissionApplication.size, 0);
  const failure = harness({ failure: new Error("Database unavailable") });
  await assert.rejects(failure.submissions.saveAdmissionSubmission(submission(profile())), /Database unavailable/);
  assert.equal(failure.transactionOptions.length, 1);
  assert.equal(failure.tables.lastSchool.size, 0);
  assert.equal(failure.tables.address.size, 0);
});
