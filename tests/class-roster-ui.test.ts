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
import { InteractivePortalTable } from "../components/portal/interactive-table";
import { ClassBanner } from "../components/classroom/class-banner";
import { ClassworkView } from "../components/classroom/classwork-view";
import { WorkspaceTabs } from "../components/classroom/workspace-tabs";
import * as pageHeader from "../components/portal/page-header";
import * as utils from "../lib/utils";
import * as academicLevels from "../lib/academic-levels";
import * as employeeNames from "../lib/employees/names";
import { parseClassId } from "../lib/classes/validation";
import * as periodVisibility from "../lib/classes/period-visibility";
import type { ClassFormState, ClassFormValues } from "../lib/classes/validation";
import type * as classForms from "../app/portal/classes/class-form";
import type * as classOptions from "../lib/classes/options";
import type * as editPages from "../app/portal/classes/[classId]/edit/page";
import type * as summaryPages from "../app/portal/my-classes/[classId]/page";
import type * as rosterTables from "../app/portal/my-classes/class-roster-table";
import type * as managementPages from "../app/portal/classes/page";
import { loadPortalFeedback } from "./portal-feedback-harness";

const rosterImportDialog = () => React.createElement("button", { type: "button" }, "Upload Excel");
type PickerProps = {
  students: Array<{ id: string; name: string; studentNumber: string | null; userImage?: string | null }>;
  selectedIds: string[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
};
function studentPicker({ students, selectedIds }: PickerProps) {
  const selected = students.filter((student) => selectedIds.includes(student.id));
  return React.createElement("section", null,
    React.createElement("input", { role: "combobox", "aria-label": "Search students" }),
    students.length === 0 && React.createElement("p", null, "No saved students are available yet."),
    selected.length === 0 && React.createElement("p", null, "No students added to this class yet."),
    selected.map((student) => React.createElement("p", { key: student.id },
      student.userImage && React.createElement("img", { src: student.userImage, alt: student.name }),
      student.name, " ", student.studentNumber ?? "Student number not assigned")));
}

function loadModule(path: string, overrides: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const modules: Record<string, unknown> = {
    react: React, "react/jsx-runtime": jsxRuntime, "next/link": { default: Link }, "lucide-react": icons,
    "@/components/ui/button": { Button }, "@/components/ui/input": { Input },
    "@/components/portal/page-header": pageHeader,
    "@/components/portal/interactive-table": { InteractivePortalTable },
    "@/components/classroom/class-banner": { ClassBanner },
    "@/components/classroom/classwork-view": { ClassworkView },
    "@/components/classroom/workspace-tabs": { WorkspaceTabs },
    "@/lib/utils": utils, "@/lib/academic-levels": academicLevels,
    "@/lib/employees/names": employeeNames,
    "@/lib/classes/period-visibility": periodVisibility,
    "../period-visibility-card": { PeriodVisibilityCard: () => null },
    "./class-roster-import-dialog": { ClassRosterImportDialog: rosterImportDialog },
    "./class-student-picker": { ClassStudentPicker: studentPicker },
    "@/components/portal/toasts": { useActionToast: () => {} },
    ...overrides,
  };
  const loaded = { exports: {} };
  runInNewContext(code, {
    module: loaded, exports: loaded.exports,
    require: (name: string) => { assert.ok(name in modules, `Unexpected class UI dependency: ${name}`); return modules[name]; },
  });
  return loaded.exports;
}

type TreeElement = React.ReactElement<Record<string, unknown>>;
function elements(tree: React.ReactNode): TreeElement[] {
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

const teacherId = "9007199254740995";
const firstStudentId = "9007199254740997";
const secondStudentId = "9007199254740999";
const teachers = [{ id: teacherId, name: "Maria Santos", email: "saved.teacher@example.com" }];
const branches = [{ id: "9007199254740991", title: "Main Branch" }];
const subjects = [{ id: "9007199254741001", name: "Computing", code: "IT101" }];
const programs = [{ id: "9007199254740999", code: "BSIT", label: "Information Technology", programType: "Bachelor", branchIds: [branches[0].id], subjectIds: [subjects[0].id] }];
const students = [
  { id: firstStudentId, name: "Ana Cruz", studentNumber: "0007", userImage: "https://res.cloudinary.com/synthetic/image/upload/student.png" },
  { id: secondStudentId, name: "Ben Santos", studentNumber: null, userImage: null },
];
function values(studentIds: string[] = [firstStudentId]): ClassFormValues {
  return { teacherId, branchId: branches[0].id, programId: programs[0].id, subjectId: subjects[0].id, schoolYear: "2026-2027", sectionName: "IT 1-A", yearLevel: "FirstYear", semester: "FirstSemester", studentIds };
}

function formHarness(state: ClassFormState = { success: false, message: "" }, pending = false) {
  const slots: unknown[] = [];
  let slotIndex = 0;
  const effects: Array<() => unknown> = [];
  const navigation: string[] = [];
  const calls: Array<{ mode: string; previous: ClassFormState; data: FormData }> = [];
  const action = (mode: string) => async (previous: ClassFormState, data: FormData) => {
    calls.push({ mode, previous, data });
    return state;
  };
  const useState = <T,>(initial: T | (() => T)): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const index = slotIndex++;
    if (!(index in slots)) slots[index] = typeof initial === "function" ? (initial as () => T)() : initial;
    return [slots[index] as T, (next) => { slots[index] = typeof next === "function" ? (next as (previous: T) => T)(slots[index] as T) : next; }];
  };
  const hooks = {
    ...React, useState, useRef: <T,>(initial: T) => useState(() => ({ current: initial }))[0], useEffect: (effect: () => unknown) => effects.push(effect),
    useActionState: (handler: (previous: ClassFormState, data: FormData) => Promise<ClassFormState>) => [state, (data: FormData) => handler(state, data), pending],
  };
  const { ClassForm } = loadModule("../app/portal/classes/class-form.tsx", {
    react: hooks,
    "@/components/portal/toasts": loadPortalFeedback(hooks, { push: (path: string) => navigation.push(path) }),
    "./actions": { createClassAction: action("create"), updateClassAction: action("edit") },
  }) as typeof classForms;
  return {
    calls, effects, navigation,
    render: (props: Parameters<typeof ClassForm>[0]) => { slotIndex = 0; return ClassForm(props); },
  };
}

function picker(tree: React.ReactNode) {
  const control = elements(tree).find((element) => element.type === studentPicker);
  assert.ok(control, "Class form uses the shared student picker");
  return control;
}

function changeStudents(tree: React.ReactNode, ids: string[]) {
  (picker(tree).props.onChange as PickerProps["onChange"])(ids);
}

function changeSelect(tree: React.ReactNode, name: string, value: string) {
  const control = elements(tree).find((element) => element.type === "select" && element.props.name === name);
  assert.ok(control, `Missing select ${name}`);
  (control.props.onChange as (event: { target: { name: string; value: string } }) => void)({ target: { name, value } });
}

function submittedValues(tree: React.ReactNode) {
  const data = new FormData();
  for (const element of elements(tree)) {
    if (typeof element.props.name === "string" && typeof element.props.value === "string") data.append(element.props.name, element.props.value);
  }
  return data;
}

test("class teacher choices submit the precise Teacher employee primary key and show the employee name and saved account email", () => {
  const harness = formHarness();
  const markup = renderToStaticMarkup(harness.render({ mode: "create", teachers, students, branches, programs, subjects }));
  assert.match(markup, /<select[^>]*name="teacherId"[^>]*required=""/);
  assert.ok(markup.includes(`<option value="${teacherId}">Maria Santos (saved.teacher@example.com)</option>`));
  assert.doesNotMatch(markup, /name="userId"|name="spreadsheetUrl"|value="EMP-/);
  assert.match(markup, /role="combobox"/);
  assert.match(markup, /No students added to this class yet/);
  assert.doesNotMatch(markup, /Ana Cruz|Ben Santos|type="checkbox"/);
  assert.match(markup, /<input type="hidden" name="studentIds" value=""/);
  assert.match(markup, /<select[^>]*name="branchId"[^>]*required=""/);
  assert.ok(markup.includes(`<option value="${branches[0].id}">Main Branch</option>`));
});

test("Add and Edit class share a required semester dropdown that keeps saved values and never guesses a legacy term", () => {
  for (const mode of ["create", "edit"] as const) {
    for (const semester of ["", "FirstSemester", "SecondSemester", "NoLongerAvailable"]) {
      if (mode === "create" && semester) continue;
      const harness = formHarness();
      const sharedProps = { teachers, students, branches, programs, subjects };
      const props: Parameters<typeof classForms.ClassForm>[0] = mode === "edit"
        ? { mode, classId: "7", ...sharedProps, values: { ...values(), semester } }
        : { mode, ...sharedProps };
      let tree = harness.render(props);
      const select = elements(tree).find((element) => element.type === "select" && element.props.name === "semester");
      assert.ok(select);
      assert.equal(select.props.required, true);
      assert.equal(select.props.value, semester === "NoLongerAvailable" ? "" : semester);
      const markup = renderToStaticMarkup(select);
      assert.match(markup, /<option value="FirstSemester"[^>]*>1st Semester/);
      assert.match(markup, /<option value="SecondSemester"[^>]*>2nd Semester/);
      changeSelect(tree, "semester", "SecondSemester");
      tree = harness.render(props);
      assert.deepEqual(submittedValues(tree).getAll("semester"), ["SecondSemester"]);
      if (mode === "edit") assert.deepEqual(submittedValues(tree).getAll("studentIds"), ["", firstStudentId]);
    }
  }
  const state = { success: false, message: "Check the highlighted fields.", fieldErrors: { semester: "Select a valid semester." } };
  const tree = formHarness(state).render({ mode: "edit", classId: "7", teachers, students, branches, programs, subjects, values: { ...values(), semester: "SecondSemester" } });
  assert.equal(submittedValues(tree).get("semester"), "SecondSemester");
  assert.match(renderToStaticMarkup(tree), /aria-describedby="class-semester-error"/);
  assert.match(renderToStaticMarkup(tree), /Select a valid semester/);
});

test("class edit forms preserve branch IDs and require a new choice for unassigned or removed branches", () => {
  const assigned = formHarness().render({ mode: "edit", classId: "7", teachers, students, branches, programs, subjects, values: values() });
  assert.equal(submittedValues(assigned).get("branchId"), branches[0].id);
  for (const branchId of ["", "25"]) {
    const state = { success: false, message: "Choose an existing branch.", fieldErrors: { branchId: "This branch is no longer available." } };
    const tree = formHarness(state).render({ mode: "edit", classId: "7", teachers, students, branches, programs, subjects, values: { ...values(), branchId } });
    assert.equal(submittedValues(tree).get("branchId"), "");
    assert.match(renderToStaticMarkup(tree), /aria-describedby="class-branchId-error"/);
  }
  const noBranches = renderToStaticMarkup(formHarness().render({ mode: "create", teachers, students, programs, subjects, branches: [] }));
  assert.match(noBranches, /No saved branches are available/);
  assert.match(noBranches, /<button[^>]*disabled=""/);
});

test("class dropdowns filter programs by branch and subjects by program, and clear downstream choices", () => {
  const secondBranch = { id: "25", title: "City Branch" };
  const otherSubject = { id: "26", name: "Science", code: "SCI101" };
  const otherProgram = { id: "27", code: "STEM", label: "Science Track", programType: "SeniorHigh", branchIds: [secondBranch.id], subjectIds: [otherSubject.id] };
  const harness = formHarness();
  const props = { mode: "edit" as const, classId: "7", teachers, students, branches: [...branches, secondBranch], programs: [...programs, otherProgram], subjects: [...subjects, otherSubject], values: values() };
  let tree = harness.render(props);
  let markup = renderToStaticMarkup(tree);
  assert.match(markup, /name="programId"/);
  assert.match(markup, /name="subjectId"/);
  assert.match(markup, /IT101 — Computing/);
  assert.doesNotMatch(markup, /STEM — Science Track|SCI101 — Science|name="subjectName"/);
  changeSelect(tree, "branchId", secondBranch.id);
  tree = harness.render(props);
  assert.equal(submittedValues(tree).get("programId"), "");
  assert.equal(submittedValues(tree).get("subjectId"), "");
  assert.equal(submittedValues(tree).get("yearLevel"), "");
  assert.deepEqual(submittedValues(tree).getAll("studentIds"), ["", firstStudentId]);
  markup = renderToStaticMarkup(tree);
  assert.match(markup, /STEM — Science Track/);
  assert.doesNotMatch(markup, /BSIT — Information Technology|IT101 — Computing|SCI101 — Science/);
  changeSelect(tree, "programId", otherProgram.id);
  tree = harness.render(props);
  markup = renderToStaticMarkup(tree);
  assert.match(markup, /SCI101 — Science/);
  assert.match(markup, /<option value="Grade11">Grade 11/);
  assert.match(markup, /<option value="Grade12">Grade 12/);
  assert.doesNotMatch(markup, /<option value="FirstYear"|<option value="FourthYear"/);
  changeSelect(tree, "subjectId", otherSubject.id);
  changeSelect(tree, "yearLevel", "Grade12");
  tree = harness.render(props);
  assert.equal(submittedValues(tree).get("subjectId"), otherSubject.id);
  assert.equal(submittedValues(tree).get("yearLevel"), "Grade12");
  changeSelect(tree, "programId", "");
  tree = harness.render(props);
  assert.equal(submittedValues(tree).get("subjectId"), "");
  assert.equal(submittedValues(tree).get("yearLevel"), "");
});

test("legacy or removed program and subject selections require new choices instead of guessing", () => {
  for (const previous of [
    { ...values(), programId: "" },
    { ...values(), programId: "25" },
    { ...values(), branchId: "25" },
  ]) {
    const tree = formHarness().render({ mode: "edit", classId: "7", teachers, students, branches, programs, subjects, values: previous });
    const saved = submittedValues(tree);
    assert.equal(saved.get("programId"), "");
    assert.equal(saved.get("subjectId"), "");
    assert.equal(saved.get("yearLevel"), "");
    assert.deepEqual(saved.getAll("studentIds"), ["", firstStudentId]);
  }
  const removedSubject = formHarness().render({ mode: "edit", classId: "7", teachers, students, branches, programs, subjects, values: { ...values(), subjectId: "25" } });
  assert.equal(submittedValues(removedSubject).get("programId"), programs[0].id);
  assert.equal(submittedValues(removedSubject).get("subjectId"), "");
  assert.match(renderToStaticMarkup(removedSubject), /<button[^>]*disabled=""/);
});

test("empty class subject and program choices show links to the appropriate management pages", () => {
  const noOffering = formHarness().render({ mode: "edit", classId: "7", teachers, students, branches, programs: [], subjects, values: values() });
  const offeringMarkup = renderToStaticMarkup(noOffering);
  assert.match(offeringMarkup, /No programs are offered by this branch/);
  assert.match(offeringMarkup, /href="\/portal\/branch-programs"/);
  const noSubjects = formHarness().render({ mode: "edit", classId: "7", teachers, students, branches, programs: [{ ...programs[0], subjectIds: [] }], subjects, values: values() });
  const subjectMarkup = renderToStaticMarkup(noSubjects);
  assert.match(subjectMarkup, /This program has no assigned subjects/);
  assert.match(subjectMarkup, /href="\/portal\/subjects"/);
  assert.ok(subjectMarkup.includes(`href="/portal/programs/${programs[0].id}/subjects"`));
  assert.match(subjectMarkup, /<button[^>]*disabled=""/);
  const unavailable = formHarness({ success: false, message: "Select a subject.", fieldErrors: { programId: "Offering changed.", subjectId: "Subject changed." } }).render({ mode: "edit", classId: "7", teachers, students, branches, programs, subjects, values: values() });
  const markup = renderToStaticMarkup(unavailable);
  assert.match(markup, /aria-describedby="class-programId-error"/);
  assert.match(markup, /aria-describedby="class-subjectId-error"/);
});

test("student picker drafts preserve precise roster IDs and submit once through hidden fields", async () => {
  const harness = formHarness();
  const props = { mode: "edit" as const, classId: "9007199254740993", teachers, students, branches, programs, subjects, values: values() };
  let tree = harness.render(props);
  assert.deepEqual(Array.from(picker(tree).props.selectedIds as string[]), [firstStudentId]);
  assert.equal(picker(tree).props.students, students);
  assert.equal(picker(tree).props.disabled, false);
  assert.match(renderToStaticMarkup(tree), /Ana Cruz/);
  assert.match(renderToStaticMarkup(tree), /res\.cloudinary\.com\/synthetic\/image\/upload\/student\.png/);
  assert.doesNotMatch(renderToStaticMarkup(tree), /Ben Santos|type="checkbox"/);
  changeStudents(tree, [firstStudentId, secondStudentId]);
  tree = harness.render(props);
  assert.match(renderToStaticMarkup(tree), /Ana Cruz/);
  assert.match(renderToStaticMarkup(tree), /Ben Santos/);
  const data = submittedValues(tree);
  assert.deepEqual(data.getAll("studentIds"), ["", firstStudentId, secondStudentId]);
  assert.equal(data.get("teacherId"), teacherId);
  assert.equal(data.get("classId"), "9007199254740993");
  assert.equal(data.has("class-student-search"), false);
  await (tree.props.action as (data: FormData) => Promise<ClassFormState>)(data);
  assert.equal(harness.calls.length, 1);
  assert.equal(harness.calls[0].mode, "edit");
  assert.equal(harness.calls[0].data, data);
  assert.equal(harness.calls[0].previous.success, false);
  assert.deepEqual(Array.from(picker(tree).props.selectedIds as string[]), [firstStudentId, secondStudentId]);
});

test("Excel roster confirmation merges unique IDs into Add and Edit drafts without saving the class", async () => {
  for (const mode of ["create", "edit"] as const) {
    const harness = formHarness();
    const props: Parameters<typeof classForms.ClassForm>[0] = mode === "create"
      ? { mode, teachers, students, branches, programs, subjects }
      : { mode, classId: "9007199254740993", teachers, students, branches, programs, subjects, values: values() };
    let tree = harness.render(props);
    if (mode === "create") {
      changeSelect(tree, "branchId", branches[0].id);
      tree = harness.render(props);
      changeSelect(tree, "programId", programs[0].id);
      tree = harness.render(props);
      changeSelect(tree, "subjectId", subjects[0].id);
      changeSelect(tree, "semester", "SecondSemester");
      changeStudents(tree, [firstStudentId]);
      tree = harness.render(props);
    }
    const before = submittedValues(tree);
    const importer = elements(tree).find((element) => element.type === rosterImportDialog);
    assert.ok(importer, `${mode} shares the Excel roster importer`);
    assert.equal(importer.props.students, students);
    assert.equal(importer.props.disabled, false);
    assert.deepEqual(Array.from(importer.props.selectedIds as Iterable<string>), [firstStudentId]);
    (importer.props.onApply as (ids: string[]) => void)([firstStudentId, secondStudentId, secondStudentId]);
    tree = harness.render(props);
    const after = submittedValues(tree);
    assert.deepEqual(after.getAll("studentIds"), ["", firstStudentId, secondStudentId]);
    assert.deepEqual(Array.from(picker(tree).props.selectedIds as string[]), [firstStudentId, secondStudentId]);
    for (const field of ["classId", "teacherId", "branchId", "programId", "subjectId", "schoolYear", "semester", "sectionName", "yearLevel"]) {
      assert.equal(after.get(field), before.get(field), `Import preserves ${field} in ${mode}`);
    }
    assert.equal(harness.calls.length, 0, "Import only changes the draft roster");
    await (tree.props.action as (data: FormData) => Promise<ClassFormState>)(after);
    assert.equal(harness.calls.length, 1);
    assert.equal(harness.calls[0].mode, mode);
    assert.equal(harness.calls[0].data, after);
  }
});

test("removing the final assigned student sends an explicit empty roster and new classes need no student account", () => {
  const harness = formHarness();
  const props = { mode: "edit" as const, classId: "7", teachers, students, branches, programs, subjects, values: values() };
  changeStudents(harness.render(props), []);
  const cleared = harness.render(props);
  assert.deepEqual(submittedValues(cleared).getAll("studentIds"), [""]);
  assert.deepEqual(Array.from(picker(cleared).props.selectedIds as string[]), []);
  assert.doesNotMatch(renderToStaticMarkup(cleared), /Ana Cruz/);
  const empty = formHarness().render({ mode: "create", teachers, students: [], branches, programs, subjects });
  assert.deepEqual(submittedValues(empty).getAll("studentIds"), [""]);
  assert.match(renderToStaticMarkup(empty), /No saved students are available yet/);
  assert.match(renderToStaticMarkup(empty), /Add class/);
});

test("class roster validation errors stay visible with pending groups disabled and selections retained", () => {
  const harness = formHarness({ success: false, message: "Check the highlighted fields.", fieldErrors: { studentIds: "One selected student is unavailable.", teacherId: "Choose a teacher." } }, true);
  const tree = harness.render({ mode: "edit", classId: "7", teachers, students, branches, programs, subjects, values: values() });
  const markup = renderToStaticMarkup(tree);
  assert.match(markup, /aria-busy="true"/);
  assert.equal((markup.match(/<fieldset disabled=""/g) ?? []).length, 2);
  assert.match(markup, /id="class-studentIds-error" role="alert"/);
  assert.match(markup, /One selected student is unavailable/);
  assert.match(markup, /aria-describedby="class-teacherId-error"/);
  assert.match(markup, /<button[^>]*disabled=""/);
  assert.deepEqual(submittedValues(tree).getAll("studentIds"), ["", firstStudentId]);
  assert.equal(elements(tree).find((element) => element.type === rosterImportDialog)?.props.disabled, true);
  assert.equal(picker(tree).props.disabled, true);
  for (const effect of harness.effects) effect();
  assert.deepEqual(harness.navigation, []);
});

test("successful class additions and edits return to the management list and disable another save", () => {
  for (const mode of ["create", "edit"] as const) {
    const harness = formHarness({ success: true, message: "Saved." });
    const tree = harness.render(mode === "create"
      ? { mode, teachers, students, branches, programs, subjects }
      : { mode, classId: "7", teachers, students, branches, programs, subjects, values: values() });
    for (const effect of harness.effects) effect();
    assert.deepEqual(harness.navigation, ["/portal/classes"]);
    const markup = renderToStaticMarkup(tree);
    assert.equal((markup.match(/<fieldset disabled=""/g) ?? []).length, 2);
    assert.match(markup, /<button[^>]*disabled=""/);
  }
});

function optionsHarness(denied = false) {
  const events: string[] = [];
  const queries: Array<{ model: string; query: Record<string, unknown> }> = [];
  const { getClassFormOptions } = loadModule("../lib/classes/options.ts", {
    "@/lib/auth": { requireSuperAdmin: async () => { events.push("authorize"); if (denied) throw new Error("Superadmin required"); } },
    "@/lib/prisma": { prisma: {
      teacher: { findMany: async (query: Record<string, unknown>) => {
        events.push("teacher query"); queries.push({ model: "teacher", query });
        return [{ employeeId: BigInt(teacherId), employee: { firstName: "Maria", middleName: null, lastName: "Santos", suffix: null }, user: { email: "saved.teacher@example.com" } }];
      } },
      student: { findMany: async (query: Record<string, unknown>) => {
        events.push("student query"); queries.push({ model: "student", query });
        return [{ id: BigInt(firstStudentId), studentNumber: "0007", firstName: "Ana", middleName: null, lastName: "Cruz", suffix: null, userImage: students[0].userImage }];
      } },
      branch: { findMany: async (query: Record<string, unknown>) => {
        events.push("branch query"); queries.push({ model: "branch", query });
        return branches.map((branch) => ({ ...branch, id: BigInt(branch.id) }));
      } },
      program: { findMany: async (query: Record<string, unknown>) => {
        events.push("program query"); queries.push({ model: "program", query });
        return programs.map((program) => ({ id: BigInt(program.id), code: program.code, label: program.label, programType: program.programType, branchPrograms: program.branchIds.map((branchId) => ({ branchId: BigInt(branchId) })), programSubjects: program.subjectIds.map((subjectId) => ({ subjectId: BigInt(subjectId) })) }));
      } },
      subject: { findMany: async (query: Record<string, unknown>) => {
        events.push("subject query"); queries.push({ model: "subject", query });
        return subjects.map((subject) => ({ ...subject, id: BigInt(subject.id) }));
      } },
    } },
  }) as typeof classOptions;
  return { getClassFormOptions, events, queries };
}

test("class form options authorize the superadmin before any teacher or student database read", async () => {
  const harness = optionsHarness(true);
  await assert.rejects(harness.getClassFormOptions(), /Superadmin required/);
  assert.deepEqual(harness.events, ["authorize"]);
  assert.equal(harness.queries.length, 0);
});

test("class form options read verified Teacher profiles and only the saved student display fields", async () => {
  const harness = optionsHarness();
  const result = await harness.getClassFormOptions();
  assert.equal(harness.events[0], "authorize");
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { teachers, students: [students[0]], branches, programs, subjects });
  const teacher = harness.queries.find((entry) => entry.model === "teacher")!.query;
  const student = harness.queries.find((entry) => entry.model === "student")!.query;
  assert.deepEqual(JSON.parse(JSON.stringify(teacher.where)), { user: { role: "teacher", emailVerified: true } });
  assert.deepEqual(JSON.parse(JSON.stringify(teacher.select)), { employeeId: true, employee: { select: { firstName: true, middleName: true, lastName: true, suffix: true } }, user: { select: { email: true } } });
  assert.deepEqual(JSON.parse(JSON.stringify(student.select)), { id: true, studentNumber: true, firstName: true, middleName: true, lastName: true, suffix: true, userImage: true });
  const program = harness.queries.find((entry) => entry.model === "program")!.query;
  const subject = harness.queries.find((entry) => entry.model === "subject")!.query;
  assert.deepEqual(JSON.parse(JSON.stringify(program.select)), { id: true, code: true, label: true, programType: true, branchPrograms: { select: { branchId: true } }, programSubjects: { select: { subjectId: true } } });
  assert.deepEqual(JSON.parse(JSON.stringify(subject.select)), { id: true, name: true, code: true });
  assert.equal("where" in student, false, "Saved students are selectable without a linked user account");
  assert.doesNotMatch(JSON.stringify(harness.queries), /password|birthDate|address|government|contactNumber/);
});

function managementPageHarness(denied = false) {
  const events: string[] = [];
  const queries: Array<{ where?: { teacher: { user: { role: { not: string } } } }; select?: unknown }> = [];
  const records = [
    { id: 1n, role: "teacher", firstName: "Visible", lastName: "Teacher", email: "visible.teacher@example.com" },
    { id: 2n, role: "superAdmin", firstName: "Hidden", lastName: "Owner", email: "hidden.owner@example.com" },
    { id: 3n, role: "admin", firstName: "Ordinary", lastName: "Legacy Admin", email: "ordinary.admin@example.com" },
  ];
  const { default: ClassesManagementPage } = loadModule("../app/portal/classes/page.tsx", {
    "@/lib/auth": { requireSuperAdmin: async () => { events.push("authorize"); if (denied) throw new Error("Denied"); } },
    "@/lib/prisma": { prisma: {
      class: { findMany: async (query: (typeof queries)[number]) => {
        events.push("classes"); queries.push(query);
        return records.filter((record) => record.role !== query.where?.teacher.user.role.not)
          .map((record) => ({ id: record.id, schoolYear: "2026-2027", sectionName: "IT 1-A", yearLevel: "FirstYear", subjectName: "Computing", spreadsheetUrl: null,
            branch: { title: branches[0].title }, teacher: { employee: { firstName: record.firstName, lastName: record.lastName, middleName: null, suffix: null }, user: { email: record.email } }, _count: { students: 2 } }));
      } },
      teacher: { count: async (query: { where: { user: { role: string; emailVerified: boolean } } }) => {
        events.push("teacher count");
        assert.equal(query.where.user.role, "teacher");
        assert.equal(query.where.user.emailVerified, true);
        return 1;
      } },
    } },
    "./classes-table": { ClassesTable: ({ classes }: { classes: Array<{ id: string; teacherName: string; teacherEmail: string }> }) =>
      React.createElement("div", null, classes.map((record) => React.createElement("span", { key: record.id }, record.teacherName + " " + record.teacherEmail))) },
  }) as typeof managementPages;
  return { ClassesManagementPage, events, queries };
}

test("class management excludes legacy profiles linked to the hidden administrator before sending names or account emails to the client", async () => {
  const harness = managementPageHarness();
  const markup = renderToStaticMarkup(await harness.ClassesManagementPage());
  assert.equal(harness.events[0], "authorize");
  assert.equal(harness.queries[0].where?.teacher.user.role.not, "superAdmin");
  assert.match(markup, /Visible Teacher visible\.teacher@example\.com/);
  assert.match(markup, /Ordinary Legacy Admin ordinary\.admin@example\.com/);
  assert.doesNotMatch(markup, /Hidden Owner|hidden\.owner@example\.com/);
});

test("class management protects every list and count query before database access", async () => {
  const harness = managementPageHarness(true);
  await assert.rejects(harness.ClassesManagementPage(), /Denied/);
  assert.deepEqual(harness.events, ["authorize"]);
  assert.equal(harness.queries.length, 0);
});

function editPageHarness({ denied = false, missing = false, semester = "FirstSemester" as string | null } = {}) {
  const events: string[] = [];
  const form = () => null;
  const { default: EditClassPage } = loadModule("../app/portal/classes/[classId]/edit/page.tsx", {
    "@/lib/auth": { requireSuperAdmin: async () => { events.push("authorize"); if (denied) throw new Error("Superadmin required"); } },
    "@/lib/classes/validation": { parseClassId },
    "@/lib/classes/options": { getClassFormOptions: async () => { events.push("options"); return { teachers, students, branches, programs, subjects }; } },
    "@/lib/prisma": { prisma: { class: { findUnique: async (query: { where: { id: bigint }; select: Record<string, unknown> }) => {
      events.push("class query");
      assert.equal(query.where.id, 9007199254740993n);
      assert.deepEqual(JSON.parse(JSON.stringify(query.select.students)), { select: { studentId: true } });
      assert.equal(query.select.semester, true);
      return missing ? null : { id: query.where.id, ...values(), semester, subjectName: "Computing", branchId: BigInt(branches[0].id), programId: BigInt(programs[0].id), subjectId: BigInt(subjects[0].id), teacherId: BigInt(teacherId), students: [{ studentId: BigInt(firstStudentId) }] };
    } } } },
    "next/navigation": { notFound: () => { throw new Error("Not found"); } },
    "../../class-form": { ClassForm: form },
  }) as typeof editPages;
  return { EditClassPage, events, form };
}

test("edit class pages hydrate the joined student IDs and employee Teacher key as precise client strings", async () => {
  const harness = editPageHarness();
  const tree = await harness.EditClassPage({ params: Promise.resolve({ classId: "9007199254740993" }) });
  assert.equal(harness.events[0], "authorize");
  const form = elements(tree).find((element) => element.type === harness.form);
  assert.ok(form);
  assert.equal(form.props.classId, "9007199254740993");
  assert.deepEqual(JSON.parse(JSON.stringify(form.props.values)), values());
  assert.equal(form.props.students, students);
  const denied = editPageHarness({ denied: true });
  await assert.rejects(denied.EditClassPage({ params: Promise.resolve({ classId: "9007199254740993" }) }), /Superadmin required/);
  assert.deepEqual(denied.events, ["authorize"]);
  const invalid = editPageHarness();
  await assert.rejects(invalid.EditClassPage({ params: Promise.resolve({ classId: "not-an-id" }) }), /Not found/);
  assert.deepEqual(invalid.events, ["authorize"]);
  const missing = editPageHarness({ missing: true });
  await assert.rejects(missing.EditClassPage({ params: Promise.resolve({ classId: "9007199254740993" }) }), /Not found/);
});

test("editing a class with an unassigned semester leaves the selection blank while preserving its student roster", async () => {
  const harness = editPageHarness({ semester: null });
  const tree = await harness.EditClassPage({ params: Promise.resolve({ classId: "9007199254740993" }) });
  const form = elements(tree).find((element) => element.type === harness.form);
  assert.ok(form);
  assert.deepEqual(JSON.parse(JSON.stringify(form.props.values)), { ...values(), semester: "" });
});

test("teacher detail renders a saved roster independently of spreadsheet errors and sends only display fields to the client table", async () => {
  const calls: string[] = [];
  const roster = () => React.createElement("div", { "data-roster": true });
  const student = { id: BigInt(firstStudentId), firstName: "Ana", middleName: null, lastName: "Cruz", suffix: null, studentNumber: "0007", email: "private@example.com", birthDate: "private-date" };
  const { default: ClassSummaryPage } = loadModule("../app/portal/my-classes/[classId]/page.tsx", {
    "@/lib/classes/teacher": { getAssignedClass: async (id: string) => {
      calls.push("authorized class " + id);
      return id === "7" ? { id: 7n, ...values(), branch: { title: "Main Branch" }, spreadsheetUrl: "https://docs.google.com/spreadsheets/d/test/edit", students: [{ student }] } : null;
    } },
    "@/lib/classes/spreadsheet": {
      getClassSummary: async () => { calls.push("spreadsheet"); return { success: false, message: "Sharing is unavailable." }; },
      getClassworkCatalog: async () => { calls.push("classwork"); return { success: false, message: "Classwork is unavailable." }; },
    },
    "@/lib/classes/validation": { normalizeSpreadsheetUrl: (value: string) => value },
    "next/navigation": { notFound: () => { throw new Error("Not found"); } },
    "../class-roster-table": { ClassRosterTable: roster },
    "../spreadsheet-connection-card": { SpreadsheetConnectionCard: () => null },
    "../student-summary-table": { StudentSummaryTable: () => null },
  }) as typeof summaryPages;
  const tree = await ClassSummaryPage({ params: Promise.resolve({ classId: "7" }) });
  const workspace = elements(tree).find((element) => element.type === WorkspaceTabs);
  assert.ok(workspace);
  const table = elements(workspace.props.students as React.ReactNode).find((element) => element.type === roster);
  assert.ok(table);
  assert.deepEqual(JSON.parse(JSON.stringify(table.props.students)), [{ id: firstStudentId, name: "Ana Cruz", studentNumber: "0007" }]);
  const markup = renderToStaticMarkup(React.createElement(React.Fragment, null, tree, workspace.props.students as React.ReactNode, workspace.props.grades as React.ReactNode));
  assert.match(markup, /aria-label="Saved class roster"/);
  assert.match(markup, /Class roster/);
  assert.match(markup, /Main Branch/);
  assert.match(markup, /role="tab"[^>]*>Students/);
  assert.match(markup, /role="tab"[^>]*>Grades/);
  assert.match(markup, /href="\/portal\/my-classes\/7\?tab=grades"/);
  assert.match(markup, /Sharing is unavailable/);
  assert.doesNotMatch(markup, /private@example.com|private-date/);
  assert.deepEqual(calls, ["authorized class 7", "spreadsheet", "classwork"]);
  const refreshed = await ClassSummaryPage({ params: Promise.resolve({ classId: "7" }), searchParams: Promise.resolve({ tab: "grades" }) });
  assert.equal(elements(refreshed).find((element) => element.type === WorkspaceTabs)?.props.defaultTab, "grades");
  await assert.rejects(ClassSummaryPage({ params: Promise.resolve({ classId: "other-class" }) }), /Not found/);
  assert.deepEqual(calls, ["authorized class 7", "spreadsheet", "classwork", "authorized class 7", "spreadsheet", "classwork", "authorized class other-class"]);
});

test("class roster tables retain leading-zero numbers and unnumbered students with search, safe names and an empty state", () => {
  const { ClassRosterTable } = loadModule("../app/portal/my-classes/class-roster-table.tsx", {}) as typeof rosterTables;
  const markup = renderToStaticMarkup(React.createElement(ClassRosterTable, { students: [students[0], { ...students[1], name: "Ben <script>private</script> Santos" }] }));
  assert.match(markup, /Search class roster/);
  assert.match(markup, /0007/);
  assert.match(markup, /Not assigned/);
  assert.match(markup, /Ben &lt;script&gt;private&lt;\/script&gt; Santos/);
  assert.doesNotMatch(markup, /<script>|Birth|Email|Address|Password/);
  const empty = renderToStaticMarkup(React.createElement(ClassRosterTable, { students: [] }));
  assert.match(empty, /No students assigned yet/);
});
