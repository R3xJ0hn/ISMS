import assert from "node:assert/strict";
import { test } from "node:test";
import * as XLSX from "xlsx";
import {
  classRosterImportMaxBytes, classRosterImportMaxRows, parseClassRosterWorkbook,
  type ClassRosterStudent,
} from "../lib/classes/roster-import";

const students: ClassRosterStudent[] = [
  { id: "9007199254740993", studentNumber: "000123", name: "Maria Ana Cruz" },
  { id: "2", studentNumber: "AB-002", name: "Jose Santos" },
  { id: "3", studentNumber: "123", name: "Plain Numeric" },
];

function workbookFile(rows: unknown[][], format: "xlsx" | "xls" = "xlsx", edit?: (sheet: XLSX.WorkSheet) => void) {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  edit?.(sheet);
  XLSX.utils.book_append_sheet(book, sheet, "Students");
  const bytes = XLSX.write(book, { type: "array", bookType: format === "xls" ? "biff8" : "xlsx" });
  return new File([bytes], `students.${format}`);
}

async function rowsFrom(file: File, saved: readonly ClassRosterStudent[] = students) {
  const result = await parseClassRosterWorkbook(file, saved);
  if (!result.success) assert.fail(result.message);
  return result.rows;
}

test("real XLSX and XLS workbooks preserve text numbers, saved IDs, and original row numbers", async () => {
  for (const format of ["xlsx", "xls"] as const) {
    const rows = await rowsFrom(workbookFile([
      ["Student Number", "Name"], ["000123", "  maria   ANA cruz  "], [], ["AB-002", "Jose Santos"],
    ], format));
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((row) => [row.rowNumber, row.studentNumber, row.studentId]), [
      [2, "000123", "9007199254740993"], [4, "AB-002", "2"],
    ]);
  }
});

test("accepts documented header aliases, trims values, and reads only the first worksheet", async () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["\uFEFFStudent No.", "Full Name"], [" AB-002 ", "Jose Santos"]]), "First");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["not headers"]]), "Second");
  const rows = await rowsFrom(new File([XLSX.write(book, { type: "array", bookType: "xlsx" })], "LIST.XLSX"));
  assert.equal(rows[0].studentId, "2");
  assert.equal(rows[0].studentNumber, "AB-002");
  const aliases = await rowsFrom(workbookFile([["studentnumber", "studentname"], ["000123", "Maria Ana Cruz"]]));
  assert.equal(aliases[0].studentId, students[0].id);
});

test("never guesses by name, changes identifier case, or drops significant zeroes", async () => {
  const rows = await rowsFrom(workbookFile([
    ["Student Number", "Name"],
    ["ab-002", "Jose Santos"], ["00123", "Maria Ana Cruz"], ["AB-002", "Maria Ana Cruz"], ["missing", "Jose Santos"],
  ]));
  assert.ok(rows.every((row) => row.studentId === null));
  assert.match(rows[0].message, /No saved student/u);
  assert.match(rows[2].message, /name does not match/u);
});

test("flags all repeated file numbers and ambiguous saved numbers", async () => {
  const repeated = await rowsFrom(workbookFile([
    ["Student Number", "Name"], ["AB-002", "Jose Santos"], [" AB-002 ", "Jose Santos"],
  ]));
  assert.ok(repeated.every((row) => row.studentId === null && /more than once/u.test(row.message)));
  const ambiguous = await rowsFrom(workbookFile([["Student Number", "Name"], ["AB-002", "Jose Santos"]]), [
    ...students, { id: "99", studentNumber: "AB-002", name: "Jose Santos" },
  ]);
  assert.equal(ambiguous[0].studentId, null);
  assert.match(ambiguous[0].message, /More than one saved/u);
});

test("requires both values while ignoring entirely empty rows", async () => {
  const rows = await rowsFrom(workbookFile([
    ["Student Number", "Name"], ["", "Jose Santos"], ["AB-002", ""], ["  ", "  "], [], ["AB-002", 12],
  ]));
  assert.deepEqual(rows.map((row) => row.rowNumber), [2, 3, 6]);
  assert.ok(rows.every((row) => row.studentId === null && /both required/u.test(row.message)));
});

test("safe numeric IDs respect explicit zero padding while scientific, decimal and unsafe cells do not match", async () => {
  const rows = await rowsFrom(workbookFile([
    ["Student Number", "Name"],
    [123, "Plain Numeric"], [123, "Maria Ana Cruz"], [123, "Plain Numeric"],
    [1234567890123456, "Unsafe Numeric"], [1.25, "Decimal"], [Number.MAX_SAFE_INTEGER + 1, "Unsafe Integer"],
  ], "xlsx", (sheet) => {
    sheet.A3.z = "000000";
    sheet.A4.z = "0.00E+00";
  }));
  assert.equal(rows[0].studentId, "3");
  assert.equal(rows[1].studentNumber, "000123");
  assert.equal(rows[1].studentId, students[0].id);
  for (const row of rows.slice(2)) {
    assert.equal(row.studentId, null);
    assert.match(row.message, /stored as Text/u);
  }
});

test("cached formula values never match student identifiers or names", async () => {
  const rows = await rowsFrom(workbookFile([
    ["Student Number", "Name"], ["AB-002", "Jose Santos"], ["000123", "Maria Ana Cruz"],
  ], "xlsx", (sheet) => {
    sheet.A2.f = '"AB-002"';
    sheet.B3.f = '"Maria Ana Cruz"';
  }));
  assert.equal(rows[0].studentId, null);
  assert.equal(rows[1].studentId, null);
  assert.match(rows[0].message, /formula/u);
  assert.match(rows[1].message, /formula/u);
});

test("keeps text as plain values for React rendering instead of evaluating or HTML-encoding it", async () => {
  const name = "<img src=x onerror=alert(1)>";
  const rows = await rowsFrom(workbookFile([["Student Number", "Name"], ["X", name]]), [{ id: "10", studentNumber: "X", name }]);
  assert.equal(rows[0].name, name);
  assert.equal(rows[0].studentId, "10");
});

test("rejects missing, duplicate and displaced headers and empty student lists", async () => {
  for (const cells of [
    [["Student Number", "Other"]],
    [["Student Number", "Name", "Student No"]],
    [["Student Number", "Name", "Full Name"]],
    [[], ["Student Number", "Name"], ["000123", "Maria Ana Cruz"]],
    [["Student Number", "Name"]],
  ]) {
    assert.equal((await parseClassRosterWorkbook(workbookFile(cells), students)).success, false);
  }
});

test("bounds the first worksheet before iterating a grid and accepts exactly 1,000 student rows", async () => {
  const rows = Array.from({ length: classRosterImportMaxRows }, (_, index) => [`S-${index}`, `Student ${index}`]);
  const valid = await parseClassRosterWorkbook(workbookFile([["Student Number", "Name"], ...rows]), []);
  assert.equal(valid.success, true);
  if (valid.success) assert.equal(valid.rows.length, classRosterImportMaxRows);
  const tooMany = await parseClassRosterWorkbook(workbookFile([["Student Number", "Name"], ...rows, ["extra", "Extra Student"]]), []);
  assert.equal(tooMany.success, false);
  if (!tooMany.success) assert.match(tooMany.message, /1,000/u);
  const tooWide = await parseClassRosterWorkbook(workbookFile([["Student Number", "Name"], ["AB-002", "Jose Santos"]], "xlsx", (sheet) => {
    sheet.AY2 = { t: "s", v: "distant cell" };
    sheet["!ref"] = "A1:AY2";
  }), students);
  assert.equal(tooWide.success, false);
  const tooTall = await parseClassRosterWorkbook(workbookFile([["Student Number", "Name"]], "xlsx", (sheet) => {
    sheet.A1048576 = { t: "s", v: "distant cell" };
    sheet["!ref"] = "A1:B1048576";
  }), students);
  assert.equal(tooTall.success, false);
});

test("rejects empty, oversized, corrupt, unsupported and CSV files disguised as Excel", async () => {
  const files = [
    new File([], "empty.xlsx"),
    new File([new Uint8Array(classRosterImportMaxBytes + 1)], "large.xlsx"),
    new File(["Student Number,Name\n000123,Maria Ana Cruz"], "roster.csv"),
    new File(["Student Number,Name\n000123,Maria Ana Cruz"], "roster.xlsx"),
    new File(["Student Number,Name\n000123,Maria Ana Cruz"], "roster.xls"),
    new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0])], "corrupt.xlsx"),
    new File([new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])], "corrupt.xls"),
  ];
  for (const file of files) assert.equal((await parseClassRosterWorkbook(file, students)).success, false, file.name);
});
