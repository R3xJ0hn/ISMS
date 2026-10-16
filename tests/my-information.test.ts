import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type * as informationService from "../lib/portal/information";
import { getEmployeeFullName } from "../lib/employees/names";
import { formatAddress, formatDateInput, formatStudentName, literalInsensitiveEquality, normalizeEmail, parseRecordId } from "../lib/utils";
import { loadStudentIdentityService } from "./student-services-harness";

const code = ts.transpileModule(
  readFileSync(new URL("../lib/portal/information.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } },
).outputText;

type EmailFilter = { equals: string; mode: string };
type StudentQuery = { where: { id?: bigint; email: EmailFilter }; select: Record<string, unknown>; take?: number };
type TeacherQuery = {
  where: { userId: bigint; user: { role: string; emailVerified: boolean } };
  select: { employee: { select: Record<string, unknown> } };
};

function harness({
  denied = false, role = "student", email = "Student@Example.test", id = "9007199254740993",
  matches = 1, teacherLinked = true, studentFound = true, teacherRole = "teacher", verified = true,
  studentExtras = true,
} = {}) {
  const teacherQueries: TeacherQuery[] = [];
  const studentQueries: StudentQuery[] = [];
  const events: string[] = [];
  const employee = {
    id: 222n, employeeId: "TEACHER-007", firstName: "Ana", middleName: "Reyes", lastName: "Cruz", suffix: "III",
    birthDate: new Date("1987-11-20T00:00:00.000Z"), placeOfBirth: "Davao City", gender: "Female", civilStatus: "Married",
    nationality: "Filipino", address: "12 Main Street", contactNumber: "09123456789", emailAddress: "ana@example.test",
    dateStarted: new Date("2021-06-01T00:00:00.000Z"), role: "teacher", status: "Regular",
    tin: "PRIVATE-TIN", sssNo: "PRIVATE-SSS", philHealthNo: "PRIVATE-PH", pagIbigNo: "PRIVATE-PI",
    passwordHash: "PRIVATE-PASSWORD", key: "PRIVATE-KEY", userId: 456n,
  };
  const ownStudentId = 9007199254740995n;
  const student = {
    id: ownStudentId, studentNumber: "00007", firstName: "Maria", middleName: null, lastName: "Santos", suffix: null,
    birthDate: new Date("2006-12-31T00:00:00.000Z"), gender: "Female", civilStatus: "Single", citizenship: "Filipino",
    birthplace: "Cotabato City", religion: "Christian", email: "student@example.test", phone: "09000000000",
    facebookAccount: "Maria Santos",
    address: studentExtras ? { id: 888n, houseNumber: "7", street: "Mabini", subdivision: null, barangay: "Central",
      city: "Cotabato", province: "Maguindanao", postalCode: "9600", students: ["PRIVATE-CLASSMATE"] } : null,
    guardians: studentExtras ? [{ id: 444n, relationship: "Mother", guardian: { id: 445n,
      firstName: "Lea", middleName: null, lastName: "Santos", suffix: null, contactNumber: "09111111111", occupation: "Farmer",
      email: "PRIVATE-GUARDIAN-EMAIL", addressId: 999n, students: ["PRIVATE-CLASSMATE"] } }] : [],
    applications: studentExtras ? [{ id: 555n, studentId: ownStudentId, academicLevel: "FirstYear", programType: "Bachelor",
      applicantType: "new", applicationStatus: "approved", submittedAt: new Date("2026-07-13T20:30:00.000Z"),
      branch: { id: 77n, title: "Main Campus" }, program: { id: 78n, label: "BS Information Technology" },
      LSSchoolYearEnd: "2025-2026", LSAttainedLevelText: "Grade 12", LSGraduationDate: new Date("2026-04-15T00:00:00.000Z"),
      lastSchool: { id: 56n, schoolName: "Sample High School", schoolType: "Public" }, remarks: "PRIVATE-INTERNAL-REMARKS",
    }] : [],
    passwordHash: "PRIVATE-PASSWORD", key: "PRIVATE-KEY", classes: ["PRIVATE-CLASSMATE"],
  };
  const modules: Record<string, unknown> = {
    "@/lib/auth": { requireSession: async () => {
      events.push("session");
      if (denied) throw new Error("Verified session required");
      return { role, email, id, emailVerified: true };
    } },
    "@/lib/prisma": { prisma: {
      teacher: { findUnique: async (query: TeacherQuery) => {
        events.push("teacher"); teacherQueries.push(query);
        return teacherLinked && query.where.userId === 9007199254740993n &&
          query.where.user.role === teacherRole && query.where.user.emailVerified === verified ? { employee } : null;
      } },
      student: {
        findMany: async (query: StudentQuery) => {
          events.push("student resolution"); studentQueries.push(query);
          return Array.from({ length: matches }, (_, index) => ({ id: ownStudentId + BigInt(index) }));
        },
        findFirst: async (query: StudentQuery) => {
          events.push("student profile"); studentQueries.push(query);
          return studentFound && query.where.id === ownStudentId ? student : null;
        },
      },
    } },
    "@/lib/employees/names": { getEmployeeFullName },
    "@/lib/utils": { formatAddress, formatDateInput, formatStudentName, literalInsensitiveEquality, normalizeEmail, parseRecordId },
    "next/navigation": { redirect: (path: string) => { throw new Error("Redirect " + path); } },
  };
  modules["./student"] = loadStudentIdentityService(modules);
  const loaded = { exports: {} };
  runInNewContext(code, {
    module: loaded, exports: loaded.exports,
    require: (name: string) => {
      assert.ok(name in modules, "Unexpected information service dependency: " + name);
      return modules[name];
    },
  });
  return { service: loaded.exports as typeof informationService, teacherQueries, studentQueries, events, ownStudentId };
}

test("my information requires the verified current session before reading any profile", async () => {
  const loaded = harness({ denied: true });
  await assert.rejects(loaded.service.getMyInformation(), /Verified session required/);
  assert.deepEqual(loaded.events, ["session"]);
  assert.equal(loaded.teacherQueries.length, 0);
  assert.equal(loaded.studentQueries.length, 0);
});

test("administrative roles cannot use the teacher/student personal information route", async () => {
  for (const role of ["admin", "registrar", "superAdmin", "unknown"]) {
    const loaded = harness({ role });
    await assert.rejects(loaded.service.getMyInformation(), /Redirect \/portal/);
    assert.deepEqual(loaded.events, ["session"]);
  }
});

test("teacher profile ownership uses the exact authenticated user ID and verified Teacher role", async () => {
  const loaded = harness({ role: "teacher", email: "different-account@example.test" });
  const result = await loaded.service.getMyInformation();
  assert.equal(result.role, "teacher");
  assert.equal(result.accountEmail, "different-account@example.test");
  assert.equal(result.profile?.kind, "teacher");
  assert.equal(loaded.teacherQueries[0].where.userId, 9007199254740993n);
  assert.equal(loaded.teacherQueries[0].where.user.role, "teacher");
  assert.equal(loaded.teacherQueries[0].where.user.emailVerified, true);
  assert.deepEqual(loaded.events, ["session", "teacher"]);
  assert.doesNotMatch(JSON.stringify(loaded.teacherQueries[0].where, (_, value) => typeof value === "bigint" ? value.toString() : value), /emailAddress|email"|employeeId/);
});

test("missing or changed-role teacher links cannot fall back to matching employee email", async () => {
  for (const options of [{ teacherLinked: false }, { teacherRole: "superAdmin" }, { verified: false }]) {
    const loaded = harness({ role: "teacher", ...options });
    const result = await loaded.service.getMyInformation();
    assert.equal(result.profile, null);
    assert.equal(loaded.teacherQueries.length, 1);
    assert.equal(loaded.studentQueries.length, 0);
  }
});

test("invalid teacher IDs cannot create an unscoped lookup or lose BigInt precision", async () => {
  for (const id of ["", " ", "0", "-1", "invalid", "9.0", "9223372036854775808"]) {
    const loaded = harness({ role: "teacher", id });
    const result = await loaded.service.getMyInformation();
    assert.equal(result.profile, null);
    assert.equal(loaded.teacherQueries.length, 0);
    assert.equal(loaded.studentQueries.length, 0);
  }
});

test("teacher information returns explicit saved fields and date-only strings without account internals", async () => {
  const loaded = harness({ role: "teacher" });
  const result = await loaded.service.getMyInformation();
  assert.ok(result.profile?.kind === "teacher");
  assert.equal(result.profile.name, "Ana Reyes Cruz III");
  assert.equal(result.profile.personal.birthDate, "1987-11-20");
  assert.equal(result.profile.contact.email, "ana@example.test");
  assert.equal(result.profile.employment.employeeId, "TEACHER-007");
  assert.equal(result.profile.employment.dateStarted, "2021-06-01");
  assert.equal(result.profile.employment.status, "Regular");
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|passwordHash|userId|employeeId":222|tin|sssNo|philHealthNo|pagIbigNo/);
  const selection = loaded.teacherQueries[0].select.employee.select;
  assert.deepEqual(Object.keys(selection).sort(), ["address", "birthDate", "civilStatus", "contactNumber", "dateStarted", "emailAddress",
    "employeeId", "firstName", "gender", "lastName", "middleName", "nationality", "placeOfBirth", "role", "status", "suffix"]);
});

test("student resolution escapes every ILIKE wildcard and remains scoped to the current normalized email", async () => {
  const loaded = harness({ email: " STUDENT_%\\@EXAMPLE.TEST " });
  await loaded.service.getMyInformation();
  const [resolution, profile] = loaded.studentQueries;
  assert.equal(resolution.where.email.equals, "student\\_\\%\\\\@example.test");
  assert.equal(resolution.where.email.mode, "insensitive");
  assert.equal(resolution.take, 2);
  assert.deepEqual(Object.keys(resolution.select), ["id"]);
  assert.equal(profile.where.id, loaded.ownStudentId);
  assert.equal(profile.where.email.equals, resolution.where.email.equals);
  assert.equal(profile.where.email.mode, "insensitive");
  assert.deepEqual(loaded.events, ["session", "student resolution", "student profile"]);
});

test("missing and ambiguous case-only student profiles stop before reading private profile relations", async () => {
  for (const matches of [0, 2]) {
    const loaded = harness({ matches });
    const result = await loaded.service.getMyInformation();
    assert.equal(result.profile, null);
    assert.equal(loaded.studentQueries.length, 1);
    assert.deepEqual(Object.keys(loaded.studentQueries[0].select), ["id"]);
    assert.equal(loaded.teacherQueries.length, 0);
  }
});

test("blank student session email never queries arbitrary saved students", async () => {
  const loaded = harness({ email: " " });
  assert.equal((await loaded.service.getMyInformation()).profile, null);
  assert.equal(loaded.studentQueries.length, 0);
  assert.equal(loaded.teacherQueries.length, 0);
});

test("a removed student profile between resolution and loading yields a safe missing-record result", async () => {
  const loaded = harness({ studentFound: false });
  assert.equal((await loaded.service.getMyInformation()).profile, null);
  assert.equal(loaded.studentQueries.length, 2);
});

test("caller-supplied identity arguments cannot choose another profile or teacher account", async () => {
  for (const role of ["student", "teacher"]) {
    const loaded = harness({ role });
    const invoke = loaded.service.getMyInformation as (...args: unknown[]) => Promise<informationService.MyInformation>;
    await invoke({ id: "999", email: "victim@example.test", role: "superAdmin" }, "other@example.test");
    const queries = [...loaded.studentQueries, ...loaded.teacherQueries];
    assert.doesNotMatch(JSON.stringify(queries, (_, value) => typeof value === "bigint" ? value.toString() : value), /victim|other@example|superAdmin|"999"/);
    assert.equal(loaded.service.getMyInformation.length, 0);
  }
});

test("student information preserves saved identifiers, own contact and guardian fields with safe serialization", async () => {
  const loaded = harness();
  const result = await loaded.service.getMyInformation();
  assert.ok(result.profile?.kind === "student");
  assert.equal(result.profile.name, "Maria Santos");
  assert.equal(result.profile.studentNumber, "00007");
  assert.equal(result.profile.personal.birthDate, "2006-12-31");
  assert.equal(result.profile.contact.phone, "09000000000");
  assert.equal(result.profile.contact.address, "7, Mabini, Central, Cotabato, Maguindanao, 9600");
  assert.equal(result.profile.guardian?.name, "Lea Santos");
  assert.equal(result.profile.guardian?.relationship, "Mother");
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|passwordHash|\"id\"|addressId|studentId|userId|classes|students|remarks/);
  const selection = loaded.studentQueries[1].select;
  assert.equal("id" in selection, false);
  assert.equal("classes" in selection, false);
  assert.equal("passwordHash" in selection, false);
});

test("student academic summary comes only from latest own nested admission with deterministic ordering", async () => {
  const loaded = harness();
  const result = await loaded.service.getMyInformation();
  assert.ok(result.profile?.kind === "student");
  const admission = result.profile.admission;
  assert.equal(admission?.branch, "Main Campus");
  assert.equal(admission?.program, "BS Information Technology");
  assert.equal(admission?.yearLevel, "FirstYear");
  assert.equal(admission?.status, "approved");
  assert.equal(admission?.submittedAt, "2026-07-13");
  assert.equal(admission?.lastSchool?.name, "Sample High School");
  assert.equal(admission?.lastSchool?.graduationDate, "2026-04-15");
  const applicationQuery = loaded.studentQueries[1].select.applications as { take: number; orderBy: unknown; select: Record<string, unknown> };
  assert.equal(applicationQuery.take, 1);
  assert.equal(JSON.stringify(applicationQuery.orderBy), JSON.stringify([{ submittedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" }]));
  assert.equal("student" in applicationQuery.select, false);
  assert.equal("remarks" in applicationQuery.select, false);
  const guardianQuery = loaded.studentQueries[1].select.guardians as { take: number; select: Record<string, unknown> };
  assert.equal(guardianQuery.take, 1);
  assert.equal("students" in guardianQuery.select, false);
});

test("students without optional addresses, guardians, or admissions retain a usable own profile", async () => {
  const loaded = harness({ studentExtras: false });
  const result = await loaded.service.getMyInformation();
  assert.ok(result.profile?.kind === "student");
  assert.equal(result.profile.name, "Maria Santos");
  assert.equal(result.profile.contact.address, null);
  assert.equal(result.profile.guardian, null);
  assert.equal(result.profile.admission, null);
  assert.doesNotThrow(() => JSON.stringify(result));
});
