import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { getClassSummary } from "../lib/classes/spreadsheet";

const sheetUrl = "https://docs.google.com/spreadsheets/d/test-sheet_123/edit#gid=0";
const endpoint = "https://script.google.com/macros/s/test-deployment_123/exec";
const secret = "test-spreadsheet-secret";
const reportStudent = {
  student_num: "0000123", student_name: "Maria Santos",
  grades: [
    { Label: "Prelim", Value: 0 }, { Label: "Midterm", Value: "85.50" },
    { Label: "Prefinals", Value: null }, { Label: "Finals", Value: "" },
    { Label: "Ave", Value: 86 }, { Label: "Remarks", Value: "PASSED" },
    { Label: "Note", Value: " Regular " },
  ],
};

function connection(t: TestContext) {
  const previousUrl = process.env.GOOGLE_SCRIPT_URL;
  const previousSecret = process.env.GOOGLE_SCRIPT_SECRET;
  process.env.GOOGLE_SCRIPT_URL = endpoint;
  process.env.GOOGLE_SCRIPT_SECRET = secret;
  t.after(() => {
    if (previousUrl === undefined) delete process.env.GOOGLE_SCRIPT_URL;
    else process.env.GOOGLE_SCRIPT_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.GOOGLE_SCRIPT_SECRET;
    else process.env.GOOGLE_SCRIPT_SECRET = previousSecret;
  });
}

function response(t: TestContext, payload: unknown, status = 200) {
  return t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(payload), { status }));
}

function summary(students: unknown[]) {
  return { success: true, settings: { view_records_in_web_portal: true }, data: { total_students: students.length, students } };
}

test("class summaries request the existing all_students action and normalize report grades", async (t) => {
  connection(t);
  let request: { url: string; init?: RequestInit } | undefined;
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    request = { url: String(url), init };
    return new Response(JSON.stringify(summary([reportStudent])));
  });
  const result = await getClassSummary(sheetUrl);
  assert.deepEqual(result, { success: true, students: [{
    studentNumber: "0000123", studentName: "Maria Santos", prelim: "0", midterm: "85.50",
    prefinals: null, finals: null, average: "86", remarks: "PASSED", note: "Regular",
  }] });
  assert.equal(request?.url, endpoint);
  assert.equal(request?.init?.method, "POST");
  assert.deepEqual(request?.init?.headers, { "Content-Type": "text/plain" });
  assert.equal(request?.init?.cache, "no-store");
  assert.ok(request?.init?.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(String(request?.init?.body)), {
    secret, spreadsheetId: "test-sheet_123", action: "all_students",
  });
  assert.equal(JSON.stringify(result).includes(secret), false);
});

test("flat aliases normalize to the same student summary shape", async (t) => {
  connection(t);
  response(t, summary([{
    studentNumber: " 001 ", studentName: " Juan Cruz ", prelim: "75", midterm: 0,
    pre_finals: "", finals: null, ave: "80.00", remarks: null, note: "0",
  }]));
  assert.deepEqual(await getClassSummary(sheetUrl), { success: true, students: [{
    studentNumber: "001", studentName: "Juan Cruz", prelim: "75", midterm: "0",
    prefinals: null, finals: null, average: "80.00", remarks: null, note: "0",
  }] });
});

test("empty student arrays are successful empty summaries", async (t) => {
  connection(t);
  response(t, summary([]));
  assert.deepEqual(await getClassSummary(sheetUrl), { success: true, students: [] });
});

test("students without assigned numbers retain their names and grades without invented identifiers", async (t) => {
  connection(t);
  response(t, summary([
    { ...reportStudent, student_num: "", student_name: "Maria Santos" },
    { ...reportStudent, student_num: "   ", student_name: "Juan Cruz" },
    { ...reportStudent, student_num: "0000123", student_name: "Ana Reyes" },
  ]));
  const result = await getClassSummary(sheetUrl);
  assert.equal(result.success, true);
  if (!result.success) assert.fail("Unassigned student numbers rejected");
  assert.deepEqual(result.students.map(({ studentNumber, studentName, prelim }) => ({ studentNumber, studentName, prelim })), [
    { studentNumber: "", studentName: "Maria Santos", prelim: "0" },
    { studentNumber: "", studentName: "Juan Cruz", prelim: "0" },
    { studentNumber: "0000123", studentName: "Ana Reyes", prelim: "0" },
  ]);
});

test("invalid spreadsheet links and untrusted script endpoints never trigger a request", async (t) => {
  connection(t);
  const fetchMock = response(t, summary([]));
  for (const invalid of [
    "https://example.com/sheet", "http://docs.google.com/spreadsheets/d/test-sheet_123/edit",
    "https://docs.google.com.evil.test/spreadsheets/d/test-sheet_123/edit",
  ]) {
    assert.equal((await getClassSummary(invalid)).success, false);
  }
  for (const invalid of [
    "http://script.google.com/macros/s/test/exec", "https://script.google.com.evil.test/macros/s/test/exec",
    "https://script.googleusercontent.com/macros/s/test/exec", "https://127.0.0.1/macros/s/test/exec",
    "https://user:password@script.google.com/macros/s/test/exec", "https://script.google.com/macros/s/test/dev",
    "https://script.google.com/macros/s/test/exec?target=internal", "https://script.google.com/macros/s/test/exec#extra",
    "https://script.google.com:444/macros/s/test/exec", "not a URL",
  ]) {
    process.env.GOOGLE_SCRIPT_URL = invalid;
    assert.equal((await getClassSummary(sheetUrl)).success, false, invalid);
  }
  process.env.GOOGLE_SCRIPT_URL = endpoint;
  delete process.env.GOOGLE_SCRIPT_SECRET;
  assert.equal((await getClassSummary(sheetUrl)).success, false);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("malformed and incomplete provider payloads fail instead of showing an empty summary", async (t) => {
  connection(t);
  let payload: unknown;
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(payload)));
  const malformed: unknown[] = [
    null, {}, { success: true }, { success: true, data: { students: null } },
    { success: true, data: { total_students: 1, students: [] } },
    summary([null]), summary([{ ...reportStudent, student_num: 123 }]),
    summary([{ ...reportStudent, student_num: undefined }]),
    summary([{ ...reportStudent, student_name: " " }]),
    summary([{ ...reportStudent, grades: reportStudent.grades.slice(0, 6) }]),
    summary([{ ...reportStudent, grades: [...reportStudent.grades, { Label: "Prelim", Value: 90 }] }]),
    summary([{ ...reportStudent, grades: [{ Label: "Prelim", Value: { invalid: true } }, ...reportStudent.grades.slice(1)] }]),
  ];
  for (payload of malformed) {
    const result = await getClassSummary(sheetUrl);
    assert.equal(result.success, false);
    if (!result.success) assert.match(result.message, /incomplete/i);
  }
});

test("duplicate student numbers and ambiguous normalized names fail safely", async (t) => {
  connection(t);
  let students: unknown[] = [];
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(summary(students))));
  for (const duplicate of [
    { ...reportStudent, student_name: "Juan Cruz" },
    { ...reportStudent, student_num: "0000124", student_name: " MARIA   SANTOS " },
  ]) {
    students = [reportStudent, duplicate];
    const result = await getClassSummary(sheetUrl);
    assert.equal(result.success, false);
    if (!result.success) assert.match(result.message, /duplicate/i);
  }
});

test("provider failures expose useful safe messages without raw errors or student names", async (t) => {
  connection(t);
  let error = "";
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ success: false, error })));
  for (const [providerError, expected] of [
    ["Unsupported action", /update the spreadsheet service/i], ["Unauthorized", /check the connection/i],
    ["REPORT sheet not found", /missing its REPORT/i], ["Worksheet not found", /could not find the class worksheet/i],
    ["Duplicate name in INPUT: Private Student", /duplicate student names/i],
    [`Internal failure with ${secret} and Private Student`, /Unable to load/i],
  ] as const) {
    error = providerError;
    const result = await getClassSummary(sheetUrl);
    assert.equal(result.success, false);
    if (!result.success) assert.match(result.message, expected);
    assert.equal(JSON.stringify(result).includes(secret), false);
    assert.equal(JSON.stringify(result).includes("Private Student"), false);
  }
});

test("transport errors, non-JSON responses and timeouts remain safe failures", async (t) => {
  connection(t);
  let mode: "http" | "html" | "timeout" | "network" = "http";
  t.mock.method(globalThis, "fetch", async () => {
    if (mode === "http") return new Response(secret, { status: 500 });
    if (mode === "html") return new Response(`<html>${secret}</html>`);
    if (mode === "timeout") throw new DOMException(secret, "TimeoutError");
    throw new Error(secret);
  });
  for (mode of ["http", "html", "timeout", "network"] as const) {
    const result = await getClassSummary(sheetUrl);
    assert.equal(result.success, false);
    if (!result.success) assert.match(result.message, mode === "timeout" ? /too long/i : /Unable to load/i);
    assert.equal(JSON.stringify(result).includes(secret), false);
  }
});
