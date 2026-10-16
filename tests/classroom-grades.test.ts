import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import Link from "next/link";
import * as icons from "lucide-react";
import { GradesTableSkeleton } from "../components/portal/grades-table-skeleton";
import { PortalTable } from "../components/portal/data-table";
import { Semester, UserRole } from "../lib/generated/prisma/enums";
import { formatStudentName, literalInsensitiveEquality, normalizeEmail } from "../lib/utils";
import { loadStudentIdentityService } from "./student-services-harness";
import { normalizeSemester, type StudentGradesResult } from "../lib/student-grades";
import * as periodVisibility from "../lib/classes/period-visibility";
import type * as semesterVisibility from "../lib/classes/semester-visibility";
import type * as views from "../app/portal/grades/grades-view";
import type * as pages from "../app/portal/grades/page";

function loadModule(path: string, modules: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  runInNewContext(code, {
    module: loaded, exports: loaded.exports,
    require: (name: string) => { assert.ok(name in modules, `Unexpected grades UI dependency: ${name}`); return modules[name]; },
    process: { env: { STUDENT_GRADES_APPS_SCRIPT_URL: "https://grades.example.test/exec" } },
  });
  return loaded.exports;
}

type TreeElement = React.ReactElement<Record<string, unknown>>;
function elements(tree: React.ReactNode) {
  const result: TreeElement[] = [];
  function visit(node: React.ReactNode) {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement<Record<string, unknown>>(child)) return;
      result.push(child);
      visit(child.props.children as React.ReactNode);
    });
  }
  visit(tree);
  return result;
}

function viewHarness(initialPending = false) {
  let pending = initialPending;
  let optimisticSemester: string | undefined;
  const events: string[] = [];
  const navigation: string[] = [];
  const { GradesView } = loadModule("../app/portal/grades/grades-view.tsx", {
    react: {
      ...React,
      useTransition: () => [pending, (action: () => void) => { events.push("transition"); pending = true; action(); }],
      useOptimistic: (semester: string) => [optimisticSemester ?? semester, (value: string) => { events.push("optimistic " + value); optimisticSemester = value; }],
    },
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: Link },
    "next/navigation": { useRouter: () => ({ push: (path: string) => { events.push("navigation"); navigation.push(path); } }) },
    "lucide-react": icons,
    "@/components/portal/grades-table-skeleton": { GradesTableSkeleton },
  }) as typeof views;
  return { GradesView, events, navigation };
}

const student = { id: 9007199254740995n, firstName: "Ana", middleName: null, lastName: "Cruz", suffix: null, studentNumber: "0007" };
const grade: Extract<StudentGradesResult, { success: true }>["grades"][number] = {
  code: "IT101", subject: "Computing", units: "3", instructor_id: "private-instructor-id", instructor_name: "Maria Santos",
  prelim: "0", midterm: "85", prefinals: null, finals: "90", average: "87.5", remarks: "Passed",
  note: "<script>Saved note</script>", raw: { privatePayload: "not-for-the-page" },
};

function pageHarness({
  role = UserRole.student as UserRole, denied = false,
  record = student as typeof student | null,
  result = { success: true, semester: "1stSem", studentName: null, grades: [grade], raw: [] } as StudentGradesResult,
  classes = [] as semesterVisibility.SemesterClassVisibility[],
  afterGradesRead = undefined as { classes?: semesterVisibility.SemesterClassVisibility[]; record?: typeof student | null } | undefined,
} = {}) {
  const events: string[] = [];
  const queries: Array<{ where: { email: { equals: string; mode: string } }; select: Record<string, boolean>; take: number }> = [];
  const classQueries: unknown[] = [];
  const gradesCalls: Array<{ studentNumber: string; semester: string }> = [];
  const { GradesView } = viewHarness();
  const semesterModules: Record<string, unknown> = {
    "@/lib/auth": { requireSession: async () => ({ id: "9007199254740993", email: "own.student@example.com", role }) },
    "@/lib/utils": { literalInsensitiveEquality, normalizeEmail },
    "next/navigation": { redirect: (path: string) => { throw new Error("Redirect " + path); } },
    "./period-visibility": periodVisibility,
    "@/lib/prisma": { prisma: {
      student: { findMany: async (query: typeof queries[number]) => { events.push("student query"); queries.push(query); return record ? [record] : []; } },
      class: { findMany: async (query: unknown) => { events.push("visibility query"); classQueries.push(query); return classes; } },
    } },
  };
  semesterModules["@/lib/portal/student"] = loadStudentIdentityService(semesterModules);
  const semesterService = loadModule("../lib/classes/semester-visibility.ts", semesterModules) as typeof semesterVisibility;
  const { default: StudentGradesPage } = loadModule("../app/portal/grades/page.tsx", {
    "react/jsx-runtime": jsxRuntime, "lucide-react": icons,
    "@/lib/utils": { formatStudentName },
    "next/navigation": { redirect: (path: string) => { events.push("redirect " + path); throw new Error("Redirect " + path); } },
    "@/app/portal/grades/grades-view": { GradesView },
    "@/components/portal/data-table": { PortalTable },
    "@/lib/generated/prisma/enums": { Semester, UserRole },
    "@/lib/auth": { requireSession: async () => {
      events.push("authorize");
      if (denied) throw new Error("Session required");
      return { id: "9007199254740993", email: "own.student@example.com", role };
    } },
    "@/lib/classes/semester-visibility": semesterService,
    "@/lib/student-grades": {
      normalizeSemester,
      getStudentGrades: async (studentNumber: string, semester: string) => {
        events.push("grades service"); gradesCalls.push({ studentNumber, semester });
        if (afterGradesRead?.classes) classes = afterGradesRead.classes;
        if (afterGradesRead && "record" in afterGradesRead) record = afterGradesRead.record ?? null;
        return { ...result, semester };
      },
    },
  }) as typeof pages;
  return { StudentGradesPage, GradesView, events, queries, classQueries, gradesCalls };
}

test("My grades shows the student's record and an actionable link back to assigned classes", () => {
  const { GradesView } = viewHarness();
  const markup = renderToStaticMarkup(GradesView({ semester: "1stSem", displayName: "Ana <script>Cruz</script>", studentNumber: "0007", children: React.createElement("p", null, "Saved grade content") }));
  assert.match(markup, /href="\/portal\/classroom"/);
  assert.match(markup, /All classes/);
  assert.match(markup, /My grades/);
  assert.match(markup, /Ana &lt;script&gt;Cruz&lt;\/script&gt;/);
  assert.match(markup, /Student No\. 0007/);
  assert.match(markup, /Saved grade content/);
  assert.doesNotMatch(markup, /<script>|disabled=""/);
  const unnumbered = renderToStaticMarkup(GradesView({ semester: "1stSem", displayName: "Student record", studentNumber: null, children: null }));
  assert.match(unnumbered, /Student No\. Not assigned/);
});

test("semester changes navigate inside the transition and disable further selection while showing the chosen semester skeleton", () => {
  const harness = viewHarness();
  const props = { semester: "1stSem", displayName: "Ana Cruz", studentNumber: "0007", children: React.createElement("p", null, "Previous semester records") };
  const tree = harness.GradesView(props);
  const select = elements(tree).find((element) => element.type === "select");
  assert.ok(select);
  assert.equal(select.props.value, "1stSem");
  assert.equal(select.props.disabled, false);
  (select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "2ndSem" } });
  assert.deepEqual(harness.events, ["transition", "optimistic 2ndSem", "navigation"]);
  assert.deepEqual(harness.navigation, ["/portal/grades?semester=2ndSem"]);
  const pendingTree = harness.GradesView(props);
  const pendingSelect = elements(pendingTree).find((element) => element.type === "select");
  assert.equal(pendingSelect?.props.value, "2ndSem");
  assert.equal(pendingSelect?.props.disabled, true);
  const markup = renderToStaticMarkup(pendingTree);
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /2nd Semester/);
  assert.match(markup, /Loading grade records/);
  assert.doesNotMatch(markup, /Previous semester records/);
});

test("Grades requires a student session before reading the student record or fetching grades", async () => {
  for (const role of [UserRole.teacher, UserRole.admin, UserRole.registrar, UserRole.superAdmin]) {
    const harness = pageHarness({ role });
    await assert.rejects(harness.StudentGradesPage({}), /Redirect \/portal/);
    assert.deepEqual(harness.events, ["authorize", "redirect /portal"]);
    assert.equal(harness.queries.length, 0);
    assert.equal(harness.gradesCalls.length, 0);
  }
  const denied = pageHarness({ denied: true });
  await assert.rejects(denied.StudentGradesPage({}), /Session required/);
  assert.deepEqual(denied.events, ["authorize"]);
});

test("Grades uses only the session's student number and normalized semester and renders all saved grade fields safely", async () => {
  const harness = pageHarness();
  const tree = await harness.StudentGradesPage({ searchParams: Promise.resolve({ semester: ["2", "1"] }) });
  assert.deepEqual(harness.events, ["authorize", "student query", "visibility query", "grades service", "student query", "visibility query"]);
  assert.equal(harness.queries.length, 2);
  for (const query of harness.queries) assert.deepEqual(JSON.parse(JSON.stringify(query)), {
    where: { email: { equals: "own.student@example.com", mode: "insensitive" } },
    select: { id: true, firstName: true, middleName: true, lastName: true, suffix: true, studentNumber: true },
    take: 2,
  });
  assert.deepEqual(harness.gradesCalls, [{ studentNumber: "0007", semester: "2ndSem" }]);
  const view = elements(tree).find((element) => element.type === harness.GradesView);
  assert.equal(view?.props.displayName, "Ana Cruz");
  assert.equal(view?.props.studentNumber, "0007");
  const markup = renderToStaticMarkup(tree);
  for (const value of ["IT101", "Computing", "Maria Santos", "87.5", "Passed", "2nd Semester"]) assert.ok(markup.includes(value));
  assert.match(markup, />0<\/td>/);
  assert.match(markup, /&lt;script&gt;Saved note&lt;\/script&gt;/);
  assert.match(markup, /overflow-x-auto/);
  assert.doesNotMatch(markup, /<script>|private-instructor-id|not-for-the-page|own\.student@example\.com/);
});

test("missing student records or numbers skip the grades service and preserve a useful record message", async () => {
  for (const record of [null, { ...student, studentNumber: null }]) {
    const harness = pageHarness({ record: record as typeof student | null });
    const markup = renderToStaticMarkup(await harness.StudentGradesPage({}));
    assert.equal(harness.gradesCalls.length, 0);
    assert.match(markup, /Grades unavailable/);
    assert.match(markup, /Your student number is not available yet/);
    assert.match(markup, /Student No\. Not assigned/);
    assert.ok(markup.includes(record ? "Ana Cruz" : "Student record"));
  }
});

test("empty semesters retain the student record and semester while explaining there are no grades", async () => {
  const harness = pageHarness({ result: { success: true, semester: "1stSem", studentName: "Ana Cruz", grades: [], raw: [] } });
  const markup = renderToStaticMarkup(await harness.StudentGradesPage({ searchParams: Promise.resolve({ semester: "invalid-semester" }) }));
  assert.deepEqual(harness.gradesCalls, [{ studentNumber: "0007", semester: "1stSem" }]);
  assert.match(markup, /Ana Cruz/);
  assert.match(markup, /1st Semester/);
  assert.match(markup, /0 subjects/);
  assert.match(markup, /No grades found/);
  assert.doesNotMatch(markup, /<table|Grades unavailable/);
});

test("failed grade requests retain the saved student name and escape the service error", async () => {
  const harness = pageHarness({ result: { success: false, semester: "1stSem", message: "Sharing unavailable <script>unsafe</script>" } });
  const markup = renderToStaticMarkup(await harness.StudentGradesPage({}));
  assert.match(markup, /Grades unavailable/);
  assert.match(markup, /Ana Cruz/);
  assert.match(markup, /Sharing unavailable &lt;script&gt;unsafe&lt;\/script&gt;/);
  assert.doesNotMatch(markup, /<table|<script>/);
});

test("semester grade tables receive only released period values and mark teacher-hidden grades clearly", async () => {
  const privateGrade = { ...grade, prelim: "81.111", midterm: "82.222", average: "88.888", remarks: "PRIVATE OVERALL REMARK", note: "PRIVATE OVERALL NOTE", raw: { prelim: "81.111", average: "88.888", secret: "PRIVATE RAW RECORD" } };
  const harness = pageHarness({
    result: { success: true, semester: "1stSem", studentName: null, grades: [privateGrade], raw: { privateRaw: "PRIVATE TOP LEVEL RAW" } },
    classes: [{ ...periodVisibility.defaultClassPeriodVisibility, semester: null, subjectName: "Computing", subject: { code: "IT101", name: "Computing" }, prelimVisible: false }],
  });
  const tree = await harness.StudentGradesPage({});
  const table = elements(tree).find((element) => element.type === PortalTable);
  assert.ok(table);
  const rows = table.props.rows as semesterVisibility.VisibleSemesterGrade[];
  assert.equal(rows[0].prelim, null);
  assert.equal(rows[0].midterm, "82.222");
  assert.equal(rows[0].average, null);
  assert.equal(rows[0].remarks, null);
  assert.equal(rows[0].note, null);
  assert.equal("raw" in rows[0], false);
  assert.doesNotMatch(JSON.stringify(rows), /81\.111|88\.888|PRIVATE OVERALL|PRIVATE RAW|PRIVATE TOP LEVEL/);
  const markup = renderToStaticMarkup(tree);
  assert.match(markup, /Your teacher has hidden some grading periods/);
  assert.match(markup, />Hidden<\/td>/);
  assert.match(markup, />82\.222<\/td>/);
  assert.doesNotMatch(markup, /81\.111|88\.888|PRIVATE OVERALL|PRIVATE RAW|PRIVATE TOP LEVEL/);
});

test("semester grades use settings refreshed after the external request so newly hidden grades never reach the table", async () => {
  const source = { ...grade, prelim: "81.111", midterm: "82.222", average: "88.888", remarks: "PRIVATE OVERALL REMARK", note: "PRIVATE OVERALL NOTE" };
  const classRule = { ...periodVisibility.defaultClassPeriodVisibility, semester: null, subjectName: "Computing", subject: { code: "IT101", name: "Computing" } };
  const loaded = pageHarness({ result: { success: true, semester: "1stSem", studentName: null, grades: [source], raw: [] }, classes: [classRule], afterGradesRead: { classes: [{ ...classRule, prelimVisible: false }] } });
  const tree = await loaded.StudentGradesPage({});
  const table = elements(tree).find((element) => element.type === PortalTable);
  assert.ok(table);
  const rows = table.props.rows as semesterVisibility.VisibleSemesterGrade[];
  assert.equal(rows[0].prelim, null);
  assert.equal(rows[0].midterm, "82.222");
  assert.equal(rows[0].average, null);
  assert.equal(rows[0].remarks, null);
  assert.equal(rows[0].note, null);
  assert.equal(loaded.classQueries.length, 2);
  assert.doesNotMatch(JSON.stringify(rows), /81\.111|88\.888|PRIVATE OVERALL/);
  assert.doesNotMatch(renderToStaticMarkup(tree), /81\.111|88\.888|PRIVATE OVERALL/);
});

test("the semester Grades route scopes hidden periods to the requested term and preserves legacy privacy rules", async () => {
  for (const [requested, semester, otherSemester] of [["1stSem", Semester.FirstSemester, Semester.SecondSemester], ["2ndSem", Semester.SecondSemester, Semester.FirstSemester]] as const) {
    const sameSubject = { ...periodVisibility.defaultClassPeriodVisibility, subjectName: "Computing", subject: { code: "IT101", name: "Computing" } };
    for (const ruleSemester of [otherSemester, semester, null]) {
      const loaded = pageHarness({ classes: [{ ...sameSubject, semester: ruleSemester, prelimVisible: false }] });
      const tree = await loaded.StudentGradesPage({ searchParams: Promise.resolve({ semester: requested }) });
      const table = elements(tree).find((element) => element.type === PortalTable);
      assert.ok(table);
      const [row] = table.props.rows as semesterVisibility.VisibleSemesterGrade[];
      const hidden = ruleSemester !== otherSemester;
      assert.equal(row.prelim, hidden ? null : "0");
      assert.equal(row.average, hidden ? null : "87.5");
      assert.equal(row.periodVisibility.prelimVisible, !hidden);
      assert.equal(loaded.gradesCalls[0].semester, requested);
      assert.equal("raw" in row, false);
    }
  }
});

test("changed or missing student identity during a semester request discards the fetched grade record", async () => {
  for (const record of [null, { ...student, id: 400n }, { ...student, studentNumber: "0008" }]) {
    const loaded = pageHarness({ afterGradesRead: { record } });
    const tree = await loaded.StudentGradesPage({});
    assert.equal(elements(tree).some((element) => element.type === PortalTable), false);
    const markup = renderToStaticMarkup(tree);
    assert.match(markup, /Your student record has changed/);
    assert.doesNotMatch(markup, /IT101|Computing|87\.5|Saved note/);
    assert.equal(loaded.gradesCalls.length, 1);
    assert.equal(loaded.gradesCalls[0].studentNumber, "0007");
    assert.equal(loaded.queries.length, 2);
  }
});
