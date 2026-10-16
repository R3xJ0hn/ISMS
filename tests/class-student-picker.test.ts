import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import * as utils from "../lib/utils";
import * as table from "../lib/table";
import * as colors from "../lib/portal/classroom-colors";
import type * as pickerModule from "../app/portal/classes/class-student-picker";

type Props = Record<string, unknown> & { children?: React.ReactNode };
type Element = React.ReactElement<Props>;
function native(tag: string) {
  return function Native(props: Props) { return React.createElement(tag, props); };
}
const fixtures: pickerModule.ClassStudentOption[] = [
  { id: "9007199254740993", name: "Ana Cruz", studentNumber: "0007", userImage: "https://example.test/ana.webp" },
  { id: "9007199254740995", name: "José Maria Santos", studentNumber: "0008" },
  { id: "9007199254740997", name: "Ben Santos", studentNumber: null },
];

function elements(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Props>(node)) return [];
  return [node, ...elements(node.props.children)];
}

function harness(initialIds: string[] = [fixtures[0].id], students = fixtures) {
  let selectedIds = initialIds, disabled = false, index = 0, focused = 0;
  const slots: unknown[] = [], changes: string[][] = [];
  const hooks = {
    ...React, useId: () => "student-picker", useMemo: <T,>(factory: () => T) => factory(), useEffect: () => {},
    useState: (initial: unknown) => {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = initial;
      return [slots[slot], (next: unknown) => { slots[slot] = typeof next === "function" ? next(slots[slot]) : next; }];
    },
    useRef: (initial: unknown) => { const slot = index++; return slots[slot] ??= { current: initial }; },
  };
  const modules: Record<string, unknown> = {
    react: hooks, "react/jsx-runtime": jsxRuntime, "lucide-react": icons,
    "@/components/ui/input": { Input: native("input") }, "@/components/ui/button": { Button: native("button") },
    "@/components/ui/avatar": { Avatar: native("span"), AvatarImage: native("img"), AvatarFallback: native("span") },
    "@/lib/utils": utils, "@/lib/table": table, "@/lib/portal/classroom-colors": colors,
  };
  const source = ts.transpileModule(readFileSync(new URL("../app/portal/classes/class-student-picker.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  runInNewContext(source, { module: loaded, exports: loaded.exports, require: (name: string) => {
    assert.ok(name in modules, `Unexpected picker dependency: ${name}`); return modules[name];
  } });
  const { ClassStudentPicker } = loaded.exports as typeof pickerModule;
  return {
    changes, get selectedIds() { return selectedIds; }, get focused() { return focused; },
    setSelected(ids: string[]) { selectedIds = ids; }, setDisabled(value: boolean) { disabled = value; },
    render() {
      index = 0;
      const tree = ClassStudentPicker({ students, selectedIds, disabled, onChange(ids) { selectedIds = Array.from(ids); changes.push(selectedIds); } });
      const input = elements(tree).find(({ props }) => props.role === "combobox")!;
      (input.props.ref as { current: unknown }).current = { focus: () => focused++ };
      return tree;
    },
  };
}

function search(tree: React.ReactNode, value: string) {
  const input = elements(tree).find(({ props }) => props.role === "combobox")!;
  (input.props.onChange as (event: unknown) => void)({ target: { value } });
}

function key(tree: React.ReactNode, value: string) {
  let prevented = false, stopped = false;
  const input = elements(tree).find(({ props }) => props.role === "combobox")!;
  (input.props.onKeyDown as (event: unknown) => void)({ key: value, preventDefault: () => prevented = true, stopPropagation: () => stopped = true });
  return { prevented, stopped };
}

function options(tree: React.ReactNode) { return elements(tree).filter(({ props }) => props.role === "option"); }

test("class roster shows only selected student photos and names, with pastel initials and explicit removal", () => {
  const picker = harness([fixtures[0].id, fixtures[1].id, fixtures[1].id, "42"]);
  const tree = picker.render();
  const markup = renderToStaticMarkup(tree);
  assert.match(markup, /Ana Cruz/);
  assert.match(markup, /José Maria Santos/);
  assert.match(markup, /https:\/\/example.test\/ana.webp/);
  assert.match(markup, new RegExp(colors.studentThumbnailColor(fixtures[1].id)));
  assert.match(markup, /Unavailable student/);
  assert.match(markup, />3 students</);
  assert.doesNotMatch(markup, /Ben Santos|type="checkbox"|name="studentIds"|<form/);
  assert.equal(options(tree).length, 0);
  const remove = elements(tree).find(({ props }) => props["aria-label"] === "Remove Unavailable student from this class")!;
  assert.equal(remove.props.type, "button");
  (remove.props.onClick as () => void)();
  assert.deepEqual(picker.selectedIds, [fixtures[0].id, fixtures[1].id]);
  assert.equal(picker.changes.length, 1);
});

test("multiword and accent-insensitive search excludes enrolled students, and Enter adds without submitting", () => {
  const picker = harness();
  let tree = picker.render();
  assert.equal(key(tree, "Enter").prevented, true);
  assert.equal(picker.changes.length, 0);
  search(tree, "  jose  0008 santos  ");
  tree = picker.render();
  assert.equal(options(tree).length, 1);
  assert.equal(elements(tree).find(({ props }) => props.role === "combobox")?.props["aria-expanded"], true);
  assert.equal(key(tree, "Enter").prevented, true);
  tree = picker.render();
  assert.deepEqual(picker.selectedIds, [fixtures[0].id, fixtures[1].id]);
  assert.equal(picker.focused, 1);
  assert.equal(options(tree).length, 0);
  assert.equal(elements(tree).find(({ props }) => props.role === "combobox")?.props.value, "");
  search(tree, "ana 0007");
  tree = picker.render();
  assert.equal(options(tree).length, 0);
  assert.match(renderToStaticMarkup(tree), /already in this class/);
  assert.deepEqual(picker.selectedIds, [fixtures[0].id, fixtures[1].id]);
});

test("keyboard navigation selects the active result, closes on Escape and Tab, and preserves updated roster IDs", () => {
  const picker = harness([]);
  let tree = picker.render();
  search(tree, "santos"); tree = picker.render();
  key(tree, "End"); tree = picker.render();
  assert.equal(options(tree)[1].props["aria-selected"], true);
  key(tree, "Home"); tree = picker.render();
  assert.equal(options(tree)[0].props["aria-selected"], true);
  key(tree, "ArrowDown"); tree = picker.render();
  assert.equal(options(tree)[1].props["aria-selected"], true);
  key(tree, "ArrowUp"); tree = picker.render();
  assert.equal(options(tree)[0].props["aria-selected"], true);
  assert.deepEqual(key(tree, "Escape"), { prevented: true, stopped: true });
  tree = picker.render(); assert.equal(options(tree).length, 0);
  key(tree, "Enter"); assert.equal(picker.changes.length, 0);
  key(tree, "ArrowUp"); tree = picker.render();
  assert.equal(options(tree)[1].props["aria-selected"], true);
  key(tree, "Tab"); tree = picker.render(); assert.equal(options(tree).length, 0);
  picker.setSelected([fixtures[0].id]); tree = picker.render();
  search(tree, "santos"); tree = picker.render();
  const option = options(tree)[0];
  let preservedFocus = false;
  (option.props.onPointerDown as (event: unknown) => void)({ preventDefault: () => preservedFocus = true });
  (option.props.onClick as () => void)();
  assert.equal(preservedFocus, true);
  assert.deepEqual(picker.selectedIds, [fixtures[0].id, fixtures[1].id]);
});

test("large search results are bounded, pending changes are blocked, and the 1,000-student limit keeps removals available", () => {
  const students = Array.from({ length: 1_001 }, (_, index) => ({ id: String(index), name: `Student ${index}`, studentNumber: String(index) }));
  const picker = harness([], students);
  let tree = picker.render(); search(tree, "student"); tree = picker.render();
  assert.equal(options(tree).length, 20);
  assert.match(renderToStaticMarkup(tree), /Refine your search/);
  picker.setDisabled(true); tree = picker.render();
  assert.equal(options(tree).length, 0);
  assert.equal(elements(tree).find(({ props }) => props.role === "combobox")?.props.disabled, true);
  key(tree, "Enter"); assert.equal(picker.changes.length, 0);
  picker.setSelected(students.slice(0, 1_000).map(({ id }) => id)); picker.setDisabled(false); tree = picker.render();
  assert.equal(elements(tree).find(({ props }) => props.role === "combobox")?.props.disabled, true);
  assert.match(renderToStaticMarkup(tree), /limit of 1,000 students/);
  const remove = elements(tree).find(({ props }) => props["aria-label"] === "Remove Student 0 from this class")!;
  assert.equal(remove.props.disabled, false);
  (remove.props.onClick as () => void)(); tree = picker.render();
  assert.equal(elements(tree).find(({ props }) => props.role === "combobox")?.props.disabled, false);
  picker.setDisabled(true); tree = picker.render();
  const disabledRemove = elements(tree).find(({ props }) => props["aria-label"] === "Remove Student 1 from this class")!;
  (disabledRemove.props.onClick as () => void)();
  assert.equal(picker.selectedIds.length, 999);
});
