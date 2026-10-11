import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  formatProgramType, formatRoleLabel, getEmailDisplayName, getInitials, isActivePath, toTitleCase,
} from "../lib/utils";
import { initialFormValues } from "../app/(public)/admission/components/wizard-state";
import { AdmissionReviewDetails } from "../app/(public)/admission/components/review-step";

test("active navigation matches a route and descendants without matching sibling prefixes", () => {
  assert.equal(isActivePath("/portal/admission", "/portal/admission"), true);
  assert.equal(isActivePath("/portal/admission/42/edit", "/portal/admission"), true);
  assert.equal(isActivePath("/portal/admission-old", "/portal/admission"), false);
  assert.equal(isActivePath("/portal/admissions", "/portal/admission"), false);
  assert.equal(isActivePath("/programs/information-technology", "/programs"), true);
  assert.equal(isActivePath("/portal", "/portal/admission"), false);
  assert.equal(isActivePath("/", "/"), true);
  assert.equal(isActivePath("/programs", "/"), false);
});

test("avatar initials preserve first-two-word behavior and handle a single or missing name", () => {
  assert.equal(getInitials(" Maria Ana Santos "), "MA");
  assert.equal(getInitials("Maria\tSantos"), "MS");
  assert.equal(getInitials("maria"), "MA");
  assert.equal(getInitials("m"), "M");
  assert.equal(getInitials("  \t"), "U");
  assert.equal(getInitials("", "?"), "?");
});

test("email display names normalize separators and camel case while preserving role fallbacks", () => {
  assert.equal(getEmailDisplayName("mariaAna.santos-test@example.com", "Student"), "Maria Ana Santos Test");
  assert.equal(getEmailDisplayName("  maria_santos@example.com", "Student"), "Maria Santos");
  assert.equal(getEmailDisplayName("superAdmin@example.com", "Super Admin"), "Super Admin");
  assert.equal(getEmailDisplayName("SUPER_ADMIN@example.com", "Super Admin"), "Super Admin");
  assert.equal(getEmailDisplayName("---...___@example.com", "Administrator"), "Administrator");
  assert.equal(getEmailDisplayName("@example.com", "Student"), "Student");
  assert.equal(toTitleCase("mARIA aNA"), "MARIA ANA");
});

test("program labels cover known types and preserve unknown or blank values for caller fallbacks", () => {
  assert.equal(formatProgramType("Bachelor"), "Bachelor's Degree");
  assert.equal(formatProgramType("SeniorHigh"), "Senior High School");
  assert.equal(formatProgramType("Associate"), "Associate Degree");
  assert.equal(formatProgramType("Custom Program"), "Custom Program");
  for (const programType of ["toString", "constructor", "__proto__"]) {
    assert.equal(formatProgramType(programType), programType);
  }
  assert.equal(formatProgramType(""), "");
  assert.equal(formatProgramType("  "), "  ");
  assert.equal(formatRoleLabel("superAdmin"), "Super Admin");
  assert.equal(formatRoleLabel("student"), "Student");
});

test("admission review retains its missing-program fallback independently from the shared formatter", () => {
  for (const programType of ["", "  "]) {
    const markup = renderToStaticMarkup(createElement(AdmissionReviewDetails, {
      form: { ...initialFormValues, program_type: programType }, showConsent: false,
    }));
    assert.match(markup, /Program type<\/dt><dd[^>]*>Not provided<\/dd>/);
  }
  const markup = renderToStaticMarkup(createElement(AdmissionReviewDetails, {
    form: { ...initialFormValues, program_type: "SeniorHigh" }, showConsent: false,
  }));
  assert.match(markup, /Program type<\/dt><dd[^>]*>Senior High School<\/dd>/);
});
