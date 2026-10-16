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
import * as enums from "../lib/generated/prisma/enums";
import * as utils from "../lib/utils";
import type { ProgramFormValues } from "../lib/programs/validation";
import { loadPortalFeedback } from "./portal-feedback-harness";

type ActionState = { success: boolean; message: string; fieldErrors?: Record<string, string> };

function formHarness(path: string, exportName: string, props: Record<string, unknown>) {
  let state: ActionState = { success: false, message: "" };
  let pending = false;
  const dependenciesBySlot: React.DependencyList[] = [];
  const refs: Array<{ current: unknown }> = [];
  let effectSlot = 0, refSlot = 0;
  const effects: Array<() => unknown> = [];
  const events: string[] = [];
  const router = { push: (url: string) => events.push(url), refresh: () => events.push("refresh") };
  const action = async () => assert.fail("Rendering must not submit an edit");
  const modules: Record<string, unknown> = {
    react: {
      ...React,
      useState: <T,>(initial: T | (() => T)) => [typeof initial === "function" ? (initial as () => T)() : initial, () => {}],
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
    "@/components/ui/button": { Button }, "@/components/ui/input": { Input },
    "@/lib/generated/prisma/enums": enums, "@/lib/utils": utils,
    "./actions": { updateProgramAction: action, saveClassSpreadsheetAction: action },
  };
  modules["@/components/portal/toasts"] = loadPortalFeedback(modules.react as Record<string, unknown>, router, (message) => events.push(`toast:${message}`));
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} as Record<string, (properties: Record<string, unknown>) => React.ReactElement> };
  runInNewContext(code, {
    module: loaded, exports: loaded.exports,
    require: (name: string) => { assert.ok(name in modules, `Unexpected edit dependency: ${name}`); return modules[name]; },
  });
  return {
    events,
    render(nextState = state, saving = false) {
      state = nextState;
      pending = saving;
      effectSlot = 0; refSlot = 0;
      return renderToStaticMarkup(loaded.exports[exportName](props));
    },
    flushEffects() { for (const effect of effects.splice(0)) effect(); },
  };
}

const programValues: ProgramFormValues = {
  label: "Computing", code: "BSIT", programType: "Bachelor", groupId: "", sortOrder: "0",
  publicTitle: "", publicCode: "", slug: "", note: "", overview: "", focusAreas: "", pathways: "",
};

for (const form of [
  { path: "../app/portal/programs/program-edit-form.tsx", name: "ProgramEditForm", props: { programId: "7", values: programValues, groups: [] }, parent: "/portal/programs", refresh: false, field: "label" },
  { path: "../app/portal/my-classes/spreadsheet-link-form.tsx", name: "SpreadsheetLinkForm", props: { classId: "7", spreadsheetUrl: "https://docs.google.com/spreadsheets/d/saved/edit" }, parent: "/portal/my-classes", refresh: true, field: "spreadsheetUrl" },
]) {
  test(`${form.name} retains failed saves and sends success feedback before returning to its parent`, () => {
    const harness = formHarness(form.path, form.name, form.props);
    harness.render();
    harness.flushEffects();
    assert.deepEqual(harness.events, []);

    const failed = { success: false, message: "Check the fields.", fieldErrors: { [form.field]: "Enter a valid value." } };
    const failedMarkup = harness.render(failed, true);
    harness.flushEffects();
    assert.deepEqual(harness.events, ["toast:Check the fields."]);
    assert.match(failedMarkup, /aria-invalid="true"/);
    assert.match(failedMarkup, /Enter a valid value\./);
    assert.match(failedMarkup, /<fieldset disabled=""/);

    harness.events.length = 0;
    const success = { success: true, message: "Saved." };
    const savedMarkup = harness.render(success);
    harness.flushEffects();
    assert.deepEqual(harness.events, ["toast:Saved.", form.parent, ...(form.refresh ? ["refresh"] : [])]);
    assert.match(savedMarkup, /<fieldset disabled=""/);

    harness.events.length = 0;
    harness.render(success);
    harness.flushEffects();
    assert.deepEqual(harness.events, [], "An unchanged successful result must not repeat its feedback or navigation");

    harness.events.length = 0;
    harness.render({ ...success });
    harness.flushEffects();
    assert.deepEqual(harness.events, ["toast:Saved.", form.parent, ...(form.refresh ? ["refresh"] : [])], "A new result with an identical message still completes navigation");
  });
}
