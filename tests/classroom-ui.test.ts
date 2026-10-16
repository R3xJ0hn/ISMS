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
import * as avatar from "../components/ui/avatar";
import * as tooltip from "../components/ui/tooltip";
import * as academicLevels from "../lib/academic-levels";
import * as studentPreview from "../lib/classes/student-preview";
import * as classroomColors from "../lib/portal/classroom-colors";
import * as utils from "../lib/utils";
import * as banner from "../components/classroom/class-banner";
import { WorkspaceTabs } from "../components/classroom/workspace-tabs";
import type * as cards from "../components/classroom/class-cards";

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

const classes: cards.ClassroomCardData[] = [
  { id: "7", href: "/portal/my-classes/7", subjectName: "Computing", sectionName: "IT 1-A", yearLevel: "FirstYear", schoolYear: "2026-2027", semester: "FirstSemester", branchTitle: "Main Branch", spreadsheetLinked: true, studentCount: 24 },
  { id: "8", href: "/portal/my-classes/8", subjectName: "Mathematics", sectionName: "IT 1-A", yearLevel: "FirstYear", schoolYear: "2025-2026", semester: "SecondSemester", branchTitle: "Main Branch", spreadsheetLinked: false, studentCount: 0 },
  { id: "9", href: "/portal/my-classes/9", subjectName: "Computing", sectionName: "IT 2-B", yearLevel: "SecondYear", schoolYear: "2025-2026", semester: "FirstSemester", branchTitle: "City Branch", spreadsheetLinked: false, studentCount: 8 },
];

function gridHarness() {
  const slots: unknown[] = [];
  let cursor = 0;
  let idCursor = 0;
  const state = <T,>(initial: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index] as T, (next) => { slots[index] = typeof next === "function" ? (next as (previous: T) => T)(slots[index] as T) : next; }];
  };
  const modules: Record<string, unknown> = {
    react: { ...React, useId: () => `filter-control-${idCursor++}`, useState: state },
    "react/jsx-runtime": jsxRuntime, "next/link": { default: Link }, "lucide-react": icons,
    "@/components/ui/button": { Button }, "@/components/ui/input": { Input },
    "@/components/ui/avatar": avatar, "@/components/ui/tooltip": tooltip,
    "@/lib/academic-levels": academicLevels, "@/lib/utils": utils, "./class-banner": banner,
    "@/lib/classes/student-preview": studentPreview,
    "@/lib/portal/classroom-colors": classroomColors,
  };
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL("../components/classroom/class-cards.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(code, {
    module: loaded, exports: loaded.exports,
    require: (name: string) => { assert.ok(name in modules, `Unexpected card dependency: ${name}`); return modules[name]; },
  });
  const { ClassroomClassGrid } = loaded.exports as typeof cards;
  return { render: (props: Parameters<typeof ClassroomClassGrid>[0] = { classes, role: "teacher" }) => { cursor = 0; idCursor = 0; return ClassroomClassGrid(props); } };
}

function filterSelect(tree: React.ReactNode, type: "year" | "semester" | "level") {
  const labels = { year: "Filter by school year", semester: "Filter by semester", level: "Filter by year level" };
  const label = elements(tree).find((element) => element.type === "label" && element.props.children === labels[type]);
  assert.ok(label, `Missing accessible filter label ${labels[type]}`);
  const control = elements(tree).find((element) => element.type === "select" && element.props.id === label.props.htmlFor);
  assert.ok(control, `Missing labeled filter ${labels[type]}`);
  return control;
}

function change(tree: React.ReactNode, type: "search" | "year" | "semester" | "level", value: string) {
  const control = type === "search" ? elements(tree).find((element) => element.props.role === "searchbox") : filterSelect(tree, type);
  assert.ok(control);
  (control.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
}

test("class cards combine multiword search with school-year filters and preserve class destinations", () => {
  const harness = gridHarness();
  let tree = harness.render();
  change(tree, "search", " computing   IT ");
  tree = harness.render();
  let markup = renderToStaticMarkup(tree);
  assert.match(markup, /href="\/portal\/my-classes\/7"/);
  assert.match(markup, /href="\/portal\/my-classes\/9"/);
  assert.doesNotMatch(markup, /href="\/portal\/my-classes\/8"/);
  change(tree, "year", "2025-2026");
  markup = renderToStaticMarkup(harness.render());
  assert.match(markup, /href="\/portal\/my-classes\/9"/);
  assert.doesNotMatch(markup, /href="\/portal\/my-classes\/(7|8)"/);
  assert.match(markup, /1 class of 3/);
});

test("teacher and student class filters combine search, school year, semester and year level without changing destinations", () => {
  for (const role of ["teacher", "student"] as const) {
    const harness = gridHarness();
    const prefix = role === "teacher" ? "/portal/my-classes" : "/portal/classroom";
    const assigned = [
      ...classes,
      { ...classes[2], id: "10", semester: "SecondSemester" as const },
      { ...classes[2], id: "11", yearLevel: "FirstYear" as const },
      { ...classes[2], id: "12", schoolYear: "2026-2027" },
      { ...classes[2], id: "13", subjectName: "Mathematics" },
      { ...classes[2], id: "14", semester: null },
    ].map((assignedClass) => ({ ...assignedClass, href: `${prefix}/${assignedClass.id}` }));
    const props = { role, classes: assigned };
    let tree = harness.render(props);
    assert.match(renderToStaticMarkup(tree), /8 classes/);
    change(tree, "search", "computing");
    change(tree, "year", "2025-2026");
    change(tree, "semester", "FirstSemester");
    change(tree, "level", "SecondYear");
    tree = harness.render(props);
    const markup = renderToStaticMarkup(tree);
    assert.ok(markup.includes(`href="${prefix}/9"`));
    assert.equal((markup.match(/aria-label="Open /g) ?? []).length, 1);
    assert.match(markup, /1 class of 8/);
    assert.equal(filterSelect(tree, "semester").props.value, "FirstSemester");
    assert.equal(filterSelect(tree, "level").props.value, "SecondYear");
    assert.equal(filterSelect(tree, "year").props.value, "2025-2026");
    change(tree, "level", "Grade12");
    tree = harness.render(props);
    assert.match(renderToStaticMarkup(tree), /No classes match your filters/);
    const clear = elements(tree).find((element) => element.type === Button && element.props.children === "Clear filters");
    assert.ok(clear);
    (clear.props.onClick as () => void)();
    tree = harness.render(props);
    assert.equal((renderToStaticMarkup(tree).match(/aria-label="Open /g) ?? []).length, 8);
    for (const type of ["year", "semester", "level"] as const) assert.equal(filterSelect(tree, type).props.value, "");
    assert.equal(elements(tree).find((element) => element.props.role === "searchbox")?.props.value, "");
    assert.deepEqual(assigned.map((assignedClass) => assignedClass.id), ["7", "8", "9", "10", "11", "12", "13", "14"]);
  }
});

test("legacy classes remain visible by default, have an unassigned semester choice and never appear under a known term", () => {
  const harness = gridHarness();
  const props = { role: "student" as const, classes: [
    { ...classes[0], href: "/portal/classroom/7", semester: null },
    { ...classes[1], href: "/portal/classroom/8" },
  ] };
  let tree = harness.render(props);
  let markup = renderToStaticMarkup(tree);
  assert.match(markup, /href="\/portal\/classroom\/7"/);
  assert.match(markup, /Semester not assigned/);
  assert.match(renderToStaticMarkup(filterSelect(tree, "semester")), /<option value="unassigned">Semester not assigned/);
  change(tree, "semester", "unassigned");
  markup = renderToStaticMarkup(harness.render(props));
  assert.match(markup, /href="\/portal\/classroom\/7"/);
  assert.doesNotMatch(markup, /href="\/portal\/classroom\/8"/);
  tree = harness.render(props);
  change(tree, "semester", "SecondSemester");
  markup = renderToStaticMarkup(harness.render(props));
  assert.match(markup, /href="\/portal\/classroom\/8"/);
  assert.doesNotMatch(markup, /href="\/portal\/classroom\/7"/);
});

test("semester labels are searchable and year-level filter choices are readable and sorted using the academic enum", () => {
  const harness = gridHarness();
  const props = { role: "teacher" as const, classes: [classes[2], classes[0], classes[1]] };
  let tree = harness.render(props);
  const levelOptions = elements(filterSelect(tree, "level")).filter((element) => element.type === "option");
  assert.deepEqual(levelOptions.map((option) => [option.props.value, option.props.children]), [["", "All year levels"], ["FirstYear", "First Year"], ["SecondYear", "Second Year"]]);
  assert.doesNotMatch(renderToStaticMarkup(filterSelect(tree, "semester")), /value="unassigned"/);
  change(tree, "search", "mathematics 2nd semester");
  tree = harness.render(props);
  const markup = renderToStaticMarkup(tree);
  assert.match(markup, /href="\/portal\/my-classes\/8"/);
  assert.equal((markup.match(/aria-label="Open /g) ?? []).length, 1);
});

test("no-match filters can be cleared together without changing the assigned classes", () => {
  const harness = gridHarness();
  let tree = harness.render();
  change(tree, "search", "Unavailable subject");
  change(tree, "year", "2025-2026");
  tree = harness.render();
  assert.match(renderToStaticMarkup(tree), /No classes match your filters/);
  const clear = elements(tree).find((element) => element.type === Button && element.props.children === "Clear filters");
  assert.ok(clear);
  (clear.props.onClick as () => void)();
  const markup = renderToStaticMarkup(harness.render());
  assert.equal((markup.match(/href="\/portal\/my-classes\/\d"/g) ?? []).length, 3);
  assert.match(markup, /3 classes/);
});

test("student cards link their own class pages, omit roster counts and escape saved titles", () => {
  const harness = gridHarness();
  const markup = renderToStaticMarkup(harness.render({ role: "student", classes: [{ ...classes[0], href: "/portal/classroom/7", teacherName: "Maria Santos", subjectName: "Computing <script>unsafe</script>" }] }));
  assert.match(markup, /href="\/portal\/classroom\/7"/);
  assert.match(markup, /Maria Santos/);
  assert.match(markup, /&lt;script&gt;unsafe&lt;\/script&gt;/);
  assert.doesNotMatch(markup, /24 students|<script>|href="\/portal\/my-classes/);
  const empty = renderToStaticMarkup(harness.render({ role: "student", classes: [] }));
  assert.match(empty, /No classes assigned yet/);
  assert.match(empty, /your student record/);
});

test("both portal banners show a bounded student preview with accessible names and initials without nesting controls in the class link", () => {
  const studentPreviews = [
    { id: "1", name: "Ada Lovelace", imageUrl: null },
    { id: "2", name: "Grace Hopper", imageUrl: "https://res.cloudinary.com/demo/image/upload/student.png" },
    { id: "3", name: "Sam <script>unsafe</script>", imageUrl: null },
    { id: "4", name: "Lin Chen", imageUrl: null },
    { id: "5", name: "Fifth Student", imageUrl: null },
  ];
  for (const role of ["teacher", "student"] as const) {
    const href = `${role === "teacher" ? "/portal/my-classes" : "/portal/classroom"}/7`;
    const markup = renderToStaticMarkup(gridHarness().render({ role, classes: [{ ...classes[0], href, studentCount: 9, studentPreviews }] }));
    assert.ok(markup.includes(`href="${href}"`));
    assert.equal((markup.match(/aria-label="Student: /g) ?? []).length, 4);
    assert.equal((markup.match(/tabindex="0"/g) ?? []).length, 4);
    assert.match(markup, /aria-label="Student: Ada Lovelace"/);
    assert.match(markup, /aria-label="Student: Grace Hopper"/);
    assert.match(markup, /Sam &lt;script&gt;unsafe&lt;\/script&gt;/);
    assert.match(markup, />AL<\/span>/);
    assert.match(markup, /5 more students/);
    assert.match(markup, />\+5<\/span>/);
    assert.doesNotMatch(markup, /Fifth Student|<script>/);
    const links = [...markup.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)];
    assert.equal(links.length, 1);
    assert.doesNotMatch(links[0][1], /tabindex|Student:|<button/);
  }
});

test("class cards without student previews keep their existing class navigation and omit the thumbnail row", () => {
  for (const studentPreviews of [undefined, []]) {
    const markup = renderToStaticMarkup(gridHarness().render({ role: "teacher", classes: [{ ...classes[0], studentCount: 0, studentPreviews }] }));
    assert.match(markup, /href="\/portal\/my-classes\/7"/);
    assert.doesNotMatch(markup, /aria-label="Student: |more students|>\+/);
  }
});

test("workspace tabs expose only available role content and honor the selected section", () => {
  const overview = React.createElement("p", null, "Overview content");
  const grades = React.createElement("p", null, "Personal grades");
  const studentMarkup = renderToStaticMarkup(React.createElement(WorkspaceTabs, { overview, grades, defaultTab: "grades" }));
  assert.match(studentMarkup, /role="tab"[^>]*aria-selected="true"[^>]*>Grades/);
  assert.match(studentMarkup, /Personal grades/);
  assert.doesNotMatch(studentMarkup, />Students<|Overview content/);
  const teacherMarkup = renderToStaticMarkup(React.createElement(WorkspaceTabs, { overview, grades, students: React.createElement("p", null, "Authorized roster"), defaultTab: "students" }));
  assert.match(teacherMarkup, /role="tab"[^>]*aria-selected="true"[^>]*>Students/);
  assert.match(teacherMarkup, /Authorized roster/);
  assert.doesNotMatch(teacherMarkup, /Personal grades/);
});
