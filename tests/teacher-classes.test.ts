import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseClassId, parseTeacherSpreadsheetForm } from "../lib/classes/validation";
import * as periodVisibility from "../lib/classes/period-visibility";
import * as studentPreview from "../lib/classes/student-preview";
import type * as teacherService from "../lib/classes/teacher";
import { ClassroomClassGrid } from "../components/classroom/class-cards";
import { StudentSummaryTable } from "../app/portal/my-classes/student-summary-table";

const code = ts.transpileModule(
  readFileSync(new URL("../lib/classes/teacher.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } },
).outputText;

function teacherHarness({ denied = false, sessionId = "9007199254740993", missingProfile = false, semester = "FirstSemester" as "FirstSemester" | "SecondSemester" | null } = {}) {
  const queries: Array<{ method: string; where: { id?: bigint; teacherId: bigint; teacher: { userId: bigint; user: { role: string } } }; select: Record<string, unknown> }> = [];
  const assigned = { id: 7n, teacherId: 9007199254740995n, role: "teacher", semester };
  const profileQueries: Array<{ where: { userId: bigint }; select: { employeeId: boolean } }> = [];
  const modules: Record<string, unknown> = {
    "@/lib/auth": { requireTeacher: async () => {
      if (denied) throw new Error("Teacher access required");
      return { id: sessionId };
    } },
    "@/lib/prisma": { prisma: {
      teacher: { findUnique: async (query: typeof profileQueries[number]) => {
        profileQueries.push(query);
        return missingProfile ? null : { employeeId: query.where.userId === 9007199254740993n ? assigned.teacherId : 400n };
      } },
      class: {
      findMany: async (query: typeof queries[number]) => { queries.push({ ...query, method: "list" }); return [assigned]; },
      findFirst: async (query: typeof queries[number]) => {
        queries.push({ ...query, method: "detail" });
        return query.where.id === assigned.id && query.where.teacherId === assigned.teacherId && query.where.teacher.user.role === assigned.role ? assigned : null;
      },
    } } },
    "next/navigation": { redirect: (path: string) => { throw new Error("Redirect " + path); } },
    "next/cache": { revalidatePath: () => {} },
    "./validation": { parseClassId, parseTeacherSpreadsheetForm },
    "./period-visibility": periodVisibility,
    "./student-preview": studentPreview,
  };
  const loaded = { exports: {} };
  runInNewContext(code, {
    module: loaded, exports: loaded.exports,
    require: (name: string) => {
      assert.ok(name in modules, "Unexpected teacher service dependency: " + name);
      return modules[name];
    },
  });
  return { service: loaded.exports as typeof teacherService, queries, profileQueries };
}

test("teacher class list and detail deny access before querying records", async () => {
  const harness = teacherHarness({ denied: true });
  await assert.rejects(harness.service.getAssignedClasses(), /Teacher access required/);
  await assert.rejects(harness.service.getAssignedClass("7"), /Teacher access required/);
  assert.equal(harness.queries.length, 0);
});

test("class reads resolve a user to the teacher primary key and select only authorized roster display fields", async () => {
  const harness = teacherHarness();
  await harness.service.getAssignedClasses();
  assert.equal((await harness.service.getAssignedClass("7"))?.id, 7n);
  for (const query of harness.queries) {
    assert.equal(query.where.teacherId, 9007199254740995n);
    assert.equal(query.where.teacher.userId, 9007199254740993n);
    assert.equal(query.where.teacher.user.role, "teacher");
    assert.deepEqual(Object.keys(query.select).sort(), [...(query.method === "list" ? ["_count"] : []), "branch", "finalsVisible", "id", "midtermVisible", "prefinalsVisible", "prelimVisible", "schoolYear", "sectionName", "semester", "spreadsheetUrl", "students", "subjectName", "yearLevel"]);
    if (query.method === "list") {
      assert.deepEqual(JSON.parse(JSON.stringify(query.select._count)), { select: { students: true } });
      assert.deepEqual(JSON.parse(JSON.stringify(query.select.students)), studentPreview.classStudentPreviewSelection.students);
      assert.doesNotMatch(JSON.stringify(query.select.students), /studentNumber/);
    } else {
      assert.deepEqual(JSON.parse(JSON.stringify(query.select.students)), {
        orderBy: { student: { lastName: "asc" } },
        select: { student: { select: { id: true, studentNumber: true, firstName: true, middleName: true, lastName: true, suffix: true } } },
      });
    }
    assert.deepEqual(JSON.parse(JSON.stringify(query.select.branch)), { select: { title: true } });
    assert.doesNotMatch(JSON.stringify(query.select), /email|birthDate|gender|phone|password/);
  }
  assert.equal(harness.profileQueries[0].where.userId, 9007199254740993n);
});

test("authorized teacher class reads retain first, second, and unassigned semesters without guessing", async () => {
  for (const semester of ["FirstSemester", "SecondSemester", null] as const) {
    const harness = teacherHarness({ semester });
    const classes = await harness.service.getAssignedClasses();
    const detail = await harness.service.getAssignedClass("7");
    assert.equal(classes[0].semester, semester);
    assert.equal(detail?.semester, semester);
    assert.equal(harness.queries[0].select.semester, true);
    assert.equal(harness.queries[0].where.teacherId, 9007199254740995n);
  }
});

test("a teacher cannot read another teacher's class by changing the URL", async () => {
  const harness = teacherHarness({ sessionId: "2" });
  assert.equal(await harness.service.getAssignedClass("7"), null);
  assert.equal(harness.queries[0].where.teacherId, 400n);
  assert.equal(harness.queries[0].where.teacher.userId, 2n);
});

test("a teacher user without a linked teacher profile has no assigned classes or unscoped roster reads", async () => {
  const harness = teacherHarness({ missingProfile: true });
  assert.deepEqual(Array.from(await harness.service.getAssignedClasses()), []);
  assert.equal(await harness.service.getAssignedClass("7"), null);
  assert.equal(harness.queries.length, 0);
});

test("invalid session and class IDs cannot produce unscoped database reads", async () => {
  const invalidSession = teacherHarness({ sessionId: "not-a-database-id" });
  await assert.rejects(invalidSession.service.getAssignedClasses(), /Redirect \/login/);
  assert.equal(invalidSession.queries.length, 0);
  const harness = teacherHarness();
  for (const id of ["0", "-1", "bad", "9223372036854775808"]) {
    assert.equal(await harness.service.getAssignedClass(id), null);
  }
  assert.equal(harness.queries.length, 0);
});

test("assigned class cards connect to their own student summary with authorized roster counts", () => {
  const markup = renderToStaticMarkup(createElement(ClassroomClassGrid, { role: "teacher", classes: [{
    id: "9007199254740993", href: "/portal/my-classes/9007199254740993", schoolYear: "2026-2027", semester: "FirstSemester", branchTitle: "Main Branch", sectionName: "IT 1-A", yearLevel: "FirstYear", subjectName: "Computing", spreadsheetLinked: true, studentCount: 24,
  }] }));
  assert.match(markup, /href="\/portal\/my-classes\/9007199254740993"/);
  assert.match(markup, /Search my classes/);
  assert.match(markup, /IT 1-A/);
  assert.match(markup, /First Year/);
  assert.match(markup, /1st Semester/);
  assert.match(markup, /Main Branch/);
  assert.match(markup, /24.*students/);
  assert.match(markup, /Grades connected/);
  assert.doesNotMatch(markup, />FirstYear</);
});

test("assigned classes without a spreadsheet invite the teacher to add their link", () => {
  const markup = renderToStaticMarkup(createElement(ClassroomClassGrid, { role: "teacher", classes: [{
    id: "7", href: "/portal/my-classes/7", schoolYear: "2026-2027", semester: null, branchTitle: null, sectionName: "IT 1-A", yearLevel: "FirstYear",
    subjectName: "Computing", spreadsheetLinked: false,
  }] }));
  assert.match(markup, /Branch not assigned/);
  assert.match(markup, /Semester not assigned/);
  assert.match(markup, /Add Google Sheets link/);
  assert.match(markup, /href="\/portal\/my-classes\/7"/);
});

test("student summary displays leading-zero numbers, zero grades and escaped notes", () => {
  const markup = renderToStaticMarkup(createElement(StudentSummaryTable, { students: [{
    studentNumber: "0007", studentName: "Maria Santos", prelim: "0", midterm: null, prefinals: "85",
    finals: "90", average: "82.5", remarks: "Passed", note: "<script>private</script>",
  }] }));
  assert.match(markup, /0007/);
  assert.match(markup, />0<\/td>/);
  assert.match(markup, /&lt;script&gt;private&lt;\/script&gt;/);
  assert.doesNotMatch(markup, /<script>private/);
  assert.match(markup, /Search class students/);
});

test("summary rows without student numbers remain visible by name", () => {
  const markup = renderToStaticMarkup(createElement(StudentSummaryTable, { students: ["Maria Santos", "Juan Cruz"].map((studentName) => ({
    studentNumber: "", studentName, prelim: "80", midterm: null, prefinals: null,
    finals: null, average: "80", remarks: null, note: null,
  })) }));
  assert.match(markup, /Maria Santos/);
  assert.match(markup, /Juan Cruz/);
  assert.equal((markup.match(/Not assigned/g) ?? []).length, 2);
});
