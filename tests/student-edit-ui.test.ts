import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

import * as studentFields from "../lib/admission/student-fields";
import * as academicLevels from "../lib/academic-levels";
import * as utils from "../lib/utils";
import type { AdmittedStudentEditOptions, AdmittedStudentEditRecord } from "../app/portal/admission/admitted-student-form";
import { loadPortalFeedback } from "./portal-feedback-harness";

type ActionState = { success: boolean; message: string };
type Props = Record<string, unknown> & { children?: React.ReactNode };
type Element = React.ReactElement<Props>;
type ControlProps = Props & {
  name: string;
  value: string;
  onChange: (event: { target: { value: string } }) => void;
  onBlur: (event: { currentTarget: { value: string } }) => void;
};

const source = ts.transpileModule(readFileSync(new URL("../app/portal/admission/admitted-student-form.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function fixture(): AdmittedStudentEditRecord {
  return {
    ...Object.fromEntries(studentFields.studentUpdateFields.map((field) => [field, ""])),
    studentId: "9007199254740993", applicationId: "9007199254740995", studentNumber: "stuAb12",
    applicantType: "new", branchId: "1", programId: "2", academicLevel: "FirstYear",
    firstName: " <b>maria</b> luz ", lastName: " de la cruz ", middleName: " McDonald ", suffix: " jr. ",
    birthDate: "2008-02-29", gender: "Female", civilStatus: "Single", citizenship: " filipino ",
    birthplace: " quezon city ", religion: " roman catholic ", email: " MARIA@Example.COM ", phone: "09171234567",
    facebookAccount: "https://facebook.com/Maria.User", addressHouseNumber: "12b", addressPostalCode: "0010",
    addressStreet: " main street ", addressBarangay: " central ", addressCity: " manila ", addressProvince: " metro manila ",
    guardianFirstName: " ana ", guardianLastName: " de la cruz ", guardianRelationship: " mother ",
    guardianContactNumber: "09171234567", guardianOccupation: " software developer ",
    lastSchoolName: " central school ", lastSchoolShortName: " CSHS ", lastSchoolId: "idAb12", lastSchoolType: "Public",
    lastSchoolBarangay: " west ", lastSchoolCity: " quezon city ", lastSchoolProvince: " metro manila ",
    lastSchoolYear: " 2025 to 2026 ", lastSchoolYearLevel: " grade 12 ",
  } as AdmittedStudentEditRecord;
}

function options(): AdmittedStudentEditOptions {
  return {
    branches: [{ id: "1", title: "Main Campus" }, { id: "4", title: "Other Campus" }],
    programs: [
      { id: "2", code: "BSIT", label: "Information Technology", programType: "Bachelor" },
      { id: "3", code: "SHS", label: "Senior High", programType: "SeniorHigh" },
    ],
    academicLevels: [...academicLevels.academicLevelOptions],
  };
}

function harness(initialState: ActionState = { success: false, message: "" }, initialPending = false) {
  let state = initialState;
  let pending = initialPending;
  let scope = "";
  let slot = 0;
  let effects: Array<() => void | (() => void)> = [];
  const stateByScope = new Map<string, unknown[]>();
  const events: string[] = [];
  const usedActions: unknown[] = [];
  const unusedAction = async () => assert.fail("Rendering student edits must not write records");

  function stateHook(initial: unknown) {
    const values = stateByScope.get(scope) ?? [];
    stateByScope.set(scope, values);
    const index = slot++;
    if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
    return [values[index], (next: unknown) => {
      values[index] = typeof next === "function" ? next(values[index]) : next;
    }];
  }

  function native(tag: string) {
    return function Native(props: Props) {
      const attributes = { ...props };
      delete attributes.asChild;
      return React.createElement(tag, attributes);
    };
  }
  const router = { push: (path: string) => events.push(`navigate:${path}`) };
  const modules: Record<string, unknown> = {
    react: {
      ...React,
      useState: stateHook,
      useRef: (initial: unknown) => stateHook({ current: initial })[0],
      useActionState: (action: unknown) => { usedActions.push(action); return [state, unusedAction, pending]; },
      useEffect: (effect: () => void | (() => void)) => effects.push(effect),
    },
    "react/jsx-runtime": jsxRuntime,
    "next/link": { default: native("a") },
    "next/navigation": { useRouter: () => router },
    "lucide-react": {},
    "@/app/portal/admission/actions": { addAdmittedStudentAction: unusedAction, editAdmittedStudentAction: unusedAction, bulkAdmitStudentsAction: unusedAction },
    "@/app/portal/admission/admission-ui": { AdmissionField: native("label"), AdmissionSelect: native("select"), AdmissionModal: native("div") },
    "@/components/portal/profile-image-field": { ProfileImageField: () => null },
    "@/components/ui/button": { Button: native("button") },
    "@/components/ui/input": { Input: native("input") },
    "@/lib/admission/student-fields": studentFields,
    "@/lib/academic-levels": academicLevels,
    "@/lib/utils": utils,
  };
  modules["@/components/portal/toasts"] = loadPortalFeedback(modules.react as Record<string, unknown>, router,
    (message, variant) => events.push(`toast:${variant}:${message}`));
  const loaded = { exports: {} };
  runInNewContext(source, { module: loaded, exports: loaded.exports, require: (name: string) => {
    assert.ok(name in modules, `Unexpected student edit dependency: ${name}`);
    return modules[name];
  } });
  const { EditAdmittedStudentForm: EditForm } = loaded.exports as {
    EditAdmittedStudentForm: React.ComponentType<{
      student: AdmittedStudentEditRecord; options: AdmittedStudentEditOptions;
      returnTo?: "/portal/admission" | "/portal/students";
      action?: (previous: ActionState, formData: FormData) => Promise<ActionState>;
      allowIncomplete?: boolean;
    }>;
  };

  function resolve(node: React.ReactNode, key: string): React.ReactNode {
    if (Array.isArray(node)) return node.map((child, index) => {
      const resolved = resolve(child, `${key}.${index}`);
      return React.isValidElement(resolved) ? React.cloneElement(resolved, { key: resolved.key ?? `${key}.${index}` }) : resolved;
    });
    if (!React.isValidElement<Props>(node)) return node;
    if (typeof node.type === "function") {
      const previousScope = scope;
      const previousSlot = slot;
      scope = key;
      slot = 0;
      const result = (node.type as (props: Props) => React.ReactNode)(node.props);
      scope = previousScope;
      slot = previousSlot;
      return resolve(result, `${key}.component`);
    }
    return React.cloneElement(node, undefined, resolve(node.props.children, `${key}.children`));
  }

  return {
    events, usedActions,
    setResult(next: ActionState, saving = false) { state = next; pending = saving; },
    render(student = fixture(), props: Pick<React.ComponentProps<typeof EditForm>, "returnTo" | "action" | "allowIncomplete"> = {}) {
      effects = [];
      return resolve(React.createElement(EditForm, { student, options: options(), ...props }), "edit") as Element;
    },
    flushEffects() {
      const cleanups = effects.map((effect) => effect()).filter((cleanup): cleanup is () => void => typeof cleanup === "function");
      return () => { for (const cleanup of cleanups) cleanup(); };
    },
  };
}

function elements(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Props>(node)) return [];
  return [node, ...elements(node.props.children)];
}

function control(tree: Element, name: string) {
  const found = elements(tree).find((element) => element.props.name === name);
  assert.ok(found, `Missing student control ${name}`);
  return found as React.ReactElement<ControlProps>;
}

test("student edits display sanitized capitalized profile text and preserve exact identifiers and select values", () => {
  const student = fixture();
  const form = harness();
  const tree = form.render(student);
  for (const [name, expected] of Object.entries({
    firstName: "Maria Luz", lastName: "De La Cruz", middleName: "McDonald", suffix: "Jr.", citizenship: "Filipino",
    birthplace: "Quezon City", religion: "Roman Catholic", email: "maria@example.com", addressStreet: "Main Street",
    addressCity: "Manila", guardianFirstName: "Ana", guardianLastName: "De La Cruz", guardianRelationship: "Mother",
    guardianOccupation: "Software Developer", lastSchoolName: "Central School", lastSchoolYearLevel: "Grade 12",
    lastSchoolShortName: "CSHS", studentNumber: "stuAb12", lastSchoolId: "idAb12", addressHouseNumber: "12b",
    addressPostalCode: "0010", phone: "09171234567", facebookAccount: "https://facebook.com/Maria.User",
    gender: "Female", civilStatus: "Single", lastSchoolType: "Public", lastSchoolYear: " 2025 to 2026 ",
  })) assert.equal(control(tree, name).props.value, expected, name);
  for (const name of ["firstName", "addressCity", "guardianOccupation", "lastSchoolName"]) {
    assert.equal(control(tree, name).props.autoCapitalize, "words", name);
  }
  for (const name of ["email", "studentNumber", "lastSchoolId", "phone", "facebookAccount", "addressHouseNumber"]) {
    assert.equal(control(tree, name).props.autoCapitalize, "none", name);
  }
  assert.equal(control(tree, "email").props.spellCheck, false);
  assert.equal(student.firstName, " <b>maria</b> luz ");
  form.flushEffects();
  assert.deepEqual(form.events, []);
});

test("only admission edits can save incomplete details while keeping native validation for provided values", () => {
  const form = harness();
  let tree = form.render(fixture(), { allowIncomplete: true });
  assert.notEqual(tree.props.noValidate, true, "Provided email and date values must retain browser validation");
  const controls = elements(tree).filter((element) => ["input", "select"].includes(String(element.type)));
  assert.ok(controls.length > 30, "The complete student editor must still render");
  assert.equal(controls.some((element) => Boolean(element.props.required)), false);
  assert.equal(elements(tree).some((element) => element.type === "label" && Boolean(element.props.required)), false);
  assert.equal(control(tree, "email").props.type, "email");
  assert.equal(control(tree, "birthDate").props.type, "date");
  for (const element of controls.filter((item) => item.type === "select")) {
    const emptyChoice = elements(element.props.children).find((option) => option.type === "option" && option.props.value === "");
    assert.ok(emptyChoice, `${element.props.name} needs a blank option`);
    assert.notEqual(emptyChoice.props.disabled, true, `${element.props.name} must allow its blank option`);
  }
  assert.match(renderToStaticMarkup(tree), /Save the details you have now/);
  assert.match(renderToStaticMarkup(tree), /saved type, or Other for a new school/);
  assert.equal(control(tree, "lastSchoolType").props["aria-describedby"], "student-school-type-9007199254740995");
  control(tree, "programId").props.onChange({ target: { value: "" } });
  control(tree, "gender").props.onChange({ target: { value: "" } });
  control(tree, "email").props.onChange({ target: { value: "" } });
  tree = form.render(fixture(), { allowIncomplete: true });
  assert.equal(control(tree, "programId").props.value, "");
  assert.equal(control(tree, "academicLevel").props.value, "FirstYear", "Keeping the current program must retain its available academic level");
  assert.equal(control(tree, "gender").props.value, "");
  assert.doesNotMatch(renderToStaticMarkup(tree), /sign-in email will also change/);
  assert.equal(elements(tree).find((element) => element.type === "button" && element.props.type === "submit")?.props.disabled, false);
});

test("Manage Students and default student editors retain required inputs, labels and selection guards", () => {
  for (const props of [{}, { returnTo: "/portal/students" as const }]) {
    const tree = harness().render(fixture(), props);
    for (const name of ["studentNumber", "email", "firstName", "lastName", "birthDate", "gender", "phone", "addressCity", "guardianFirstName", "lastSchoolName", "lastSchoolType", "lastSchoolYear", "applicantType", "branchId", "programId", "academicLevel"]) {
      assert.equal(control(tree, name).props.required, true, name);
    }
    assert.ok(elements(tree).some((element) => element.type === "label" && Boolean(element.props.required)));
    for (const name of ["gender", "lastSchoolType", "lastSchoolYear"]) {
      const emptyChoice = elements(control(tree, name).props.children).find((option) => option.type === "option" && option.props.value === "");
      assert.equal(emptyChoice?.props.disabled, true, name);
    }
    assert.doesNotMatch(renderToStaticMarkup(tree), /Save the details you have now/);
  }
});

test("student edit text updates stay editable and normalize on blur without changing URL or identifier casing", () => {
  const form = harness();
  let tree = form.render();
  control(tree, "firstName").props.onChange({ target: { value: " <i>luz</i>  reyes " } });
  tree = form.render();
  assert.equal(control(tree, "firstName").props.value, " <i>luz</i>  reyes ");
  for (const [name, raw] of Object.entries({
    firstName: " <i>luz</i>  reyes ", guardianOccupation: " web developer ", email: " LUZ@Example.COM ",
    facebookAccount: " https://facebook.com/Luz.User ", studentNumber: " stuAb34 ", lastSchoolId: " idCd34 ",
    addressHouseNumber: " 12b ", phone: " 09171234567 ", lastSchoolShortName: " SHS ", middleName: " McDonald ",
  })) control(tree, name).props.onBlur({ currentTarget: { value: raw } });
  tree = form.render();
  for (const [name, expected] of Object.entries({
    firstName: "Luz Reyes", guardianOccupation: "Web Developer", email: "luz@example.com",
    facebookAccount: "https://facebook.com/Luz.User", studentNumber: "stuAb34", lastSchoolId: "idCd34",
    addressHouseNumber: "12b", phone: "09171234567", lastSchoolShortName: "SHS", middleName: "McDonald",
  })) assert.equal(control(tree, name).props.value, expected, name);
});

test("student and guardian N/A suffix entries become empty optional controls", () => {
  const form = harness();
  let tree = form.render({ ...fixture(), suffix: " N/a ", guardianSuffix: "<b>n/a</b>" });
  assert.equal(control(tree, "suffix").props.value, "");
  assert.equal(control(tree, "guardianSuffix").props.value, "");
  control(tree, "suffix").props.onBlur({ currentTarget: { value: "n/A" } });
  control(tree, "guardianSuffix").props.onBlur({ currentTarget: { value: " N/A " } });
  tree = form.render();
  assert.equal(control(tree, "suffix").props.value, "");
  assert.equal(control(tree, "guardianSuffix").props.value, "");
});

test("student email changes explain account verification while equivalent casing changes need no warning", () => {
  const form = harness();
  let tree = form.render();
  assert.doesNotMatch(renderToStaticMarkup(tree), /sign-in email will also change/);
  control(tree, "email").props.onChange({ target: { value: " MARIA@EXAMPLE.COM " } });
  tree = form.render();
  assert.doesNotMatch(renderToStaticMarkup(tree), /sign-in email will also change/);
  control(tree, "email").props.onChange({ target: { value: "new@example.test" } });
  tree = form.render();
  const markup = renderToStaticMarkup(tree);
  assert.match(markup, /sign-in email will also change/);
  assert.match(markup, /must be verified before portal access/);
  assert.equal(control(tree, "email").props["aria-describedby"], "student-email-change-9007199254740995");
});

test("failed student saves retain profile and admission choices and keep the edit page open", () => {
  const form = harness();
  let tree = form.render();
  control(tree, "firstName").props.onBlur({ currentTarget: { value: " luz changed " } });
  control(tree, "applicantType").props.onChange({ target: { value: "existing" } });
  control(tree, "branchId").props.onChange({ target: { value: "4" } });
  control(tree, "programId").props.onChange({ target: { value: "3" } });
  tree = form.render();
  assert.equal(control(tree, "academicLevel").props.value, "");
  control(tree, "academicLevel").props.onChange({ target: { value: "Grade11" } });
  control(tree, "lastSchoolYear").props.onChange({ target: { value: "2026-2027" } });
  form.setResult({ success: false, message: "Check required fields." });
  tree = form.render();
  form.flushEffects();
  for (const [name, expected] of Object.entries({
    firstName: "Luz Changed", applicantType: "existing", branchId: "4", programId: "3", academicLevel: "Grade11", lastSchoolYear: "2026-2027",
  })) assert.equal(control(tree, name).props.value, expected, name);
  assert.deepEqual(form.events, ["toast:error:Check required fields."]);
  const fieldset = elements(tree).find((element) => element.type === "fieldset");
  assert.equal(fieldset?.props.disabled, false);
});

test("student edit forms cancel native resets after failed saves and remove the listener when unmounted", () => {
  const form = harness();
  let tree = form.render();
  const ref = tree.props.ref as React.RefObject<EventTarget | null> | undefined;
  assert.ok(ref, "The reset guard must attach to the rendered edit form");
  const target = new EventTarget();
  ref.current = target;
  const cleanup = form.flushEffects();

  form.setResult({ success: false, message: "Check required fields." });
  tree = form.render();
  assert.equal(tree.props.ref, ref, "The form ref must remain stable after the action result");
  const reset = new Event("reset", { cancelable: true });
  assert.equal(target.dispatchEvent(reset), false);
  assert.equal(reset.defaultPrevented, true, "Native form resets must not clear the current select values");
  const unrelated = new Event("change", { cancelable: true });
  assert.equal(target.dispatchEvent(unrelated), true);

  cleanup();
  const afterUnmount = new Event("reset", { cancelable: true });
  assert.equal(target.dispatchEvent(afterUnmount), true);
  assert.equal(afterUnmount.defaultPrevented, false, "The old form must no longer retain its reset listener");
});

test("successful student saves notify before returning to admissions and lock further edits", () => {
  const form = harness({ success: true, message: "Student details updated." });
  const tree = form.render();
  form.flushEffects();
  assert.deepEqual(form.events, ["toast:success:Student details updated.", "navigate:/portal/admission"]);
  assert.equal(elements(tree).find((element) => element.type === "fieldset")?.props.disabled, true);
  assert.equal(elements(tree).find((element) => element.type === "button" && element.props.type === "submit")?.props.disabled, true);
});

test("Manage Students reuses the full editor with its scoped action and returns to its own parent after save", () => {
  const action = async () => ({ success: true, message: "Student details updated." });
  const form = harness({ success: true, message: "Student details updated." });
  const tree = form.render(fixture(), { returnTo: "/portal/students", action });
  form.flushEffects();
  assert.equal(form.usedActions[0], action);
  assert.deepEqual(form.events, ["toast:success:Student details updated.", "navigate:/portal/students"]);
  assert.equal(elements(tree).find((element) => element.type === "a" && element.props.children === "Back")?.props.href, "/portal/students");
  for (const name of ["firstName", "studentNumber", "email", "addressCity", "guardianFirstName", "lastSchoolName", "programId", "academicLevel"]) {
    assert.ok(control(tree, name));
  }
});

test("pending student saves disable all editable details while preserving raw hidden database IDs", () => {
  const form = harness({ success: false, message: "" }, true);
  const tree = form.render();
  assert.equal(tree.props["aria-busy"], true);
  const fieldsets = elements(tree).filter((element) => element.type === "fieldset");
  assert.equal(fieldsets.length, 1);
  assert.equal(fieldsets[0].props.disabled, true);
  const groupedFields = elements(fieldsets[0]);
  for (const name of ["firstName", "branchId", "guardianFirstName", "addressCity", "lastSchoolName"]) {
    assert.ok(groupedFields.some((element) => element.props.name === name), name);
  }
  for (const [name, expected] of [["studentId", "9007199254740993"], ["applicationId", "9007199254740995"]]) {
    assert.equal(control(tree, name).props.type, "hidden");
    assert.equal(control(tree, name).props.value, expected);
  }
  assert.match(renderToStaticMarkup(tree), /Saving\.\.\./);
  form.flushEffects();
  assert.deepEqual(form.events, []);
});
