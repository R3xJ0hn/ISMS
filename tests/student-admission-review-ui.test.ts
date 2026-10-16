import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import ts from "typescript";

import * as fieldComponents from "../app/(public)/admission/components/form-fields";
import * as formSchema from "../app/(public)/admission/components/form-schema";
import * as studentFields from "../lib/admission/student-fields";
import type { StudentAdmissionReviewRecord, StudentAdmissionReviewState } from "../lib/admission/student-review";
import { loadPortalFeedback } from "./portal-feedback-harness";

type Props = Record<string, unknown> & { children?: React.ReactNode };
type Element = React.ReactElement<Props>;

function fixture(): StudentAdmissionReviewRecord {
  return {
    applicationId: "9007199254740993", studentNumber: "0007", branch: "Main Campus", program: "BSIT", academicLevel: "First Year", status: "reviewing",
    lastSchoolRecordId: "41",
    profile: {
      ...Object.fromEntries(studentFields.studentUpdateFields.map((field) => [field, ""])),
      firstName: " <b>maria</b> luz ", lastName: " santos ", email: " MARIA@Example.test ", birthDate: "2008-02-29",
      addressCity: " manila ", suffix: "n/a", lastSchoolId: "school-hidden", lastSchoolHouseNumber: "school-house-hidden",
      lastSchoolSubdivision: "school-village-hidden", lastSchoolStreet: "School Road", lastSchoolYear: "2024-2025",
      lastSchoolName: "Central School", lastSchoolType: "Public", lastSchoolBarangay: "Central", lastSchoolCity: "Manila", lastSchoolProvince: "Metro Manila",
      lastSchoolYearLevel: "Grade 12", lastSchoolGraduationDate: "2025-03-31",
    } as Record<studentFields.StudentUpdateField, string>,
  };
}

function load<T>(file: string, modules: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  runInNewContext(code, { module: loaded, exports: loaded.exports, require: (name: string) => {
    assert.ok(name in modules, `Unexpected admission-review dependency: ${name}`);
    return modules[name];
  } });
  return loaded.exports as T;
}

function elements(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Props>(node)) return [];
  return [node, ...elements(node.props.children)];
}

const catalog = [
  { id: "41", schoolName: "Central School", shortName: "CS", schoolType: "Public", schoolId: "old-school-id", address: { houseNumber: "41B", subdivision: "Old Village", street: "School Road", barangay: "Central", city: "Manila", province: "Metro Manila", postalCode: "1000" }, formattedAddress: "Central, Manila" },
  { id: "42", schoolName: "West Academy", shortName: "WA", schoolType: "Private", schoolId: "new-school-id", address: { houseNumber: "42B", subdivision: "West Village", street: "West Road", barangay: "West", city: "Makati", province: "Metro Manila", postalCode: "1200" }, formattedAddress: "West, Makati" },
];

function harness(record = fixture()) {
  let slot = 0;
  let state: StudentAdmissionReviewState = { success: false, message: "" };
  let pending = false;
  let effects: Array<() => void | (() => void)> = [];
  const values: unknown[] = [];
  const events: string[] = [];
  const action = async () => assert.fail("Rendering a review must not save data");
  const stateHook = (initial: unknown) => {
    const index = slot++;
    if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
    return [values[index], (next: unknown) => { values[index] = typeof next === "function" ? next(values[index]) : next; }];
  };
  const hooks = {
    ...React, useState: stateHook, useRef: (initial: unknown) => stateHook({ current: initial })[0],
    useId: () => "review-last-school-list",
    useActionState: (usedAction: unknown) => { assert.equal(usedAction, action); return [state, action, pending]; },
    useEffect: (effect: () => void | (() => void)) => effects.push(effect),
  };
  const router = { push: (path: string) => events.push(`navigate:${path}`), refresh: () => events.push("refresh") };
  const schoolPicker = load("../app/(public)/admission/components/last-school-step.tsx", {
    react: hooks, "react/jsx-runtime": jsxRuntime, "lucide-react": icons,
    "./form-fields": fieldComponents, "./form-schema": formSchema,
    "../actions": { getAdmissionLastSchools: async () => ({ schools: catalog }) },
  });
  const loaded = load<{ default: (props: { student: StudentAdmissionReviewRecord }) => Element }>("../app/portal/admission-review/review-form.tsx", {
    react: hooks, "react/jsx-runtime": jsxRuntime,
    "next/link": { default: (props: Props) => React.createElement("a", props) },
    "@/app/(public)/admission/components/form-fields": fieldComponents,
    "@/app/(public)/admission/components/last-school-step": schoolPicker,
    "@/app/(public)/admission/components/form-schema": formSchema,
    "@/components/ui/button": { Button: (props: Props) => React.createElement("button", props) },
    "@/components/portal/toasts": loadPortalFeedback(hooks, router, (message, variant) => events.push(`toast:${variant}:${message}`)),
    "@/lib/admission/student-fields": studentFields,
    "./actions": { saveStudentAdmissionReviewAction: action },
  });
  function resolve(node: React.ReactNode): React.ReactNode {
    if (Array.isArray(node)) return node.map((child, index) => {
      const result = resolve(child);
      return React.isValidElement(result) ? React.cloneElement(result, { key: result.key ?? index }) : result;
    });
    if (!React.isValidElement<Props>(node)) return node;
    if (typeof node.type === "function") return resolve((node.type as (props: Props) => React.ReactNode)(node.props));
    return React.cloneElement(node, undefined, resolve(node.props.children));
  }
  return {
    events,
    render() { slot = 0; effects = []; return resolve(loaded.default({ student: record })) as Element; },
    setResult(result: StudentAdmissionReviewState, saving = false) { state = result; pending = saving; },
    flushEffects() { const cleanups = effects.map((effect) => effect()); return () => cleanups.forEach((cleanup) => cleanup?.()); },
  };
}

function control(tree: Element, id: string) {
  const found = elements(tree).find((element) => element.props.id === id && ["input", "select"].includes(String(element.type)));
  assert.ok(found, `Missing ${id} control`);
  return found;
}

function submittedValue(tree: Element, name: string) {
  const field = elements(tree).find((element) => element.type === "input" && element.props.name === name);
  assert.ok(field, `Missing submitted ${name}`);
  return field.props.value;
}

function chooseSchool(tree: Element, id: string) {
  const option = elements(tree).find((element) => element.props.role === "option" && element.props.id === `review-last-school-list-${id}`);
  assert.ok(option, `Missing school option ${id}`);
  (option.props.onClick as () => void)();
}

async function loadSchools(form: ReturnType<typeof harness>) {
  const tree = form.render();
  form.flushEffects();
  await new Promise<void>((resolve) => setImmediate(resolve));
  (control(tree, "last-school-search").props.onFocus as () => void)();
  return form.render();
}

test("student review shows sanitized personal details and keeps login/enrollment metadata out of submitted controls", () => {
  const tree = harness().render();
  assert.equal(control(tree, "firstName").props.value, "Maria Luz");
  assert.equal(control(tree, "addressCity").props.value, "Manila");
  assert.equal(control(tree, "suffix").props.value, "");
  const email = control(tree, "email");
  assert.equal(email.props.value, "maria@example.test");
  assert.equal(email.props.readOnly, true);
  assert.equal(email.props.name, undefined);
  const names = elements(tree).map((element) => element.props.name);
  const applicationId = elements(tree).find((element) => element.props.name === "applicationId");
  assert.equal(applicationId?.props.type, "hidden");
  assert.equal(applicationId?.props.value, "9007199254740993");
  for (const name of ["studentId", "studentNumber", "branchId", "programId", "academicLevel", "lastSchoolId", "lastSchoolHouseNumber", "lastSchoolSubdivision"]) {
    assert.ok(!names.includes(name), `${name} must come from the authenticated saved record`);
  }
  const markup = renderToStaticMarkup(tree);
  assert.match(markup, /Contact the registrar/);
  assert.match(markup, /Saving updates keeps your admission under review/);
  assert.doesNotMatch(markup, /school-hidden|school-house-hidden|school-village-hidden/);
  assert.equal(submittedValue(tree, "lastSchoolRecordId"), "41");
  assert.equal(control(tree, "last-school-search").props.value, "Central School");
  assert.equal(control(tree, "last_school_name").props.readOnly, true);
  assert.equal(control(tree, "last_school_name").props.name, undefined);
  assert.equal(submittedValue(tree, "lastSchoolStreet"), "School Road");
});

test("review fields follow student-update requirements and retain native email/date validation and dynamic school years", () => {
  const record = fixture();
  record.lastSchoolRecordId = "";
  const tree = harness(record).render();
  for (const field of ["firstName", "lastName", "birthDate", "addressBarangay", "addressCity", "addressProvince", "guardianFirstName", "guardianLastName", "guardianRelationship", "guardianContactNumber", "last_school_name", "last_school_type", "last_school_barangay", "last_school_city", "last_school_province", "last_school_year", "last_school_year_level"]) {
    assert.equal(control(tree, field).props.required, true, field);
  }
  for (const field of ["gender", "civilStatus", "citizenship", "birthplace", "phone", "middleName", "suffix", "last_school_graduation_date"]) {
    assert.ok(!control(tree, field).props.required, field);
  }
  assert.equal(control(tree, "birthDate").props.type, "date");
  assert.equal(control(tree, "email").props.type, "email");
  assert.notEqual(tree.props.noValidate, true);
  const year = control(tree, "last_school_year");
  assert.equal(year.type, "select");
  assert.equal(year.props.value, "2024-2025");
  assert.ok(elements(year).some((element) => element.type === "option" && element.props.value === "2024-2025"));
});

test("review reuses database school search, selects canonical school details, and submits camel-case school and academic values", async () => {
  const form = harness();
  let tree = await loadSchools(form);
  const options = elements(tree).filter((element) => element.props.role === "option");
  assert.deepEqual(options.map((element) => element.props.id), ["review-last-school-list-41", "review-last-school-list-42", "review-last-school-list-other"]);
  chooseSchool(tree, "42");
  tree = form.render();
  assert.equal(submittedValue(tree, "lastSchoolRecordId"), "42");
  assert.equal(control(tree, "last-school-search").props.value, "West Academy");
  for (const [field, value] of Object.entries({
    lastSchoolName: "West Academy", lastSchoolShortName: "WA", lastSchoolType: "Private", lastSchoolStreet: "West Road",
    lastSchoolBarangay: "West", lastSchoolCity: "Makati", lastSchoolProvince: "Metro Manila", lastSchoolPostalCode: "1200",
    lastSchoolYear: "2024-2025", lastSchoolYearLevel: "Grade 12", lastSchoolGraduationDate: "2025-03-31",
  })) assert.equal(submittedValue(tree, field), value, field);
  const names = elements(tree).map((element) => element.props.name);
  for (const field of ["lastSchoolId", "lastSchoolHouseNumber", "lastSchoolSubdivision", "last_school_id", "last_school_house_number", "last_school_subdivision"]) assert.ok(!names.includes(field), field);
  form.setResult({ success: false, message: "Select your school again.", fieldErrors: { lastSchoolName: "The saved school changed." } });
  tree = form.render();
  assert.match(renderToStaticMarkup(tree), /href="#last-school-search"/);
  assert.equal(submittedValue(tree, "lastSchoolRecordId"), "42");
});

test("Other clears saved school details while retaining academics, supports sanitized edits, and keeps the draft on a failed save", async () => {
  const form = harness();
  let tree = await loadSchools(form);
  chooseSchool(tree, "other");
  tree = form.render();
  assert.equal(submittedValue(tree, "lastSchoolRecordId"), "");
  for (const field of ["lastSchoolName", "lastSchoolShortName", "lastSchoolType", "lastSchoolStreet", "lastSchoolBarangay", "lastSchoolCity", "lastSchoolProvince", "lastSchoolPostalCode"]) assert.equal(submittedValue(tree, field), "", field);
  assert.equal(submittedValue(tree, "lastSchoolYear"), "2024-2025");
  assert.equal(submittedValue(tree, "lastSchoolYearLevel"), "Grade 12");
  assert.equal(submittedValue(tree, "lastSchoolGraduationDate"), "2025-03-31");
  (control(tree, "last_school_name").props.onChange as (event: unknown) => void)({ currentTarget: { setCustomValidity() {} }, target: { value: " <b>new</b> academy " } });
  (tree.props.onBlurCapture as (event: unknown) => void)({ target: { name: "last_school_name", value: " <b>new</b> academy " } });
  (control(tree, "last_school_street").props.onChange as (event: unknown) => void)({ currentTarget: { setCustomValidity() {} }, target: { value: " west road " } });
  (tree.props.onBlurCapture as (event: unknown) => void)({ target: { name: "last_school_street", value: " west road " } });
  form.setResult({ success: false, message: "Complete the school address.", fieldErrors: { lastSchoolCity: "Enter the city." } });
  tree = form.render();
  assert.equal(control(tree, "last_school_name").props.value, "New Academy");
  assert.equal(submittedValue(tree, "lastSchoolName"), "New Academy");
  assert.equal(submittedValue(tree, "lastSchoolStreet"), "West Road");
  assert.equal(submittedValue(tree, "lastSchoolRecordId"), "");
  assert.match(renderToStaticMarkup(tree), /href="#last_school_city"/);
});

test("failed reviews retain edited drafts, normalize on blur, announce errors, and protect against React form resets", () => {
  const form = harness();
  let tree = form.render();
  const ref = tree.props.ref as React.RefObject<EventTarget | null>;
  const target = new EventTarget();
  ref.current = target;
  const cleanup = form.flushEffects();
  const change = control(tree, "firstName").props.onChange as (event: unknown) => void;
  change({ currentTarget: { setCustomValidity() {} }, target: { value: " luz edited " } });
  const blur = tree.props.onBlurCapture as (event: unknown) => void;
  blur({ target: { name: "firstName", value: " luz edited " } });
  form.setResult({ success: false, message: "Check your details.", fieldErrors: { guardianContactNumber: "Enter a valid phone number." } });
  tree = form.render();
  const retryCleanup = form.flushEffects();
  assert.equal(control(tree, "firstName").props.value, "Luz Edited");
  assert.equal(target.dispatchEvent(new Event("reset", { cancelable: true })), false);
  assert.deepEqual(form.events, ["toast:error:Check your details."]);
  assert.match(renderToStaticMarkup(tree), /href="#guardianContactNumber"/);
  assert.equal(elements(tree).find((element) => element.type === "fieldset")?.props.disabled, false);
  cleanup();
  retryCleanup();
  assert.equal(target.dispatchEvent(new Event("reset", { cancelable: true })), true);
});

test("continue works without saving; pending and successful saves lock edits, and success toasts before opening classes", () => {
  const form = harness();
  let tree = form.render();
  const link = elements(tree).find((element) => element.type === "a" && element.props.href === "/portal/classroom");
  assert.ok(link);
  assert.equal(link.props["aria-disabled"], undefined);
  assert.equal(link.props.type, undefined);
  form.setResult({ success: false, message: "" }, true);
  tree = form.render();
  assert.equal(tree.props["aria-busy"], true);
  assert.equal(elements(tree).find((element) => element.type === "fieldset")?.props.disabled, true);
  const pendingLink = elements(tree).find((element) => element.type === "a" && element.props.href === "/portal/classroom")!;
  assert.equal(pendingLink.props["aria-disabled"], true);
  let prevented = false;
  (pendingLink.props.onClick as (event: unknown) => void)({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  form.setResult({ success: true, message: "Your information was updated." });
  tree = form.render();
  form.flushEffects();
  assert.deepEqual(form.events, ["toast:success:Your information was updated.", "navigate:/portal/classroom", "refresh"]);
  assert.equal(elements(tree).find((element) => element.type === "fieldset")?.props.disabled, true);
});

test("review route reads only its student-scoped service, shows saved enrollment, and redirects non-reviewing records to classes", async () => {
  let record: StudentAdmissionReviewRecord | null = fixture();
  const received: unknown[] = [];
  const service = load<{ default: () => Promise<React.ReactElement> }>("../app/portal/admission-review/page.tsx", {
    "react/jsx-runtime": jsxRuntime, "next/navigation": { redirect: (path: string) => { throw new Error(`redirect:${path}`); } },
    "lucide-react": { ClipboardCheck: () => null },
    "@/lib/admission/student-review": { getStudentAdmissionReview: async () => record },
    "./review-form": { default: (props: { student: StudentAdmissionReviewRecord }) => { received.push(props.student); return null; } },
  });
  const markup = renderToStaticMarkup(await service.default());
  for (const text of ["Review your information", "0007", "Main Campus", "BSIT", "First Year", "Under review"]) assert.ok(markup.includes(text), text);
  assert.equal(received[0], record);
  record = null;
  await assert.rejects(service.default(), /redirect:\/portal\/classroom/);
  assert.equal(received.length, 1);
});

test("review server action delegates FormData to its session-scoped service without trusting previous client state", async () => {
  const submitted: FormData[] = [];
  const expected = { success: true, message: "Saved." };
  const actions = load<{ saveStudentAdmissionReviewAction: (state: StudentAdmissionReviewState, data: FormData) => Promise<StudentAdmissionReviewState> }>("../app/portal/admission-review/actions.ts", {
    "@/lib/admission/student-review": { saveStudentAdmissionReview: async (data: FormData) => { submitted.push(data); return expected; } },
  });
  const data = new FormData();
  data.set("firstName", "Luz");
  assert.equal(await actions.saveStudentAdmissionReviewAction({ success: true, message: "forged state" }, data), expected);
  assert.equal(submitted[0], data);
});
