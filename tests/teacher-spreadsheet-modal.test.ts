import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import { Dialog } from "radix-ui";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { normalizeSpreadsheetUrl, type TeacherSpreadsheetFormState } from "../lib/classes/validation";
import * as utils from "../lib/utils";
import { classroomTheme } from "../lib/portal/theme";
import type * as cards from "../app/portal/my-classes/spreadsheet-connection-card";
import type * as forms from "../app/portal/my-classes/spreadsheet-link-form";

function loadModule(path: string, overrides: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  const modules: Record<string, unknown> = {
    react: React, "react/jsx-runtime": jsxRuntime, "lucide-react": icons, "radix-ui": { Dialog },
    "@/components/ui/button": { Button }, "@/components/ui/input": { Input },
    "@/lib/classes/validation": { normalizeSpreadsheetUrl }, "@/lib/utils": utils,
    "@/lib/portal/theme": { classroomTheme }, ...overrides,
  };
  runInNewContext(code, {
    module: loaded, exports: loaded.exports,
    require: (name: string) => { assert.ok(name in modules, `Unexpected spreadsheet modal dependency: ${name}`); return modules[name]; },
  });
  return loaded.exports;
}

type TreeElement = React.ReactElement<Record<string, unknown>>;
function elements(tree: React.ReactNode) {
  const result: TreeElement[] = [];
  function visit(node: React.ReactNode) {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement<Record<string, unknown>>(child)) return;
      result.push(child);
      visit(child.props.children as React.ReactNode);
    });
  }
  visit(tree);
  return result;
}

function stateSlots() {
  const slots: unknown[] = [];
  let cursor = 0;
  const useState = <T,>(initial: T | (() => T)): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === "function" ? (initial as () => T)() : initial;
    return [slots[index] as T, (next) => { slots[index] = typeof next === "function" ? (next as (previous: T) => T)(slots[index] as T) : next; }];
  };
  return { useState, reset: () => { cursor = 0; } };
}

function cardHarness(spreadsheetUrl: string | null = null) {
  const slots = stateSlots();
  const focusEvents: string[] = [];
  const triggerRef = { current: { focus: () => focusEvents.push("trigger") } };
  const form = () => null;
  const { SpreadsheetConnectionCard } = loadModule("../app/portal/my-classes/spreadsheet-connection-card.tsx", {
    react: { ...React, useState: slots.useState, useRef: () => triggerRef },
    "./spreadsheet-link-form": { SpreadsheetLinkForm: form },
  }) as typeof cards;
  return {
    focusEvents, form,
    render() { slots.reset(); return SpreadsheetConnectionCard({ classId: "9007199254740993", spreadsheetUrl }); },
  };
}

function requiredElement(tree: React.ReactNode, type: React.ElementType | object) {
  const element = elements(tree).find((node) => node.type === type);
  assert.ok(element);
  return element;
}

test("spreadsheet cards show a red add action when unlinked and a green edit action when linked without an inline form", () => {
  const disconnected = renderToStaticMarkup(cardHarness().render());
  assert.match(disconnected, /Spreadsheet not connected/);
  assert.match(disconnected, /aria-label="Add Google Sheets link"/);
  assert.match(disconnected, /text-red-700/);
  assert.match(disconnected, /lucide-plus/);
  assert.doesNotMatch(disconnected, /<form|class-spreadsheet-url/);
  const linked = renderToStaticMarkup(cardHarness("https://docs.google.com/spreadsheets/d/saved/edit").render());
  assert.match(linked, /Spreadsheet connected/);
  assert.match(linked, /aria-label="Edit Google Sheets link"/);
  assert.match(linked, /text-emerald-700/);
  assert.match(linked, /lucide-pencil/);
  assert.doesNotMatch(linked, /<form|class-spreadsheet-url/);
  const invalid = renderToStaticMarkup(cardHarness("https://other.example.com/private").render());
  assert.match(invalid, /Spreadsheet not connected/);
  assert.match(invalid, /aria-label="Add Google Sheets link"/);
});

test("spreadsheet dialog locks dismiss controls during a save, allows cancel after failure, and restores trigger focus", () => {
  const harness = cardHarness();
  let tree = harness.render();
  (tree.props.onOpenChange as (open: boolean) => void)(true);
  tree = harness.render();
  assert.equal(tree.props.open, true);
  let form = requiredElement(tree, harness.form);
  assert.equal(form.props.classId, "9007199254740993");
  assert.equal(form.props.spreadsheetUrl, null);
  (form.props.onPendingChange as (busy: boolean) => void)(true);
  tree = harness.render();
  (tree.props.onOpenChange as (open: boolean) => void)(false);
  assert.equal(harness.render().props.open, true);
  let prevented = 0;
  const content = requiredElement(tree, Dialog.Content);
  const event = { preventDefault: () => { prevented++; } };
  (content.props.onEscapeKeyDown as (inputEvent: typeof event) => void)(event);
  (content.props.onInteractOutside as (inputEvent: typeof event) => void)(event);
  assert.equal(prevented, 2);
  assert.equal(content.props.style, classroomTheme);
  const close = elements(tree).find((node) => node.props["aria-label"] === "Close spreadsheet dialog");
  assert.equal(close?.props.disabled, true);
  form = requiredElement(tree, harness.form);
  (form.props.onPendingChange as (busy: boolean) => void)(false);
  tree = harness.render();
  (requiredElement(tree, harness.form).props.onCancel as () => void)();
  assert.equal(harness.render().props.open, false);
  (requiredElement(tree, Dialog.Content).props.onCloseAutoFocus as (inputEvent: typeof event) => void)(event);
  assert.deepEqual(harness.focusEvents, ["trigger"]);
});

function formHarness(spreadsheetUrl: string | null = null) {
  const slots = stateSlots();
  let state: TeacherSpreadsheetFormState = { success: false, message: "" };
  let pending = false;
  let previousDependencies: React.DependencyList | undefined;
  const effects: Array<() => unknown> = [];
  const events: string[] = [];
  const submissions: FormData[] = [];
  const router = { push: (path: string) => events.push(path), refresh: () => events.push("refresh") };
  const busy = (value: boolean) => events.push("busy " + value);
  const cancel = () => events.push("cancel");
  const action = async (data: FormData) => { submissions.push(data); };
  const { SpreadsheetLinkForm } = loadModule("../app/portal/my-classes/spreadsheet-link-form.tsx", {
    react: {
      ...React, useState: slots.useState, useActionState: () => [state, action, pending],
      useEffect: (effect: () => unknown, dependencies: React.DependencyList) => {
        if (!previousDependencies || dependencies.some((value, index) => !Object.is(value, previousDependencies![index]))) effects.push(effect);
        previousDependencies = dependencies;
      },
    },
    "next/navigation": { useRouter: () => router },
    "@/components/portal/toasts": { useActionToast: (value: TeacherSpreadsheetFormState) => { if (value.message) events.push("toast " + value.message); } },
    "./actions": { saveClassSpreadsheetAction: action },
  }) as typeof forms;
  return {
    events, submissions,
    render(nextState = state, saving = pending) {
      slots.reset(); state = nextState; pending = saving;
      return SpreadsheetLinkForm({ classId: "9007199254740993", spreadsheetUrl, onPendingChange: busy, onCancel: cancel });
    },
    flushEffects() { for (const effect of effects.splice(0)) effect(); },
  };
}

test("spreadsheet add/edit forms keep saved links and failed drafts with accessible field errors and cancellation", () => {
  const savedUrl = "https://docs.google.com/spreadsheets/d/saved/edit";
  const harness = formHarness(savedUrl);
  let tree = harness.render();
  harness.flushEffects();
  assert.equal(requiredElement(tree, Input).props.value, savedUrl);
  assert.match(renderToStaticMarkup(tree), /Update link/);
  const draft = "https://other.example.com/invalid";
  (requiredElement(tree, Input).props.onChange as (event: { target: { value: string } }) => void)({ target: { value: draft } });
  tree = harness.render({ success: false, message: "Check the link.", fieldErrors: { spreadsheetUrl: "Enter a Google Sheets link." } });
  harness.flushEffects();
  const input = requiredElement(tree, Input);
  assert.equal(input.props.value, draft);
  assert.equal(input.props["aria-invalid"], true);
  assert.match(String(input.props["aria-describedby"]), /class-spreadsheet-url-error/);
  assert.match(renderToStaticMarkup(tree), /Enter a Google Sheets link/);
  const cancel = elements(tree).find((node) => node.type === Button && node.props.children === "Cancel");
  assert.ok(cancel);
  assert.equal(cancel.props.type, "button");
  (cancel.props.onClick as () => void)();
  assert.ok(harness.events.includes("cancel"));
  assert.equal(harness.submissions.length, 0);
  const add = renderToStaticMarkup(formHarness().render());
  assert.match(add, /Save link/);
});

test("spreadsheet save notifies pending before submission and returns to My Classes only after successful feedback", () => {
  const harness = formHarness();
  let tree = harness.render();
  harness.flushEffects();
  harness.events.length = 0;
  (tree.props.onSubmit as () => void)();
  assert.deepEqual(harness.events, ["busy true"]);
  tree = harness.render({ success: false, message: "" }, true);
  harness.flushEffects();
  assert.equal(requiredElement(tree, "fieldset").props.disabled, true);
  assert.match(renderToStaticMarkup(tree), /Saving\.\.\./);
  harness.events.length = 0;
  const failed = { success: false, message: "Unable to save." };
  harness.render(failed, false);
  harness.flushEffects();
  assert.deepEqual(harness.events, ["toast Unable to save.", "busy false"]);
  harness.events.length = 0;
  const success = { success: true, message: "Saved." };
  tree = harness.render(success, false);
  harness.flushEffects();
  assert.equal(requiredElement(tree, "fieldset").props.disabled, true);
  assert.deepEqual(harness.events, ["toast Saved.", "busy true", "/portal/my-classes", "refresh"]);
  harness.events.length = 0;
  harness.render(success, false);
  harness.flushEffects();
  assert.deepEqual(harness.events, ["toast Saved."], "Repeated renders must not repeat navigation.");
});
