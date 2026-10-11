import assert from "node:assert/strict";
import { test } from "node:test";
import { filterTableRows, paginateTableRows, sortTableRows } from "../lib/table";

test("search matches every term across fields regardless of case, accents, or query spacing", () => {
  const rows = [
    { name: "José Santos", program: "Computer Technology" },
    { name: "Maria Santos", program: "Tourism Management" },
    { name: "Jose Reyes", program: "Tourism Management" },
  ];
  const searchValue = (row: typeof rows[number]) => `${row.name} ${row.program}`;

  assert.deepEqual(filterTableRows(rows, "  TECHNOLOGY\tJOSÉ  ", searchValue), [rows[0]]);
  assert.deepEqual(filterTableRows(rows, "santos tourism", searchValue), [rows[1]]);
  assert.deepEqual(filterTableRows(rows, "jose accounting", searchValue), []);
  const unchanged = filterTableRows(rows, " \n\t ", searchValue);
  assert.deepEqual(unchanged, rows);
  assert.notEqual(unchanged, rows);
});

test("sorting uses natural text order and retains the original order for equivalent labels", () => {
  const rows = [
    { id: 1, name: "Course 10" },
    { id: 2, name: "Course 2" },
    { id: 3, name: "course 2" },
    { id: 4, name: "Course 1" },
  ];
  const original = [...rows];

  assert.deepEqual(sortTableRows(rows, (row) => row.name, "asc").map((row) => row.id), [4, 2, 3, 1]);
  assert.deepEqual(sortTableRows(rows, (row) => row.name, "desc").map((row) => row.id), [1, 2, 3, 4]);
  assert.deepEqual(rows, original);
});

test("numeric sorting keeps missing values last in either direction and preserves ties", () => {
  const rows = [
    { id: "unset", order: undefined },
    { id: "ten", order: 10 },
    { id: "negative", order: -2 },
    { id: "null", order: null },
    { id: "two", order: 2 },
    { id: "zero", order: 0 },
    { id: "same-two", order: 2 },
    { id: "invalid", order: Number.NaN },
  ];

  assert.deepEqual(sortTableRows(rows, (row) => row.order, "asc").map((row) => row.id), [
    "negative", "zero", "two", "same-two", "ten", "unset", "null", "invalid",
  ]);
  assert.deepEqual(sortTableRows(rows, (row) => row.order, "desc").map((row) => row.id), [
    "ten", "two", "same-two", "zero", "negative", "unset", "null", "invalid",
  ]);
  assert.deepEqual(sortTableRows(["", "Beta", " ", "Alpha"], (value) => value, "desc"), [
    "Beta", "Alpha", "", " ",
  ]);
  assert.deepEqual(sortTableRows([true, false, true], (value) => value, "asc"), [false, true, true]);
});

test("filtering and sorting run across the complete data before a page is selected", () => {
  const rows = [
    { name: "Computer 10", category: "Associate" },
    { name: "Tourism", category: "Bachelor" },
    { name: "Computer 3", category: "Associate" },
    { name: "Computer 1", category: "Associate" },
    { name: "Computer 2", category: "Associate" },
    { name: "Computer 4", category: "Associate" },
  ];
  const matching = filterTableRows(rows, "associate computer", (row) => `${row.name} ${row.category}`);
  const sorted = sortTableRows(matching, (row) => row.name, "asc");
  const result = paginateTableRows(sorted, 1, 2);

  assert.deepEqual(result, {
    rows: [rows[2], rows[5]], page: 1, pageCount: 3, start: 3, end: 4, total: 5,
  });
  assert.deepEqual(paginateTableRows(sorted, 2, 2), {
    rows: [rows[0]], page: 2, pageCount: 3, start: 5, end: 5, total: 5,
  });
});

test("pagination clamps old pages after filtering shrinks the data and reports empty ranges", () => {
  const rows = ["one", "two", "three"];
  assert.deepEqual(paginateTableRows(rows, 8, 2), {
    rows: ["three"], page: 1, pageCount: 2, start: 3, end: 3, total: 3,
  });
  assert.deepEqual(paginateTableRows(["one"], 8, 2), {
    rows: ["one"], page: 0, pageCount: 1, start: 1, end: 1, total: 1,
  });
  assert.deepEqual(paginateTableRows([], 8, 2), {
    rows: [], page: 0, pageCount: 0, start: 0, end: 0, total: 0,
  });
  for (const page of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(paginateTableRows(rows, page, 2).page, 0);
  }
});

test("pagination rejects invalid page sizes instead of creating unusable page controls", () => {
  for (const size of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => paginateTableRows(["row"], 0, size), RangeError);
  }
});
