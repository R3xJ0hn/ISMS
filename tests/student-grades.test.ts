import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import { getStudentGrades, normalizeSemester } from "../lib/student-grades";

function mockGradesService(context: TestContext, payload: unknown = []) {
  const previousEndpoint = process.env.STUDENT_GRADES_APPS_SCRIPT_URL;
  process.env.STUDENT_GRADES_APPS_SCRIPT_URL = "https://grades.example.test/exec";
  context.after(() => {
    if (previousEndpoint === undefined) delete process.env.STUDENT_GRADES_APPS_SCRIPT_URL;
    else process.env.STUDENT_GRADES_APPS_SCRIPT_URL = previousEndpoint;
  });
  const implementation: typeof fetch = async () => Response.json(payload);
  return context.mock.method(globalThis, "fetch", implementation);
}

async function parsedGrades() {
  const result = await getStudentGrades("2026-001", "1stSem");
  assert.equal(result.success, true);
  assert.ok(result.success);
  return result;
}

test("semester normalization retains exact aliases and first search parameter precedence", () => {
  for (const input of ["2", "2ndSem", ["2", "1"]]) assert.equal(normalizeSemester(input), "2ndSem");
  for (const input of [undefined, [], "", "1", "2ndsem", " 2", ["1", "2"]]) {
    assert.equal(normalizeSemester(input), "1stSem");
  }
});

test("grade aliases keep exact and ordered normalized precedence, whitespace subjects, zero and false", async (context) => {
  const rows = [
    {
      "SUBJECT TITLE": "Normalized", subject_title: " Exact title ", subject: "Fallback",
      subject_code: " IT101 ", code: "Fallback", unit: 0, units: "Fallback", instructor_id: false,
      "Instructor Name": " Teacher ", grade: 0, remarks: false, prelim: 95,
    },
    { "S U B J E C T - T I T L E": " Normalized title ", "SUBJECT-CODE": " Preferred ", subjectCode: "Later alias", "Faculty-ID": 123, credits: false },
    { subject_title: "", subjectTitle: null, subject: " ", code: " " },
    {},
    { subject: false, code: 0 },
  ];
  mockGradesService(context, rows);
  const { grades, raw } = await parsedGrades();
  assert.deepEqual(raw, rows);
  assert.equal(grades[0].subject, " Exact title ");
  assert.equal(grades[0].code, "IT101");
  assert.equal(grades[0].units, "0");
  assert.equal(grades[0].instructor_id, "false");
  assert.equal(grades[0].instructor_name, "Teacher");
  assert.equal(grades[0].average, "0");
  assert.equal(grades[0].remarks, "false");
  assert.equal(grades[0].prelim, null);
  assert.equal(grades[1].subject, " Normalized title ");
  assert.equal(grades[1].code, "Preferred");
  assert.equal(grades[1].instructor_id, "123");
  assert.equal(grades[1].units, "false");
  assert.equal(grades[2].subject, " ");
  assert.equal(grades[2].code, null);
  assert.equal(grades[3].subject, "Untitled subject");
  assert.equal(grades[4].subject, "false");
  assert.equal(grades[4].code, "0");
  assert.deepEqual(grades[0].raw, rows[0]);
});

test("nested grade labels preserve first matches and Ave or Remarks fallback priorities", async (context) => {
  mockGradesService(context, [
    { subject: "Programming", grade: 81, remarks: "Flat", grades: [
      null, "invalid", { label: "Finals", value: 100 },
      { Label: "Unrelated", Value: { toString: 0 } },
      { Label: " Prelim ", Value: 0 }, { Label: "MIDTERM", Value: false },
      { Label: "Prefinals", Value: " 89 " },
      { Label: "Finals", Value: null }, { Label: "Finals", Value: 99 },
      { Label: "Ave", Value: " 92 " }, { Label: "Ave", Value: 98 },
      { Label: "Remarks", Value: " Passed " },
      { Label: "Note", Value: " " }, { Label: "Note", Value: "Later note" },
    ] },
    { subject: "Math", grade: 85, remarks: "Flat", grades: [
      { Label: "Ave", Value: "" }, { Label: "Ave", Value: 99 },
      { Label: "Remarks", Value: null }, { Label: "Remarks", Value: "Later" },
    ] },
  ]);
  const { grades } = await parsedGrades();
  assert.deepEqual(
    [grades[0].prelim, grades[0].midterm, grades[0].prefinals, grades[0].finals, grades[0].average, grades[0].remarks, grades[0].note],
    ["0", "false", "89", null, "92", "Passed", null]
  );
  assert.equal(grades[1].average, "85");
  assert.equal(grades[1].remarks, "Flat");
});

test("array and wrapper payloads keep array precedence, student names and empty-array results", async (context) => {
  const fetchMock = mockGradesService(context);
  const wrappers = ["Grades", "grades", "data", "records", "subjects", "result"];
  for (const wrapper of wrappers) {
    const payload = { student_name: " Maria Santos ", [wrapper]: [{ subject: wrapper }] };
    fetchMock.mock.mockImplementation(async () => Response.json(payload));
    const result = await parsedGrades();
    assert.equal(result.studentName, "Maria Santos");
    assert.equal(result.grades[0].subject, wrapper);
  }
  for (const payload of [
    { Grades: [], grades: [{ subject: "Ignored" }] },
    { Grades: null, grades: [], data: [{ subject: "Ignored" }] },
  ]) {
    fetchMock.mock.mockImplementation(async () => Response.json(payload));
    assert.deepEqual((await parsedGrades()).grades, []);
  }
  fetchMock.mock.mockImplementation(async () => Response.json({ Grades: "invalid", grades: [{ subject: "First" }], data: [{ subject: "Later" }], studentName: "Ignored" }));
  const result = await parsedGrades();
  assert.equal(result.grades[0].subject, "First");
  assert.equal(result.studentName, null);
});

test("row filtering removes primitives and pseudoheaders while retaining subject whitespace and array records", async (context) => {
  mockGradesService(context, [
    null, 42, "invalid", false, [],
    { code: " Code: ", subject: "SUBJECT:" },
    { code: "code:", subject: " subject: " },
    { code: "IT101", subject: "Programming" },
  ]);
  assert.deepEqual((await parsedGrades()).grades.map(({ subject }) => subject), ["Untitled subject", " subject: ", "Programming"]);
});

test("unsupported payloads return a successful empty result", async (context) => {
  const fetchMock = mockGradesService(context);
  for (const payload of [null, 0, false, "invalid", {}]) {
    fetchMock.mock.mockImplementation(async () => Response.json(payload));
    const result = await parsedGrades();
    assert.deepEqual(result.grades, []);
    assert.equal(result.studentName, null);
  }
});

test("missing and malformed endpoints return exact errors without fetching", async (context) => {
  const fetchMock = mockGradesService(context);
  delete process.env.STUDENT_GRADES_APPS_SCRIPT_URL;
  assert.deepEqual(await getStudentGrades("2026-001", "2ndSem"), {
    success: false, semester: "2ndSem", message: "Student grades Apps Script URL is not configured.",
  });
  process.env.STUDENT_GRADES_APPS_SCRIPT_URL = "not a URL";
  assert.deepEqual(await getStudentGrades("2026-001", "2ndSem"), {
    success: false, semester: "2ndSem", message: "Student grades Apps Script URL is not configured or malformed.",
  });
  assert.equal(fetchMock.mock.calls.length, 0);
});

test("requests overwrite student and semester parameters while retaining endpoint query and fetch settings", async (context) => {
  const fetchMock = mockGradesService(context);
  process.env.STUDENT_GRADES_APPS_SCRIPT_URL = "https://grades.example.test/exec?existing=1&student_no=old&semester=old";
  await getStudentGrades("2026 001/2", "2ndSem");
  const [input, init] = fetchMock.mock.calls[0].arguments;
  assert.ok(input instanceof URL);
  assert.equal(input.searchParams.get("student_no"), "2026 001/2");
  assert.equal(input.searchParams.get("semester"), "2ndSem");
  assert.equal(input.searchParams.get("existing"), "1");
  assert.deepEqual(init?.headers, { Accept: "application/json" });
  assert.equal(init?.cache, "no-store");
  assert.ok(init?.signal instanceof AbortSignal);
});

test("HTTP, JSON and transport failures preserve exact service errors", async (context) => {
  const fetchMock = mockGradesService(context);
  for (const status of [403, 503]) {
    fetchMock.mock.mockImplementation(async () => new Response("Unavailable", { status }));
    assert.deepEqual(await getStudentGrades("2026-001", "1stSem"), {
      success: false, semester: "1stSem", message: `Grades service returned ${status}.`,
    });
  }
  for (const response of [() => new Response("Invalid JSON"), () => { throw new Error("Transport error"); }]) {
    fetchMock.mock.mockImplementation(async () => response());
    assert.deepEqual(await getStudentGrades("2026-001", "1stSem"), {
      success: false, semester: "1stSem", message: "Unable to load grades right now.",
    });
  }
});

test("fetch aborts after ten seconds and clears its timer after successful responses", async (context) => {
  const fetchMock = mockGradesService(context);
  context.mock.timers.enable({ apis: ["setTimeout"] });
  fetchMock.mock.mockImplementation((_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("Aborted")));
  }));
  const pending = getStudentGrades("2026-001", "1stSem");
  const signal = fetchMock.mock.calls[0].arguments[1]?.signal;
  assert.ok(signal);
  context.mock.timers.tick(9_999);
  assert.equal(signal.aborted, false);
  context.mock.timers.tick(1);
  assert.equal(signal.aborted, true);
  assert.deepEqual(await pending, { success: false, semester: "1stSem", message: "Unable to load grades right now." });

  fetchMock.mock.mockImplementation(async () => Response.json([]));
  await parsedGrades();
  const successfulSignal = fetchMock.mock.calls[1].arguments[1]?.signal;
  assert.ok(successfulSignal);
  context.mock.timers.tick(10_000);
  assert.equal(successfulSignal.aborted, false);
});
