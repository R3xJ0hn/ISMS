import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { literalInsensitiveEquality, normalizeEmail } from "../lib/utils";
import { loadStudentIdentityService } from "./student-services-harness";
import * as periodVisibility from "../lib/classes/period-visibility";
import type * as semesterVisibility from "../lib/classes/semester-visibility";
import type { StudentGrade } from "../lib/student-grades";

const code = ts.transpileModule(readFileSync(new URL("../lib/classes/semester-visibility.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText;
const student = { id: 9007199254740993n, firstName: "Ana", middleName: null, lastName: "Cruz", suffix: null, studentNumber: "0007" };
type ProfileQuery = { where: { email: { equals: string; mode: string } }; select: Record<string, boolean>; take: number };
type ClassQuery = { where: { students: { some: { studentId: bigint } }; teacher: { user: { role: string; emailVerified: boolean } } }; select: Record<string, unknown> };

function harness({ denied = false, role = "student", email = "Student@Example.test", profiles = 1, enrolled = true, teacherRole = "teacher", teacherVerified = true, classes = [] as semesterVisibility.SemesterClassVisibility[] } = {}) {
  const events: string[] = [];
  const profileQueries: ProfileQuery[] = [];
  const classQueries: ClassQuery[] = [];
  const modules: Record<string, unknown> = {
    "@/lib/auth": { requireSession: async () => { events.push("authorize"); if (denied) throw new Error("Verified session required"); return { role, email, emailVerified: true }; } },
    "@/lib/utils": { literalInsensitiveEquality, normalizeEmail },
    "./period-visibility": periodVisibility,
    "next/navigation": { redirect: (path: string) => { throw new Error("Redirect " + path); } },
    "@/lib/prisma": { prisma: {
      student: { findMany: async (query: ProfileQuery) => {
        events.push("profile"); profileQueries.push(query);
        return Array.from({ length: profiles }, (_, index) => ({ ...student, id: student.id + BigInt(index) }));
      } },
      class: { findMany: async (query: ClassQuery) => {
        events.push("classes"); classQueries.push(query);
        const authorized = enrolled && query.where.students.some.studentId === student.id &&
          query.where.teacher.user.role === teacherRole && query.where.teacher.user.emailVerified === teacherVerified;
        return authorized ? classes : [];
      } },
    } },
  };
  modules["@/lib/portal/student"] = loadStudentIdentityService(modules);
  const loaded = { exports: {} };
  runInNewContext(code, { module: loaded, exports: loaded.exports, require: (name: string) => { assert.ok(name in modules, "Unexpected semester visibility dependency: " + name); return modules[name]; } });
  return { service: loaded.exports as typeof semesterVisibility, events, profileQueries, classQueries };
}

function grade(overrides: Partial<StudentGrade> = {}): StudentGrade {
  return {
    subject: "Computing", code: "IT101", units: "3", instructor_id: "teacher-7", instructor_name: "Teacher",
    prelim: "81.111", midterm: "82.222", prefinals: "83.333", finals: "84.444", average: "88.888",
    remarks: "PRIVATE OVERALL REMARK", note: "PRIVATE OVERALL NOTE", raw: { privateRaw: "PRIVATE RAW RECORD", prelim: "81.111", average: "88.888" }, ...overrides,
  };
}
function rule(overrides: Partial<semesterVisibility.SemesterClassVisibility> = {}): semesterVisibility.SemesterClassVisibility {
  return { ...periodVisibility.defaultClassPeriodVisibility, semester: null, subjectName: "Computing", subject: { code: "IT101", name: "Computing" }, ...overrides };
}

test("semester visibility requires a verified student session before reading profiles or classes", async () => {
  const denied = harness({ denied: true });
  await assert.rejects(denied.service.getStudentSemesterGradeVisibility(), /Verified session required/);
  assert.deepEqual(denied.events, ["authorize"]);
  for (const role of ["teacher", "admin", "superAdmin", "registrar"]) {
    const loaded = harness({ role });
    await assert.rejects(loaded.service.getStudentSemesterGradeVisibility(), /Redirect \/portal/);
    assert.equal(loaded.profileQueries.length, 0);
    assert.equal(loaded.classQueries.length, 0);
  }
});

test("semester visibility resolves only one normalized literal session email and fails closed for ambiguous profiles", async () => {
  const loaded = harness({ email: " STUDENT_%\\@EXAMPLE.TEST " });
  await loaded.service.getStudentSemesterGradeVisibility();
  assert.equal(loaded.profileQueries[0].where.email.equals, "student\\_\\%\\\\@example.test");
  assert.equal(loaded.profileQueries[0].where.email.mode, "insensitive");
  assert.equal(loaded.profileQueries[0].take, 2);
  for (const profiles of [0, 2]) {
    const ambiguous = harness({ profiles });
    const result = await ambiguous.service.getStudentSemesterGradeVisibility();
    assert.equal(result.student, null);
    assert.equal(result.classes.length, 0);
    assert.equal(ambiguous.classQueries.length, 0);
  }
  const blank = harness({ email: " " });
  assert.equal((await blank.service.getStudentSemesterGradeVisibility()).student, null);
  assert.equal(blank.profileQueries.length, 0);
});

test("semester period settings use student membership and verified teacher ownership without sheet URLs or rosters", async () => {
  const loaded = harness({ classes: [rule({ prelimVisible: false })] });
  const result = await loaded.service.getStudentSemesterGradeVisibility();
  assert.equal(result.student?.studentNumber, "0007");
  assert.equal(result.classes.length, 1);
  const query = loaded.classQueries[0];
  assert.equal(query.where.students.some.studentId, student.id);
  assert.deepEqual(JSON.parse(JSON.stringify(query.where.teacher)), { user: { role: "teacher", emailVerified: true } });
  assert.doesNotMatch(JSON.stringify(query.select), /spreadsheetUrl|students|employee|phone|birth|password|userId/);
  assert.deepEqual(JSON.parse(JSON.stringify(query.select.subject)), { select: { code: true, name: true } });
  assert.equal(query.select.semester, true);
  for (const field of ["prelimVisible", "midtermVisible", "prefinalsVisible", "finalsVisible"]) assert.equal(query.select[field], true);
  for (const options of [{ enrolled: false }, { teacherRole: "superAdmin" }, { teacherRole: "admin" }, { teacherVerified: false }]) {
    const unavailable = harness({ ...options, classes: [rule()] });
    assert.equal((await unavailable.service.getStudentSemesterGradeVisibility()).classes.length, 0);
  }
});

test("semester grades apply only their own known term while legacy rules still protect both terms", () => {
  const { service } = harness();
  for (const [semester, opposite] of [["FirstSemester", "SecondSemester"], ["SecondSemester", "FirstSemester"]] as const) {
    const hiddenOtherTerm = rule({ semester: opposite, prelimVisible: false });
    const visibleCurrentTerm = rule({ semester });
    const [visible] = service.filterSemesterGradesByVisibility([grade()], [hiddenOtherTerm, visibleCurrentTerm], semester);
    assert.equal(visible.prelim, "81.111");
    assert.equal(visible.average, "88.888");
    assert.equal(visible.periodVisibility.prelimVisible, true);
    for (const hidden of [rule({ semester, prelimVisible: false }), rule({ semester: null, prelimVisible: false })]) {
      const [privateRow] = service.filterSemesterGradesByVisibility([grade()], [visibleCurrentTerm, hiddenOtherTerm, hidden], semester);
      assert.equal(privateRow.prelim, null);
      assert.equal(privateRow.average, null);
      assert.equal(privateRow.remarks, null);
      assert.equal(privateRow.note, null);
      assert.doesNotMatch(JSON.stringify(privateRow), /81\.111|88\.888|PRIVATE OVERALL|PRIVATE RAW/);
    }
  }
  assert.equal(service.filterSemesterGradesByVisibility([grade()], [rule({ semester: "SecondSemester", prelimVisible: false })])[0].prelim, null, "Without a requested term, existing conservative behavior must remain");
});

test("semester rows remove every hidden grade plus averages and narrative fields before being passed to the table", () => {
  const { service } = harness();
  for (const [field, gradeField, privateGrade] of [
    ["prelimVisible", "prelim", "81.111"], ["midtermVisible", "midterm", "82.222"],
    ["prefinalsVisible", "prefinals", "83.333"], ["finalsVisible", "finals", "84.444"],
  ] as const) {
    const original = grade();
    const before = JSON.stringify(original);
    const [row] = service.filterSemesterGradesByVisibility([original], [rule({ [field]: false })]);
    assert.equal(row[gradeField], null);
    assert.equal(row.periodVisibility[field], false);
    assert.equal(row.average, null);
    assert.equal(row.remarks, null);
    assert.equal(row.note, null);
    assert.equal("raw" in row, false);
    for (const privateValue of [privateGrade, "88.888", "PRIVATE OVERALL", "PRIVATE RAW RECORD"]) assert.equal(JSON.stringify(row).includes(privateValue), false, `${field}: ${privateValue}`);
    for (const visibleField of ["prelim", "midterm", "prefinals", "finals"] as const) if (visibleField !== gradeField) assert.equal(row[visibleField], original[visibleField]);
    assert.equal(JSON.stringify(original), before);
  }
});

test("semester matching uses exact normalized subject codes and falls back to saved names only without a code", () => {
  const { service } = harness();
  const hidden = rule({ prelimVisible: false, subjectName: "Legacy subject label", subject: { code: " IT101 ", name: "Canonical computing" } });
  assert.equal(service.filterSemesterGradesByVisibility([grade({ code: "it101", subject: "Changed display name" })], [hidden])[0].prelim, null);
  assert.equal(service.filterSemesterGradesByVisibility([grade({ code: "IT102", subject: "Canonical computing" })], [hidden])[0].prelim, "81.111", "Different supplied codes cannot match only by name");
  assert.equal(service.filterSemesterGradesByVisibility([grade({ code: null, subject: " CANONICAL   COMPUTING " })], [hidden])[0].prelim, null);
  assert.equal(service.filterSemesterGradesByVisibility([grade({ subject: "Computing" })], [rule({ subject: null, prelimVisible: false })])[0].prelim, null);
  assert.equal(service.filterSemesterGradesByVisibility([grade({ code: null, subject: "Computing laboratory" })], [rule({ prelimVisible: false })])[0].prelim, "81.111", "Subject substrings cannot match");
});

test("multiple class assignments combine hidden periods so a visible class cannot reveal another class's record", () => {
  const { service } = harness();
  const [row] = service.filterSemesterGradesByVisibility([grade()], [rule(), rule({ prelimVisible: false }), rule({ finalsVisible: false })]);
  assert.deepEqual(JSON.parse(JSON.stringify(row.periodVisibility)), { prelimVisible: false, midtermVisible: true, prefinalsVisible: true, finalsVisible: false });
  assert.equal(row.prelim, null);
  assert.equal(row.finals, null);
  assert.equal(row.midterm, "82.222");
  assert.equal(row.prefinals, "83.333");
  assert.doesNotMatch(JSON.stringify(row), /81\.111|84\.444|88\.888|PRIVATE OVERALL|PRIVATE RAW/);
});

test("unmatched and fully visible semester rows keep supplied grades while raw source payloads are always stripped", () => {
  const { service } = harness();
  for (const rules of [[], [rule()], [rule({ subject: { code: "OTHER", name: "Other" }, subjectName: "Other", prelimVisible: false })]]) {
    const [row] = service.filterSemesterGradesByVisibility([grade()], rules);
    assert.equal(row.prelim, "81.111");
    assert.equal(row.average, "88.888");
    assert.equal(row.remarks, "PRIVATE OVERALL REMARK");
    assert.equal(row.note, "PRIVATE OVERALL NOTE");
    assert.equal("raw" in row, false);
    assert.deepEqual(JSON.parse(JSON.stringify(row.periodVisibility)), periodVisibility.defaultClassPeriodVisibility);
  }
  assert.equal(service.filterSemesterGradesByVisibility([], [rule()]).length, 0);
});
