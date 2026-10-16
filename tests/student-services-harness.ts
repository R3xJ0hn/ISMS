import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type * as studentIdentity from "../lib/portal/student";

const source = ts.transpileModule(readFileSync(new URL("../lib/portal/student.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText;

export function loadStudentIdentityService(modules: Record<string, unknown>) {
  const loaded = { exports: {} };
  runInNewContext(source, { module: loaded, exports: loaded.exports, require: (name: string) => {
    assert.ok(name in modules, "Unexpected student identity dependency: " + name);
    return modules[name];
  } });
  return loaded.exports as typeof studentIdentity;
}
