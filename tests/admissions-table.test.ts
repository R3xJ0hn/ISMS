import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

import { InteractivePortalTable, type InteractiveTableColumn } from "../components/portal/interactive-table";
import * as pageHeaders from "../components/portal/page-header";
import * as studentColumns from "../components/portal/student-columns";
import * as academicLevels from "../lib/academic-levels";
import * as enums from "../lib/generated/prisma/enums";
import * as utils from "../lib/utils";
import { filterTableRows, paginateTableRows, sortTableRows } from "../lib/table";
import type { AdmissionTableRow } from "../app/portal/admission/admissions-table";

const branches = [{ id: "1", title: "Main Campus" }, { id: "2", title: "East Campus" }];

function applications(count: number): AdmissionTableRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index + 1), applicantType: "new", applicationStatus: "reviewing",
    submittedAt: new Date(Date.UTC(2026, 9, index + 1)).toISOString(), submittedDate: `Oct ${index + 1}, 2026`,
    academicLevel: "FirstYear", program: { label: "Information Technology" },
    student: { firstName: "Applicant", middleName: null, lastName: String(index + 1).padStart(2, "0"), suffix: null,
      studentNumber: String(index + 1).padStart(4, "0"), phone: "09171234567", email: `applicant${index + 1}@example.test` },
  }));
}

function StatusSelect({ applicationId, status, statuses }: { applicationId: string; status: string; statuses: string[] }) {
  return React.createElement("form", { "data-application-id": applicationId },
    React.createElement("select", { "aria-label": "Application status", defaultValue: status },
      statuses.map((value) => React.createElement("option", { key: value, value }, value))));
}

function BranchFilter({ branches: options, selectedBranchId }: { branches: typeof branches; selectedBranchId: string }) {
  return React.createElement("form", { action: "/portal/admission" },
    React.createElement("label", null, "Branch", React.createElement("select", { name: "branchId", defaultValue: selectedBranchId },
      React.createElement("option", { value: "" }, "All branches"),
      options.map((branch) => React.createElement("option", { key: branch.id, value: branch.id }, branch.title)))));
}

function Actions({ student }: { student: { applicationId: string; firstName: string; lastName: string } }) {
  return React.createElement("a", { href: `/portal/admission/${student.applicationId}/edit` }, `Edit ${student.firstName} ${student.lastName}`);
}

function loadModule(path: string, overrides: Record<string, unknown> = {}) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const controls = { AdmissionBranchFilter: BranchFilter, ApplicationStatusSelect: StatusSelect };
  const actions = { AdmittedStudentActions: Actions };
  const modules: Record<string, unknown> = {
    react: React, "react/jsx-runtime": jsxRuntime,
    "@/components/portal/interactive-table": { InteractivePortalTable },
    "@/components/portal/student-columns": studentColumns,
    "@/components/portal/page-header": pageHeaders,
    "@/lib/academic-levels": academicLevels, "@/lib/generated/prisma/enums": enums, "@/lib/utils": utils,
    "./admission-controls": controls, "@/app/portal/admission/admission-controls": controls,
    "./admitted-student-actions": actions, "@/app/portal/admission/admitted-student-actions": actions,
    ...overrides,
  };
  const loaded = { exports: {} };
  runInNewContext(code, {
    module: loaded, exports: loaded.exports, Date,
    require: (name: string) => { assert.ok(name in modules, `Unexpected admissions-table dependency: ${name}`); return modules[name]; },
  });
  return loaded.exports;
}

type TableProps = { applications: AdmissionTableRow[]; branches: typeof branches; selectedBranchId: string };
type InteractiveProps = {
  rows: AdmissionTableRow[];
  columns: InteractiveTableColumn<AdmissionTableRow>[];
  searchValue: (row: AdmissionTableRow) => string;
  toolbarControls: React.ReactElement;
  emptyTitle: string;
};

function tableModule(overrides: Record<string, unknown> = {}) {
  return loadModule("../app/portal/admission/admissions-table.tsx", overrides) as {
    AdmissionsTable: (props: TableProps) => React.ReactElement<InteractiveProps>;
  };
}

test("Admissions has shared search, sortable columns and pagination over the complete application list", () => {
  const { AdmissionsTable } = tableModule();
  const markup = renderToStaticMarkup(React.createElement(AdmissionsTable, {
    applications: applications(11), branches, selectedBranchId: "2",
  }));
  assert.match(markup, /role="searchbox"/);
  assert.match(markup, /Search (admission|application)/i);
  for (const header of ["Student", "Student No.", "Program", "Contact", "Status", "Submitted"]) {
    assert.ok(markup.includes(`Sort by ${header} `), header);
  }
  assert.match(markup, /aria-sort="descending"/);
  assert.match(markup, /Showing 1–10 of 11 applications/);
  assert.match(markup, /Page 1 of 2/);
  assert.match(markup, /Rows per page/);
  assert.match(markup, /href="\/portal\/admission\/11\/edit"/);
  assert.doesNotMatch(markup, /href="\/portal\/admission\/1\/edit"/);
  assert.match(markup, /action="\/portal\/admission"/);
  assert.match(markup, /<option value="2" selected="">East Campus/);
  assert.match(markup, /aria-label="applications table"/);
});

test("Admissions search matches accents, names, program, year level, numbers and contacts before pagination", () => {
  const records = applications(12);
  records[11].student.firstName = "José";
  records[11].applicationStatus = "rejected";
  const { AdmissionsTable } = tableModule({
    react: { ...React, useId: () => "filter", useMemo: (callback: () => unknown) => callback(), useState: () => ["", () => {}] },
    "@/components/portal/interactive-table": { InteractivePortalTable: () => null },
  });
  const { searchValue, columns } = AdmissionsTable({ applications: records, branches, selectedBranchId: "" }).props;
  assert.deepEqual(filterTableRows(records, "jose technology first 0012 applicant12@example.test", searchValue), [records[11]]);
  assert.deepEqual(filterTableRows(records, "review 0001", searchValue), [records[0]]);
  assert.deepEqual(filterTableRows(records, "rejected 0012", searchValue), [records[11]]);
  assert.deepEqual(filterTableRows(records, "no-matching-applicant", searchValue), []);
  const submitted = columns.find((column) => column.header === "Submitted");
  assert.ok(submitted?.sortValue);
  records[11].submittedAt = null;
  records[11].submittedDate = "Not recorded";
  const sorted = sortTableRows(records, submitted.sortValue, "desc");
  assert.equal(sorted[0].id, "11");
  assert.equal(sorted.at(-1)?.id, "12", "unrecorded dates must not become the newest application");
  assert.deepEqual(paginateTableRows(sorted, 1, 10).rows.map((row) => row.id), ["1", "12"]);
  assert.equal(sortTableRows(records, submitted.sortValue, "asc").at(-1)?.id, "12");
});

test("Admissions combines status and applicant type filters and resets paging when a filter or branch changes", () => {
  const state = ["", ""];
  let stateIndex = 0;
  const records = applications(4);
  records[0].applicationStatus = "draft";
  records[1].applicantType = "existing";
  records[2].applicationStatus = "rejected";
  records[2].applicantType = "existing";
  records[3].applicationStatus = "rejected";
  const { AdmissionsTable } = tableModule({
    react: { ...React, useId: () => "filter", useMemo: (callback: () => unknown) => callback(),
      useState: () => { const index = stateIndex++; return [state[index], (next: string) => { state[index] = next; }]; } },
    "@/components/portal/interactive-table": { InteractivePortalTable: () => null },
  });
  function renderTable(selectedBranchId = "") {
    stateIndex = 0;
    return AdmissionsTable({ applications: records, branches, selectedBranchId });
  }
  const first = renderTable();
  assert.equal(first.props.rows.length, 4);
  const filterMarkup = renderToStaticMarkup(first.props.toolbarControls);
  assert.match(filterMarkup, />Status<\/label>/);
  assert.match(filterMarkup, />Applicant type<\/label>/);
  assert.match(filterMarkup, /<option value="" selected="">All applicants<\/option>/);
  assert.match(filterMarkup, /<option value="new">New<\/option>/);
  assert.match(filterMarkup, /<option value="existing">Existing<\/option>/);
  for (const value of ["draft", "reviewing", "rejected"]) assert.match(filterMarkup, new RegExp(`<option value="${value}">`));
  assert.doesNotMatch(filterMarkup, /<option value="approved">/);
  state[0] = "rejected";
  const filtered = renderTable();
  assert.deepEqual(filtered.props.rows.map((row) => row.id), ["3", "4"]);
  assert.notEqual(first.key, filtered.key);
  state[1] = "existing";
  const combined = renderTable();
  assert.deepEqual(combined.props.rows.map((row) => row.id), ["3"]);
  assert.equal(combined.props.emptyTitle, "No applications match these filters");
  assert.notEqual(filtered.key, combined.key);
  state[0] = "";
  const existingOnly = renderTable();
  assert.deepEqual(existingOnly.props.rows.map((row) => row.id), ["2", "3"]);
  assert.notEqual(combined.key, existingOnly.key);
  state[1] = "new";
  const newOnly = renderTable();
  assert.deepEqual(newOnly.props.rows.map((row) => row.id), ["1", "4"]);
  assert.notEqual(existingOnly.key, newOnly.key);
  state[1] = "";
  const cleared = renderTable();
  assert.deepEqual(cleared.props.rows.map((row) => row.id), ["1", "2", "3", "4"]);
  assert.equal(cleared.props.emptyTitle, "No admission applications yet");
  assert.equal(cleared.key, first.key);
  assert.notEqual(cleared.key, newOnly.key);
  const differentBranch = renderTable("2");
  assert.notEqual(cleared.key, differentBranch.key);
});

test("Admissions retains draft protection, status actions, exact IDs and escaped optional summary fields", () => {
  const records = applications(2);
  records[0].id = "9007199254740993";
  records[0].student.firstName = "<Applicant>";
  records[0].student.studentNumber = "0007";
  records[0].student.phone = null;
  records[0].submittedAt = null;
  records[0].submittedDate = "Not recorded";
  records[1].applicationStatus = "draft";
  const { AdmissionsTable } = tableModule();
  const markup = renderToStaticMarkup(React.createElement(AdmissionsTable, { applications: records, branches, selectedBranchId: "" }));
  assert.match(markup, /href="\/portal\/admission\/9007199254740993\/edit"/);
  assert.match(markup, /data-application-id="9007199254740993"/);
  assert.doesNotMatch(markup, /data-application-id="2"/);
  assert.match(markup, /&lt;Applicant&gt;/);
  assert.doesNotMatch(markup, /<Applicant>/);
  assert.match(markup, /0007/);
  assert.match(markup, /Pending/);
  assert.match(markup, /Not recorded/);
  assert.match(markup, /<option value="approved">approved/);
  assert.match(markup, />Draft<\/span>/);
  assert.doesNotMatch(markup, /Password|Birth|Guardian|Address/);
  const empty = renderToStaticMarkup(React.createElement(AdmissionsTable, { applications: [], branches, selectedBranchId: "" }));
  assert.match(empty, /No admission applications yet/);
  assert.match(empty, /role="searchbox"/);
  assert.match(empty, /Showing 0–0 of 0 applications/);
  assert.doesNotMatch(empty, /aria-label="Next page"/);
});

type PageProps = { searchParams?: Promise<{ branchId?: string | string[] }> };
function pageHarness(authorized = true) {
  const events: string[] = [];
  const queries: Array<{ where: unknown; select: Record<string, unknown> }> = [];
  const captured: TableProps[] = [];
  const row = { ...applications(1)[0], id: 9007199254740993n, submittedAt: new Date("2026-10-16T10:00:00Z") };
  const { default: page } = loadModule("../app/portal/admission/page.tsx", {
    "@/lib/auth": { requireAdmin: async () => { events.push("authorize"); if (!authorized) throw new Error("Admin access required"); } },
    "@/lib/prisma": { prisma: { admissionApplication: { findMany: async (query: { where: unknown; select: Record<string, unknown> }) => {
      events.push("read"); queries.push(query); return [row, { ...row, id: 8n, submittedAt: null }];
    } } } },
    "@/lib/portal/admission-options": { getPortalAdmissionOptions: async () => { events.push("options"); return { branches, programs: [], academicLevels: [] }; } },
    "@/app/portal/admission/admitted-student-form": { AddAdmittedStudentModal: () => null, BulkAdmitStudentsModal: () => null },
    "./admissions-table": { AdmissionsTable: (props: TableProps) => { captured.push(props); return null; } },
    "@/app/portal/admission/admissions-table": { AdmissionsTable: (props: TableProps) => { captured.push(props); return null; } },
  }) as { default: (props: PageProps) => Promise<React.ReactElement> };
  return { events, queries, captured, row, page };
}

test("Admissions authorizes before reads and serializes only table summaries with lossless IDs and nullable dates", async () => {
  const denied = pageHarness(false);
  await assert.rejects(denied.page({}), /Admin access required/);
  assert.deepEqual(denied.events, ["authorize"]);
  const service = pageHarness();
  renderToStaticMarkup(await service.page({ searchParams: Promise.resolve({ branchId: ["9007199254740993", "2"] }) }));
  assert.equal(service.events[0], "authorize");
  const query = service.queries[0];
  assert.deepEqual(JSON.parse(JSON.stringify(query.where, (_key, value) => typeof value === "bigint" ? value.toString() : value)), {
    applicationStatus: { not: "approved" }, branchId: "9007199254740993",
  });
  assert.deepEqual(Object.keys(query.select).sort(), ["id", "applicantType", "applicationStatus", "submittedAt", "academicLevel", "program", "student"].sort());
  assert.deepEqual(JSON.parse(JSON.stringify(query.select.student)), { select: {
    email: true, firstName: true, lastName: true, middleName: true, phone: true, studentNumber: true, suffix: true,
  } });
  assert.equal(service.captured[0].selectedBranchId, "9007199254740993");
  assert.deepEqual(service.captured[0].branches, branches);
  const records = service.captured[0].applications;
  assert.equal(records[0].id, "9007199254740993");
  assert.equal(records[0].submittedAt, "2026-10-16T10:00:00.000Z");
  assert.equal(records[0].submittedDate, utils.formatDate(service.row.submittedAt));
  assert.equal(records[1].submittedAt, null);
  assert.equal(records[1].submittedDate, "Not recorded");
  assert.doesNotThrow(() => JSON.stringify(service.captured[0]));
});

test("Admissions branch filtering ignores absent, malformed, zero and out-of-range IDs without changing approval scope", async () => {
  for (const branchId of [undefined, "", "invalid", "0", "-1", "9223372036854775808"]) {
    const service = pageHarness();
    renderToStaticMarkup(await service.page({ searchParams: Promise.resolve({ branchId }) }));
    assert.deepEqual(JSON.parse(JSON.stringify(service.queries[0].where)), { applicationStatus: { not: "approved" } }, String(branchId));
    assert.equal(service.captured[0].selectedBranchId, "");
  }
});
