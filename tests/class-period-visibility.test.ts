import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as periodVisibility from "../lib/classes/period-visibility";
import * as studentPreview from "../lib/classes/student-preview";
import { parseClassId, parseTeacherSpreadsheetForm } from "../lib/classes/validation";
import type * as teacherService from "../lib/classes/teacher";

const { classPeriodDefinitions, defaultClassPeriodVisibility, getClassPeriodVisibility, parseClassPeriodVisibilityForm } = periodVisibility;
const classId = 9007199254740997n;
const teacherId = 9007199254740995n;
const userId = 9007199254740993n;
const initialState = { success: false, message: "" };

function visibilityForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  for (const [key, value] of Object.entries({ classId: classId.toString(), period: "Prelim", visible: "false", ...overrides })) formData.set(key, value);
  return formData;
}

test("grading period definitions map every period to its own saved visibility field and default to visible", () => {
  assert.deepEqual(classPeriodDefinitions.map(({ period, field }) => [period, field]), [
    ["Prelim", "prelimVisible"], ["Midterm", "midtermVisible"], ["Prefinals", "prefinalsVisible"], ["Finals", "finalsVisible"],
  ]);
  const allVisible = { prelimVisible: true, midtermVisible: true, prefinalsVisible: true, finalsVisible: true };
  assert.deepEqual(defaultClassPeriodVisibility, allVisible);
  for (const input of [undefined, null, {}]) assert.deepEqual(getClassPeriodVisibility(input), allVisible);
  assert.deepEqual(getClassPeriodVisibility({ prelimVisible: false, finalsVisible: false }), { ...allVisible, prelimVisible: false, finalsVisible: false });
});

test("valid grading period submissions preserve large database IDs and parse explicit boolean values", () => {
  for (const { period, field } of classPeriodDefinitions) {
    for (const visible of ["true", "false"]) {
      assert.deepEqual(parseClassPeriodVisibilityForm(visibilityForm({ period, visible })), { success: true, id: classId, period, field, visible: visible === "true" });
    }
  }
  assert.ok(parseClassPeriodVisibilityForm(visibilityForm({ classId: "9223372036854775807" })).success);
});

test("visibility changes reject invalid class IDs, unknown periods and ambiguous boolean values", () => {
  for (const value of ["", "0", "-1", "1.1", "1e2", "not-an-id", "9223372036854775808"]) {
    const result = parseClassPeriodVisibilityForm(visibilityForm({ classId: value }));
    assert.ok(!result.success && result.fieldErrors?.classId, value);
  }
  for (const value of ["", "prelim", "PRELIM", "Prelim ", "Final", "__proto__", "prelimVisible", "Quarter 1"]) {
    const result = parseClassPeriodVisibilityForm(visibilityForm({ period: value }));
    assert.ok(!result.success && result.fieldErrors?.period, value);
  }
  for (const value of ["", "on", "off", "1", "0", "TRUE", "False", " true", "false ", "null"]) {
    const result = parseClassPeriodVisibilityForm(visibilityForm({ visible: value }));
    assert.ok(!result.success && result.fieldErrors?.visible, value);
  }
});

test("visibility changes reject omitted, repeated or uploaded values for every required field", () => {
  for (const field of ["classId", "period", "visible"] as const) {
    for (const mode of ["missing", "duplicate", "file"] as const) {
      const form = visibilityForm();
      if (mode === "missing") form.delete(field);
      else if (mode === "duplicate") form.append(field, String(form.get(field)));
      else form.set(field, new File(["private"], "value.txt"));
      const result = parseClassPeriodVisibilityForm(form);
      assert.ok(!result.success && result.fieldErrors?.[field], `${field}: ${mode}`);
      assert.doesNotMatch(JSON.stringify(result), /private|value\.txt/);
    }
  }
});

type Assignment = periodVisibility.ClassPeriodVisibility & {
  id: bigint;
  teacherId: bigint;
  userId: bigint;
  teacherRole: string;
  subjectName: string;
  spreadsheetUrl: string;
};
type UpdateQuery = {
  where: { id: bigint; teacherId: bigint; teacher: { userId: bigint; user: { role: string } } };
  data: Partial<periodVisibility.ClassPeriodVisibility>;
};
const serviceCode = ts.transpileModule(readFileSync(new URL("../lib/classes/teacher.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText;

function harness(options: { denied?: boolean; sessionId?: string; missingProfile?: boolean; assigned?: boolean; teacherRole?: string; otherUser?: boolean; writeError?: boolean } = {}) {
  const assignment: Assignment = {
    ...defaultClassPeriodVisibility, id: classId, teacherId: options.assigned === false ? 2n : teacherId,
    userId: options.otherUser ? 2n : userId, teacherRole: options.teacherRole ?? "teacher", subjectName: "Computing",
    spreadsheetUrl: "https://docs.google.com/spreadsheets/d/private-teacher-sheet/edit",
  };
  const events: string[] = [];
  const queries: UpdateQuery[] = [];
  const revalidated: string[] = [];
  const errors: unknown[][] = [];
  const modules: Record<string, unknown> = {
    "@/lib/auth": { requireTeacher: async () => {
      events.push("authorize");
      if (options.denied) throw new Error("Teacher access required");
      return { id: options.sessionId ?? userId.toString() };
    } },
    "@/lib/prisma": { prisma: {
      teacher: { findUnique: async (query: { where: { userId: bigint }; select: unknown }) => {
        events.push("teacherProfile");
        assert.equal(query.where.userId, userId);
        assert.deepEqual(JSON.parse(JSON.stringify(query.select)), { employeeId: true });
        return options.missingProfile ? null : { employeeId: teacherId };
      } },
      class: { updateMany: async (query: UpdateQuery) => {
        events.push("update");
        queries.push(structuredClone(query));
        if (options.writeError) throw new Error("Private database and student details");
        const matches = assignment.id === query.where.id && assignment.teacherId === query.where.teacherId &&
          assignment.userId === query.where.teacher.userId && assignment.teacherRole === query.where.teacher.user.role;
        if (matches) Object.assign(assignment, query.data);
        return { count: matches ? 1 : 0 };
      } },
    } },
    "next/navigation": { redirect: (path: string) => { throw new Error("Redirect " + path); } },
    "next/cache": { revalidatePath: (path: string) => revalidated.push(path) },
    "./validation": { parseClassId: (value: string) => { events.push("sessionId"); return parseClassId(value); }, parseTeacherSpreadsheetForm },
    "./student-preview": studentPreview,
    "./period-visibility": { ...periodVisibility, parseClassPeriodVisibilityForm: (formData: FormData) => { events.push("parse"); return parseClassPeriodVisibilityForm(formData); } },
  };
  const loaded = { exports: {} };
  runInNewContext(serviceCode, {
    module: loaded, exports: loaded.exports, console: { error: (...args: unknown[]) => errors.push(args) },
    require: (name: string) => { assert.ok(name in modules, "Unexpected visibility service dependency: " + name); return modules[name]; },
  });
  return { service: loaded.exports as typeof teacherService, assignment, events, queries, revalidated, errors };
}

test("changing student record visibility requires teacher authorization before any parsing or database access", async () => {
  const denied = harness({ denied: true });
  await assert.rejects(denied.service.updateClassPeriodVisibility(initialState, visibilityForm()), /Teacher access required/);
  assert.deepEqual(denied.events, ["authorize"]);
  assert.equal(denied.queries.length, 0);
  const invalidSession = harness({ sessionId: "invalid" });
  await assert.rejects(invalidSession.service.updateClassPeriodVisibility(initialState, visibilityForm()), /Redirect \/login/);
  assert.deepEqual(invalidSession.events, ["authorize", "sessionId"]);
});

test("invalid visibility submissions and accounts without teacher profiles never change a class", async () => {
  for (const overrides of [{ period: "Unknown" }, { visible: "on" }, { classId: "0" }] as Record<string, string>[]) {
    const loaded = harness();
    assert.equal((await loaded.service.updateClassPeriodVisibility(initialState, visibilityForm(overrides))).success, false);
    assert.deepEqual(loaded.events, ["authorize", "sessionId", "teacherProfile", "parse"]);
    assert.equal(loaded.queries.length, 0);
    assert.equal(loaded.revalidated.length, 0);
  }
  const missing = harness({ missingProfile: true });
  assert.equal((await missing.service.updateClassPeriodVisibility(initialState, visibilityForm())).success, false);
  assert.equal(missing.queries.length, 0);
  assert.equal(missing.revalidated.length, 0);
});

test("visibility updates enforce teacher assignment, linked user and teacher role in the write itself", async () => {
  for (const options of [{ assigned: false }, { otherUser: true }, { teacherRole: "superAdmin" }, { teacherRole: "admin" }]) {
    const loaded = harness(options);
    const before = structuredClone(loaded.assignment);
    const result = await loaded.service.updateClassPeriodVisibility(initialState, visibilityForm({ teacherId: "2", userId: "2", role: "superAdmin" }));
    assert.equal(result.success, false);
    assert.ok(result.fieldErrors?.classId);
    assert.deepEqual(loaded.assignment, before);
    assert.deepEqual(loaded.queries[0].where, { id: classId, teacherId, teacher: { userId, user: { role: "teacher" } } });
    assert.equal(loaded.revalidated.length, 0);
  }
  const missingClass = harness();
  assert.equal((await missingClass.service.updateClassPeriodVisibility(initialState, visibilityForm({ classId: "25" }))).success, false);
  assert.equal(missingClass.assignment.prelimVisible, true);
});

test("saving visibility updates only the selected period and refreshes teacher and student class views", async () => {
  for (const { period, field } of classPeriodDefinitions) {
    const loaded = harness();
    const result = await loaded.service.updateClassPeriodVisibility(initialState, visibilityForm({
      period, visible: "false", subjectName: "Forged", spreadsheetUrl: "https://evil.test", teacherId: "2",
      prelimVisible: "false", midtermVisible: "false", prefinalsVisible: "false", finalsVisible: "false",
    }));
    assert.ok(result.success);
    assert.equal(result.period, period);
    assert.equal(result.visible, false);
    assert.deepEqual(loaded.queries, [{ where: { id: classId, teacherId, teacher: { userId, user: { role: "teacher" } } }, data: { [field]: false } }]);
    for (const { field: otherField } of classPeriodDefinitions) assert.equal(loaded.assignment[otherField], otherField !== field);
    assert.equal(loaded.assignment.subjectName, "Computing");
    assert.match(loaded.assignment.spreadsheetUrl, /private-teacher-sheet/);
    assert.deepEqual(loaded.revalidated, ["/portal/my-classes", `/portal/my-classes/${classId}`, "/portal/classes", "/portal/classroom", `/portal/classroom/${classId}`, "/portal/grades"]);
    assert.doesNotMatch(JSON.stringify(result), /private-teacher-sheet|teacherId|userId|Computing/);
  }
});

test("independent grading period updates cannot restore another period using stale form values", async () => {
  const loaded = harness();
  const results = await Promise.all([
    loaded.service.updateClassPeriodVisibility(initialState, visibilityForm({ period: "Prelim", visible: "false", finalsVisible: "true" })),
    loaded.service.updateClassPeriodVisibility(initialState, visibilityForm({ period: "Finals", visible: "false", prelimVisible: "true" })),
  ]);
  assert.ok(results.every((result) => result.success));
  assert.equal(loaded.assignment.prelimVisible, false);
  assert.equal(loaded.assignment.finalsVisible, false);
  assert.equal(loaded.assignment.midtermVisible, true);
  assert.equal(loaded.assignment.prefinalsVisible, true);
  assert.ok(loaded.queries.every((query) => Object.keys(query.data).length === 1));
  const reveal = await loaded.service.updateClassPeriodVisibility(initialState, visibilityForm({ period: "Prelim", visible: "true" }));
  assert.ok(reveal.success && reveal.visible);
  assert.equal(loaded.assignment.prelimVisible, true);
  assert.equal(loaded.assignment.finalsVisible, false);
});

test("visibility save errors do not change records or expose database details", async () => {
  const loaded = harness({ writeError: true });
  const result = await loaded.service.updateClassPeriodVisibility(initialState, visibilityForm());
  assert.equal(result.success, false);
  assert.match(result.message, /try again/i);
  assert.doesNotMatch(result.message, /Private database|student details/);
  assert.equal(loaded.assignment.prelimVisible, true);
  assert.equal(loaded.revalidated.length, 0);
  assert.equal(loaded.errors.length, 1);
});
