import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as validation from "../lib/program-subjects/validation";
import type * as services from "../lib/program-subjects/admin";

const programId = 9007199254740993n;
const firstSubjectId = 9007199254740995n;
const secondSubjectId = 9007199254740997n;
const initialState = { success: false, message: "" };
const subjects = [
  { id: firstSubjectId, name: "Synthetic Computing", code: "SYN-101", units: { toString: () => "3" } },
  { id: secondSubjectId, name: "Synthetic Mathematics", code: null, units: null },
];

function load(modules: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL("../lib/program-subjects/admin.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  const loaded = { exports: {} };
  runInNewContext(code, { module: loaded, exports: loaded.exports, require: (name: string) => {
    assert.ok(name in modules, `Unexpected dependency: ${name}`);
    return modules[name];
  }, console: { error: () => undefined } });
  return loaded.exports as typeof services;
}

function form(ids: string[] = [firstSubjectId.toString()], id = programId.toString()) {
  const data = new FormData();
  data.set("programId", id);
  data.append("subjectIds", "");
  for (const subjectId of ids) data.append("subjectIds", subjectId);
  return data;
}

class DatabaseError extends Error {
  constructor(public code: string) { super("Synthetic private database details"); }
}

type Assignment = { programId: bigint; subjectId: bigint; createdAt: string };
type Query = { where?: { id?: bigint | { in: bigint[] }; programId?: bigint; subjectId?: { in: bigint[] } }; select?: Record<string, unknown>; data?: Array<{ programId: bigint; subjectId: bigint }> };

function serviceHarness(options: { role?: string; missingProgram?: boolean; missingSubject?: boolean; used?: boolean; createError?: string; deleteError?: string } = {}) {
  const events: string[] = [], revalidated: string[] = [];
  const calls: Array<{ method: string; query: Query }> = [];
  const assignments: Assignment[] = [
    { programId, subjectId: firstSubjectId, createdAt: "saved timestamp" },
    { programId: 2n, subjectId: firstSubjectId, createdAt: "other program" },
  ];
  const record = (method: string, query: Query) => calls.push({ method, query: structuredClone(query) });
  const assignmentRows = () => assignments.filter((row) => row.programId === programId).map(({ subjectId }) => ({ subjectId, _count: { classes: options.used ? 1 : 0 } }));
  const program = { async findUnique(query: Query) {
    record("program.findUnique", query);
    return options.missingProgram || query.where?.id !== programId ? null : {
      id: programId, code: "SYN-IT", label: "Synthetic Information Technology", programSubjects: assignmentRows(),
    };
  } };
  const subject = { async findMany(query: Query) {
    record("subject.findMany", query);
    const ids = typeof query.where?.id === "object" ? query.where.id.in : null;
    return subjects.filter((row) => (!ids || ids.includes(row.id)) && (!options.missingSubject || row.id !== secondSubjectId));
  } };
  const programSubject = {
    async findMany(query: Query) { record("programSubject.findMany", query); return assignmentRows(); },
    async deleteMany(query: Query) {
      record("programSubject.deleteMany", query);
      if (options.deleteError) throw new DatabaseError(options.deleteError);
      for (let index = assignments.length - 1; index >= 0; index--) {
        if (assignments[index].programId === query.where?.programId && query.where.subjectId?.in.includes(assignments[index].subjectId)) assignments.splice(index, 1);
      }
    },
    async createMany(query: Query) {
      record("programSubject.createMany", query);
      if (options.createError) throw options.createError === "unexpected" ? new Error("Synthetic private details") : new DatabaseError(options.createError);
      assignments.push(...(query.data ?? []).map((row) => ({ ...row, createdAt: "new timestamp" })));
    },
  };
  const modules: Record<string, unknown> = {
    "@/lib/auth": { requireSuperAdmin: async () => {
      events.push("authorize");
      if (options.role && options.role !== "superAdmin") throw new Error("Access denied");
    } },
    "@/lib/generated/prisma/client": { Prisma: {
      PrismaClientKnownRequestError: DatabaseError, TransactionIsolationLevel: { Serializable: "Serializable" },
    } },
    "@/lib/prisma": { prisma: { program, subject, $transaction: async (
      callback: (tx: { program: typeof program; subject: typeof subject; programSubject: typeof programSubject }) => Promise<unknown>,
      transactionOptions: { isolationLevel: string },
    ) => {
      events.push("transaction");
      assert.equal(transactionOptions.isolationLevel, "Serializable");
      const before = structuredClone(assignments);
      try { return await callback({ program, subject, programSubject }); }
      catch (error) { assignments.splice(0, assignments.length, ...before); throw error; }
    } } },
    "next/cache": { revalidatePath: (path: string) => revalidated.push(path) },
    "./validation": { ...validation, parseProgramSubjectForm: (data: FormData) => {
      events.push("parse"); return validation.parseProgramSubjectForm(data);
    } },
  };
  return { service: load(modules), events, calls, assignments, revalidated };
}

test("program subject selections preserve precise IDs and reject forged, missing, oversized or file selections", () => {
  const result = validation.parseProgramSubjectForm(form([firstSubjectId.toString(), "0" + firstSubjectId.toString(), secondSubjectId.toString()]));
  assert.equal(result.success, true);
  if (!result.success) assert.fail("Precise IDs were rejected");
  assert.equal(result.programId, programId);
  assert.deepEqual(result.subjectIds, [firstSubjectId, secondSubjectId]);
  for (const value of ["", "0", "-1", "1.5", "1e2", "+1", "1x", "<b>1</b>", "1\0", "9223372036854775808", "1".repeat(21)]) {
    assert.equal(validation.parseProgramSubjectId(value), null, value);
    assert.equal(validation.parseProgramSubjectForm(form([value])).success, false, value);
    assert.equal(validation.parseProgramSubjectForm(form([], value)).success, false, value);
  }
  const missing = form([]); missing.delete("subjectIds");
  const file = form([]); file.append("subjectIds", new Blob(["1"]), "synthetic.txt");
  const duplicateEmpty = form([]); duplicateEmpty.append("subjectIds", "");
  for (const data of [missing, file, duplicateEmpty, form(Array(1001).fill("1"))]) assert.equal(validation.parseProgramSubjectForm(data).success, false);
  const empty = validation.parseProgramSubjectForm(form([]));
  assert.equal(empty.success, true);
  if (empty.success) assert.deepEqual(empty.subjectIds, []);
});

test("program assignment reads and writes require SuperAdmin before parsing or querying", async () => {
  for (const role of ["admin", "teacher", "student", "registrar", "nonTeaching"]) {
    for (const operation of ["edit", "save"]) {
      const harness = serviceHarness({ role });
      await assert.rejects(operation === "edit" ? harness.service.getProgramSubjectEditData(programId.toString())
        : harness.service.updateProgramSubjects(initialState, form()), /Access denied/);
      assert.deepEqual(harness.events, ["authorize"]);
      assert.equal(harness.calls.length, 0);
      assert.equal(harness.revalidated.length, 0);
    }
  }
});

test("invalid route IDs, missing programs, and stale subjects cannot alter assignments", async () => {
  const invalid = serviceHarness();
  assert.equal(await invalid.service.getProgramSubjectEditData("9223372036854775808"), null);
  assert.equal((await invalid.service.updateProgramSubjects(initialState, form(["bad-id"]))).success, false);
  assert.equal(invalid.calls.length, 0);
  for (const options of [{ missingProgram: true }, { missingSubject: true }]) {
    const harness = serviceHarness(options), before = structuredClone(harness.assignments);
    assert.equal((await harness.service.updateProgramSubjects(initialState, form([secondSubjectId.toString()]))).success, false);
    assert.deepEqual(harness.assignments, before);
    assert.equal(harness.calls.some(({ method }) => /deleteMany|createMany/.test(method)), false);
    assert.equal(harness.revalidated.length, 0);
  }
});

test("assignment edits retain existing rows and timestamps, while adding only new subjects", async () => {
  const harness = serviceHarness({ used: true });
  const data = form([firstSubjectId.toString(), secondSubjectId.toString(), secondSubjectId.toString()]);
  data.set("role", "superAdmin"); data.set("createdAt", "forged"); data.set("name", "forged");
  assert.equal((await harness.service.updateProgramSubjects(initialState, data)).success, true);
  assert.equal(harness.calls.some(({ method }) => method === "programSubject.deleteMany"), false);
  assert.equal(harness.assignments[0].createdAt, "saved timestamp");
  assert.deepEqual(harness.assignments.at(-1), { programId, subjectId: secondSubjectId, createdAt: "new timestamp" });
  assert.deepEqual(harness.calls.find(({ method }) => method === "programSubject.createMany")?.query, { data: [{ programId, subjectId: secondSubjectId }] });
  assert.deepEqual(harness.events, ["authorize", "parse", "transaction"]);
  assert.ok(harness.revalidated.includes("/portal/programs"));
  assert.ok(harness.revalidated.includes("/portal/classes/new"));
});

test("used class subjects cannot be unassigned even by a forged clear-all request", async () => {
  for (const selections of [[], [secondSubjectId.toString()]]) {
    const harness = serviceHarness({ used: true }), before = structuredClone(harness.assignments);
    const result = await harness.service.updateProgramSubjects(initialState, form(selections));
    assert.equal(result.success, false);
    assert.match(result.fieldErrors?.subjectIds ?? "", /already used by classes/);
    assert.deepEqual(harness.assignments, before);
    assert.equal(harness.calls.some(({ method }) => /deleteMany|createMany/.test(method)), false);
    assert.equal(harness.revalidated.length, 0);
  }
});

test("unused removals and clear-all only delete deselected assignments from the chosen program", async () => {
  for (const selections of [[], [secondSubjectId.toString()]]) {
    const harness = serviceHarness();
    assert.equal((await harness.service.updateProgramSubjects(initialState, form(selections))).success, true);
    assert.deepEqual(harness.assignments[0], { programId: 2n, subjectId: firstSubjectId, createdAt: "other program" });
    assert.deepEqual(harness.calls.find(({ method }) => method === "programSubject.deleteMany")?.query,
      { where: { programId, subjectId: { in: [firstSubjectId] } } });
    assert.equal(harness.calls.some(({ method }) => method === "programSubject.createMany"), selections.length > 0);
  }
});

test("concurrent FK and serializable failures roll back removals and return safe messages", async () => {
  for (const options of [{ deleteError: "P2003" }, { createError: "P2034" }, { createError: "P2002" }, { createError: "unexpected" }]) {
    const harness = serviceHarness(options), before = structuredClone(harness.assignments);
    const result = await harness.service.updateProgramSubjects(initialState, form([secondSubjectId.toString()]));
    assert.equal(result.success, false);
    assert.deepEqual(harness.assignments, before);
    assert.equal(harness.revalidated.length, 0);
    assert.doesNotMatch(result.message, /Synthetic private/);
  }
});

test("assignment reader exposes only metadata and serializes IDs, Decimal units, and used subject IDs", async () => {
  const harness = serviceHarness({ used: true });
  const data = await harness.service.getProgramSubjectEditData(programId.toString());
  assert.equal(data?.program.id, programId.toString());
  assert.deepEqual(Array.from(data?.subjectIds ?? []), [firstSubjectId.toString()]);
  assert.deepEqual(Array.from(data?.usedSubjectIds ?? []), [firstSubjectId.toString()]);
  assert.equal(data?.subjects[0].units, "3");
  assert.equal(data?.subjects[1].units, null);
  assert.deepEqual(Object.keys(data?.subjects[0] ?? {}).sort(), ["code", "id", "name", "units"]);
  assert.equal(await serviceHarness({ missingProgram: true }).service.getProgramSubjectEditData(programId.toString()), null);
});
