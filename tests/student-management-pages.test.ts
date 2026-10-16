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

import { AdmissionReviewDetails } from "../app/(public)/admission/components/review-step";
import * as pageHeaders from "../components/portal/page-header";
import { Button } from "../components/ui/button";
import * as records from "../lib/admission/records";
import * as utils from "../lib/utils";

function fixture(): records.AdmittedStudentQueryResult {
  return {
    id: 9007199254740993n, studentId: 7n, branchId: 1n, programId: 2n, applicantType: "new", academicLevel: "FirstYear",
    branch: { slug: "main", title: "Main Campus" }, program: { code: "BSIT", label: "Information Technology", programType: "Bachelor" },
    lastSchool: { schoolName: "Previous School", schoolId: null, shortName: null, schoolType: "Public", address: null },
    LSSchoolYearEnd: "2025-2026", LSAttainedLevelText: "Grade 12", LSGraduationDate: null,
    student: {
      id: 7n, studentNumber: "0007", firstName: "Maria", lastName: "Santos", middleName: null, suffix: null, userImage: null,
      birthDate: new Date("2008-02-29T00:00:00Z"), gender: "Female", civilStatus: "Single", citizenship: "Filipino",
      birthplace: "Manila", religion: null, email: "maria@example.test", phone: "09171234567", facebookAccount: null,
      address: { houseNumber: null, subdivision: null, street: "Main Street", barangay: "Central", city: "Manila", province: "Metro Manila", postalCode: "0100" },
      guardians: [{ relationship: "Mother", guardian: { firstName: "Ana", lastName: "Santos", middleName: null, suffix: null, contactNumber: "09171234567", occupation: "Teacher" } }],
    },
  } as records.AdmittedStudentQueryResult;
}

function loadPage(edit: boolean | "admission", found = true, authorized = true) {
  const events: string[] = [];
  const captured: Array<Record<string, unknown>> = [];
  const photos: bigint[] = [];
  const options = { branches: [], programs: [], academicLevels: [] };
  const profileImage = "https://res.cloudinary.com/test/image/upload/student.png";
  const action = async () => assert.fail("Rendering must not save a student");
  const modules: Record<string, unknown> = {
    "next/image": { default: () => null },
    "react/jsx-runtime": jsxRuntime, "next/link": { default: Link }, "lucide-react": icons,
    "next/navigation": { notFound: () => { throw new Error("Not found"); } },
    "@/components/portal/page-header": pageHeaders, "@/components/ui/button": { Button },
    "@/lib/admission/admin": { getManagedStudentApplication: async (id: string) => { events.push(`approved:${id}`); return found ? fixture() : null; } },
    "@/lib/admission/student-profile-image": { getStudentProfileImage: async (student: { id: bigint }) => { photos.push(student.id); return profileImage; } },
    "@/lib/admission/records": records, "@/lib/utils": utils,
    "@/lib/auth": { requireAdmin: async () => { events.push("admin"); if (!authorized) throw new Error("Admin access required"); } },
    "@/lib/prisma": { prisma: { admissionApplication: { findFirst: async (query: { where: { id: bigint }; include: unknown }) => {
      events.push(`application:${query.where.id}`);
      assert.equal(query.include, records.admittedStudentInclude);
      return found ? fixture() : null;
    } } } },
    "@/app/(public)/admission/components/review-step": { AdmissionReviewDetails },
    "@/lib/portal/admission-options": { getPortalAdmissionOptions: async (slugs: boolean) => { events.push(`options:${slugs}`); return options; } },
    "@/app/portal/students/actions": { editManagedStudentAction: action },
    "@/app/portal/admission/admitted-student-form": { EditAdmittedStudentForm: (props: Record<string, unknown>) => { captured.push(props); return null; } },
  };
  const file = edit === "admission" ? "../app/portal/admission/[applicationId]/edit/page.tsx"
    : edit ? "../app/portal/students/[applicationId]/edit/page.tsx" : "../app/portal/students/[applicationId]/page.tsx";
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} as { default: (props: { params: Promise<{ applicationId: string }> }) => Promise<React.ReactElement> } };
  runInNewContext(code, { module: loaded, exports: loaded.exports, require: (name: string) => {
    assert.ok(name in modules, `Unexpected student-page dependency: ${name}`);
    return modules[name];
  } });
  return { events, captured, photos, profileImage, options, action, page: loaded.exports.default };
}

test("the student details page shows the complete saved record and offers its scoped edit and parent links", async () => {
  const service = loadPage(false);
  const markup = renderToStaticMarkup(await service.page({ params: Promise.resolve({ applicationId: "9007199254740993" }) }));
  assert.deepEqual(service.events, ["approved:9007199254740993"]);
  for (const detail of ["Maria Santos", "0007", "maria@example.test", "Main Campus", "Information Technology", "Main Street", "Ana Santos", "Previous School", "2025-2026"]) {
    assert.ok(markup.includes(detail), detail);
  }
  assert.match(markup, /href="\/portal\/students\/9007199254740993\/edit"/);
  assert.match(markup, /href="\/portal\/students"/);
  assert.match(markup, /Student record/);
  assert.doesNotMatch(markup, /Review your admission details|before sending the application|Declaration and consent|<input|<form/);
});

test("Manage Students' editor loads its approved record before options and reuses the complete form with a scoped save action", async () => {
  const service = loadPage(true);
  renderToStaticMarkup(await service.page({ params: Promise.resolve({ applicationId: "9007199254740993" }) }));
  assert.deepEqual(service.events, ["approved:9007199254740993", "options:true"]);
  assert.equal(service.captured[0].returnTo, "/portal/students");
  assert.equal(service.captured[0].action, service.action);
  assert.notEqual(service.captured[0].allowIncomplete, true, "Manage Students must keep required profile fields");
  const student = service.captured[0].student as records.AdmittedStudentPayload;
  assert.equal(student.applicationId, "9007199254740993");
  assert.equal(student.studentId, "7");
  assert.equal(student.studentNumber, "0007");
  assert.equal(student.guardianFirstName, "Ana");
  assert.equal(student.lastSchoolName, "Previous School");
  assert.equal(student.userImage, service.profileImage);
  assert.deepEqual(service.photos, [7n]);
  assert.doesNotThrow(() => JSON.stringify(student));
});

test("the admission editor loads its photo from the dedicated server module without relying on an admin-service photo export", async () => {
  const service = loadPage("admission");
  const markup = renderToStaticMarkup(await service.page({ params: Promise.resolve({ applicationId: "9007199254740993" }) }));
  assert.match(markup, /Edit Admitted Student/);
  assert.deepEqual(service.events, ["admin", "application:9007199254740993", "options:true"]);
  assert.deepEqual(service.photos, [7n]);
  assert.equal(service.captured.length, 1);
  assert.equal(service.captured[0].options, service.options);
  assert.equal(service.captured[0].allowIncomplete, true, "Only Admissions edit can save incomplete details");
  const student = service.captured[0].student as records.AdmittedStudentPayload;
  assert.equal(student.applicationId, "9007199254740993");
  assert.equal(student.studentId, "7");
  assert.equal(student.firstName, "Maria");
  assert.equal(student.userImage, service.profileImage);
  assert.doesNotThrow(() => JSON.stringify(student));
});

test("the admission editor requires admin access before reading student details, options or photos", async () => {
  const service = loadPage("admission", true, false);
  await assert.rejects(service.page({ params: Promise.resolve({ applicationId: "34" }) }), /Admin access required/);
  assert.deepEqual(service.events, ["admin"]);
  assert.equal(service.photos.length, 0);
  assert.equal(service.captured.length, 0);
});

test("the admission editor rejects invalid or missing applications before loading photos or rendering the form", async () => {
  const invalid = loadPage("admission");
  await assert.rejects(invalid.page({ params: Promise.resolve({ applicationId: "invalid" }) }), /Not found/);
  assert.deepEqual(invalid.events, ["admin"]);
  assert.equal(invalid.photos.length, 0);
  assert.equal(invalid.captured.length, 0);

  const missing = loadPage("admission", false);
  await assert.rejects(missing.page({ params: Promise.resolve({ applicationId: "34" }) }), /Not found/);
  assert.deepEqual(missing.events, ["admin", "application:34", "options:true"]);
  assert.equal(missing.photos.length, 0);
  assert.equal(missing.captured.length, 0);
});

test("student details and edit pages reject missing or unapproved applications before rendering or loading options", async () => {
  for (const edit of [false, true]) {
    const service = loadPage(edit, false);
    await assert.rejects(service.page({ params: Promise.resolve({ applicationId: "8" }) }), /Not found/);
    assert.deepEqual(service.events, ["approved:8"]);
    assert.equal(service.captured.length, 0);
  }
});
