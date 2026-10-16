import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import Link from "next/link";
import * as icons from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { SubjectsTable } from "../app/portal/subjects/subjects-table";
import type { SubjectOverview } from "../lib/subjects/admin";
import * as validation from "../lib/subjects/validation";
import { loadPortalFeedback } from "./portal-feedback-harness";

function subjects(count: number): SubjectOverview[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index === 0 ? "9007199254740993" : String(index + 1), name: `Subject ${String(index + 1).padStart(2, "0")}`,
    code: index === 0 ? null : `CS${index + 1}`, units: index === 0 ? null : "3", programCount: 2, classCount: 1,
  }));
}

test("subject management table has search, sortable units, paging and precise edit links", () => {
  const markup = renderToStaticMarkup(React.createElement(SubjectsTable, { subjects: subjects(11) }));
  assert.match(markup, /role="searchbox"/);
  assert.match(markup, /Search subjects/);
  assert.match(markup, /aria-label="Sort by Units ascending"/);
  assert.match(markup, /aria-sort="ascending"/);
  assert.match(markup, /Page 1 of 2/);
  assert.match(markup, /Showing 1–10 of 11 subjects/);
  assert.match(markup, /href="\/portal\/subjects\/9007199254740993\/edit"/);
  assert.doesNotMatch(markup, /href="\/portal\/subjects\/11\/edit"/);
  assert.match(markup, /Not set/);
});

test("empty subject table retains search without showing unused pagination", () => {
  const markup = renderToStaticMarkup(React.createElement(SubjectsTable, { subjects: [] }));
  assert.match(markup, /No subjects found/);
  assert.match(markup, /role="searchbox"/);
  assert.doesNotMatch(markup, /aria-label="Next page"/);
});

function formHarness(props: { mode: "create" } | { mode: "edit"; subjectId: string; values: validation.SubjectFormValues }) {
  let state: validation.SubjectFormState = { success: false, message: "" };
  let pending = false;
  let values: validation.SubjectFormValues | undefined;
  const dependenciesBySlot: React.DependencyList[] = [];
  const refs: Array<{ current: unknown }> = [];
  let effectSlot = 0, refSlot = 0;
  const effects: Array<() => unknown> = [];
  const events: string[] = [];
  const inputProps = new Map<string, React.ComponentProps<typeof Input>>();
  const action = async () => assert.fail("Rendering must not submit a form");
  const router = { push: (url: string) => events.push(url), refresh: () => events.push("refresh") };
  const modules: Record<string, unknown> = {
    react: { ...React,
      useState: (initial: () => validation.SubjectFormValues) => {
        values ??= initial();
        return [values, (update: (previous: validation.SubjectFormValues) => validation.SubjectFormValues) => { values = update(values!); }];
      },
      useActionState: () => [state, action, pending],
      useRef: (initial: unknown) => { const index = refSlot++; return refs[index] ??= { current: initial }; },
      useEffect: (effect: () => unknown, dependencies: React.DependencyList) => {
        const index = effectSlot++;
        if (!dependenciesBySlot[index] || dependencies.some((value, slot) => !Object.is(value, dependenciesBySlot[index][slot]))) effects.push(effect);
        dependenciesBySlot[index] = dependencies;
      },
    },
    "react/jsx-runtime": jsxRuntime, "next/link": { default: Link }, "lucide-react": icons,
    "next/navigation": { useRouter: () => router },
    "@/components/ui/button": { Button },
    "@/components/ui/input": { Input: (props: React.ComponentProps<typeof Input>) => { inputProps.set(String(props.name), props); return React.createElement(Input, props); } },
    "@/lib/subjects/validation": validation,
    "./actions": { createSubjectAction: action, updateSubjectAction: action },
  };
  modules["@/components/portal/toasts"] = loadPortalFeedback(modules.react as Record<string, unknown>, router, (message) => events.push(`toast:${message}`));
  const source = ts.transpileModule(readFileSync(new URL("../app/portal/subjects/subject-form.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} as { SubjectForm: (props: unknown) => React.ReactElement } };
  runInNewContext(source, { module: loaded, exports: loaded.exports, require: (name: string) => { assert.ok(name in modules, `Unexpected form dependency ${name}`); return modules[name]; } });
  return {
    events,
    render(nextState = state, saving = false) { effectSlot = 0; refSlot = 0; state = nextState; pending = saving; return renderToStaticMarkup(loaded.exports.SubjectForm(props)); },
    flush() { for (const effect of effects.splice(0)) effect(); },
    change(field: string, value: string) { inputProps.get(field)?.onChange?.({ target: { value } } as React.ChangeEvent<HTMLInputElement>); },
  };
}

test("subject editing preserves changed values after failure and returns to its parent after success", () => {
  const h = formHarness({ mode: "edit", subjectId: "9007199254740993", values: { name: "Computing", code: "CS1", units: "0" } });
  const initial = h.render(); h.flush();
  assert.match(initial, /name="subjectId" value="9007199254740993"/);
  assert.match(initial, /<input(?=[^>]*name="units")(?=[^>]*required="")(?=[^>]*type="number")(?=[^>]*min="0")(?=[^>]*max="99.99")(?=[^>]*step="0.01")[^>]*>/);
  assert.deepEqual(h.events, []);
  h.change("name", "Updated subject draft");
  const failed = h.render({ success: false, message: "Check the fields.", fieldErrors: { code: "Choose a different code." } }, true); h.flush();
  assert.match(failed, /value="Updated subject draft"/);
  assert.match(failed, /aria-invalid="true"/);
  assert.match(failed, /Choose a different code\./);
  assert.match(failed, /<fieldset disabled=""/);
  assert.deepEqual(h.events, ["toast:Check the fields."]);
  h.events.length = 0;
  const success = { success: true, message: "Subject saved." };
  const saved = h.render(success); h.flush();
  assert.match(saved, /<fieldset disabled=""/);
  assert.deepEqual(h.events, ["toast:Subject saved.", "/portal/subjects", "refresh"]);
  h.events.length = 0;
  h.render(success); h.flush();
  assert.deepEqual(h.events, []);
});

test("subject creation requires code, name and units without rendering an existing subject identifier", () => {
  const h = formHarness({ mode: "create" });
  const markup = h.render();
  assert.match(markup, /Subject name/);
  assert.match(markup, /Subject code/);
  assert.match(markup, /<input(?=[^>]*name="units")(?=[^>]*required="")[^>]*>/);
  assert.doesNotMatch(markup, /name="subjectId"/);
  assert.match(markup, /Add subject/);
});
