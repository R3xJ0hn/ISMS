import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { getClassSummary, getClassworkCatalog, getStudentClasswork } from "../lib/classes/spreadsheet";

const sheetUrl = "https://docs.google.com/spreadsheets/d/classwork-sheet_123/edit#gid=0";
const endpoint = "https://script.google.com/macros/s/classwork-deployment_123/exec";
const secret = "synthetic-classwork-secret";
const studentNumber = "0007-Ab";
const grades = [
  { Label: "Prelim", Value: 0 }, { Label: "Midterm", Value: 87.5 },
  { Label: "Prefinals", Value: null }, { Label: "Finals", Value: "" },
  { Label: "Ave", Value: 88 }, { Label: "Remarks", Value: "Passed" },
  { Label: "Note", Value: null },
];

function periods(includeScores = false) {
  return ["Prelim", "Midterm", "Prefinals", "Finals"].map((period) => ({
    period,
    categories: period === "Prelim" ? [{
      name: " Written Works ", weight: 30,
      activities: [
        { name: " Quiz 1 ", max_score: 20, is_excludable: false, ...(includeScores ? { score: 0 } : {}) },
        { name: "Practice", max_score: 10, is_excludable: true, ...(includeScores ? { score: null } : {}) },
        { name: "Report", max_score: 50, is_excludable: false, ...(includeScores ? { score: " 42.5 " } : {}) },
      ],
    }] : [],
  }));
}

function payload(action: "all_classworks" | "student", excluded = false) {
  return {
    success: true, action,
    settings: { view_records_in_web_portal: true, view_excluded_columns_in_web_portal: excluded },
    data: {
      subject_code: "TEST-101", subject_title: "Synthetic subject", instructor_name: "Synthetic teacher",
      ...(action === "student" ? { student_num: studentNumber, student_name: "Synthetic Student", grades } : {}),
      periods: periods(action === "student"),
    },
  };
}

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

function response(t: TestContext, value: unknown, status = 200) {
  return t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(value), { status }));
}

test("teacher classwork requests the catalog server-side with the trusted shared connection", async (t) => {
  connection(t);
  let request: { url: string; init?: RequestInit } | undefined;
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    request = { url: String(url), init };
    return new Response(JSON.stringify(payload("all_classworks")));
  });
  const result = await getClassworkCatalog(sheetUrl);
  assert.equal(result.success, true);
  assert.equal(request?.url, endpoint);
  assert.equal(request?.init?.method, "POST");
  assert.deepEqual(request?.init?.headers, { "Content-Type": "text/plain" });
  assert.equal(request?.init?.cache, "no-store");
  assert.ok(request?.init?.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(String(request?.init?.body)), { secret, spreadsheetId: "classwork-sheet_123", action: "all_classworks" });
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(JSON.stringify(result).includes("subject_code"), false);
});

test("catalogs normalize periods and metadata while filtering excluded activities", async (t) => {
  connection(t);
  const value = payload("all_classworks");
  value.data.periods.reverse();
  response(t, value);
  const result = await getClassworkCatalog(sheetUrl);
  assert.deepEqual(result, {
    success: true,
    periods: [
      { period: "Prelim", categories: [{ name: "Written Works", weight: 30, activities: [
        { name: "Quiz 1", maxScore: 20, isExcludable: false },
        { name: "Report", maxScore: 50, isExcludable: false },
      ] }] },
      { period: "Midterm", categories: [] }, { period: "Prefinals", categories: [] }, { period: "Finals", categories: [] },
    ],
  });
});

test("teacher catalogs never serialize scores or student data from an overbroad provider response", async (t) => {
  connection(t);
  const value = { ...payload("student", true), action: "all_classworks" };
  response(t, value);
  const result = await getClassworkCatalog(sheetUrl);
  assert.equal(result.success, true);
  const serialized = JSON.stringify(result);
  for (const privateField of ["studentNumber", "studentName", "student_num", "Synthetic Student", '"score":', '"record":']) {
    assert.equal(serialized.includes(privateField), false, privateField);
  }
});

test("student requests preserve leading zeros and case and return only the exact requested student's scores", async (t) => {
  connection(t);
  let body: Record<string, unknown> | undefined;
  t.mock.method(globalThis, "fetch", async (_url: string | URL | Request, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify(payload("student", true)));
  });
  const result = await getStudentClasswork(sheetUrl, ` ${studentNumber} `);
  assert.deepEqual(body, { secret, spreadsheetId: "classwork-sheet_123", action: "student", studentNum: studentNumber });
  assert.ok(result.success);
  assert.deepEqual(result.record, {
    studentNumber, studentName: "Synthetic Student", prelim: "0", midterm: "87.5",
    prefinals: null, finals: null, average: "88", remarks: "Passed", note: null,
  });
  assert.deepEqual(result.periods[0].categories[0].activities, [
    { name: "Quiz 1", maxScore: 20, isExcludable: false, score: "0" },
    { name: "Practice", maxScore: 10, isExcludable: true, score: null },
    { name: "Report", maxScore: 50, isExcludable: false, score: "42.5" },
  ]);
  assert.equal(JSON.stringify(result).includes(secret), false);
});

test("student record failures expose only fixed useful messages and never raw provider details", async (t) => {
  connection(t);
  let value: unknown;
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(value)));
  for (const [code, expected] of [
    ["STUDENT_NUMBER_NOT_FOUND", /student number is not listed/],
    ["STUDENT_REPORT_NOT_FOUND", /REPORT sheet/],
    ["STUDENT_RECORD_AMBIGUOUS", /cannot be matched safely/],
  ] as const) {
    value = { success: false, code, error: "PRIVATE-STUDENT-ID AND NAME" };
    const result = await getStudentClasswork(sheetUrl, studentNumber);
    assert.ok(!result.success);
    assert.equal(result.code, code);
    assert.match(result.message, expected);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE-STUDENT-ID AND NAME/);
    const catalog = await getClassworkCatalog(sheetUrl);
    assert.ok(!catalog.success);
    assert.equal("code" in catalog, false);
    assert.doesNotMatch(catalog.message, /student number|REPORT sheet|matched safely/);
  }
  for (const code of ["PRIVATE-STUDENT-ID", "toString", "__proto__", null]) {
    value = { success: false, code, error: "PRIVATE-STUDENT-ID AND NAME" };
    const result = await getStudentClasswork(sheetUrl, studentNumber);
    assert.ok(!result.success);
    assert.equal(result.code, undefined);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE-STUDENT-ID AND NAME|toString|__proto__/);
  }
});

test("missing student numbers stop before contacting the provider", async (t) => {
  connection(t);
  const mocked = response(t, payload("student"));
  assert.equal((await getStudentClasswork(sheetUrl, " ")).success, false);
  assert.equal(mocked.mock.callCount(), 0);
});

test("student responses with a different identifier fail closed without name fallback", async (t) => {
  connection(t);
  let value: unknown;
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(value)));
  for (const wrongNumber of ["7-Ab", "0007-ab", "another-student", 7, null, undefined]) {
    value = { ...payload("student"), data: { ...payload("student").data, student_num: wrongNumber } };
    const result = await getStudentClasswork(sheetUrl, studentNumber);
    assert.equal(result.success, false, String(wrongNumber));
    assert.equal(JSON.stringify(result).includes("Synthetic Student"), false);
  }
});

test("explicit hidden records block catalog, own grades and existing summary serialization", async (t) => {
  connection(t);
  let value: unknown;
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(value)));
  for (const action of ["all_classworks", "student"] as const) {
    const base = payload(action);
    value = { ...base, settings: { ...base.settings, view_records_in_web_portal: false } };
    const result = action === "student" ? await getStudentClasswork(sheetUrl, studentNumber) : await getClassworkCatalog(sheetUrl);
    assert.deepEqual(result, { success: false, message: "This class has not enabled spreadsheet records in the portal." });
    assert.equal(JSON.stringify(result).includes("Synthetic Student"), false);
  }
  value = { success: true, settings: { view_records_in_web_portal: false }, data: { students: [{ student_num: studentNumber, student_name: "Synthetic Student", grades }] } };
  assert.deepEqual(await getClassSummary(sheetUrl), { success: false, message: "This class has not enabled spreadsheet records in the portal." });
});

test("both new actions require the exact action and complete boolean visibility settings", async (t) => {
  connection(t);
  let value: unknown;
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(value)));
  for (const action of ["all_classworks", "student"] as const) {
    const base = payload(action);
    for (const invalid of [
      null, {}, { ...base, action: action === "student" ? "all_classworks" : "student" },
      { ...base, action: undefined }, { ...base, success: "true" },
      { ...base, settings: undefined }, { ...base, settings: {} },
      { ...base, settings: { ...base.settings, view_records_in_web_portal: "false" } },
      { ...base, settings: { ...base.settings, view_excluded_columns_in_web_portal: 1 } },
    ]) {
      value = invalid;
      const result = action === "student" ? await getStudentClasswork(sheetUrl, studentNumber) : await getClassworkCatalog(sheetUrl);
      assert.equal(result.success, false);
      assert.equal(JSON.stringify(result).includes("Synthetic Student"), false);
    }
  }
});

test("excluded flags and raw backtick markers both prevent hidden activity disclosure", async (t) => {
  connection(t);
  const value = payload("student");
  value.data.periods[0].categories[0].activities[2].name = "`Hidden Report";
  response(t, value);
  const result = await getStudentClasswork(sheetUrl, studentNumber);
  assert.ok(result.success);
  assert.deepEqual(result.periods[0].categories[0].activities, [{ name: "Quiz 1", maxScore: 20, isExcludable: false, score: "0" }]);
  assert.equal(JSON.stringify(result).includes("Hidden Report"), false);
});

test("malformed periods, categories, activity maxima and scores fail instead of partial classwork", async (t) => {
  connection(t);
  let value: unknown;
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(value)));
  const firstPeriod = periods(true)[0];
  const firstCategory = firstPeriod.categories[0];
  const firstActivity = firstCategory.activities[0];
  const replacementPeriods = (first: unknown) => [first, ...periods(true).slice(1)];
  const replacementCategory = (category: unknown) => replacementPeriods({ ...firstPeriod, categories: [category] });
  const replacementActivity = (activity: unknown) => replacementCategory({ ...firstCategory, activities: [activity] });
  const invalidPeriods: unknown[] = [
    undefined, null, [], periods(true).slice(0, 3), [firstPeriod, firstPeriod, ...periods(true).slice(2)],
    replacementPeriods({ ...firstPeriod, period: "Other" }), replacementPeriods({ ...firstPeriod, categories: null }),
    replacementCategory({ ...firstCategory, name: " " }), replacementCategory({ ...firstCategory, activities: null }),
    replacementCategory({ ...firstCategory, weight: undefined }), replacementCategory({ ...firstCategory, weight: -1 }),
    replacementCategory({ ...firstCategory, weight: 101 }), replacementCategory({ ...firstCategory, weight: "30" }),
    replacementActivity({ ...firstActivity, name: " " }), replacementActivity({ ...firstActivity, max_score: 0 }),
    replacementActivity({ ...firstActivity, max_score: -1 }), replacementActivity({ ...firstActivity, max_score: "20" }),
    replacementActivity({ ...firstActivity, is_excludable: undefined }), replacementActivity({ ...firstActivity, score: undefined }),
    replacementActivity({ ...firstActivity, score: { private: true } }),
  ];
  for (const invalid of invalidPeriods) {
    const base = payload("student", true);
    value = { ...base, data: { ...base.data, periods: invalid } };
    const result = await getStudentClasswork(sheetUrl, studentNumber);
    assert.equal(result.success, false);
    assert.equal(JSON.stringify(result).includes("Synthetic Student"), false);
  }
});

test("incomplete or duplicate own grade labels invalidate the complete student response", async (t) => {
  connection(t);
  let value: unknown;
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(value)));
  for (const invalidGrades of [grades.slice(0, 6), [...grades, { Label: "Prelim", Value: 90 }], null]) {
    const base = payload("student");
    value = { ...base, data: { ...base.data, grades: invalidGrades } };
    assert.equal((await getStudentClasswork(sheetUrl, studentNumber)).success, false);
  }
});

test("new classwork actions reject invalid links and untrusted endpoint configuration before fetching", async (t) => {
  connection(t);
  const mocked = response(t, payload("all_classworks"));
  for (const url of ["http://docs.google.com/spreadsheets/d/id/edit", "https://docs.google.com.evil.test/spreadsheets/d/id/edit"]) {
    assert.equal((await getClassworkCatalog(url)).success, false);
    assert.equal((await getStudentClasswork(url, studentNumber)).success, false);
  }
  process.env.GOOGLE_SCRIPT_URL = "https://127.0.0.1/macros/s/id/exec";
  assert.equal((await getClassworkCatalog(sheetUrl)).success, false);
  assert.equal((await getStudentClasswork(sheetUrl, studentNumber)).success, false);
  process.env.GOOGLE_SCRIPT_URL = endpoint;
  delete process.env.GOOGLE_SCRIPT_SECRET;
  assert.equal((await getClassworkCatalog(sheetUrl)).success, false);
  assert.equal((await getStudentClasswork(sheetUrl, studentNumber)).success, false);
  assert.equal(mocked.mock.callCount(), 0);
});

test("provider, HTTP, non-JSON, timeout and network failures keep details private", async (t) => {
  connection(t);
  let mode: "provider" | "http" | "html" | "timeout" | "network" = "provider";
  t.mock.method(globalThis, "fetch", async () => {
    if (mode === "provider") return new Response(JSON.stringify({ success: false, error: `${secret} Synthetic Student` }));
    if (mode === "http") return new Response(secret, { status: 500 });
    if (mode === "html") return new Response(`<html>${secret}</html>`);
    if (mode === "timeout") throw new DOMException(secret, "TimeoutError");
    throw new Error(secret);
  });
  for (mode of ["provider", "http", "html", "timeout", "network"] as const) {
    for (const result of [await getClassworkCatalog(sheetUrl), await getStudentClasswork(sheetUrl, studentNumber)]) {
      assert.equal(result.success, false);
      assert.equal(JSON.stringify(result).includes(secret), false);
      assert.equal(JSON.stringify(result).includes("Synthetic Student"), false);
      if (!result.success) assert.match(result.message, mode === "timeout" ? /too long/i : /unable to load/i);
    }
  }
});
