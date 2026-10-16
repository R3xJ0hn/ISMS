import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as validation from "../lib/program-subjects/validation";
import type * as formModule from "../components/portal/assignment-form";
import { loadPortalFeedback } from "./portal-feedback-harness";

const programId = "9007199254740993";
const usedId = "9007199254740995";
const unusedId = "9007199254740997";
const subjects = [
  { id: usedId, name: "Synthetic Computing", code: "SYN-101", units: "3" },
  { id: unusedId, name: "Synthetic Mathematics", code: null, units: "1" },
];
type Props = Record<string, unknown> & { children?: React.ReactNode };
type Element = React.ReactElement<Props>;

function native(tag: string) {
  return function Native(props: Props) {
    const attributes = { ...props }; delete attributes.asChild;
    return React.createElement(tag, attributes);
  };
}

function elements(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Props>(node)) return [];
  return [node, ...elements(node.props.children)];
}

function resolve(node: React.ReactNode): React.ReactNode {
  if (Array.isArray(node)) return node.map((child, index) => {
    const resolved = resolve(child);
    return React.isValidElement(resolved) ? React.cloneElement(resolved, { key: resolved.key ?? index }) : resolved;
  });
  if (!React.isValidElement<Props>(node)) return node;
  if (typeof node.type === "function") return resolve((node.type as (props: Props) => React.ReactNode)(node.props));
  return React.cloneElement(node, undefined, resolve(node.props.children));
}

async function formHarness(empty = false) {
  let slot = 0, pending = false;
  let state: validation.ProgramSubjectFormState = { success: false, message: "" };
  let effects: Array<() => unknown> = [];
  const values: unknown[] = [], navigation: string[] = [], toasts: validation.ProgramSubjectFormState[] = [];
  const unusedAction = () => assert.fail("Rendering must not submit database records");
  const modules: Record<string, unknown> = {
    react: { ...React, useId: () => "synthetic-subject-search", useState: (initial: unknown) => {
      const index = slot++;
      if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
      return [values[index], (next: unknown) => { values[index] = typeof next === "function" ? next(values[index]) : next; }];
    }, useRef: (initial: unknown) => {
      const index = slot++;
      return values[index] ??= { current: initial };
    }, useActionState: () => [state, unusedAction, pending], useEffect: (effect: () => unknown) => effects.push(effect) },
    "react/jsx-runtime": jsxRuntime,
    "next/navigation": { useRouter: () => ({ push: (path: string) => navigation.push(path) }) },
    "next/link": { default: native("a") },
    "lucide-react": { Search: () => null, Save: () => null, X: () => null },
    "@/components/ui/button": { Button: native("button") }, "@/components/ui/input": { Input: native("input") },
  };
  modules["./toasts"] = loadPortalFeedback(modules.react as Record<string, unknown>, { push: (path) => navigation.push(path) }, () => toasts.push(state));
  const code = ts.transpileModule(readFileSync(new URL("../components/portal/assignment-form.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  runInNewContext(code, { module: loaded, exports: loaded.exports, require: (name: string) => {
    assert.ok(name in modules, `Unexpected dependency: ${name}`); return modules[name];
  } });
  const { PortalAssignmentForm } = loaded.exports as typeof formModule;
  const pageModules: Record<string, unknown> = {
    "react/jsx-runtime": jsxRuntime, "next/link": { default: native("a") },
    "next/navigation": { notFound: () => assert.fail("Synthetic program exists") },
    "lucide-react": { ArrowLeft: () => null }, "@/components/ui/button": { Button: native("button") },
    "@/components/portal/page-header": { PortalFormPage: native("main") },
    "@/components/portal/assignment-form": { PortalAssignmentForm },
    "@/lib/program-subjects/admin": { getProgramSubjectEditData: async () => ({
      program: { id: programId, code: "SYN", label: "Synthetic program" }, subjects: empty ? [] : subjects,
      subjectIds: empty ? [] : [usedId], usedSubjectIds: empty ? [] : [usedId],
    }) }, "./actions": { saveProgramSubjectsAction: unusedAction },
  };
  const pageCode = ts.transpileModule(readFileSync(new URL("../app/portal/programs/[programId]/subjects/page.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const page = { exports: {} as { default: (props: { params: Promise<{ programId: string }> }) => Promise<React.ReactNode> } };
  runInNewContext(pageCode, { module: page, exports: page.exports, require: (name: string) => {
    assert.ok(name in pageModules, `Unexpected page dependency: ${name}`); return pageModules[name];
  } });
  const pageTree = await page.exports.default({ params: Promise.resolve({ programId }) });
  const form = elements(pageTree).find(({ type }) => type === PortalAssignmentForm);
  assert.ok(form, "The program page must configure the shared assignment form");
  return {
    navigation, toasts,
    setResult(result: validation.ProgramSubjectFormState, saving = false) { state = result; pending = saving; },
    flushEffects() { effects.forEach((effect) => effect()); },
    render() {
      slot = 0; effects = [];
      return resolve(form) as Element;
    },
  };
}

function hiddenForm(tree: Element) {
  const data = new FormData();
  for (const { props } of elements(tree).filter(({ type, props }) => type === "input" && props.type === "hidden")) {
    data.append(String(props.name), String(props.value));
  }
  return data;
}

function clickButton(tree: Element, text: string) {
  const button = elements(tree).find(({ type, props }) => type === "button" && props.children === text);
  assert.ok(button, `Missing ${text} control`);
  (button.props.onClick as () => void)();
}

function search(tree: Element, value: string) {
  const control = elements(tree).find(({ props }) => props.role === "searchbox");
  assert.ok(control);
  (control.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
}

test("subject search keeps hidden selections and shows names, optional codes and units", async () => {
  const harness = await formHarness();
  let tree = harness.render();
  assert.match(renderToStaticMarkup(tree), /SYN-101/);
  assert.match(renderToStaticMarkup(tree), /3 units/);
  assert.match(renderToStaticMarkup(tree), /1 unit/);
  search(tree, "Mathematics");
  tree = harness.render();
  const checkboxes = elements(tree).filter(({ props }) => props.type === "checkbox");
  assert.equal(checkboxes.length, 1);
  assert.equal(checkboxes[0].props.checked, false);
  assert.deepEqual(hiddenForm(tree).getAll("subjectIds"), ["", usedId]);
  (checkboxes[0].props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: true } });
  tree = harness.render();
  search(tree, "nothing matches");
  tree = harness.render();
  assert.equal(elements(tree).filter(({ props }) => props.type === "checkbox").length, 0);
  assert.deepEqual(hiddenForm(tree).getAll("subjectIds"), ["", usedId, unusedId]);
  assert.match(renderToStaticMarkup(tree), /Existing selections are kept/);
  const parsed = validation.parseProgramSubjectForm(hiddenForm(tree));
  assert.equal(parsed.success, true);
  if (parsed.success) assert.deepEqual(parsed.subjectIds, [BigInt(usedId), BigInt(unusedId)]);
});

test("used assignments remain checked and disabled, including after select-all and clear", async () => {
  const harness = await formHarness();
  let tree = harness.render();
  const used = elements(tree).find(({ props }) => props.type === "checkbox" && props.disabled === true);
  assert.ok(used);
  assert.equal(used.props.checked, true);
  (used.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: false } });
  tree = harness.render();
  assert.deepEqual(hiddenForm(tree).getAll("subjectIds"), ["", usedId]);
  search(tree, "Mathematics");
  tree = harness.render();
  clickButton(tree, "Select all");
  tree = harness.render();
  assert.deepEqual(hiddenForm(tree).getAll("subjectIds"), ["", usedId, unusedId]);
  clickButton(tree, "Clear unused selections");
  tree = harness.render();
  assert.deepEqual(hiddenForm(tree).getAll("subjectIds"), ["", usedId]);
  assert.match(renderToStaticMarkup(tree), /Subjects used by existing classes must remain assigned/);
});

test("failed saves retain selections, pending disables the form, and successful saves toast and return to programs", async () => {
  const harness = await formHarness();
  let tree = harness.render();
  clickButton(tree, "Select all");
  harness.setResult({ success: false, message: "Synthetic failed save", fieldErrors: { subjectIds: "Synthetic selection error" } });
  tree = harness.render(); harness.flushEffects();
  assert.deepEqual(hiddenForm(tree).getAll("subjectIds"), ["", usedId, unusedId]);
  assert.equal(elements(tree).find(({ type }) => type === "fieldset")?.props.disabled, false);
  assert.match(renderToStaticMarkup(tree), /Synthetic selection error/);
  assert.deepEqual(harness.navigation, []);
  harness.setResult({ success: false, message: "" }, true);
  tree = harness.render();
  assert.equal(tree.props["aria-busy"], true);
  assert.equal(elements(tree).find(({ type }) => type === "fieldset")?.props.disabled, true);
  const success = { success: true, message: "Synthetic saved" };
  harness.setResult(success);
  tree = harness.render(); harness.flushEffects();
  assert.equal(elements(tree).find(({ type }) => type === "fieldset")?.props.disabled, true);
  assert.deepEqual(harness.navigation, ["/portal/programs"]);
  assert.equal(harness.toasts.at(-1), success);
});

test("empty catalog provides a direct Manage Subjects link and explicit empty selections", async () => {
  const tree = (await formHarness(true)).render();
  assert.match(renderToStaticMarkup(tree), /href="\/portal\/subjects"/);
  assert.match(renderToStaticMarkup(tree), /Add subjects in Manage Subjects/);
  assert.deepEqual(hiddenForm(tree).getAll("subjectIds"), [""]);
});
