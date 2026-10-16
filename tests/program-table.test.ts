import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProgramsTable, type ProgramTableRow } from "../app/portal/programs/programs-table";
import { PortalTable } from "../components/portal/data-table";

function programs(count: number): ProgramTableRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index + 1), label: `Program ${index + 1}`, code: `P${index + 1}`,
    programType: "Bachelor", category: "College", slug: null, listed: false, sortOrder: index, subjectCount: index,
  }));
}

test("program table exposes search, accessible sorting and paging without rendering all rows", () => {
  const markup = renderToStaticMarkup(createElement(ProgramsTable, { programs: programs(11) }));
  assert.match(markup, /role="searchbox"/);
  assert.match(markup, /Search programs/);
  assert.match(markup, /aria-label="Sort by Code ascending"/);
  assert.match(markup, /aria-sort="ascending"/);
  assert.match(markup, /Page 1 of 2/);
  assert.match(markup, /Showing 1–10 of 11 programs/);
  assert.match(markup, /aria-label="Previous page" disabled=""/);
  assert.match(markup, /aria-label="Next page"/);
  assert.match(markup, /href="\/portal\/programs\/10\/edit"/);
  assert.match(markup, /href="\/portal\/programs\/10\/subjects"/);
  assert.match(markup, /aria-label="Assign subjects to Program 10"/);
  assert.match(markup, /aria-label="Sort by Subjects ascending"/);
  assert.doesNotMatch(markup, /href="\/portal\/programs\/11\/edit"/);
});

test("empty program searches stay available while unnecessary pagination is hidden", () => {
  const markup = renderToStaticMarkup(createElement(ProgramsTable, { programs: [] }));
  assert.match(markup, /No programs found/);
  assert.match(markup, /role="searchbox"/);
  assert.match(markup, /Showing 0–0 of 0 programs/);
  assert.doesNotMatch(markup, /aria-label="Next page"/);
});

test("existing server tables still render function columns with their default behavior", () => {
  const markup = renderToStaticMarkup(createElement(PortalTable<{ id: bigint; label: string }>, {
    rows: [{ id: 9007199254740993n, label: "Saved student" }],
    rowKey: (row) => row.id.toString(),
    columns: [{ header: "Student", cell: (row) => createElement("strong", null, row.label) }],
  }));
  assert.match(markup, /<strong>Saved student<\/strong>/);
  assert.match(markup, /scope="col"/);
  assert.doesNotMatch(markup, /aria-sort=/);
  assert.doesNotMatch(markup, /role="searchbox"/);
});
