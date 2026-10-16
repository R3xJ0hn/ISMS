import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { StudentsTable, type StudentTableRow } from "../app/portal/students/students-table";
import * as pageHeaders from "../components/portal/page-header";
import * as studentColumns from "../components/portal/student-columns";
import * as academicLevels from "../lib/academic-levels";
import * as utils from "../lib/utils";
import * as enums from "../lib/generated/prisma/enums";
import { filterTableRows, sortTableRows } from "../lib/table";
import type { InteractiveTableColumn } from "../components/portal/interactive-table";
import type * as studentPages from "../app/portal/students/page";
import Link from "next/link";
import * as icons from "lucide-react";
import { Button } from "../components/ui/button";
import * as avatars from "../components/ui/avatar";

function students(count: number): StudentTableRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index + 1), applicantType: "new", updatedAt: new Date(Date.UTC(2026, 9, index + 1)).toISOString(),
    approvedDate: `Oct ${index + 1}, 2026`, branch: { title: "Main Branch" }, academicLevel: "FirstYear",
    program: { label: "Computer Technology" },
    student: { firstName: "Student", middleName: null, lastName: String(index + 1).padStart(2, "0"), suffix: null,
      studentNumber: String(index + 1).padStart(4, "0"), phone: "09171234567", email: `student${index + 1}@example.test` },
  }));
}

function loadModule(path: string, modules: Record<string, unknown>) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  runInNewContext(compiled, {
    module: loaded, exports: loaded.exports, Date,
    require: (name: string) => { assert.ok(name in modules, `Unexpected student-table dependency: ${name}`); return modules[name]; },
  });
  return loaded.exports;
}

test("Manage Students offers search, sorting and paging while initially showing the most recently approved records", () => {
  const markup = renderToStaticMarkup(React.createElement(StudentsTable, { students: students(11) }));
  assert.match(markup, /role="searchbox"/);
  assert.match(markup, /Search students/);
  assert.match(markup, />Photo<\/th>/);
  for (const header of ["Student No.", "Student", "Program", "Branch", "Contact", "Approved"]) assert.ok(markup.includes(`Sort by ${header} `), header);
  assert.match(markup, /aria-sort="descending"/);
  assert.match(markup, /Showing 1–10 of 11 students/);
  assert.match(markup, /Page 1 of 2/);
  assert.match(markup, /Student 11/);
  assert.doesNotMatch(markup, /Student 01/);
  assert.match(markup, /Rows per page/);
  assert.match(markup, /aria-label="students table"/);
});

test("student rows retain leading zeros and optional fields and escape name and contact text", () => {
  const records = students(1);
  records[0].student = { ...records[0].student, studentNumber: "0007", phone: null,
    firstName: "José", middleName: "Elena", lastName: "<Santos>", suffix: "Jr.", email: "name<&>@example.test" };
  const markup = renderToStaticMarkup(React.createElement(StudentsTable, { students: records }));
  assert.match(markup, /0007/);
  assert.match(markup, /José Elena &lt;Santos&gt; Jr\./);
  assert.match(markup, /name&lt;&amp;&gt;@example\.test/);
  assert.match(markup, /Pending/);
  assert.doesNotMatch(markup, /<Santos>|Birth|Address|Password/);
  const empty = renderToStaticMarkup(React.createElement(StudentsTable, { students: [] }));
  assert.match(empty, /No approved students yet/);
  assert.match(empty, /role="searchbox"/);
  assert.match(empty, /Showing 0–0 of 0 students/);
  assert.doesNotMatch(empty, /aria-label="Next page"/);
});

test("student search matches names, numbers, branch, program, year level and contact across the complete list", () => {
  const rows = students(11);
  rows[0].student.firstName = "José";
  const { StudentsTable: Table } = loadModule("../app/portal/students/students-table.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: Link }, "lucide-react": icons,
    "@/components/ui/button": { Button },
    "@/components/ui/avatar": avatars,
    "@/components/portal/interactive-table": { InteractivePortalTable: () => null },
    "@/components/portal/student-columns": studentColumns,
    "@/lib/academic-levels": academicLevels, "@/lib/utils": utils,
  }) as { StudentsTable: (props: { students: StudentTableRow[] }) => React.ReactElement<{
    searchValue: (row: StudentTableRow) => string; columns: InteractiveTableColumn<StudentTableRow>[];
  }> };
  const props = Table({ students: rows }).props;
  assert.deepEqual(filterTableRows(rows, "jose main first technology 0001 student1@example.test", props.searchValue), [rows[0]]);
  assert.deepEqual(filterTableRows(rows, "student11@example.test 0011", props.searchValue), [rows[10]]);
  assert.deepEqual(filterTableRows(rows, "no-such-record", props.searchValue), []);
  const dateColumn = props.columns.find((column) => column.header === "Approved");
  assert.ok(dateColumn?.sortValue);
  assert.deepEqual(sortTableRows([rows[1], rows[10]], dateColumn.sortValue, "desc"), [rows[10], rows[1]]);
});

test("Manage Students opens the approved admission's details and editor using exact application IDs", () => {
  const records = students(1);
  records[0].id = "9007199254740993";
  const markup = renderToStaticMarkup(React.createElement(StudentsTable, { students: records }));
  assert.match(markup, /href="\/portal\/students\/9007199254740993"/);
  assert.match(markup, /href="\/portal\/students\/9007199254740993\/edit"/);
  assert.match(markup, /View details for Student 01/);
  assert.match(markup, /aria-label="Edit Student 01"/);
  assert.doesNotMatch(markup, /href="\/portal\/admission\//);
});

test("student management authorizes before reading and sends only the selected approved-student fields as serializable data", async () => {
  const events: string[] = [];
  const record = { ...students(1)[0], id: 9007199254740993n, updatedAt: new Date("2026-10-13T12:00:00Z"),
    student: { ...students(1)[0].student, userImage: "https://res.cloudinary.com/example/image/upload/student-photo.webp" } };
  let denied = true;
  const captured: StudentTableRow[][] = [];
  const { default: StudentsPage } = loadModule("../app/portal/students/page.tsx", {
    "react/jsx-runtime": jsxRuntime,
    "@/components/portal/page-header": pageHeaders,
    "@/lib/auth": { requireAdmin: async () => { events.push("authorize"); if (denied) throw new Error("Denied"); } },
    "@/lib/generated/prisma/enums": enums, "@/lib/utils": utils,
    "@/lib/prisma": { prisma: { admissionApplication: { findMany: async (query: { where: unknown; select: Record<string, unknown> }) => {
      events.push("read");
      assert.deepEqual(JSON.parse(JSON.stringify(query.where)), { applicationStatus: "approved" });
      assert.deepEqual(Object.keys(query.select).sort(), ["id", "applicantType", "updatedAt", "branch", "academicLevel", "program", "student"].sort());
      assert.deepEqual(JSON.parse(JSON.stringify(query.select.student)), { select: {
        email: true, firstName: true, lastName: true, middleName: true, phone: true, studentNumber: true, suffix: true, userImage: true,
      } });
      return [record];
    } } } },
    "./students-table": { StudentsTable: ({ students: rows }: { students: StudentTableRow[] }) => { captured.push(rows); return null; } },
  }) as typeof studentPages;
  await assert.rejects(StudentsPage(), /Denied/);
  assert.deepEqual(events, ["authorize"]);
  denied = false;
  renderToStaticMarkup(await StudentsPage());
  assert.deepEqual(events, ["authorize", "authorize", "read"]);
  assert.equal(captured[0][0].id, "9007199254740993");
  assert.equal(captured[0][0].updatedAt, "2026-10-13T12:00:00.000Z");
  assert.equal(captured[0][0].approvedDate, utils.formatDate(record.updatedAt));
  assert.equal(captured[0][0].student.userImage, record.student.userImage);
  assert.doesNotThrow(() => JSON.stringify(captured[0]));
});
