import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import ts from "typescript";

import * as fields from "../app/(public)/admission/components/form-fields";
import * as schema from "../app/(public)/admission/components/form-schema";
import type * as lastSchoolStep from "../app/(public)/admission/components/last-school-step";
import type { AdmissionLastSchool, AdmissionLastSchoolsResult } from "../lib/types/last-schools";

type Props = Record<string, unknown> & { children?: React.ReactNode };
type Element = React.ReactElement<Props>;

const schools: AdmissionLastSchool[] = [
  {
    id: "9007199254740993", schoolName: "Central School", shortName: "CS", schoolId: "00123", schoolType: "Public",
    address: { houseNumber: "12B", subdivision: "East Village", street: "Main Road", barangay: "Central", city: "Quezon City", province: "Metro Manila", postalCode: "0100" },
    formattedAddress: "12B, Main Road, East Village, Central, Quezon City, Metro Manila, 0100",
  },
  {
    id: "9007199254740995", schoolName: "West Academy", shortName: "WA", schoolId: "00456", schoolType: "Private",
    address: { houseNumber: null, subdivision: null, street: "West Road", barangay: "West", city: "Makati", province: "Metro Manila", postalCode: "1200" },
    formattedAddress: "West Road, West, Makati, Metro Manila, 1200",
  },
];

const source = ts.transpileModule(readFileSync(new URL("../app/(public)/admission/components/last-school-step.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function elements(node: React.ReactNode): Element[] {
  const result: Element[] = [];
  function visit(child: React.ReactNode) {
    React.Children.forEach(child, (entry) => {
      if (!React.isValidElement<Props>(entry)) return;
      if (typeof entry.type === "function") {
        visit((entry.type as (props: Props) => React.ReactNode)(entry.props));
        return;
      }
      result.push(entry);
      visit(entry.props.children);
    });
  }
  visit(node);
  return result;
}

function textContent(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (React.isValidElement<Props>(node)) return textContent(node.props.children);
  return String(node);
}

function control(tree: React.ReactNode) {
  const found = elements(tree).find(({ type, props }) => type === "input" && props.role === "combobox");
  assert.ok(found, "Previous-school search must be one accessible combobox");
  return found;
}

function options(tree: React.ReactNode) {
  return elements(tree).filter(({ props }) => props.role === "option");
}

function event(tree: React.ReactNode, name: "onFocus" | "onChange" | "onKeyDown", value?: string) {
  const input = control(tree);
  const handler = input.props[name] as (event: unknown) => void;
  assert.equal(typeof handler, "function", `Missing combobox ${name} handler`);
  let prevented = false;
  const target = { value, setCustomValidity: () => undefined };
  handler({ target, currentTarget: target, key: value, preventDefault: () => { prevented = true; } });
  return prevented;
}

function harness(initial: Partial<lastSchoolStep.LastSchoolFormValues> = {}, result: AdmissionLastSchoolsResult = { schools }) {
  const form = Object.fromEntries(Object.values(schema.detailsSteps).flatMap((step) => step.sections.flatMap((section) => section.fields.map(({ id }) => [id, ""])))) as lastSchoolStep.LastSchoolFormValues;
  Object.assign(form, { last_school_year: "2025-2026", last_school_year_level: "Grade 12", last_school_graduation_date: "2026-03-31" }, initial);
  const values: unknown[] = [];
  let index = 0;
  const dependencies: Array<React.DependencyList | undefined> = [];
  const effects: Array<() => unknown> = [];
  const useState = <T,>(initialValue: T | (() => T)): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const slot = index++;
    if (!(slot in values)) values[slot] = typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;
    return [values[slot] as T, (next) => {
      values[slot] = typeof next === "function" ? (next as (previous: T) => T)(values[slot] as T) : next;
    }];
  };
  let catalog = result;
  const modules: Record<string, unknown> = {
    react: {
      ...React, useState, useRef: <T,>(initialValue: T) => useState(() => ({ current: initialValue }))[0],
      useId: () => "previous-school-synthetic", useMemo: <T,>(factory: () => T) => factory(),
      useEffect: (effect: () => unknown, nextDependencies?: React.DependencyList) => {
        const slot = index++;
        const previous = dependencies[slot];
        if (!nextDependencies || !previous || nextDependencies.some((value, position) => !Object.is(previous[position], value))) effects.push(effect);
        dependencies[slot] = nextDependencies;
      },
    },
    "react/jsx-runtime": jsxRuntime, "lucide-react": icons, "./form-fields": fields, "./form-schema": schema,
    "../actions": { getAdmissionLastSchools: async () => catalog },
  };
  const loaded = { exports: {} };
  runInNewContext(source, {
    module: loaded, exports: loaded.exports, setTimeout, clearTimeout,
    document: { getElementById: () => null, addEventListener: () => undefined, removeEventListener: () => undefined },
    require: (dependency: string) => {
      assert.ok(dependency in modules, `Unexpected previous-school UI dependency: ${dependency}`);
      return modules[dependency];
    },
  });
  const { LastSchoolStep } = loaded.exports as typeof lastSchoolStep;
  return {
    form,
    setCatalog(next: AdmissionLastSchoolsResult) { catalog = next; },
    render() {
      index = 0;
      return LastSchoolStep({ form, onChange: (field, value) => { form[field] = value; } });
    },
    async flushEffects() {
      for (const effect of effects.splice(0)) effect();
      await new Promise<void>((resolve) => setImmediate(resolve));
    },
  };
}

test("previous-school search opens matching results with Other always at the bottom", async () => {
  const school = harness();
  let tree = school.render();
  await school.flushEffects();
  tree = school.render();
  assert.equal(control(tree).props["aria-expanded"], false);
  assert.equal(options(tree).length, 0);
  event(tree, "onFocus");
  tree = school.render();
  assert.equal(control(tree).props["aria-expanded"], true);
  assert.equal(options(tree).length, 3);
  assert.match(textContent(options(tree).at(-1)!.props.children), /^Other/i);

  for (const query of ["central", "cs", "quezon", "  CENTRAL  "]) {
    event(tree, "onChange", query);
    tree = school.render();
    assert.equal(options(tree).length, 2, query);
    assert.match(textContent(options(tree)[0].props.children), /Central School/);
    assert.match(textContent(options(tree).at(-1)!.props.children), /^Other/i);
  }

  event(tree, "onChange", "School not in the database");
  tree = school.render();
  assert.equal(options(tree).length, 1);
  assert.match(textContent(options(tree)[0].props.children), /^Other/i);
  assert.match(renderToStaticMarkup(tree), /No saved schools match/);
  assert.equal(school.form.last_school_record_id ?? "", "", "Typing never selects an arbitrary school");
});

test("keyboard selection keeps canonical saved-school fields while omitting the removed fillable fields", async () => {
  const school = harness();
  let tree = school.render();
  await school.flushEffects();
  tree = school.render();
  assert.equal(event(tree, "onKeyDown", "ArrowDown"), true);
  tree = school.render();
  assert.equal(control(tree).props["aria-activedescendant"], options(tree)[0].props.id);
  assert.equal(event(tree, "onKeyDown", "Enter"), true);
  tree = school.render();
  assert.equal(school.form.last_school_record_id, schools[0].id);
  assert.equal(school.form.last_school_name, "Central School");
  assert.equal(school.form.last_school_id, "00123");
  assert.equal(school.form.last_school_house_number, "12B");
  assert.equal(school.form.last_school_subdivision, "East Village");
  assert.equal(school.form.last_school_city, "Quezon City");
  assert.equal(control(tree).props["aria-expanded"], false);
  assert.equal(school.form.last_school_year, "2025-2026");
  for (const field of ["last_school_id", "last_school_house_number", "last_school_subdivision"]) {
    assert.equal(elements(tree).some(({ type, props }) => ["input", "select"].includes(String(type)) && (props.id === field || props.name === field)), false, field);
  }
  const name = elements(tree).find(({ type, props }) => type === "input" && props.id === "last_school_name");
  assert.equal(name?.props.readOnly, true);
});

test("Other clears saved-school metadata, enables the smaller manual form, and preserves academic history", async () => {
  const school = harness();
  let tree = school.render();
  await school.flushEffects();
  tree = school.render();
  event(tree, "onKeyDown", "ArrowDown");
  tree = school.render();
  event(tree, "onKeyDown", "Enter");
  tree = school.render();
  event(tree, "onFocus");
  tree = school.render();
  event(tree, "onChange", "Unknown School");
  tree = school.render();
  event(tree, "onKeyDown", "ArrowDown");
  tree = school.render();
  event(tree, "onKeyDown", "Enter");
  tree = school.render();
  assert.equal(school.form.last_school_record_id, "");
  for (const section of schema.detailsSteps.lastSchool.sections.slice(0, 2)) {
    for (const field of section.fields) assert.equal(school.form[field.id], "", field.id);
  }
  assert.equal(school.form.last_school_year, "2025-2026");
  assert.equal(school.form.last_school_year_level, "Grade 12");
  assert.equal(school.form.last_school_graduation_date, "2026-03-31");
  const inputs = elements(tree).filter(({ type }) => type === "input");
  assert.ok(inputs.find(({ props }) => props.name === "last_school_name" && !props.readOnly));
  for (const field of ["last_school_id", "last_school_house_number", "last_school_subdivision"]) {
    assert.equal(inputs.some(({ props }) => props.id === field || props.name === field), false, field);
  }
  assert.ok(inputs.find(({ props }) => props.name === "last_school_street"));
});

test("Escape closes search without overwriting the current school", async () => {
  const school = harness({ last_school_record_id: schools[0].id, last_school_name: schools[0].schoolName });
  let tree = school.render();
  await school.flushEffects();
  tree = school.render();
  event(tree, "onFocus");
  tree = school.render();
  event(tree, "onChange", "West");
  tree = school.render();
  assert.equal(event(tree, "onKeyDown", "Escape"), true);
  tree = school.render();
  assert.equal(control(tree).props["aria-expanded"], false);
  assert.equal(school.form.last_school_record_id, schools[0].id);
  assert.equal(school.form.last_school_name, schools[0].schoolName);
});

test("ArrowUp reaches the final Other option and Tab leaves an unchosen query unsaved", async () => {
  const school = harness({ last_school_record_id: schools[0].id, last_school_name: schools[0].schoolName });
  let tree = school.render();
  await school.flushEffects();
  tree = school.render();
  assert.equal(event(tree, "onKeyDown", "ArrowUp"), true);
  tree = school.render();
  assert.equal(control(tree).props["aria-activedescendant"], options(tree).at(-1)!.props.id);
  assert.match(textContent(options(tree).at(-1)!.props.children), /^Other/i);
  event(tree, "onChange", "West");
  tree = school.render();
  assert.equal(event(tree, "onKeyDown", "Tab"), false, "Tab must continue to the next field");
  const wrapper = elements(tree).find(({ type, props }) => type === "div" && typeof props.onBlur === "function");
  assert.ok(wrapper, "Search closes when focus leaves the combobox wrapper");
  (wrapper.props.onBlur as (event: unknown) => void)({ currentTarget: { contains: () => false }, relatedTarget: {} });
  tree = school.render();
  assert.equal(control(tree).props["aria-expanded"], false);
  assert.equal(school.form.last_school_record_id, schools[0].id);
  assert.equal(school.form.last_school_name, schools[0].schoolName);
});

test("loading, empty and failed saved-school lookups keep Other available", async () => {
  for (const catalog of [{ schools: [] }, { schools: [], error: "Unavailable" }]) {
    const school = harness({}, catalog);
    let tree = school.render();
    event(tree, "onFocus");
    tree = school.render();
    assert.match(textContent(options(tree).at(-1)!.props.children), /^Other/i);
    await school.flushEffects();
    tree = school.render();
    assert.equal(options(tree).length, 1);
    assert.match(textContent(options(tree)[0].props.children), /^Other/i);
    assert.match(renderToStaticMarkup(tree), catalog.error ? /Saved schools are unavailable/ : /No schools have been saved/);
  }
});
