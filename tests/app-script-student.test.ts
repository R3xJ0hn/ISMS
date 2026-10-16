import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../script/app-script.js", import.meta.url), "utf8");
const secret = "synthetic-student-script-secret";
const studentNumber = "0007-Ab";
const studentName = "Synthetic Student";
const otherNumber = "0099";
const otherName = "Other Private Student";
type Grid = unknown[][];
type Read = { sheet: string; row: number; col: number; height: number; width: number };

function inputRows(): Grid {
  const rows: Grid = Array.from({ length: 12 }, () => []);
  rows[10] = ["", studentName, "", "", "", studentNumber, "", "Own note"];
  rows[11] = ["", otherName, "", "", "", otherNumber, "", "Other private note"];
  return rows;
}

function reportRows(): Grid {
  const rows: Grid = Array.from({ length: 7 }, () => []);
  rows[5] = ["", studentName, 0, 87.5, "", "", 88, "Passed"];
  rows[6] = ["", otherName, 991, 992, 993, 994, 995, "Other private remarks"];
  return rows;
}

function activityHeaders(): Grid {
  return [
    ["", "", "", "WRITTEN WORKS (30%)", "", "PERFORMANCE TASKS"],
    ["", "", "", "Quiz 1", "`Hidden practice", "Project"],
    ["", "", "", 20, 10, 50],
  ];
}

function periodRows(): Grid {
  return [...activityHeaders(),
    ["", studentName, "", 0, 5, 42.5],
    ["", otherName, "", 987, 988, 989],
  ];
}

function harness({
  input = inputRows(), report = reportRows(),
  periods = { Prelim: periodRows() } as Record<string, Grid>,
  excluded = false, openError = null as Error | null,
} = {}) {
  const reads: Read[] = [];
  const errors: unknown[] = [];
  let opens = 0;
  let cellReads = 0;
  const cells: Record<string, unknown> = {
    C8: "SYN-101", C3: "Synthetic subject", C4: "Synthetic Teacher",
    G7: true, G8: excluded, F4: 0.3, F5: 0.5, F6: 0.2,
  };
  function sheet(name: string, rows: Grid) {
    return {
      getLastRow: () => rows.length,
      getLastColumn: () => Math.max(0, ...rows.map((row) => row.length)),
      getRange: (range: string | number, col?: number, height?: number, width?: number) => {
        if (typeof range === "string") {
          cellReads++;
          const value = name === "INPUT" ? cells[range] : undefined;
          return { getValue: () => value, getDisplayValue: () => String(value ?? "") };
        }
        assert.ok(col !== undefined && height !== undefined && width !== undefined);
        assert.ok(height > 0 && width > 0, "Range dimensions must be positive");
        reads.push({ sheet: name, row: range, col, height, width });
        return {
          getDisplayValues: () => Array.from({ length: height }, (_, rowIndex) =>
            Array.from({ length: width }, (_, columnIndex) => String(rows[range - 1 + rowIndex]?.[col - 1 + columnIndex] ?? ""))),
        };
      },
    };
  }
  const sheets = new Map([
    ["INPUT", sheet("INPUT", input)], ["REPORT", sheet("REPORT", report)],
    ...Object.entries(periods).map(([name, rows]) => [name, sheet(name, rows)] as const),
  ]);
  const doPost = runInNewContext(`${source}\ndoPost`, {
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: (value: string) => ({ setMimeType: () => value }),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => secret }) },
    SpreadsheetApp: { openById: () => {
      opens++;
      if (openError) throw openError;
      return { getSheetByName: (name: string) => sheets.get(name) ?? null };
    } },
    console: { error: (value: unknown) => errors.push(value) },
  }) as (event: { postData: { contents: string } }) => string;
  function request(body: Record<string, unknown> = {}) {
    return JSON.parse(doPost({ postData: { contents: JSON.stringify({
      secret, spreadsheetId: "synthetic-sheet_123", action: "student", studentNum: studentNumber, ...body,
    }) } }));
  }
  return { request, reads, errors, get opens() { return opens; }, get cellReads() { return cellReads; } };
}

function assertPrivateFailure(result: unknown, code?: string) {
  assert.deepEqual(result, {
    success: false, error: "Request could not be completed", ...(code ? { code } : {}),
  });
  const serialized = JSON.stringify(result);
  for (const privateValue of [secret, studentNumber, studentName, otherNumber, otherName, "Own note", "Other private remarks"]) {
    assert.equal(serialized.includes(privateValue), false, privateValue);
  }
}

test("Apps Script student requests return only the exact student's own grades and scores, including zero", () => {
  const result = harness().request();
  assert.equal(result.success, true);
  assert.equal(result.action, "student");
  assert.equal(result.data.student_num, studentNumber);
  assert.equal(result.data.student_name, studentName);
  assert.deepEqual(result.data.grades[0], { Label: "Prelim", Value: 0 });
  assert.deepEqual(result.data.periods[0].categories[0].activities, [
    { name: "Quiz 1", max_score: 20, is_excludable: false, score: 0 },
  ]);
  assert.deepEqual(result.data.periods[0].categories[1].activities, [
    { name: "Project", max_score: 50, is_excludable: false, score: 42.5 },
  ]);
  for (const privateValue of [secret, otherNumber, otherName, "Other private note", "Other private remarks", "987", "991", "Hidden practice"]) {
    assert.equal(JSON.stringify(result).includes(privateValue), false, privateValue);
  }
});

test("Apps Script rejects missing INPUT numbers without numeric, case-insensitive, or name fallback", () => {
  for (const wrongNumber of ["7-Ab", "0007-ab", "missing-number"]) {
    const loaded = harness();
    assertPrivateFailure(loaded.request({ studentNum: wrongNumber, studentName }), "STUDENT_NUMBER_NOT_FOUND");
    assert.equal(loaded.reads.some((read) => read.sheet === "REPORT" || read.sheet === "Prelim"), false);
  }
});

test("Apps Script requires a nonempty student number and trims boundary whitespace only", () => {
  for (const empty of [null, "", "  "]) {
    assertPrivateFailure(harness().request({ studentNum: empty }), "STUDENT_NUMBER_REQUIRED");
  }
  assert.equal(harness().request({ studentNum: ` ${studentNumber} ` }).success, true);
});

test("a missing own REPORT row has a safe fixed code and cannot return a different student's grades", () => {
  const report = reportRows();
  report[5] = [];
  const loaded = harness({ report });
  assertPrivateFailure(loaded.request(), "STUDENT_REPORT_NOT_FOUND");
  assert.equal(loaded.reads.some((read) => read.sheet === "Prelim"), false);
});

test("duplicate own period rows remain ambiguous and never expose any score row", () => {
  const prelim = periodRows();
  prelim.push(["", `  ${studentName.toUpperCase()}  `, "", 999]);
  const loaded = harness({ periods: { Prelim: prelim } });
  assertPrivateFailure(loaded.request(), "STUDENT_RECORD_AMBIGUOUS");
  assert.equal(loaded.reads.some((read) => read.sheet === "Prelim" && read.col === 1 && read.row >= 4), false);
  const catalog = loaded.request({ action: "all_classworks" });
  assert.equal(catalog.success, true);
  assert.equal(JSON.stringify(catalog).includes('"score":'), false);
});

test("duplicate INPUT names and numbers have a safe ambiguity code without changing teacher error envelopes", () => {
  for (const field of ["name", "number"]) {
    const input = inputRows();
    input[11][field === "name" ? 1 : 5] = field === "name" ? studentName.toUpperCase() : studentNumber;
    const loaded = harness({ input });
    assertPrivateFailure(loaded.request(), "STUDENT_RECORD_AMBIGUOUS");
    assertPrivateFailure(loaded.request({ action: "all_students" }));
  }
});

test("duplicate REPORT records have a safe ambiguity code and keep internal exception details out of responses", () => {
  const report = reportRows();
  report.push(["", studentName.toUpperCase(), 999]);
  const loaded = harness({ report });
  assertPrivateFailure(loaded.request(), "STUDENT_RECORD_AMBIGUOUS");
  assert.equal(loaded.errors.length, 1);
});

test("future periods without the student return ungraded activities without reading another student's scores", () => {
  const future = [...activityHeaders(), ["", otherName, "", 987, 988, 989]];
  const loaded = harness({ periods: { Prelim: periodRows(), Midterm: future, "Pre-Finals": activityHeaders() } });
  const result = loaded.request();
  assert.equal(result.success, true);
  for (const period of result.data.periods.slice(1, 3)) {
    assert.equal(period.categories.length, 2);
    for (const category of period.categories) for (const activity of category.activities) assert.equal(activity.score, null);
  }
  assert.deepEqual(result.data.periods[3], { period: "Finals", categories: [] });
  assert.equal(loaded.reads.some((read) => read.sheet === "Midterm" && read.col === 1 && read.row >= 4), false);
  assert.equal(JSON.stringify(result).includes("987"), false);
  assert.equal(JSON.stringify(result).includes(otherName), false);
});

test("excludable classwork remains governed by settings and teacher catalogs keep their score-free shape", () => {
  const loaded = harness({ excluded: true });
  const student = loaded.request();
  assert.deepEqual(student.data.periods[0].categories[0].activities[1], {
    name: "Hidden practice", max_score: 10, is_excludable: true, score: 5,
  });
  const teacher = loaded.request({ action: "all_classworks" });
  assert.equal(teacher.success, true);
  assert.equal(teacher.action, "all_classworks");
  assert.deepEqual(teacher.data.periods[0].categories[0].activities[0], {
    name: "Quiz 1", max_score: 20, is_excludable: false,
  });
  assert.equal(JSON.stringify(teacher).includes('"score":'), false);
  assert.equal(JSON.stringify(teacher).includes(studentNumber), false);
});

test("the shared secret is checked before opening a spreadsheet or reading any cells", () => {
  for (const invalid of [undefined, null, "wrong-secret"]) {
    const loaded = harness();
    assert.deepEqual(loaded.request({ secret: invalid }), { success: false, error: "Unauthorized" });
    assert.equal(loaded.opens, 0);
    assert.equal(loaded.cellReads, 0);
    assert.equal(loaded.reads.length, 0);
  }
});

test("unexpected exception messages and unapproved codes never leave the Apps Script response", () => {
  const error = Object.assign(new Error(`${secret} ${studentName} ${studentNumber}`), { code: "PRIVATE_EXCEPTION" });
  const loaded = harness({ openError: error });
  assertPrivateFailure(loaded.request());
  assert.equal(loaded.errors[0], error);
});
