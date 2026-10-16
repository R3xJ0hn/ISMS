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
import * as utils from "../lib/utils";
import * as admissionUi from "../app/portal/admission/admission-ui";
import * as academicLevels from "../lib/academic-levels";
import { studentUpdateFields } from "../lib/admission/student-fields";
import * as studentFields from "../lib/admission/student-fields";
import type * as classForm from "../app/portal/classes/class-form";
import type * as admittedForm from "../app/portal/admission/admitted-student-form";
import { loadPortalFeedback } from "./portal-feedback-harness";

function renderModule(path: string, extraModules: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const modules: Record<string, unknown> = {
    react: React, "react/jsx-runtime": jsxRuntime, "next/link": { default: Link }, "lucide-react": icons,
    "@/components/portal/profile-image-field": { ProfileImageField: () => null },
    "@/components/ui/button": { Button }, "@/components/ui/input": { Input }, "@/lib/utils": utils,
    "@/components/portal/toasts": loadPortalFeedback({}, { push: () => {} }),
    "next/navigation": { useRouter: () => ({ push: () => {}, refresh: () => {} }) },
    "@/lib/admission/student-fields": studentFields,
    ...extraModules,
  };
  const loaded = { exports: {} };
  runInNewContext(code, {
    module: loaded, exports: loaded.exports,
    require: (name: string) => {
      assert.ok(name in modules, "Unexpected form dependency: " + name);
      return modules[name];
    },
  });
  return loaded.exports;
}

const unusedAction = async () => assert.fail("Rendering must not execute a form action");
const { ClassForm } = renderModule("../app/portal/classes/class-form.tsx", {
  "next/navigation": { useRouter: () => ({ push: () => {} }) },
  "./actions": { createClassAction: unusedAction, updateClassAction: unusedAction },
  "@/lib/academic-levels": academicLevels,
}) as typeof classForm;
const { EditAdmittedStudentForm } = renderModule("../app/portal/admission/admitted-student-form.tsx", {
  "@/app/portal/admission/actions": {
    addAdmittedStudentAction: unusedAction, bulkAdmitStudentsAction: unusedAction, editAdmittedStudentAction: unusedAction,
  },
  "@/app/portal/admission/admission-ui": admissionUi,
  "@/lib/academic-levels": academicLevels,
}) as typeof admittedForm;

function schoolYearSelect(markup: string, name: string) {
  const match = markup.match(new RegExp(`<select\\b[^>]*name="${name}"[^>]*>[\\s\\S]*?</select>`));
  assert.ok(match, "School year must render as a select");
  return match[0];
}

test("new class school-year selects start blank and include shared generated choices", () => {
  const markup = renderToStaticMarkup(React.createElement(ClassForm, { mode: "create", programs: [], subjects: [], branches: [{ id: "1", title: "Main" }], teachers: [{ id: "1", email: "teacher@example.com" }] }));
  const select = schoolYearSelect(markup, "schoolYear");
  assert.match(select, /required=""/);
  assert.match(select, /<option value="" selected="">Select school year<\/option>/);
  assert.ok(select.includes(`<option value="${utils.generateSchoolYears()[0]}">`));
});

test("editing a class retains the exact legacy school-year value as the selected choice", () => {
  const legacy = " 2025 to 2026 ";
  const markup = renderToStaticMarkup(React.createElement(ClassForm, {
    mode: "edit", classId: "7", programs: [], subjects: [], branches: [{ id: "1", title: "Main" }], teachers: [{ id: "1", email: "teacher@example.com" }],
    values: { teacherId: "1", branchId: "1", programId: "", subjectId: "", schoolYear: legacy, sectionName: "IT 1-A", yearLevel: "FirstYear", semester: "" },
  }));
  assert.ok(schoolYearSelect(markup, "schoolYear").includes(`<option value="${legacy}" selected="">${legacy}</option>`));
});

test("admission academic-level dropdowns submit enum values and filter levels for the selected program", () => {
  for (const [programType, selectedLevel, expectedValues] of [
    ["SeniorHigh", "Grade12", ["Grade11", "Grade12"]],
    ["Associate", "SecondYear", ["FirstYear", "SecondYear"]],
    ["Bachelor", "FourthYear", ["FirstYear", "SecondYear", "ThirdYear", "FourthYear"]],
  ] as const) {
    const student = {
      ...Object.fromEntries(studentUpdateFields.map((field) => [field, ""])),
      studentId: "1", applicationId: "1", applicantType: "new", branchId: "1", programId: "1", academicLevel: selectedLevel,
    } as admittedForm.AdmittedStudentEditRecord;
    const markup = renderToStaticMarkup(React.createElement(EditAdmittedStudentForm, {
      student, options: {
        branches: [{ id: "1", title: "Main" }],
        programs: [{ id: "1", code: "TEST", label: "Test Program", programType }],
        academicLevels: [...academicLevels.academicLevelOptions],
      },
    }));
    const select = schoolYearSelect(markup, "academicLevel");
    assert.match(select, /required=""/);
    assert.ok(select.includes(`<option value="${selectedLevel}" selected="">`));
    const allowedValues = new Set<string>(expectedValues);
    for (const level of academicLevels.academicLevelOptions) {
      assert.equal(select.includes(`<option value="${level.value}"`), allowedValues.has(level.value), `${programType}: ${level.value}`);
    }
    assert.doesNotMatch(markup, /name="academicLevelsId"/);
  }
});

test("admission editing retains legacy school-year choices and keeps year level as its own text field", () => {
  const legacy = "2025 - 2026";
  const student = {
    ...Object.fromEntries(studentUpdateFields.map((field) => [field, ""])),
    studentId: "1", applicationId: "1", applicantType: "new", branchId: "1", programId: "1", academicLevel: "FirstYear",
    lastSchoolYear: legacy, lastSchoolYearLevel: "Grade 12",
  } as admittedForm.AdmittedStudentEditRecord;
  const markup = renderToStaticMarkup(React.createElement(EditAdmittedStudentForm, {
    student, options: { branches: [], programs: [], academicLevels: [] },
  }));
  const select = schoolYearSelect(markup, "lastSchoolYear");
  assert.match(select, /required=""/);
  assert.ok(select.includes(`<option value="${legacy}" selected="">${legacy}</option>`));
  assert.match(markup, /<input[^>]*name="lastSchoolYearLevel"[^>]*value="Grade 12"/);
});
