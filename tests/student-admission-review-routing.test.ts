import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { UserRole } from "../lib/generated/prisma/enums";
import { portalTheme } from "../lib/portal/theme";

const code = ts.transpileModule(readFileSync(new URL("../app/portal/page.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function harness({
  role = "student", email = "student@example.test", needsReview = false, denied = false,
  failedLookup = false,
} = {}) {
  const events: string[] = [];
  const modules: Record<string, unknown> = {
    "react/jsx-runtime": jsxRuntime,
    "@/lib/auth": { requireSession: async () => {
      events.push("session");
      if (denied) throw new Error("Verified session required");
      return { id: "7", email, role, emailVerified: true };
    } },
    "@/lib/admission/student-review": { studentNeedsAdmissionReview: async (accountEmail: string) => {
      events.push(`review:${accountEmail}`);
      if (failedLookup) throw new Error("Admission lookup unavailable");
      return needsReview;
    } },
    "@/lib/generated/prisma/enums": { UserRole },
    "@/lib/portal/theme": { portalTheme },
    "next/navigation": { redirect: (path: string) => { events.push(path); throw new Error("Redirect " + path); } },
  };
  const loaded = { exports: {} as { default: () => Promise<React.ReactElement> } };
  runInNewContext(code, {
    module: loaded, exports: loaded.exports,
    require: (name: string) => { assert.ok(name in modules, `Unexpected portal dependency: ${name}`); return modules[name]; },
  });
  return { page: loaded.exports.default, events };
}

test("portal entry requires a verified session before any admission lookup or redirect", async () => {
  const loaded = harness({ denied: true, needsReview: true });
  await assert.rejects(loaded.page(), /Verified session required/);
  assert.deepEqual(loaded.events, ["session"]);
});

test("students under review are sent to their information review page at every portal entry", async () => {
  const loaded = harness({ needsReview: true, email: "Current_Student@Example.test" });
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(loaded.page(), /Redirect \/portal\/admission-review$/);
  }
  assert.deepEqual(loaded.events, [
    "session", "review:Current_Student@Example.test", "/portal/admission-review",
    "session", "review:Current_Student@Example.test", "/portal/admission-review",
  ]);
});

test("students without a current reviewing application enter their classes", async () => {
  const loaded = harness();
  await assert.rejects(loaded.page(), /Redirect \/portal\/classroom$/);
  assert.deepEqual(loaded.events, ["session", "review:student@example.test", "/portal/classroom"]);
});

test("teachers enter their assigned classes without student admission lookups", async () => {
  const loaded = harness({ role: "teacher", needsReview: true });
  await assert.rejects(loaded.page(), /Redirect \/portal\/my-classes$/);
  assert.deepEqual(loaded.events, ["session", "/portal/my-classes"]);
});

test("administrative accounts retain their portal without reading student admissions", async () => {
  for (const role of ["admin", "superAdmin", "registrar"]) {
    const loaded = harness({ role, needsReview: true });
    const markup = renderToStaticMarkup(await loaded.page());
    assert.match(markup, /min-h-screen/);
    assert.deepEqual(loaded.events, ["session"]);
  }
});

test("an unavailable review lookup does not silently skip the student's current review", async () => {
  const loaded = harness({ failedLookup: true });
  await assert.rejects(loaded.page(), /Admission lookup unavailable/);
  assert.deepEqual(loaded.events, ["session", "review:student@example.test"]);
});
