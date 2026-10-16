import { nonPhotoServiceModules } from "./profile-image-harness";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as XLSX from "xlsx";

import * as utils from "../lib/utils";
import * as validation from "../lib/validation";
import * as enums from "../lib/generated/prisma/enums";
import { Prisma } from "../lib/generated/prisma/client";
import * as academicLevels from "../lib/academic-levels";
import * as constants from "../lib/admission/constants";
import * as studentFields from "../lib/admission/student-fields";
import * as schoolIdentity from "../lib/admission/last-school-identity";
import * as records from "../lib/admission/records";
import type * as applicationServices from "../lib/admission/applications";
import type * as adminServices from "../lib/admission/admin";

type Query = { where?: Record<string, unknown>; select?: Record<string, unknown>; data?: Record<string, unknown> | Record<string, unknown>[] };
type Call = { method: string; query: Query };

const code = Object.fromEntries(["applications", "submission-store", "last-school-store", "admin"].map((name) => [name,
  ts.transpileModule(readFileSync(new URL(`../lib/admission/${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText,
]));

function harness(options: {
  academicLevel?: enums.AcademicLevel; programType?: enums.ProgramType; existingProfile?: boolean;
  assignedProgram?: boolean; verificationBranchId?: bigint;
  offeringChangesAfterSelection?: "removed" | "family";
  selectedSchool?: { id: bigint; schoolName: string; schoolId: string | null; shortName: string | null; schoolType: string; verificationStatus: "pending" | "verified" | "rejected"; address: ReturnType<typeof studentFields.addressDataFromProfile> };
  schoolLookupError?: boolean;
  deniedAdmin?: boolean;
  applicationStatus?: enums.ApplicationStatus;
  photoChange?: string;
} = {}) {
  const calls: Call[] = [];
  const applicationReads: Query[] = [];
  const refreshedPaths: string[] = [];
  const transactionOptions: Array<{ isolationLevel?: string } | undefined> = [];
  const reportedErrors: unknown[] = [];
  let offeringReads = 0;
  function record(method: string, query: Query) {
    calls.push({ method, query: structuredClone(query) });
  }
  const offering = {
    branch: { id: 1n, slug: "main", title: "Main Campus" },
    program: { id: 2n, code: "BSIT", label: "Information Technology", programType: options.programType ?? "Bachelor" },
  };
  const delegates = {
    branch: { findUnique: async () => offering.branch },
    program: { findUnique: async () => offering.program },
    branchProgram: { findUnique: async (query: Query) => {
      record("branchProgram.findUnique", query);
      offeringReads += 1;
      if (offeringReads > 1 && options.offeringChangesAfterSelection === "removed") return null;
      if (offeringReads > 1 && options.offeringChangesAfterSelection === "family") {
        return { ...offering, program: { ...offering.program, programType: "Associate" } };
      }
      const pair = query.where?.branchId_programId as { branchId?: bigint; programId?: bigint } | undefined;
      return options.assignedProgram !== false && pair?.branchId === offering.branch.id && pair.programId === offering.program.id
        ? offering : null;
    } },
    student: {
      findMany: async () => [],
      findUnique: async (query: Query) => {
        if (query.select?.studentNumber) {
          record("student.verification", query);
          const relation = query.select.applications as { where: { branchId: bigint } };
          return query.where?.id === 4n ? {
            id: 4n, studentNumber: "00123", email: "maria@example.com", firstName: "Maria Luz",
            lastName: "De La Cruz", birthDate: new Date("2008-02-29T00:00:00Z"),
            applications: relation.where.branchId === options.verificationBranchId ? [{ branchId: options.verificationBranchId }] : [],
          } : null;
        }
        return {
          id: 4n,
          email: "maria@example.com",
          addressId: options.existingProfile ? 7n : null,
          guardians: options.existingProfile ? [{ id: 8n, guardianId: 9n }] : [],
        };
      },
      count: async () => 1,
      findFirst: async () => null,
      create: async (query: Query) => { record("student.create", query); return { id: 4n }; },
      update: async (query: Query) => { record("student.update", query); return { id: 4n }; },
      createManyAndReturn: async (query: Query) => {
        record("student.createManyAndReturn", query);
        return (query.data as Record<string, unknown>[]).map((row, index) => ({ id: BigInt(index + 4), studentNumber: row.studentNumber }));
      },
    },
    admissionApplication: {
      findFirst: async (query: Query) => {
        applicationReads.push(structuredClone(query));
        if (query.where?.id !== 5n ||
            (query.where.studentId !== undefined && query.where.studentId !== 4n) ||
            (query.where.applicationStatus !== undefined && query.where.applicationStatus !== (options.applicationStatus ?? "approved"))) return null;
        return {
          id: 5n,
          lastSchoolId: options.existingProfile ? 10n : null,
          lastSchool: options.existingProfile ? { addressId: 11n } : null,
        };
      },
      create: async (query: Query) => { record("application.create", query); return { id: 5n }; },
      update: async (query: Query) => { record("application.update", query); return { id: 5n }; },
      createMany: async (query: Query) => { record("application.createMany", query); return { count: 1 }; },
    },
    user: { findMany: async () => [], findFirst: async () => null },
    ...Object.fromEntries(["address", "guardian", "studentGuardian", "lastSchool"].map((name) => [name, {
      create: async (query: Query) => { record(`${name}.create`, query); return { id: 6n }; },
      update: async (query: Query) => { record(`${name}.update`, query); return { id: query.where?.id }; },
      count: async () => name === "lastSchool" ? 0 : 1,
    }])),
    $queryRaw: async () => [],
  };
  Object.assign((delegates as Record<string, unknown>).lastSchool as object, {
    findUnique: async (query: Query) => {
      record("lastSchool.findUnique", query);
      if (options.schoolLookupError) throw new Error("Lookup failed");
      return options.selectedSchool?.id === query.where?.id ? structuredClone(options.selectedSchool) : null;
    },
  });
  const modules: Record<string, unknown> = {
    ...nonPhotoServiceModules(),
    "node:crypto": { randomUUID }, "xlsx": XLSX, "next/cache": { revalidatePath: (path: string) => refreshedPaths.push(path) },
    "@/lib/auth": { requireAdmin: async () => { if (options.deniedAdmin) throw new Error("Admin access required"); } },
    "@/lib/generated/prisma/client": { Prisma },
    "@/lib/generated/prisma/enums": enums,
    "@/lib/utils": utils, "@/lib/validation": validation,
    "@/lib/academic-levels": academicLevels,
    "@/lib/admission/constants": constants, "./constants": constants,
    "./student-fields": studentFields, "./records": records,
    "./last-school-identity": schoolIdentity,
    "@/lib/admission/student-update-email": { sendStudentUpdateLinkEmail: () => assert.fail("Unexpected email") },
    "@/lib/admission/student-update": { createStudentUpdateUrl: () => assert.fail("Unexpected token") },
    "@/lib/prisma": { prisma: { ...delegates, $transaction: async (
      callback: (tx: typeof delegates) => Promise<unknown>, transactionSettings?: { isolationLevel?: string },
    ) => {
      transactionOptions.push(transactionSettings);
      return callback(delegates);
    } } },
  };
  if (options.photoChange) modules["@/lib/users/profile-image"] = {
    prepareProfileImage: async (data: FormData, scope: string) => {
      assert.ok(data.get("image") instanceof File); assert.match(scope, /^student:/); assert.doesNotMatch(scope, /maria|@/);
      return { success: true, change: { value: options.photoChange } };
    },
    cleanupProfileImage: async () => assert.fail("A successful photo save must not clean up its image"),
  };
  function load(name: string) {
    const loaded = { exports: {} };
    runInNewContext(code[name], {
      module: loaded, exports: loaded.exports,
      console: { ...console, error: (...args: unknown[]) => reportedErrors.push(args) }, File, Date,
      require: (dependency: string) => {
        assert.ok(dependency in modules, `Unexpected dependency ${dependency}`);
        return modules[dependency];
      },
    });
    return loaded.exports;
  }
  modules["./last-school-store"] = load("last-school-store");
  modules["@/lib/admission/submission-store"] = load("submission-store");
  return {
    calls, applicationReads, refreshedPaths, transactionOptions, reportedErrors, applications: load("applications") as typeof applicationServices,
    admin: load("admin") as typeof adminServices,
  };
}

test("manual student admission can save a photo before a login account exists", async () => {
  const photo = "https://res.cloudinary.com/test/image/upload/new-student.png", h = harness({ photoChange: photo });
  const data = new FormData();
  for (const [name, value] of Object.entries({ ...dirtyProfile(), studentNumber: "0007", applicantType: "new", branchId: "1", programId: "2", academicLevel: "FirstYear" })) data.set(name, value ?? "");
  data.set("image", new File(["synthetic"], "photo.png", { type: "image/png" }));
  assert.equal((await h.admin.addAdmittedStudentAction({ success: false, message: "" }, data)).success, true);
  assert.equal((h.calls.find((call) => call.method === "student.create")?.query.data as Record<string, unknown>).userImage, photo);
  assert.equal(h.calls.some((call) => call.method === "user.create"), false);
});

function dirtyProfile(): studentFields.UpdateStudentRecordInput {
  return {
    ...Object.fromEntries(studentFields.studentUpdateFields.map((field) => [field, ""])),
    firstName: " <b>maria</b>\t luz ", lastName: " de la\n cruz ", middleName: " McDonald ",
    birthDate: "2008-02-29", gender: "Female", civilStatus: "Single", citizenship: " filipino ",
    birthplace: "<i>quezon city</i>", religion: " roman catholic ", email: " MARIA@Example.COM ",
    phone: "09171234567", facebookAccount: "https://facebook.com/Maria.User",
    addressHouseNumber: "12b", addressStreet: " main street ", addressSubdivision: " east subdivision ",
    addressBarangay: " central ", addressCity: " manila ", addressProvince: " metro manila ", addressPostalCode: "0010",
    guardianFirstName: " ana ", guardianLastName: " de la cruz ", guardianRelationship: " mother ",
    guardianContactNumber: "09171234567", guardianOccupation: " software developer ",
    lastSchoolName: " <b>central school</b> ", lastSchoolShortName: " CSHS ", lastSchoolId: "idAb12",
    lastSchoolType: "Public", lastSchoolHouseNumber: "2a", lastSchoolStreet: "west road",
    lastSchoolBarangay: " west ", lastSchoolCity: " quezon city ", lastSchoolProvince: " metro manila ",
    lastSchoolYear: "2025-2026", lastSchoolYearLevel: " grade 12 ",
  } as studentFields.UpdateStudentRecordInput;
}

function assertProfileWrites(calls: Call[], studentMethod: string, applicationMethod: string, relatedMethod = "create", schoolMethod = relatedMethod) {
  const student = calls.find((call) => call.method === studentMethod)?.query.data as Record<string, unknown>;
  assert.equal(student.firstName, "Maria Luz");
  assert.equal(student.lastName, "De La Cruz");
  assert.equal(student.middleName, "McDonald");
  assert.equal(student.birthplace, "Quezon City");
  assert.equal(student.email, "maria@example.com");
  assert.equal(student.facebookAccount, "https://facebook.com/Maria.User");
  assert.equal(student.gender, "Female");
  assert.equal(student.citizenship, "Filipino");
  const guardian = calls.find((call) => call.method === `guardian.${relatedMethod}`)?.query.data as Record<string, unknown>;
  assert.equal(guardian.occupation, "Software Developer");
  assert.equal(guardian.firstName, "Ana");
  const relationship = calls.find((call) => call.method === `studentGuardian.${relatedMethod}`)?.query.data as Record<string, unknown>;
  assert.equal(relationship.relationship, "Mother");
  const address = calls.find((call) => call.method === `address.${relatedMethod}`)?.query.data as Record<string, unknown>;
  assert.equal(address.houseNumber, "12b");
  assert.equal(address.city, "Manila");
  assert.equal(address.street, "Main Street");
  assert.equal(address.postalCode, "0010");
  const school = calls.find((call) => call.method === `lastSchool.${schoolMethod}`)?.query.data as Record<string, unknown>;
  assert.equal(school.schoolName, "Central School");
  assert.equal(school.shortName, "CSHS");
  assert.equal(school.schoolId, "idAb12");
  assert.equal(school.schoolType, "Public");
  const application = calls.find((call) => call.method === applicationMethod)?.query.data as Record<string, unknown>;
  assert.equal(application.LSAttainedLevelText, "Grade 12");
  assert.equal(application.LSSchoolYearEnd, "2025-2026");
  assert.equal(application.academicLevel, "FirstYear");
  assert.equal("academicLevelsId" in application, false);
}

test("profile persistence builders sanitize raw values and preserve structured field formats", () => {
  const input = dirtyProfile();
  assert.equal(studentFields.studentDataFromProfile(input, new Date()).firstName, "Maria Luz");
  assert.equal(studentFields.guardianDataFromProfile(input).occupation, "Software Developer");
  assert.equal(studentFields.addressDataFromProfile(input, "address").houseNumber, "12b");
  assert.equal(studentFields.lastSchoolDataFromProfile(input).shortName, "CSHS");
  assert.equal(input.firstName, " <b>maria</b>\t luz ");
  assert.equal(studentFields.normalizeStudentUpdateInput({ ...input, firstName: " jose\u0301   a\u0301ngel " }).firstName, "José Ángel");
  const normalized = studentFields.normalizeStudentUpdateInput({ ...input, gender: "female", lastSchoolType: "public" });
  assert.equal(normalized.gender, "female");
  assert.equal(normalized.lastSchoolType, "public");
  assert.equal(studentFields.firstInvalidStudentUpdateField(normalized), "gender");
});

test("student and guardian suffixes treat N/A as absent while keeping real suffixes and other field formats", () => {
  for (const suffix of ["N/a", "n/a", "N/A", " n/A ", "<b>N/a</b>", ""]) {
    const profile = { ...dirtyProfile(), suffix, guardianSuffix: suffix };
    assert.equal(studentFields.normalizeStudentField("suffix", suffix), "");
    assert.equal(studentFields.normalizeStudentField("guardianSuffix", suffix), "");
    assert.equal(studentFields.studentDataFromProfile(profile, new Date()).suffix, null);
    assert.equal(studentFields.guardianDataFromProfile(profile).suffix, null);
  }
  const profile = { ...dirtyProfile(), suffix: " jr. ", guardianSuffix: " III " };
  assert.equal(studentFields.studentDataFromProfile(profile, new Date()).suffix, "Jr.");
  assert.equal(studentFields.guardianDataFromProfile(profile).suffix, "III");
  assert.equal(studentFields.normalizeStudentField("lastSchoolId", "N/a"), "N/a");
});

test("public admissions and portal edits persist absent student and guardian suffixes as database null", async () => {
  function savedSuffix(calls: Call[], method: string) {
    const data = calls.find((call) => call.method === method)?.query.data;
    assert.ok(data && !Array.isArray(data));
    return data.suffix;
  }
  const profile = { ...dirtyProfile(), suffix: " N/a ", guardianSuffix: "<b>n/a</b>" };
  const submission = Object.fromEntries(Object.entries(studentFields.studentSubmissionFields).map(([field, key]) => [key, profile[field as studentFields.StudentUpdateField]]));
  const admission = harness();
  const result = await admission.applications.submitAdmissionApplication({
    ...submission, applicant_type: "New Student", branch_id: "1", program_id: "2", academic_level: "FirstYear", program_type: "Bachelor",
  }, true);
  assert.equal(result.submitted, true);
  assert.equal(savedSuffix(admission.calls, "student.create"), null);
  assert.equal(savedSuffix(admission.calls, "guardian.create"), null);

  const edit = harness({ existingProfile: true });
  const form = new FormData();
  for (const [key, value] of Object.entries({ ...profile, studentNumber: "stuAb12", studentId: "4", applicationId: "5", applicantType: "new", branchId: "1", programId: "2", academicLevel: "FirstYear" })) {
    if (typeof value === "string") form.set(key, value);
  }
  assert.equal((await edit.admin.editAdmittedStudentAction({ success: false, message: "" }, form)).success, true);
  assert.equal(savedSuffix(edit.calls, "student.update"), null);
  assert.equal(savedSuffix(edit.calls, "guardian.update"), null);
});

test("public admission submissions save sanitized and capitalized student, guardian, address and school data", async () => {
  const service = harness();
  const profile = dirtyProfile();
  const form = Object.fromEntries(Object.entries(studentFields.studentSubmissionFields).map(([field, key]) => [key, profile[field as studentFields.StudentUpdateField]]));
  const result = await service.applications.submitAdmissionApplication({
    ...form, applicant_type: "New Student", branch_id: "1", program_id: "2", academic_level: "FirstYear", program_type: "Bachelor", academic_level_label: "Forged Level",
  }, true);
  assert.equal(result.submitted, true);
  assertProfileWrites(service.calls, "student.create", "application.create");
  assert.deepEqual(service.calls.find((call) => call.method === "branchProgram.findUnique")?.query.where, {
    branchId_programId: { branchId: 1n, programId: 2n },
  });
  assert.equal(service.calls.filter((call) => call.method === "branchProgram.findUnique").length, 2);
  assert.equal(service.transactionOptions[0]?.isolationLevel, "Serializable");
});

test("selecting a saved previous school uses its database ID and ignores forged school metadata", async () => {
  const profile = dirtyProfile();
  const savedSchool = {
    id: 123n,
    verificationStatus: "verified" as const,
    ...studentFields.lastSchoolDataFromProfile(profile),
    address: studentFields.addressDataFromProfile(profile, "lastSchool"),
  };
  const service = harness({ selectedSchool: savedSchool });
  const form = Object.fromEntries(Object.entries(studentFields.studentSubmissionFields).map(([field, key]) => [key, profile[field as studentFields.StudentUpdateField]]));
  const result = await service.applications.submitAdmissionApplication({
    ...form, applicant_type: "New Student", branch_id: "1", program_id: "2", academic_level: "FirstYear", program_type: "Bachelor",
    last_school_record_id: "123", last_school_name: "Forged school", last_school_id: "999", last_school_type: "invalid",
    last_school_barangay: "", last_school_city: "<script>bad</script>", last_school_province: "",
    last_school_year: "2024-2025", last_school_year_level: "grade 11",
  }, true);
  assert.equal(result.submitted, true);
  const application = service.calls.find((call) => call.method === "application.create")?.query.data as Record<string, unknown>;
  assert.equal(application.lastSchoolId, 123n);
  assert.equal(application.LSSchoolYearEnd, "2024-2025");
  assert.equal(application.LSAttainedLevelText, "Grade 11");
  assert.equal(service.calls.some((call) => call.method === "lastSchool.create" || call.method === "lastSchool.update"), false);
  assert.equal(service.calls.filter((call) => call.method === "address.create").length, 1);
  assert.deepEqual(savedSchool, {
    id: 123n, verificationStatus: "verified", ...studentFields.lastSchoolDataFromProfile(profile), address: studentFields.addressDataFromProfile(profile, "lastSchool"),
  });
});

test("saved previous-school submissions restore optional metadata omitted from the admission form", async () => {
  const profile = { ...dirtyProfile(), lastSchoolSubdivision: "Saved Village" };
  const savedSchool = {
    id: 123n,
    verificationStatus: "verified" as const,
    ...studentFields.lastSchoolDataFromProfile(profile),
    address: studentFields.addressDataFromProfile(profile, "lastSchool"),
  };
  const before = structuredClone(savedSchool);
  const service = harness({ selectedSchool: savedSchool });
  const form = Object.fromEntries(Object.entries(studentFields.studentSubmissionFields).map(([field, key]) => [key, profile[field as studentFields.StudentUpdateField]]));
  delete form.last_school_id;
  delete form.last_school_house_number;
  delete form.last_school_subdivision;

  const result = await service.applications.submitAdmissionApplication({
    ...form, applicant_type: "New Student", branch_id: "1", program_id: "2", academic_level: "FirstYear", program_type: "Bachelor",
    last_school_record_id: "123",
  }, true);
  assert.equal(result.submitted, true);
  const application = service.calls.find((call) => call.method === "application.create")?.query.data as Record<string, unknown>;
  assert.equal(application.lastSchoolId, 123n);
  assert.equal(service.calls.filter((call) => call.method === "lastSchool.findUnique").length, 2, "The selected school is rechecked inside the admission transaction");
  assert.equal(service.calls.some((call) => call.method === "lastSchool.create" || call.method === "lastSchool.update"), false);
  assert.deepEqual(savedSchool, before, "Removing fillable fields must not alter the shared saved-school metadata");
});

test("unknown or malformed saved previous-school IDs fail before any admission record is written", async () => {
  const profile = dirtyProfile();
  const form = Object.fromEntries(Object.entries(studentFields.studentSubmissionFields).map(([field, key]) => [key, profile[field as studentFields.StudentUpdateField]]));
  for (const id of ["0", "-1", "not-a-record", "9223372036854775808", "789"]) {
    const service = harness();
    const result = await service.applications.submitAdmissionApplication({
      ...form, applicant_type: "New Student", branch_id: "1", program_id: "2", academic_level: "FirstYear", program_type: "Bachelor",
      last_school_record_id: id,
    }, true);
    assert.equal(result.submitted, false, id);
    assert.match(result.message ?? "", /valid previous school.*Other school/i);
    assert.equal(service.calls.some((call) => /\.(create|update)/.test(call.method)), false);
  }
  const failure = harness({ schoolLookupError: true });
  assert.equal((await failure.applications.submitAdmissionApplication({
    ...form, applicant_type: "New Student", branch_id: "1", program_id: "2", academic_level: "FirstYear", program_type: "Bachelor",
    last_school_record_id: "123",
  }, true)).submitted, false);
  assert.equal(failure.calls.some((call) => /\.(create|update)/.test(call.method)), false);
});

test("public admission rejects pending and rejected school IDs before writing an applicant", async () => {
  const profile = dirtyProfile();
  const form = Object.fromEntries(Object.entries(studentFields.studentSubmissionFields).map(([field, key]) => [key, profile[field as studentFields.StudentUpdateField]]));
  for (const verificationStatus of ["pending", "rejected"] as const) {
    const service = harness({ selectedSchool: {
      id: 123n, ...studentFields.lastSchoolDataFromProfile(profile), verificationStatus,
      address: studentFields.addressDataFromProfile(profile, "lastSchool"),
    } });
    const result = await service.applications.submitAdmissionApplication({
      ...form, applicant_type: "New Student", branch_id: "1", program_id: "2", academic_level: "FirstYear", program_type: "Bachelor",
      last_school_record_id: "123",
    }, true);
    assert.equal(result.submitted, false, verificationStatus);
    assert.match(result.message ?? "", /valid previous school.*Other school/i);
    assert.equal(service.calls.some((call) => /\.(create|update)/.test(call.method)), false);
  }
});

test("public admission selection accepts enum levels only for matching program families", async () => {
  const profile = dirtyProfile();
  const form = Object.fromEntries(Object.entries(studentFields.studentSubmissionFields).map(([field, key]) => [key, profile[field as studentFields.StudentUpdateField]]));
  for (const selection of [
    { programType: "SeniorHigh", academicLevel: "Grade11" },
    { programType: "SeniorHigh", academicLevel: "Grade12" },
    { programType: "Associate", academicLevel: "SecondYear" },
    { programType: "Bachelor", academicLevel: "FourthYear" },
  ] as const) {
    const service = harness(selection);
    const result = await service.applications.submitAdmissionApplication({
      ...form, applicant_type: "New Student", branch_id: "1", program_id: "2",
      program_type: selection.programType, academic_level: selection.academicLevel,
    }, true);
    assert.equal(result.submitted, true, `${selection.programType}/${selection.academicLevel}`);
    const saved = service.calls.find((call) => call.method === "application.create")?.query.data as Record<string, unknown>;
    assert.equal(saved.academicLevel, selection.academicLevel);
    assert.equal(saved.programType, selection.programType);
    assert.equal("academicLevelsId" in saved, false);
  }
  for (const academicLevel of ["3", "First Year", "firstyear", "Grade11"]) {
    const service = harness({ academicLevel: "Grade11" });
    const result = await service.applications.submitAdmissionApplication({
      ...form, applicant_type: "New Student", branch_id: "1", program_id: "2",
      program_type: "Bachelor", academic_level: academicLevel,
    }, true);
    assert.equal(result.submitted, false, academicLevel);
    assert.equal(service.calls.some((call) => call.method.includes("create") || call.method.includes("update")), false);
  }
});

test("public admission rejects unassigned branch/program pairs before any profile write", async () => {
  const profile = dirtyProfile();
  const form = Object.fromEntries(Object.entries(studentFields.studentSubmissionFields).map(([field, key]) => [key, profile[field as studentFields.StudentUpdateField]]));

  for (const selection of [
    { branch_id: "1", program_id: "2", assignedProgram: false },
    { branch_id: "8", program_id: "2", assignedProgram: true },
    { branch_id: "1", program_id: "9", assignedProgram: true },
  ]) {
    const service = harness({ assignedProgram: selection.assignedProgram });
    const result = await service.applications.submitAdmissionApplication({
      ...form, applicant_type: "New Student", branch_id: selection.branch_id,
      program_id: selection.program_id, program_type: "Bachelor", academic_level: "FirstYear",
    }, true);

    assert.equal(result.submitted, false);
    assert.match(result.message ?? "", /valid branch and program/);
    assert.equal(service.calls.some((call) => call.method.includes("create") || call.method.includes("update")), false);
  }
});

test("public admission canonicalizes forged offering labels and rejects a forged program family", async () => {
  const profile = dirtyProfile();
  const form = Object.fromEntries(Object.entries(studentFields.studentSubmissionFields).map(([field, key]) => [key, profile[field as studentFields.StudentUpdateField]]));
  const service = harness();
  const result = await service.applications.submitAdmissionApplication({
    ...form, applicant_type: "New Student", branch_id: "1", program_id: "2",
    program_type: "Bachelor", academic_level: "ThirdYear",
    branch_title: "Forged campus", program_label: "Forged program", academic_level_label: "Forged level",
  }, true);
  assert.equal(result.submitted, true);
  const saved = service.calls.find((call) => call.method === "application.create")?.query.data as Record<string, unknown>;
  assert.equal(saved.branchId, 1n);
  assert.equal(saved.programId, 2n);
  assert.equal(saved.academicLevel, "ThirdYear");
  assert.equal(saved.programType, "Bachelor");

  const forged = harness({ programType: "SeniorHigh" });
  const rejected = await forged.applications.submitAdmissionApplication({
    ...form, applicant_type: "New Student", branch_id: "1", program_id: "2",
    program_type: "Bachelor", academic_level: "FirstYear",
  }, true);
  assert.equal(rejected.submitted, false);
  assert.equal(forged.calls.some((call) => call.method.includes("create") || call.method.includes("update")), false);
});

test("existing admission submissions revalidate the selected branch against saved application history", async () => {
  const profile = dirtyProfile();
  const form = Object.fromEntries(Object.entries(studentFields.studentSubmissionFields).map(([field, key]) => [key, profile[field as studentFields.StudentUpdateField]]));
  const submission = {
    ...form, applicant_type: "Existing Student", branch_id: "1", program_id: "2",
    program_type: "Bachelor", academic_level: "SecondYear", current_student_record_id: "4",
    current_student_number: "00123", current_student_email: "maria@example.com",
    current_student_first_name: "maria luz", current_student_last_name: "de la cruz",
    current_student_birth_date: "2008-02-29",
  };
  const matching = harness({ verificationBranchId: 1n });
  assert.equal((await matching.applications.submitAdmissionApplication(submission, true)).submitted, true);
  const verification = matching.calls.find((call) => call.method === "student.verification")?.query;
  assert.equal("enrollments" in (verification?.select ?? {}), false);
  assert.equal(matching.calls.some((call) => call.method === "student.update"), true);

  const mismatched = harness({ verificationBranchId: 8n });
  const denied = await mismatched.applications.submitAdmissionApplication(submission, true);
  assert.equal(denied.submitted, false);
  assert.match(denied.message ?? "", /verification details do not match/);
  assert.equal(mismatched.calls.some((call) => call.method.includes("create") || call.method.includes("update")), false);
});

test("an offering removed or reclassified after initial validation cannot write any admission profile records", async () => {
  const profile = dirtyProfile();
  const form = Object.fromEntries(Object.entries(studentFields.studentSubmissionFields).map(([field, key]) => [key, profile[field as studentFields.StudentUpdateField]]));

  for (const offeringChangesAfterSelection of ["removed", "family"] as const) {
    for (const applicant_type of ["New Student", "Existing Student"]) {
      const service = harness({ offeringChangesAfterSelection, verificationBranchId: 1n });
      const result = await service.applications.submitAdmissionApplication({
        ...form, applicant_type, branch_id: "1", program_id: "2",
        program_type: "Bachelor", academic_level: "FirstYear", current_student_record_id: "4",
        current_student_number: "00123", current_student_email: "maria@example.com",
        current_student_first_name: "Maria Luz", current_student_last_name: "De La Cruz",
        current_student_birth_date: "2008-02-29",
      }, true);

      assert.equal(result.submitted, false, `${applicant_type}/${offeringChangesAfterSelection}`);
      assert.match(result.message ?? "", /could not save/);
      assert.equal(service.calls.filter((call) => call.method === "branchProgram.findUnique").length, 2);
      assert.equal(service.calls.some((call) => call.method.includes("create") || call.method.includes("update")), false);
      assert.equal(service.transactionOptions[0]?.isolationLevel, "Serializable");
      assert.equal(service.reportedErrors.length, 1);
    }
  }
});

test("sanitation runs before required-field validation and cannot turn markup-only names into saved empty fields", async () => {
  const service = harness();
  const profile = dirtyProfile();
  const form = Object.fromEntries(Object.entries(studentFields.studentSubmissionFields).map(([field, key]) => [key, profile[field as studentFields.StudentUpdateField]]));
  const result = await service.applications.submitAdmissionApplication({
    ...form, student_first_name: "<br>", applicant_type: "New Student", branch_id: "1", program_id: "2", academic_level: "FirstYear", program_type: "Bachelor",
  }, true);
  assert.equal(result.submitted, false);
  assert.match(result.message ?? "", /first name.*required/i);
  assert.equal(service.calls.length, 0);
});

test("portal admission add and edit actions normalize values before database writes", async () => {
  const service = harness();
  const form = new FormData();
  for (const [key, value] of Object.entries({ ...dirtyProfile(), studentNumber: "stuAb12", studentId: "4", applicationId: "5", applicantType: "new", branchId: "1", programId: "2", academicLevel: "FirstYear" })) {
    if (typeof value === "string") form.set(key, value);
  }
  const state = { success: false, message: "" };
  assert.equal((await service.admin.addAdmittedStudentAction(state, form)).success, true);
  const added = service.calls.find((call) => call.method === "student.create")?.query.data as Record<string, unknown>;
  assert.equal(added.firstName, "Maria Luz");
  assert.equal(added.lastName, "De La Cruz");
  assert.equal(added.studentNumber, "stuAb12");
  assert.equal(added.email, "maria@example.com");
  service.calls.length = 0;
  assert.equal((await service.admin.editAdmittedStudentAction(state, form)).success, true);
  assertProfileWrites(service.calls, "student.update", "application.update");
});

function managedStudentForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    ...dirtyProfile(), studentNumber: "stuAb12", studentId: "4", applicationId: "5", applicantType: "new",
    branchId: "1", programId: "2", academicLevel: "FirstYear", ...overrides,
  })) if (typeof value === "string") form.set(key, value);
  return form;
}

test("Manage Students reads authorize first, reject invalid IDs and retrieve approved admissions only", async () => {
  const denied = harness({ deniedAdmin: true });
  await assert.rejects(denied.admin.getManagedStudentApplication("5"), /Admin access required/);
  assert.equal(denied.applicationReads.length, 0);

  const service = harness();
  for (const id of ["", "0", "-1", "five", "9223372036854775808"]) {
    assert.equal(await service.admin.getManagedStudentApplication(id), null, id);
  }
  assert.equal(service.applicationReads.length, 0);
  assert.equal((await service.admin.getManagedStudentApplication("5"))?.id, 5n);
  assert.deepEqual(service.applicationReads[0].where, { id: 5n, applicationStatus: "approved" });
  assert.equal(await harness({ applicationStatus: "reviewing" }).admin.getManagedStudentApplication("5"), null);
});

test("Manage Students saves normalize all details and refresh both students and admission views", async () => {
  const service = harness();
  const result = await service.admin.editManagedStudentAction({ success: false, message: "" }, managedStudentForm());
  assert.equal(result.success, true);
  assertProfileWrites(service.calls, "student.update", "application.update");
  assert.deepEqual(service.applicationReads[0].where, { id: 5n, studentId: 4n, applicationStatus: "approved" });
  assert.equal(service.transactionOptions[0]?.isolationLevel, "Serializable");
  for (const path of ["/portal/students", "/portal/students/5", "/portal/students/5/edit", "/portal/admission", "/portal/information"]) {
    assert.ok(service.refreshedPaths.includes(path), path);
  }
});

test("Manage Students cannot save unapproved, mismatched or missing admissions, including after an edit page was loaded", async () => {
  for (const applicationStatus of ["draft", "submitted", "reviewing", "rejected"] as const) {
    const service = harness({ applicationStatus });
    const result = await service.admin.editManagedStudentAction({ success: false, message: "" }, managedStudentForm());
    assert.equal(result.success, false, applicationStatus);
    assert.equal(service.calls.length, 0, applicationStatus);
    assert.equal(service.refreshedPaths.length, 0, applicationStatus);
    assert.equal(service.transactionOptions.length, 1, "The approved status is checked within the save transaction");
  }
  for (const overrides of [{ studentId: "7" }, { applicationId: "8" }] as Array<Record<string, string>>) {
    const service = harness();
    assert.equal((await service.admin.editManagedStudentAction({ success: false, message: "" }, managedStudentForm(overrides))).success, false);
    assert.equal(service.calls.length, 0);
  }
  const denied = harness({ deniedAdmin: true });
  await assert.rejects(denied.admin.editManagedStudentAction({ success: false, message: "" }, managedStudentForm()), /Admin access required/);
  assert.equal(denied.calls.length, 0);
  assert.equal(denied.transactionOptions.length, 0);
});

test("the admission editor still supports applications that have not been approved", async () => {
  const service = harness({ applicationStatus: "reviewing" });
  assert.equal((await service.admin.editAdmittedStudentAction({ success: false, message: "" }, managedStudentForm())).success, true);
  assert.equal("applicationStatus" in (service.applicationReads[0].where ?? {}), false);
});

test("editing an existing student sanitizes new school details without mutating the previous shared school", async () => {
  const service = harness({ existingProfile: true });
  const form = new FormData();
  for (const [key, value] of Object.entries({
    ...dirtyProfile(), studentNumber: "stuAb12", studentId: "4", applicationId: "5",
    applicantType: "new", branchId: "1", programId: "2", academicLevel: "FirstYear",
  })) if (typeof value === "string") form.set(key, value);

  const result = await service.admin.editAdmittedStudentAction({ success: false, message: "" }, form);

  assert.equal(result.success, true);
  assertProfileWrites(service.calls, "student.update", "application.update", "update", "create");
  assert.equal(service.calls.some((call) => call.method === "lastSchool.update"), false);
  const addresses = service.calls.filter((call) => call.method === "address.update");
  assert.equal(addresses.length, 1);
  assert.equal(addresses[0].query.where?.id, 7n);
  const schoolAddress = service.calls.find((call) => call.method === "address.create")?.query.data as Record<string, unknown>;
  assert.equal(schoolAddress.houseNumber, "2a");
  assert.equal(schoolAddress.street, "West Road");
  assert.equal(schoolAddress.barangay, "West");
  assert.equal(schoolAddress.city, "Quezon City");
  assert.equal(schoolAddress.province, "Metro Manila");
  const savedApplication = service.calls.find((call) => call.method === "application.update")?.query.data as Record<string, unknown>;
  assert.equal(savedApplication.lastSchoolId, 6n);
  const savedStudent = service.calls.find((call) => call.method === "student.update")?.query.data as Record<string, unknown>;
  assert.equal(savedStudent.studentNumber, "stuAb12");
  assert.equal(savedStudent.religion, "Roman Catholic");
  assert.equal(savedStudent.phone, "09171234567");
  assert.equal(savedStudent.civilStatus, "Single");
});

test("Manage Students edits reject markup-only required names before writing or validating other fields", async () => {
  const service = harness({ existingProfile: true });
  const form = new FormData();
  for (const [key, value] of Object.entries({
    ...dirtyProfile(), firstName: " <br> ", phone: "invalid", studentNumber: "stuAb12",
    studentId: "4", applicationId: "5", applicantType: "new", branchId: "1", programId: "2", academicLevel: "FirstYear",
  })) if (typeof value === "string") form.set(key, value);

  const result = await service.admin.editManagedStudentAction({ success: false, message: "" }, form);

  assert.equal(result.success, false);
  assert.equal(result.message, "Complete all required fields before saving the student.");
  assert.equal(service.calls.length, 0);
  assert.equal(form.get("firstName"), " <br> ");
});

test("portal add, edit and bulk import reject numeric, malformed and program-incompatible levels before saving", async () => {
  for (const academicLevel of ["3", "First Year", "firstyear", "Grade11"]) {
    for (const method of ["addAdmittedStudentAction", "editAdmittedStudentAction", "bulkAdmitStudentsAction"] as const) {
      const service = harness();
      const form = new FormData();
      for (const [key, value] of Object.entries({
        ...dirtyProfile(), studentNumber: "stuAb12", studentId: "4", applicationId: "5",
        applicantType: "new", branchId: "1", programId: "2", academicLevel,
      })) if (typeof value === "string") form.set(key, value);
      form.set("studentsFile", new File(["invalid file contents"], "students.xlsx"));
      const result = await service.admin[method]({ success: false, message: "" }, form);
      assert.equal(result.success, false, `${method}/${academicLevel}`);
      assert.equal(service.calls.length, 0);
    }
  }
});

test("spreadsheet admission imports sanitize and capitalize names while preserving student-number casing", async () => {
  const service = harness();
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["Student Number", "Email Address", "First Name", "Last Name", "Birth Date", "Gender"],
    ["stuAb12", " MARIA@Example.COM ", "<b>maria</b>\t luz", "de la cruz", "2008-02-29", "female"],
  ]), "Students");
  const file = new File([XLSX.write(workbook, { type: "array", bookType: "xlsx" })], "<b>students</b>.xlsx");
  const form = new FormData();
  for (const [key, value] of Object.entries({ applicantType: "new", branchId: "1", programId: "2", academicLevel: "FirstYear" })) form.set(key, value);
  form.set("studentsFile", file);
  const result = await service.admin.bulkAdmitStudentsAction({ success: false, message: "" }, form);
  assert.equal(result.success, true);
  const imported = (service.calls.find((call) => call.method === "student.createManyAndReturn")?.query.data as Record<string, unknown>[])[0];
  assert.equal(imported.studentNumber, "stuAb12");
  assert.equal(imported.email, "maria@example.com");
  assert.equal(imported.firstName, "Maria Luz");
  assert.equal(imported.lastName, "De La Cruz");
  assert.equal(imported.gender, "Female");
  const application = (service.calls.find((call) => call.method === "application.createMany")?.query.data as Record<string, unknown>[])[0];
  assert.match(application.remarks as string, /^Bulk Admitted From Students\b/);
  assert.doesNotMatch(application.remarks as string, /[<>]/);
  assert.equal(application.academicLevel, "FirstYear");
  assert.equal("academicLevelsId" in application, false);
});
