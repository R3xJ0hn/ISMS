import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type * as studentService from "../lib/classes/student";
import { getEmployeeFullName } from "../lib/employees/names";
import { formatStudentName, literalInsensitiveEquality, normalizeEmail } from "../lib/utils";
import { loadStudentIdentityService } from "./student-services-harness";
import { parseClassId } from "../lib/classes/validation";
import type { ClassSummaryStudent, StudentClassworkResult } from "../lib/classes/spreadsheet";
import * as periodVisibility from "../lib/classes/period-visibility";
import * as studentPreview from "../lib/classes/student-preview";

const code = ts.transpileModule(
  readFileSync(new URL("../lib/classes/student.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } },
).outputText;

function grade(studentNumber: string, studentName = "Student", average = "90"): ClassSummaryStudent {
  return { studentNumber, studentName, prelim: "0", midterm: null, prefinals: null, finals: null, average, remarks: "Passed", note: null };
}

function harness({
  denied = false, role = "student", email = "Student@Example.test", profiles = 1,
  studentNumber = "0007" as string | null, enrolled = true, teacherRole = "teacher",
  teacherVerified = true, linked = true, semester = "FirstSemester" as "FirstSemester" | "SecondSemester" | null,
  visibility = {} as Partial<periodVisibility.ClassPeriodVisibility>,
  afterSheetRead = undefined as { visibility?: Partial<periodVisibility.ClassPeriodVisibility>; enrolled?: boolean } | undefined,
  records = { success: true, record: grade("0007"), periods: [{ period: "Prelim", categories: [{ name: "Written Work", weight: 30, activities: [{ name: "Quiz 1", maxScore: 20, isExcludable: false, score: "0" }] }] }] } as StudentClassworkResult,
} = {}) {
  const profileQueries: Array<{ where: { email: { equals: string; mode: string } }; take: number; select: Record<string, unknown> }> = [];
  const classQueries: Array<{
    where: { id?: bigint; students: { some: { studentId: bigint } }; teacher: { user: { role: string; emailVerified: boolean } } };
    select: Record<string, unknown>;
  }> = [];
  const summaryRequests: Array<{ url: string; studentNumber: string }> = [];
  const student = { id: 9007199254740993n, firstName: "Maria", middleName: null, lastName: "Santos", suffix: null, studentNumber };
  const assigned = {
    id: 7n, schoolYear: "2026-2027", semester, sectionName: "IT 1-A", yearLevel: "FirstYear", subjectName: "Computing",
    spreadsheetUrl: linked ? "https://docs.google.com/spreadsheets/d/test-sheet/edit" : null,
    branch: { title: "Main Branch" },
    teacher: { employee: { firstName: "Ana", middleName: null, lastName: "Cruz", suffix: null } },
    students: [{ student: { ...student, userImage: "https://res.cloudinary.com/test/image/upload/student.jpg", email: "private@example.test" } }],
    _count: { students: 12 },
    ...visibility,
  };
  const authorized = (query: typeof classQueries[number]) =>
    enrolled && query.where.students.some.studentId === student.id &&
    query.where.teacher.user.role === teacherRole && query.where.teacher.user.emailVerified === teacherVerified;
  const modules: Record<string, unknown> = {
    "@/lib/auth": { requireSession: async () => {
      if (denied) throw new Error("Verified session required");
      return { role, email, emailVerified: true };
    } },
    "@/lib/prisma": { prisma: {
      student: { findMany: async (query: typeof profileQueries[number]) => {
        profileQueries.push(query);
        return Array.from({ length: profiles }, (_, index) => ({ ...student, id: student.id + BigInt(index) }));
      } },
      class: {
        findMany: async (query: typeof classQueries[number]) => {
          classQueries.push(query);
          return authorized(query) ? [assigned] : [];
        },
        findFirst: async (query: typeof classQueries[number]) => {
          classQueries.push(query);
          return authorized(query) && query.where.id === assigned.id ? assigned : null;
        },
      },
    } },
    "next/navigation": { redirect: (path: string) => { throw new Error("Redirect " + path); } },
    "@/lib/employees/names": { getEmployeeFullName },
    "@/lib/utils": { formatStudentName, literalInsensitiveEquality, normalizeEmail },
    "./spreadsheet": { getStudentClasswork: async (url: string, number: string) => {
      summaryRequests.push({ url, studentNumber: number });
      if (afterSheetRead?.visibility) Object.assign(assigned, afterSheetRead.visibility);
      if (typeof afterSheetRead?.enrolled === "boolean") enrolled = afterSheetRead.enrolled;
      return records;
    } },
    "./validation": { parseClassId },
    "./period-visibility": periodVisibility,
    "./student-preview": studentPreview,
  };
  modules["@/lib/portal/student"] = loadStudentIdentityService(modules);
  const loaded = { exports: {} };
  runInNewContext(code, {
    module: loaded, exports: loaded.exports,
    require: (name: string) => {
      assert.ok(name in modules, "Unexpected student class dependency: " + name);
      return modules[name];
    },
  });
  return { service: loaded.exports as typeof studentService, profileQueries, classQueries, summaryRequests };
}

test("student classroom denies unauthenticated or unverified sessions before profile, class, or sheet access", async () => {
  const loaded = harness({ denied: true });
  await assert.rejects(loaded.service.getStudentClasses(), /Verified session required/);
  await assert.rejects(loaded.service.getStudentClass("7"), /Verified session required/);
  assert.equal(loaded.profileQueries.length, 0);
  assert.equal(loaded.classQueries.length, 0);
  assert.equal(loaded.summaryRequests.length, 0);
});

test("teacher and administrative roles cannot access a student's classes", async () => {
  for (const role of ["teacher", "admin", "superAdmin", "registrar"]) {
    const loaded = harness({ role });
    await assert.rejects(loaded.service.getStudentClasses(), /Redirect \/portal/);
    await assert.rejects(loaded.service.getStudentClass("7"), /Redirect \/portal/);
    assert.equal(loaded.profileQueries.length, 0);
    assert.equal(loaded.classQueries.length, 0);
    assert.equal(loaded.summaryRequests.length, 0);
  }
});

test("student profile resolution compares current email case-insensitively and escapes LIKE wildcards literally", async () => {
  const loaded = harness({ email: " STUDENT_%\\@EXAMPLE.TEST " });
  await loaded.service.getStudentClasses();
  const query = loaded.profileQueries[0];
  assert.equal(query.where.email.equals, "student\\_\\%\\\\@example.test");
  assert.equal(query.where.email.mode, "insensitive");
  assert.equal(query.take, 2);
  assert.deepEqual(Object.keys(query.select).sort(), ["firstName", "id", "lastName", "middleName", "studentNumber", "suffix"]);
});

test("missing and ambiguous student profiles fail closed without any class or spreadsheet read", async () => {
  for (const profiles of [0, 2]) {
    const loaded = harness({ profiles });
    assert.equal((await loaded.service.getStudentClasses()).length, 0);
    assert.equal(await loaded.service.getStudentClass("7"), null);
    assert.equal(loaded.classQueries.length, 0);
    assert.equal(loaded.summaryRequests.length, 0);
  }
});

test("blank session email cannot query profiles or create an unscoped class read", async () => {
  const loaded = harness({ email: " " });
  assert.equal((await loaded.service.getStudentClasses()).length, 0);
  assert.equal(await loaded.service.getStudentClass("7"), null);
  assert.equal(loaded.profileQueries.length, 0);
  assert.equal(loaded.classQueries.length, 0);
});

test("student class cards return a bounded display roster only for an authorized class, without private records", async () => {
  const loaded = harness();
  const classes = await loaded.service.getStudentClasses();
  assert.equal(classes.length, 1);
  assert.equal(classes[0].id, "7");
  assert.equal(classes[0].teacherName, "Ana Cruz");
  assert.equal(classes[0].branchTitle, "Main Branch");
  assert.equal(classes[0].spreadsheetLinked, true);
  assert.equal(classes[0].semester, "FirstSemester");
  const query = loaded.classQueries[0];
  assert.equal(query.where.students.some.studentId, 9007199254740993n);
  assert.equal(query.where.teacher.user.role, "teacher");
  assert.equal(query.where.teacher.user.emailVerified, true);
  assert.deepEqual(JSON.parse(JSON.stringify(query.select.students)), studentPreview.classStudentPreviewSelection.students);
  assert.deepEqual(JSON.parse(JSON.stringify(query.select._count)), { select: { students: true } });
  assert.equal(query.select.semester, true);
  assert.doesNotMatch(JSON.stringify(query.select), /email|phone|birthDate|password|userId/);
  assert.equal(classes[0].studentCount, 12);
  assert.deepEqual(Array.from(classes[0].studentPreviews), [{ id: "9007199254740993", name: "Maria Santos", imageUrl: "https://res.cloudinary.com/test/image/upload/student.jpg" }]);
  assert.doesNotMatch(JSON.stringify(classes), /spreadsheetUrl|docs\.google|"students"|"studentNumber"|"email"|private@example/);
  assert.equal(loaded.summaryRequests.length, 0);
});

test("student class cards and details preserve every authorized semester including legacy unassigned classes", async () => {
  for (const semester of ["FirstSemester", "SecondSemester", null] as const) {
    const loaded = harness({ semester });
    const classes = await loaded.service.getStudentClasses();
    const detail = await loaded.service.getStudentClass("7");
    assert.equal(classes[0].semester, semester);
    assert.equal(detail?.semester, semester);
    for (const query of loaded.classQueries) {
      assert.equal(query.select.semester, true);
      assert.equal(query.where.students.some.studentId, 9007199254740993n);
      assert.equal(query.where.teacher.user.emailVerified, true);
    }
    assert.doesNotMatch(JSON.stringify(classes), /spreadsheetUrl|docs\.google|students/);
  }
});

test("guessed or unenrolled class IDs never fetch spreadsheet data", async () => {
  const guessed = harness();
  assert.equal(await guessed.service.getStudentClass("8"), null);
  assert.equal(guessed.summaryRequests.length, 0);
  const unenrolled = harness({ enrolled: false });
  assert.equal((await unenrolled.service.getStudentClasses()).length, 0);
  assert.equal(await unenrolled.service.getStudentClass("7"), null);
  assert.equal(unenrolled.summaryRequests.length, 0);
});

test("classes assigned to a hidden administrative or unverified teacher account remain unavailable", async () => {
  for (const options of [{ teacherRole: "superAdmin" }, { teacherRole: "admin" }, { teacherVerified: false }]) {
    const loaded = harness(options);
    assert.equal((await loaded.service.getStudentClasses()).length, 0);
    assert.equal(await loaded.service.getStudentClass("7"), null);
    assert.equal(loaded.summaryRequests.length, 0);
  }
});

test("invalid class identifiers cannot trigger class or spreadsheet requests", async () => {
  const loaded = harness();
  for (const id of ["", "0", "-1", "bad", "7.0", "9223372036854775808"]) {
    assert.equal(await loaded.service.getStudentClass(id), null);
  }
  assert.equal(loaded.classQueries.length, 0);
  assert.equal(loaded.summaryRequests.length, 0);
});

test("class details return only the student's exact trimmed number, retaining leading zeros and zero grades", async () => {
  const loaded = harness({ studentNumber: " 0007 " });
  const result = await loaded.service.getStudentClass("7");
  assert.ok(result?.grades.success);
  assert.equal(result.student.name, "Maria Santos");
  assert.equal(result.student.studentNumber, "0007");
  assert.equal(result.grades.record?.average, "90");
  assert.equal(result.grades.record?.prelim, "0");
  assert.ok(result.classwork.success);
  assert.equal(result.classwork.periods[0].categories[0].activities[0].score, "0");
  assert.equal(loaded.summaryRequests.length, 1);
  assert.equal(loaded.summaryRequests[0].studentNumber, "0007");
  assert.doesNotMatch(JSON.stringify(result), /Other student|Other number|docs\.google|spreadsheetUrl/);
  assert.equal("students" in result, false);
  assert.equal("students" in loaded.classQueries[0].select, false, "The grade detail request must not load classmates");
  assert.equal("studentPreviews" in result, false);
});

test("student number matches are case-sensitive and never fall back to names or numeric equality", async () => {
  for (const [studentNumber, otherNumber] of [["AB007", "ab007"], ["0007", "7"]]) {
    const loaded = harness({ studentNumber, records: { success: true, record: grade(otherNumber, "Maria Santos"), periods: [{ period: "Prelim", categories: [{ name: "Written Work", weight: 30, activities: [{ name: "Other student's private work", maxScore: 20, isExcludable: false, score: "19" }] }] }] } });
    const result = await loaded.service.getStudentClass("7");
    assert.ok(result && !result.grades.success && !result.classwork.success);
    assert.match(result.grades.message, /cannot be matched safely/);
    assert.doesNotMatch(JSON.stringify(result), /Other student's private work|"average"|"score"/);
  }
});

test("missing student numbers explain the limited view and never fetch the teacher's full spreadsheet", async () => {
  for (const studentNumber of [null, "", " "]) {
    const loaded = harness({ studentNumber });
    const result = await loaded.service.getStudentClass("7");
    assert.ok(result && !result.grades.success);
    assert.match(result.grades.message, /student number is not available/);
    assert.equal(result.student.studentNumber, null);
    assert.ok(!result.classwork.success);
    assert.match(result.classwork.message, /student number is not available/);
    assert.equal(loaded.summaryRequests.length, 0);
  }
});

test("unlinked class summaries wait for the teacher without fetching external data", async () => {
  const loaded = harness({ linked: false });
  const result = await loaded.service.getStudentClass("7");
  assert.ok(result && !result.grades.success);
  assert.match(result.grades.message, /teacher has not connected/);
  assert.equal(result.spreadsheetLinked, false);
  assert.ok(!result.classwork.success);
  assert.match(result.classwork.message, /teacher has not connected/);
  assert.equal(loaded.summaryRequests.length, 0);
});

test("hidden spreadsheet records expose neither grades nor activity scores", async () => {
  const loaded = harness({ records: { success: false, message: "This class has not enabled spreadsheet records in the portal." } });
  const result = await loaded.service.getStudentClass("7");
  assert.ok(result && !result.grades.success && !result.classwork.success);
  assert.match(result.classwork.message, /not enabled spreadsheet records/);
  assert.match(result.grades.message, /not enabled spreadsheet records/);
  assert.doesNotMatch(JSON.stringify(result), /"average"|"score"|"periods"/);
});

test("spreadsheet failures show a student-safe message without provider details or other students' records", async () => {
  const loaded = harness({ records: { success: false, message: "Duplicate student number: OTHER-PRIVATE-ID" } });
  const result = await loaded.service.getStudentClass("7");
  assert.ok(result && !result.grades.success);
  assert.match(result.grades.message, /unavailable right now/);
  assert.ok(!result.classwork.success);
  assert.match(result.classwork.message, /unavailable right now/);
  assert.doesNotMatch(JSON.stringify(result), /OTHER-PRIVATE-ID|Duplicate student/);
});

test("student class records explain known spreadsheet matching failures without displaying provider details", async () => {
  for (const [code, expected] of [
    ["STUDENT_NUMBER_NOT_FOUND", /student number is not listed/],
    ["STUDENT_REPORT_NOT_FOUND", /REPORT sheet/],
    ["STUDENT_RECORD_AMBIGUOUS", /cannot be matched safely/],
  ] as const) {
    const loaded = harness({ records: { success: false, code, message: "OTHER-PRIVATE-STUDENT-DETAILS" } });
    const result = await loaded.service.getStudentClass("7");
    assert.ok(result && !result.grades.success && !result.classwork.success);
    assert.match(result.grades.message, expected);
    assert.match(result.classwork.message, expected);
    assert.doesNotMatch(JSON.stringify(result), /OTHER-PRIVATE-STUDENT-DETAILS|"record"|"score"|"periods"/);
  }
});

function completeStudentRecords(): StudentClassworkResult {
  return {
    success: true,
    record: { studentNumber: "0007", studentName: "Student", prelim: "81.11", midterm: "82.22", prefinals: "83.33", finals: "84.44", average: "82.78", remarks: "PRIVATE OVERALL REMARK", note: "PRIVATE OVERALL NOTE" },
    periods: ["Prelim", "Midterm", "Prefinals", "Finals"].map((period, index) => ({
      period: period as "Prelim" | "Midterm" | "Prefinals" | "Finals",
      categories: [{ name: `${period} category`, weight: 30 + index, activities: [{ name: `${period} private activity`, maxScore: 20, isExcludable: false, score: `${10 + index}.11` }] }],
    })),
  };
}

test("each hidden grading period is removed from student classwork and its grade is null before serialization", async () => {
  for (const [field, recordField, period, hiddenGrade] of [
    ["prelimVisible", "prelim", "Prelim", "81.11"],
    ["midtermVisible", "midterm", "Midterm", "82.22"],
    ["prefinalsVisible", "prefinals", "Prefinals", "83.33"],
    ["finalsVisible", "finals", "Finals", "84.44"],
  ] as const) {
    const records = completeStudentRecords();
    const before = JSON.stringify(records);
    const loaded = harness({ visibility: { [field]: false }, records });
    const result = await loaded.service.getStudentClass("7");
    assert.ok(result?.grades.success && result.grades.record && result.classwork.success);
    assert.equal(result.grades.record[recordField], null, `${period} grade must be omitted`);
    assert.equal(result.classwork.periods.length, 3);
    assert.equal(result.classwork.periods.some((item) => item.period === period), false);
    assert.equal(result.periodVisibility[field], false);
    for (const [otherField, otherPeriod, otherGrade] of [["prelim", "Prelim", "81.11"], ["midterm", "Midterm", "82.22"], ["prefinals", "Prefinals", "83.33"], ["finals", "Finals", "84.44"]] as const) {
      if (otherField === recordField) continue;
      assert.equal(result.grades.record[otherField], otherGrade);
      assert.ok(result.classwork.periods.some((item) => item.period === otherPeriod));
    }
    const serialized = JSON.stringify(result);
    for (const privateValue of [hiddenGrade, `${period} category`, `${period} private activity`, "82.78", "PRIVATE OVERALL REMARK", "PRIVATE OVERALL NOTE"]) {
      assert.equal(serialized.includes(privateValue), false, `${period}: hidden ${privateValue} must not reach the browser`);
    }
    assert.equal(result.grades.record.average, null);
    assert.equal(result.grades.record.remarks, null);
    assert.equal(result.grades.record.note, null);
    assert.equal(JSON.stringify(records), before, "Filtering must leave the full teacher spreadsheet response untouched");
    assert.equal(loaded.summaryRequests.length, 1);
  }
});

test("multiple hidden periods retain only enabled work and never return the aggregate fields", async () => {
  const loaded = harness({ visibility: { prelimVisible: false, prefinalsVisible: false, finalsVisible: false }, records: completeStudentRecords() });
  const result = await loaded.service.getStudentClass("7");
  assert.ok(result?.grades.success && result.grades.record && result.classwork.success);
  assert.deepEqual(Array.from(result.classwork.periods, (period) => period.period), ["Midterm"]);
  assert.equal(result.grades.record.midterm, "82.22");
  for (const field of ["prelim", "prefinals", "finals", "average", "remarks", "note"] as const) assert.equal(result.grades.record[field], null);
  assert.doesNotMatch(JSON.stringify(result), /81\.11|83\.33|84\.44|82\.78|PRIVATE OVERALL|Prelim private activity|Prefinals private activity|Finals private activity/);
});

test("legacy fixtures and explicitly visible periods preserve all own student grades and classwork", async () => {
  for (const visibility of [{}, { prelimVisible: true, midtermVisible: true, prefinalsVisible: true, finalsVisible: true }]) {
    const records = completeStudentRecords();
    assert.ok(records.success);
    const loaded = harness({ visibility, records });
    const result = await loaded.service.getStudentClass("7");
    assert.ok(result?.grades.success && result.classwork.success);
    assert.deepEqual(JSON.parse(JSON.stringify(result.grades.record)), records.record);
    assert.deepEqual(JSON.parse(JSON.stringify(result.classwork.periods)), records.periods);
    assert.deepEqual(JSON.parse(JSON.stringify(result.periodVisibility)), { prelimVisible: true, midtermVisible: true, prefinalsVisible: true, finalsVisible: true });
  }
});

test("hiding every period avoids requesting any spreadsheet records while retaining assigned class metadata", async () => {
  const visibility = { prelimVisible: false, midtermVisible: false, prefinalsVisible: false, finalsVisible: false };
  const loaded = harness({ visibility, records: completeStudentRecords() });
  const result = await loaded.service.getStudentClass("7");
  assert.ok(result && !result.grades.success && !result.classwork.success);
  assert.equal(result.subjectName, "Computing");
  assert.match(result.grades.message, /teacher has hidden all grading periods/);
  assert.match(result.classwork.message, /teacher has hidden all grading periods/);
  assert.equal(loaded.summaryRequests.length, 0);
  assert.doesNotMatch(JSON.stringify(result), /81\.11|82\.22|83\.33|84\.44|82\.78|PRIVATE OVERALL|private activity|"record"|"periods"|"score"/);
});

test("period visibility cannot bypass spreadsheet record disabling or exact own-number matching", async () => {
  const visibility = { prelimVisible: false, finalsVisible: false };
  const hidden = harness({ visibility, records: { success: false, message: "This class has not enabled spreadsheet records in the portal." } });
  const hiddenResult = await hidden.service.getStudentClass("7");
  assert.ok(hiddenResult && !hiddenResult.grades.success && !hiddenResult.classwork.success);
  assert.doesNotMatch(JSON.stringify(hiddenResult), /"record"|"periods"|"score"/);
  const records = completeStudentRecords();
  if (records.success) records.record.studentNumber = "PRIVATE-OTHER-STUDENT";
  const mismatched = harness({ visibility, records });
  const mismatchedResult = await mismatched.service.getStudentClass("7");
  assert.ok(mismatchedResult && !mismatchedResult.grades.success && !mismatchedResult.classwork.success);
  assert.doesNotMatch(JSON.stringify(mismatchedResult), /PRIVATE-OTHER-STUDENT|PRIVATE OVERALL|private activity|81\.11|82\.22|83\.33|84\.44/);
});

test("a period hidden while Sheets is loading is removed using freshly scoped settings before returning records", async () => {
  const loaded = harness({ records: completeStudentRecords(), afterSheetRead: { visibility: { prelimVisible: false } } });
  const result = await loaded.service.getStudentClass("7");
  assert.ok(result?.grades.success && result.grades.record && result.classwork.success);
  assert.equal(result.periodVisibility.prelimVisible, false);
  assert.equal(result.grades.record.prelim, null);
  assert.equal(result.grades.record.midterm, "82.22");
  assert.equal(result.grades.record.average, null);
  assert.equal(result.classwork.periods.some((period) => period.period === "Prelim"), false);
  assert.doesNotMatch(JSON.stringify(result), /81\.11|Prelim private activity|82\.78|PRIVATE OVERALL/);
  assert.equal(loaded.classQueries.length, 2);
  for (const query of loaded.classQueries) assert.equal(query.where.students.some.studentId, 9007199254740993n);
  assert.equal(loaded.summaryRequests.length, 1);
});

test("hiding all periods while Sheets is loading discards the fetched grades and activities", async () => {
  const loaded = harness({ records: completeStudentRecords(), afterSheetRead: { visibility: { prelimVisible: false, midtermVisible: false, prefinalsVisible: false, finalsVisible: false } } });
  const result = await loaded.service.getStudentClass("7");
  assert.ok(result && !result.grades.success && !result.classwork.success);
  assert.match(result.grades.message, /teacher has hidden all grading periods/);
  assert.doesNotMatch(JSON.stringify(result), /81\.11|82\.22|83\.33|84\.44|82\.78|PRIVATE OVERALL|private activity|"record"|"periods"|"score"/);
  assert.equal(loaded.classQueries.length, 2);
  assert.equal(loaded.summaryRequests.length, 1);
});

test("student membership revoked while Sheets is loading prevents the fetched class record from being returned", async () => {
  const loaded = harness({ records: completeStudentRecords(), afterSheetRead: { enrolled: false } });
  assert.equal(await loaded.service.getStudentClass("7"), null);
  assert.equal(loaded.classQueries.length, 2);
  assert.equal(loaded.summaryRequests.length, 1);
});

test("refreshed period settings never make a different student's fetched record acceptable", async () => {
  const records = completeStudentRecords();
  assert.ok(records.success);
  records.record.studentNumber = "7";
  const loaded = harness({ records, afterSheetRead: { visibility: { prelimVisible: false } } });
  const result = await loaded.service.getStudentClass("7");
  assert.ok(result && !result.grades.success && !result.classwork.success);
  assert.match(result.grades.message, /cannot be matched safely/);
  assert.equal(loaded.summaryRequests[0].studentNumber, "0007");
  assert.doesNotMatch(JSON.stringify(result), /81\.11|82\.22|83\.33|84\.44|PRIVATE OVERALL|private activity|"record"|"score"/);
});
