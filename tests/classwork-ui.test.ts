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
import { Button } from "../components/ui/button";
import { ClassBanner } from "../components/classroom/class-banner";
import { ClassworkView } from "../components/classroom/classwork-view";
import { StudentGradeSummary } from "../components/classroom/student-grade-summary";
import { WorkspaceTabs } from "../components/classroom/workspace-tabs";
import * as pageHeader from "../components/portal/page-header";
import * as utils from "../lib/utils";
import * as academicLevels from "../lib/academic-levels";
import type { ClassworkCatalogResult } from "../lib/classes/spreadsheet";
import type * as teacherPage from "../app/portal/my-classes/[classId]/page";
import type * as studentPage from "../app/portal/classroom/[classId]/page";
import * as periodVisibility from "../lib/classes/period-visibility";

const classwork: ClassworkCatalogResult = {
  success: true,
  periods: [
    { period: "Prelim", categories: [
      { name: "Written Work", weight: 30, activities: [
        { name: "Quiz <script>unsafe</script>", maxScore: 20, isExcludable: false, score: "0" },
        { name: "Worksheet", maxScore: 10, isExcludable: true, score: null },
      ] },
      { name: "Performance Task", weight: null, activities: [{ name: "Presentation", maxScore: 50, isExcludable: false, score: "ABS" }] },
    ] },
    { period: "Midterm", categories: [{ name: "Quarterly Assessment", weight: 0, activities: [{ name: "Midterm Exam", maxScore: 100, isExcludable: false, score: "85.5" }] }] },
    { period: "Prefinals", categories: [] },
    { period: "Finals", categories: [] },
  ],
};

test("student classwork groups real activities by period and category, preserves zero and missing scores, and escapes spreadsheet text", () => {
  const markup = renderToStaticMarkup(React.createElement(ClassworkView, { result: classwork, role: "student", refreshHref: "/portal/classroom/7?tab=classwork" }));
  assert.match(markup, /aria-label="Classwork periods"/);
  assert.match(markup, /href="#classwork-prelim"/);
  assert.match(markup, /id="classwork-prelim"/);
  assert.match(markup, /Written Work/);
  assert.match(markup, /30% of grade/);
  assert.match(markup, /0% of grade/);
  assert.match(markup, /4 activities/);
  assert.match(markup, /Quiz &lt;script&gt;unsafe&lt;\/script&gt;/);
  assert.match(markup, />0<\/span><span[^>]*> \/ 20/);
  assert.match(markup, /Not graded/);
  assert.match(markup, /ABS<\/span><span[^>]*> \/ 50/);
  assert.match(markup, /85\.5<\/span><span[^>]*> \/ 100/);
  assert.match(markup, /href="\/portal\/classroom\/7\?tab=classwork"/);
  assert.doesNotMatch(markup, /<script>|undefined|null%|due date|Submit|Upload|Marked for exclusion|href="#classwork-finals"/i);
});

function renderScore(score: string | null | undefined, maxScore: number, role: "student" | "teacher" = "student") {
  const result: ClassworkCatalogResult = { success: true, periods: [{ period: "Prelim", categories: [{ name: "Written Work", weight: 30, activities: [{ name: "Quiz", maxScore, isExcludable: false, score }] }] }] };
  return renderToStaticMarkup(React.createElement(ClassworkView, { result, role, refreshHref: "/portal/classroom/7?tab=classwork" }));
}

test("student activity scores below 75 percent use red earned points without rounding", () => {
  for (const [score, maxScore] of [["0", 20], ["14.99", 20], ["74.999", 100], ["0.1499", 0.2], [" 7.4 ", 10], [".5", 1]] as const) {
    const markup = renderScore(score, maxScore);
    assert.match(markup, /<span class="text-red-600 dark:text-red-400">/, `${score}/${maxScore} should be red`);
    assert.match(markup, /<span class="font-normal text-muted-foreground"> \/ /, "Maximum points keep their normal color");
  }
  for (const [score, maxScore] of [["15", 20], ["75", 100], ["0.15", 0.2], ["0.525", 0.7], ["75.01", 100], ["10", 10], ["20", 20]] as const) {
    assert.doesNotMatch(renderScore(score, maxScore), /text-red-/, `${score}/${maxScore} should keep its normal color`);
  }
});

test("ungraded or nonnumeric scores and invalid maximum points keep their normal color", () => {
  for (const score of [undefined, null, "", "   ", "ABS", "INC", "74%", "NaN", "Infinity", "0x0", "1e1"]) {
    assert.doesNotMatch(renderScore(score, 20), /text-red-/, `${String(score)} must not be treated as a percentage`);
  }
  for (const maxScore of [0, -20, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.doesNotMatch(renderScore("0", maxScore), /text-red-/, `Invalid maximum ${maxScore} must not classify a score`);
  }
  assert.match(renderScore(null, 20), />Not graded<\/span>/);
});

test("teacher classwork does not show the student activity score or its low-score styling", () => {
  const markup = renderScore("14.99", 20, "teacher");
  assert.doesNotMatch(markup, /Your score|14\.99|text-red-/);
});

test("teacher catalog shows names, weights and maximum points without rendering student scores", () => {
  const teacherResult: ClassworkCatalogResult = { success: true, periods: [{ period: "Finals", categories: [{ name: "Performance", weight: 70, activities: [{ name: "Final project", maxScore: 100, isExcludable: false, score: "private-student-score" }] }] }] };
  const markup = renderToStaticMarkup(React.createElement(ClassworkView, { result: teacherResult, role: "teacher", refreshHref: "/portal/my-classes/7?tab=classwork" }));
  assert.match(markup, /Final project/);
  assert.match(markup, /100 points/);
  assert.match(markup, /70% of grade/);
  assert.match(markup, /1 activity/);
  assert.doesNotMatch(markup, /Your score|private-student-score|Not graded|\/portal\/classroom/);
});

test("unconnected, hidden, failed and empty classwork retain useful messages and do not invent activities", () => {
  const disconnected = renderToStaticMarkup(React.createElement(ClassworkView, { result: null, role: "teacher", refreshHref: "/portal/my-classes/7?tab=classwork" }));
  assert.match(disconnected, /Your classwork will appear here/);
  assert.match(disconnected, /Google Sheets link in Overview/);
  assert.doesNotMatch(disconnected, /Refresh classwork|Your score|Grading periods/);
  for (const message of ["This class has not enabled spreadsheet records in the portal.", "Unable to load classwork <script>unsafe</script>."]) {
    const markup = renderToStaticMarkup(React.createElement(ClassworkView, { result: { success: false, message }, role: "student", refreshHref: "/portal/classroom/7?tab=classwork" }));
    assert.match(markup, /Classwork unavailable/);
    assert.match(markup, /role="status"/);
    assert.match(markup, /Refresh classwork/);
    assert.doesNotMatch(markup, /<script>|Your score|Grading periods/);
  }
  const empty = renderToStaticMarkup(React.createElement(ClassworkView, { result: { success: true, periods: [{ period: "Prelim", categories: [{ name: "Written", weight: 30, activities: [] }] }] }, role: "student", refreshHref: "/portal/classroom/7?tab=classwork" }));
  assert.match(empty, /No classwork yet/);
  assert.doesNotMatch(empty, /30% of grade|Your score|Grading periods/);
});

test("Classwork is a top workspace tab for each role, keeps the banner inside Overview, and unavailable default tabs fall back safely", () => {
  for (const role of ["teacher", "student"] as const) {
    const markup = renderToStaticMarkup(React.createElement(WorkspaceTabs, {
      overview: React.createElement("section", { "aria-label": "Class details" }, "Overview banner"),
      classwork: React.createElement(ClassworkView, { result: classwork, role, refreshHref: `/${role}?tab=classwork` }),
      students: role === "teacher" ? React.createElement("p", null, "Authorized roster") : undefined,
      grades: React.createElement("p", null, "Grade summary"),
      defaultTab: "classwork",
    }));
    assert.match(markup, /role="tab"[^>]*aria-selected="true"[^>]*>Classwork/);
    assert.match(markup, /sticky top-16/);
    assert.match(markup, /Quiz &lt;script&gt;unsafe&lt;\/script&gt;/);
    assert.doesNotMatch(markup, /Overview banner|aria-label="Class details"|Grade summary|Authorized roster/);
    assert.equal(markup.includes(">Students<"), role === "teacher");
  }
  const fallback = renderToStaticMarkup(React.createElement(WorkspaceTabs, { overview: React.createElement("p", null, "Overview banner"), grades: null, defaultTab: "classwork" }));
  assert.match(fallback, /Overview banner/);
  assert.doesNotMatch(fallback, />Classwork</);
});

function loadPage(path: string, overrides: Record<string, unknown>) {
  const modules: Record<string, unknown> = {
    "react/jsx-runtime": jsxRuntime, "next/link": { default: Link }, "lucide-react": icons,
    "@/components/ui/button": { Button },
    "@/components/classroom/class-banner": { ClassBanner },
    "@/components/classroom/classwork-view": { ClassworkView },
    "@/components/classroom/student-grade-summary": { StudentGradeSummary },
    "@/components/classroom/workspace-tabs": { WorkspaceTabs },
    "@/components/portal/page-header": pageHeader,
    "@/lib/utils": utils, "@/lib/academic-levels": academicLevels,
    "@/lib/classes/period-visibility": periodVisibility,
    "../period-visibility-card": { PeriodVisibilityCard: () => null },
    "next/navigation": { notFound: () => { throw new Error("Not found"); } },
    ...overrides,
  };
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(code, {
    module: loaded, exports: loaded.exports,
    require: (name: string) => { assert.ok(name in modules, `Unexpected classwork page dependency: ${name}`); return modules[name]; },
  });
  return loaded.exports;
}

test("teacher classwork fetches only after an assigned class is authorized and preserves the active tab on refresh", async () => {
  const events: string[] = [];
  let connected = true;
  const sheetUrl = "https://docs.google.com/spreadsheets/d/synthetic-sheet/edit";
  const { default: ClassSummaryPage } = loadPage("../app/portal/my-classes/[classId]/page.tsx", {
    "@/lib/classes/teacher": { getAssignedClass: async (id: string) => {
      events.push("authorized class " + id);
      return id === "7" ? { id: 7n, subjectName: "Computing", sectionName: "IT 1-A", yearLevel: "FirstYear", schoolYear: "2026-2027", branch: null, spreadsheetUrl: connected ? sheetUrl : null, students: [] } : null;
    } },
    "@/lib/classes/spreadsheet": {
      getClassSummary: async (url: string) => { assert.equal(url, sheetUrl); events.push("summary"); return { success: true, students: [] }; },
      getClassworkCatalog: async (url: string) => { assert.equal(url, sheetUrl); events.push("classwork"); return classwork; },
    },
    "@/lib/classes/validation": { normalizeSpreadsheetUrl: (value: string) => value },
    "../class-roster-table": { ClassRosterTable: () => null },
    "../spreadsheet-connection-card": { SpreadsheetConnectionCard: () => null },
    "../student-summary-table": { StudentSummaryTable: () => null },
  }) as typeof teacherPage;
  const markup = renderToStaticMarkup(await ClassSummaryPage({ params: Promise.resolve({ classId: "7" }), searchParams: Promise.resolve({ tab: "classwork" }) }));
  assert.deepEqual(events, ["authorized class 7", "summary", "classwork"]);
  assert.match(markup, /role="tab"[^>]*aria-selected="true"[^>]*>Classwork/);
  assert.match(markup, /href="\/portal\/my-classes\/7\?tab=classwork"/);
  assert.doesNotMatch(markup, /aria-label="Class details"|Your score|synthetic-sheet/);
  events.length = 0;
  await assert.rejects(ClassSummaryPage({ params: Promise.resolve({ classId: "other" }) }), /Not found/);
  assert.deepEqual(events, ["authorized class other"]);
  events.length = 0;
  connected = false;
  const missing = renderToStaticMarkup(await ClassSummaryPage({ params: Promise.resolve({ classId: "7" }), searchParams: Promise.resolve({ tab: "classwork" }) }));
  assert.deepEqual(events, ["authorized class 7"]);
  assert.match(missing, /Your classwork will appear here/);
});

test("student class detail displays only its service's own classwork and keeps Grades and Overview available", async () => {
  const requests: string[] = [];
  const { default: StudentClassroomDetailPage } = loadPage("../app/portal/classroom/[classId]/page.tsx", {
    "@/lib/classes/student": { getStudentClass: async (id: string) => {
      requests.push(id);
      return id === "7" ? {
        id: "7", subjectName: "Computing", sectionName: "IT 1-A", yearLevel: "FirstYear", schoolYear: "2026-2027", branchTitle: null, teacherName: "Maria Santos",
        student: { name: "Ana Cruz", studentNumber: "0007" }, classwork,
        grades: { success: true, record: { studentNumber: "0007", studentName: "Ana Cruz", prelim: "80", midterm: null, prefinals: null, finals: null, average: null, remarks: null, note: null } },
      } : null;
    } },
  }) as typeof studentPage;
  const markup = renderToStaticMarkup(await StudentClassroomDetailPage({ params: Promise.resolve({ classId: "7" }), searchParams: Promise.resolve({ tab: "classwork" }) }));
  assert.deepEqual(requests, ["7"]);
  assert.match(markup, /role="tab"[^>]*aria-selected="true"[^>]*>Classwork/);
  assert.match(markup, /href="\/portal\/classroom\/7\?tab=classwork"/);
  assert.match(markup, /Your score/);
  assert.doesNotMatch(markup, /aria-label="Class details"|>Students<|Class roster|Open spreadsheet|0007|Ana Cruz/);
  const overview = renderToStaticMarkup(await StudentClassroomDetailPage({ params: Promise.resolve({ classId: "7" }) }));
  assert.match(overview, /aria-label="Class details"/);
  assert.match(overview, /All semester grades/);
  const grades = renderToStaticMarkup(await StudentClassroomDetailPage({ params: Promise.resolve({ classId: "7" }), searchParams: Promise.resolve({ tab: "grades" }) }));
  assert.match(grades, /My class grades/);
  assert.match(grades, />80<\/dd>/);
  assert.doesNotMatch(grades, /aria-label="Class details"|Quiz &lt;script&gt;/);
  await assert.rejects(StudentClassroomDetailPage({ params: Promise.resolve({ classId: "other" }) }), /Not found/);
});

test("hiding grading periods from students leaves the assigned teacher's own summary and classwork intact", async () => {
  const record = { studentNumber: "0007", studentName: "Ana Cruz", prelim: "TEACHER-ONLY-PRELIM", midterm: "TEACHER-ONLY-MIDTERM", prefinals: "TEACHER-ONLY-PREFINALS", finals: "TEACHER-ONLY-FINALS", average: "TEACHER-ONLY-AVERAGE", remarks: null, note: null };
  const requests: string[] = [];
  const { default: ClassSummaryPage } = loadPage("../app/portal/my-classes/[classId]/page.tsx", {
    "@/lib/classes/teacher": { getAssignedClass: async () => ({
      id: 7n, subjectName: "Computing", sectionName: "IT 1-A", yearLevel: "FirstYear", schoolYear: "2026-2027", branch: null,
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/teacher-sheet/edit", students: [],
      prelimVisible: false, midtermVisible: false, prefinalsVisible: false, finalsVisible: false,
    }) },
    "@/lib/classes/spreadsheet": {
      getClassSummary: async () => { requests.push("summary"); return { success: true, students: [record] }; },
      getClassworkCatalog: async () => { requests.push("classwork"); return classwork; },
    },
    "@/lib/classes/validation": { normalizeSpreadsheetUrl: (value: string) => value },
    "../class-roster-table": { ClassRosterTable: () => null },
    "../spreadsheet-connection-card": { SpreadsheetConnectionCard: () => null },
    "../student-summary-table": { StudentSummaryTable: ({ students }: { students: unknown[] }) => React.createElement("pre", null, JSON.stringify(students)) },
  }) as typeof teacherPage;
  const markup = renderToStaticMarkup(await ClassSummaryPage({ params: Promise.resolve({ classId: "7" }), searchParams: Promise.resolve({ tab: "grades" }) }));
  assert.deepEqual(requests, ["summary", "classwork"]);
  for (const value of Object.values(record).filter((value): value is string => typeof value === "string")) assert.ok(markup.includes(value));
  const teacherWork = renderToStaticMarkup(await ClassSummaryPage({ params: Promise.resolve({ classId: "7" }), searchParams: Promise.resolve({ tab: "classwork" }) }));
  assert.match(teacherWork, /Quiz &lt;script&gt;unsafe&lt;\/script&gt;|Presentation|Midterm Exam/);
  assert.doesNotMatch(teacherWork, /Your score|hidden all grading periods/);
});
