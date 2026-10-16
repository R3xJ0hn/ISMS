import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { parseClassId, parseTeacherSpreadsheetForm } from "../lib/classes/validation";
import type * as teacherService from "../lib/classes/teacher";
import * as periodVisibility from "../lib/classes/period-visibility";
import * as studentPreview from "../lib/classes/student-preview";

type Assignment = {
  id: bigint;
  teacherId: bigint;
  teacherRole: string;
  spreadsheetUrl: string | null;
  subjectName: string;
};
type SaveQuery = {
  where: { id: bigint; teacherId: bigint; teacher: { userId: bigint; user: { role: string } } };
  data: Record<string, string>;
};

const serviceCode = ts.transpileModule(
  readFileSync(new URL("../lib/classes/teacher.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } },
).outputText;
const state = { success: false, message: "" };
const spreadsheetUrl = "https://docs.google.com/spreadsheets/d/teacher_sheet-123/edit#gid=7";
const savedClass: Assignment = {
  id: 9007199254740997n, teacherId: 9007199254740993n, teacherRole: "teacher",
  spreadsheetUrl: null, subjectName: "Computing",
};

function spreadsheetForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ classId: savedClass.id.toString(), spreadsheetUrl, ...overrides })) {
    form.set(key, value);
  }
  return form;
}

function teacherHarness(options: {
  denied?: boolean;
  sessionId?: string;
  assignments?: Assignment[];
  writeError?: string;
  missingProfile?: boolean;
} = {}) {
  const assignments = structuredClone(options.assignments ?? [savedClass]);
  const calls: SaveQuery[] = [];
  const events: string[] = [];
  const revalidated: string[] = [];
  const loggedErrors: unknown[][] = [];
  const modules: Record<string, unknown> = {
    "@/lib/auth": { requireTeacher: async () => {
      events.push("authorize");
      if (options.denied) throw new Error("Teacher access required");
      return { id: options.sessionId ?? "25" };
    } },
    "@/lib/prisma": { prisma: {
      teacher: { findUnique: async (query: { where: { userId: bigint } }) => {
        events.push("teacherProfile");
        assert.equal(query.where.userId, 25n);
        return options.missingProfile ? null : { employeeId: savedClass.teacherId };
      } },
      class: { updateMany: async (query: SaveQuery) => {
      calls.push(structuredClone(query));
      events.push("update");
      if (options.writeError) throw Object.assign(new Error("Private database details"), { code: options.writeError });
      const matching = assignments.filter((assignment) => assignment.id === query.where.id &&
        assignment.teacherId === query.where.teacherId && assignment.teacherRole === query.where.teacher.user.role);
      for (const assignment of matching) Object.assign(assignment, query.data);
      return { count: matching.length };
    } } } },
    "next/navigation": { redirect: (path: string) => { throw new Error("Redirect " + path); } },
    "next/cache": { revalidatePath: (path: string) => revalidated.push(path) },
    "./period-visibility": periodVisibility,
    "./student-preview": studentPreview,
    "./validation": {
      parseClassId: (value: string) => { events.push("sessionId"); return parseClassId(value); },
      parseTeacherSpreadsheetForm: (formData: FormData) => {
        events.push("parse");
        return parseTeacherSpreadsheetForm(formData);
      },
    },
  };
  const loaded = { exports: {} };
  runInNewContext(serviceCode, {
    module: loaded, exports: loaded.exports,
    console: { error: (...args: unknown[]) => loggedErrors.push(args) },
    require: (name: string) => {
      assert.ok(name in modules, "Unexpected teacher service dependency: " + name);
      return modules[name];
    },
  });
  return { service: loaded.exports as typeof teacherService, assignments, calls, events, revalidated, loggedErrors };
}

test("saving a teacher spreadsheet requires access and a valid session before parsing or database access", async () => {
  const denied = teacherHarness({ denied: true });
  await assert.rejects(denied.service.updateClassSpreadsheet(state, spreadsheetForm()), /Teacher access required/);
  assert.deepEqual(denied.events, ["authorize"]);
  assert.equal(denied.calls.length, 0);
  const invalidSession = teacherHarness({ sessionId: "not-a-database-id" });
  await assert.rejects(invalidSession.service.updateClassSpreadsheet(state, spreadsheetForm()), /Redirect \/login/);
  assert.deepEqual(invalidSession.events, ["authorize", "sessionId"]);
  assert.equal(invalidSession.calls.length, 0);
});

test("invalid or blank spreadsheet submissions return errors without writes or refreshes", async () => {
  const invalidForms: Record<string, string>[] = [
    { classId: "0" }, { spreadsheetUrl: "https://evil.test/spreadsheet" }, { spreadsheetUrl: "" },
  ];
  for (const input of invalidForms) {
    const harness = teacherHarness();
    const result = await harness.service.updateClassSpreadsheet(state, spreadsheetForm(input));
    assert.equal(result.success, false);
    assert.ok(result.fieldErrors?.classId || result.fieldErrors?.spreadsheetUrl);
    assert.deepEqual(harness.events, ["authorize", "sessionId", "teacherProfile", "parse"]);
    assert.equal(harness.calls.length, 0);
    assert.equal(harness.revalidated.length, 0);
    assert.equal(harness.assignments[0].spreadsheetUrl, null);
  }
});

test("a user without a teacher profile cannot save a class spreadsheet", async () => {
  const harness = teacherHarness({ missingProfile: true });
  assert.equal((await harness.service.updateClassSpreadsheet(state, spreadsheetForm())).success, false);
  assert.equal(harness.calls.length, 0);
  assert.equal(harness.revalidated.length, 0);
  assert.equal(harness.assignments[0].spreadsheetUrl, null);
});

test("missing, reassigned and nonteacher-owned classes cannot have their spreadsheet changed", async () => {
  for (const assignments of [
    [], [{ ...savedClass, teacherId: 2n }], [{ ...savedClass, teacherRole: "superAdmin" }],
  ]) {
    const harness = teacherHarness({ assignments });
    const before = structuredClone(harness.assignments);
    const result = await harness.service.updateClassSpreadsheet(state, spreadsheetForm({ teacherId: "2" }));
    assert.equal(result.success, false);
    assert.ok(result.fieldErrors?.classId);
    assert.deepEqual(harness.assignments, before);
    assert.deepEqual(harness.calls[0].where, { id: savedClass.id, teacherId: savedClass.teacherId, teacher: { userId: 25n, user: { role: "teacher" } } });
    assert.equal(harness.revalidated.length, 0);
  }
});

test("teachers save only their own spreadsheet link and cannot overwrite class metadata", async () => {
  const harness = teacherHarness();
  const result = await harness.service.updateClassSpreadsheet(state, spreadsheetForm({
    spreadsheetUrl: ` ${spreadsheetUrl} `, teacherId: "2", role: "superAdmin", subjectName: "Forged",
    schoolYear: "Forged", sectionName: "Forged", yearLevel: "Forged", branchId: "25",
  }));
  assert.equal(result.success, true);
  assert.deepEqual(harness.events, ["authorize", "sessionId", "teacherProfile", "parse", "update"]);
  assert.deepEqual(harness.calls, [{
    where: { id: savedClass.id, teacherId: savedClass.teacherId, teacher: { userId: 25n, user: { role: "teacher" } } },
    data: { spreadsheetUrl },
  }]);
  assert.deepEqual(harness.assignments[0], { ...savedClass, spreadsheetUrl });
  assert.deepEqual(harness.revalidated, ["/portal/my-classes", `/portal/my-classes/${savedClass.id}`, "/portal/classes"]);
  assert.equal("spreadsheetUrl" in result || "teacherId" in result, false);
});

test("database save failures remain safe and do not refresh or mutate the class", async () => {
  for (const writeError of ["P2025", "P2034", "unexpected"]) {
    const harness = teacherHarness({ writeError });
    const result = await harness.service.updateClassSpreadsheet(state, spreadsheetForm());
    assert.equal(result.success, false);
    assert.match(result.message, /try again/i);
    assert.doesNotMatch(result.message, /Private database details/);
    assert.equal(harness.assignments[0].spreadsheetUrl, null);
    assert.equal(harness.revalidated.length, 0);
    assert.equal(harness.loggedErrors.length, 1);
  }
});
