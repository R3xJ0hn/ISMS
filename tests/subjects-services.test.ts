import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as validation from "../lib/subjects/validation";
import type * as admin from "../lib/subjects/admin";
import { literalInsensitiveEquality } from "../lib/utils";

type Subject = { id: bigint; name: string; code: string | null; units: string | null; _count: { programSubjects: number; classes: number } };
type Class = { id: bigint; subjectId: bigint | null; subjectName: string };
type Query = {
  where?: { id?: bigint | { not: bigint }; name?: { equals: string; mode: string }; code?: { equals: string; mode: string }; subjectId?: bigint };
  data?: { name?: string; code?: string | null; units?: string; subjectName?: string };
  select?: Record<string, unknown>; orderBy?: unknown;
};
class DatabaseError extends Error { constructor(public code: string) { super("Sensitive database detail"); } }
const source = ts.transpileModule(readFileSync(new URL("../lib/subjects/admin.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText;
const saved: Subject = { id: 9007199254740993n, name: "Computing", code: "cs_10", units: "3.5", _count: { programSubjects: 2, classes: 1 } };
const state = { success: false, message: "" };
function form(values: Record<string, string> = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({ subjectId: saved.id.toString(), name: "<b>computer</b> programming", code: " cs_20 ", units: "0", ...values })) result.set(key, value);
  return result;
}

function matchLiteral(value: string, pattern: string) {
  // The service must escape ILIKE wildcards rather than confusing identifier punctuation with patterns.
  let literal = "";
  for (let index = 0; index < pattern.length; index++) {
    const character = pattern[index];
    if (character === "\\") literal += pattern[++index];
    else { assert.notEqual(character, "%", "Unescaped percent wildcard"); assert.notEqual(character, "_", "Unescaped underscore wildcard"); literal += character; }
  }
  return value.toLowerCase() === literal.toLowerCase();
}
function harness(options: { denied?: boolean; subjects?: Subject[]; classes?: Class[]; error?: string; classWriteFailure?: boolean } = {}) {
  const subjects = structuredClone(options.subjects ?? []);
  const classes = structuredClone(options.classes ?? []);
  const events: string[] = [];
  const calls: { method: string; query: Query }[] = [];
  const paths: string[] = [];
  const logs: unknown[][] = [];
  function record(method: string, query: Query) { calls.push({ method, query: structuredClone(query) }); events.push(method); }
  function matches(row: Subject, query: Query) {
    const where = query.where ?? {};
    return (typeof where.id === "bigint" ? row.id === where.id : !where.id || row.id !== where.id.not) &&
      (!where.name || matchLiteral(row.name, where.name.equals)) && (!where.code || row.code !== null && matchLiteral(row.code, where.code.equals));
  }
  function fail() { if (options.error) throw new DatabaseError(options.error); }
  const subject = {
    findFirst: async (query: Query) => { record("findFirst", query); return subjects.find((row) => matches(row, query)) ?? null; },
    findUnique: async (query: Query) => { record("findUnique", query); return subjects.find((row) => matches(row, query)) ?? null; },
    findMany: async (query: Query) => { record("findMany", query); return subjects; },
    create: async (query: Query) => { record("create", query); fail(); subjects.push({ id: 8n, ...query.data, _count: { classes: 0, programSubjects: 0 } } as Subject); return { id: 8n }; },
    update: async (query: Query) => { record("update", query); fail(); const row = subjects.find((row) => matches(row, query)); assert.ok(row); Object.assign(row, query.data); return { id: row.id }; },
  };
  const classDelegate = {
    updateMany: async (query: Query) => {
      record("class.updateMany", query);
      if (options.classWriteFailure) throw new Error("Sensitive class failure");
      for (const row of classes) if (row.subjectId === query.where?.subjectId) row.subjectName = query.data?.subjectName ?? row.subjectName;
      return { count: classes.filter((row) => row.subjectId === query.where?.subjectId).length };
    },
  };
  const modules: Record<string, unknown> = {
    "@/lib/utils": { literalInsensitiveEquality },
    "@/lib/auth": { requireSuperAdmin: async () => { events.push("authorize"); if (options.denied) throw new Error("Access denied"); } },
    "@/lib/generated/prisma/client": { Prisma: { PrismaClientKnownRequestError: DatabaseError, TransactionIsolationLevel: { Serializable: "Serializable" } } },
    "@/lib/prisma": { prisma: { subject, $transaction: async (callback: (value: unknown) => Promise<unknown>, config: { isolationLevel: string }) => {
      assert.equal(config.isolationLevel, "Serializable"); events.push("transaction");
      const previousSubjects = structuredClone(subjects); const previousClasses = structuredClone(classes);
      try { return await callback({ subject, class: classDelegate }); }
      catch (error) { subjects.splice(0, subjects.length, ...previousSubjects); classes.splice(0, classes.length, ...previousClasses); throw error; }
    } } },
    "next/cache": { revalidatePath: (path: string) => paths.push(path) },
    "./validation": { ...validation, parseSubjectForm: (...args: Parameters<typeof validation.parseSubjectForm>) => { events.push("parse"); return validation.parseSubjectForm(...args); } },
  };
  const loaded = { exports: {} };
  runInNewContext(source, { module: loaded, exports: loaded.exports, console: { error: (...args: unknown[]) => logs.push(args) },
    require: (name: string) => { assert.ok(name in modules, `Unexpected dependency ${name}`); return modules[name]; } });
  return { service: loaded.exports as typeof admin, subjects, classes, events, calls, paths, logs };
}

test("subject reads and writes require superadmin before parsing or querying", async () => {
  for (const method of ["createSubject", "updateSubject"] as const) {
    const h = harness({ denied: true });
    await assert.rejects(h.service[method](state, new FormData()), /Access denied/);
    assert.deepEqual(h.events, ["authorize"]);
  }
  for (const method of ["getSubjects", "getSubjectForEdit"] as const) {
    const h = harness({ denied: true });
    await assert.rejects(h.service[method]("invalid"), /Access denied/);
    assert.deepEqual(h.events, ["authorize"]);
  }
});

test("subject creation saves only validated catalog fields and preserves zero units", async () => {
  const h = harness();
  assert.equal((await h.service.createSubject(state, form({ teacherId: "44", password: "unused" }))).success, true);
  assert.deepEqual(h.calls.find((call) => call.method === "create")?.query.data, { name: "Computer Programming", code: "cs_20", units: "0" });
  assert.deepEqual(h.events.slice(0, 3), ["authorize", "parse", "transaction"]);
  assert.ok(h.paths.includes("/portal/programs"));
});

test("duplicate names and codes compare case insensitively and punctuation literally", async () => {
  const h = harness({ subjects: [{ ...saved, name: "Computer Programming", code: "CS_20%\\" }] });
  const result = await h.service.createSubject(state, form({ code: "cs_20%\\" }));
  assert.equal(result.success, false);
  assert.ok(result.fieldErrors?.name);
  assert.ok(result.fieldErrors?.code);
  assert.equal(h.calls.some((call) => call.method === "create"), false);
  assert.deepEqual(h.paths, []);
  const distinct = harness({ subjects: [{ ...saved, name: "Other Subject", code: "CSX20" }] });
  assert.equal((await distinct.service.createSubject(state, form())).success, true);
});

test("subject rename updates only linked class names atomically and excludes itself from duplicates", async () => {
  const h = harness({ subjects: [saved], classes: [
    { id: 1n, subjectId: saved.id, subjectName: "Computing" },
    { id: 2n, subjectId: 2n, subjectName: "Another Subject" },
    { id: 3n, subjectId: null, subjectName: "Legacy Subject" },
  ] });
  assert.equal((await h.service.updateSubject(state, form({ code: saved.code! }))).success, true);
  assert.equal(h.subjects[0].name, "Computer Programming");
  assert.deepEqual(h.classes.map((row) => row.subjectName), ["Computer Programming", "Another Subject", "Legacy Subject"]);
  assert.ok(h.paths.includes("/portal/classroom"));
  assert.deepEqual(h.calls.find((call) => call.method === "class.updateMany")?.query, { where: { subjectId: saved.id }, data: { subjectName: "Computer Programming" } });
  const failing = harness({ subjects: [saved], classes: [{ id: 1n, subjectId: saved.id, subjectName: saved.name }], classWriteFailure: true });
  assert.equal((await failing.service.updateSubject(state, form())).success, false);
  assert.equal(failing.subjects[0].name, saved.name);
  assert.equal(failing.classes[0].subjectName, saved.name);
  assert.deepEqual(failing.paths, []);
  assert.doesNotMatch(JSON.stringify(failing.logs), /Sensitive/);
});

test("missing and invalid subject edits do not write or revalidate", async () => {
  const h = harness();
  assert.equal((await h.service.updateSubject(state, form())).success, false);
  assert.equal(h.calls.some((call) => call.method === "update"), false);
  const invalid = harness();
  assert.equal(await invalid.service.getSubjectForEdit("9223372036854775808"), null);
  assert.deepEqual(invalid.events, ["authorize"]);
  assert.equal((await invalid.service.updateSubject(state, form({ subjectId: "0" }))).success, false);
  assert.equal(invalid.calls.length, 0);
});

test("overview and edit responses serialize precise identifiers and expose only catalog fields", async () => {
  const h = harness({ subjects: [saved] });
  const rows = structuredClone(await h.service.getSubjects());
  assert.deepEqual(rows, [{ id: saved.id.toString(), name: saved.name, code: saved.code, units: saved.units, programCount: 2, classCount: 1 }]);
  assert.deepEqual(structuredClone(await h.service.getSubjectForEdit(saved.id.toString())), { id: saved.id.toString(), values: { name: saved.name, code: saved.code, units: saved.units } });
  const legacy = harness({ subjects: [{ ...saved, code: null, units: null }] });
  assert.deepEqual(structuredClone(await legacy.service.getSubjectForEdit(saved.id.toString())), { id: saved.id.toString(), values: { name: saved.name, code: "", units: "" } });
  assert.equal((await legacy.service.getSubjects())[0].units, null);
});

test("database conflicts return a safe error and successful paths are not refreshed", async () => {
  for (const error of ["P2002", "P2034", "P2025", "P0000"]) {
    const h = harness({ error });
    const result = await h.service.createSubject(state, form());
    assert.equal(result.success, false);
    assert.doesNotMatch(result.message, /Sensitive/);
    assert.deepEqual(h.paths, []);
  }
});
