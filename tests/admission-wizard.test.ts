import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createWizardState, currentStudentInputsComplete, firstIncompleteStepIndex,
  getVisibleSteps, initialFormValues, stepIsComplete, updateFormField, wizardReducer,
  type AdmissionFormValues, type FieldName,
} from "../app/(public)/admission/components/wizard-state";

const verifiedRecord = {
  recordId: "42", displayName: "Maria Santos", schoolYear: "2026-2027",
  program: "BSIT / First Year", branch: "Main Campus",
};

const populatedForm = (): AdmissionFormValues => Object.fromEntries(
  Object.keys(initialFormValues).map((field) => [field, field === "applicant_type" ? "New Student" : "value"])
) as AdmissionFormValues;

test("new applicants require every admission step and consent while existing students only verify their record", () => {
  const form = populatedForm();
  const steps = getVisibleSteps(form.applicant_type);
  assert.deepEqual(steps.map(({ id }) => id), ["applicant", "program", "student", "contact", "lastSchool", "guardian", "review"]);
  assert.equal(firstIncompleteStepIndex(form, false, steps), 6);
  assert.equal(firstIncompleteStepIndex(form, true, steps), -1);

  form.applicant_type = "Existing Student";
  assert.deepEqual(getVisibleSteps(form.applicant_type).map(({ id }) => id), ["applicant", "currentStudent"]);
  form.current_student_record_id = "";
  assert.equal(currentStudentInputsComplete(form), true);
  assert.equal(stepIsComplete("currentStudent", form, false), false);
  form.current_student_record_id = "42";
  assert.equal(stepIsComplete("currentStudent", form, false), true);
  form.current_student_email = "";
  assert.equal(currentStudentInputsComplete(form), false);
});

test("required fields block their step, while optional personal and school details remain optional", () => {
  const form = populatedForm();
  for (const [step, field] of [
    ["applicant", "branch_id"], ["program", "academic_level_id"], ["student", "student_civil_status"],
    ["contact", "address_barangay"], ["lastSchool", "last_school_year_level"], ["guardian", "guardian_contact_number"],
  ] as const) {
    assert.equal(stepIsComplete(step, { ...form, [field]: "" }, true), false, field);
  }
  for (const field of ["student_middle_name", "student_religion", "contact_facebook", "last_school_graduation_date", "guardian_occupation"] as const) {
    form[field] = "";
  }
  assert.equal(firstIncompleteStepIndex(form, true, getVisibleSteps(form.applicant_type)), -1);
});

test("changing the branch invalidates its program selection and verification without losing applicant details", () => {
  const form = populatedForm();
  const next = updateFormField(form, "branch_id", "another-campus");
  assert.equal(next.branch_id, "another-campus");
  for (const field of ["branch_code", "branch_title", "program_type", "program_id", "program_code", "program_label", "academic_level_id", "academic_level_label",
    "current_student_record_id", "current_student_verified_name", "current_student_verified_school_year", "current_student_verified_program", "current_student_verified_branch"] as const) {
    assert.equal(next[field], "", field);
  }
  assert.equal(next.student_first_name, form.student_first_name);
  assert.equal(next.current_student_number, form.current_student_number);
  assert.equal(form.branch_id, "value");
});

test("verification input edits revoke verification and applicant type changes clamp the visible step", () => {
  const state = { ...createWizardState(), form: populatedForm(), currentIndex: 6, consent: true,
    verifyingCurrentStudent: true, submissionError: "Previous error", existingStudentNotice: { message: "Verified" } };
  const next = wizardReducer(state, { type: "fieldChanged", field: "applicant_type", value: "Existing Student" });
  assert.equal(next.currentIndex, 1);
  assert.equal(next.consent, false);
  assert.equal(next.verifyingCurrentStudent, false);
  assert.equal(next.submissionError, "");
  assert.equal(next.existingStudentNotice, null);
  for (const field of ["current_student_number", "current_student_email", "current_student_first_name", "current_student_last_name", "current_student_birth_date"] satisfies FieldName[]) {
    assert.equal(updateFormField(next.form, field, "changed").current_student_record_id, "", field);
  }
  assert.equal(updateFormField(next.form, "applicant_type", "New Student").current_student_record_id, "");
});

test("verification populates missing applicant fields but preserves existing contact and personal details", () => {
  const state = createWizardState();
  state.form.current_student_first_name = "Maria";
  state.form.current_student_last_name = "Santos";
  state.form.current_student_email = "student@example.com";
  state.form.current_student_birth_date = "2008-02-29";
  state.form.contact_email = "preferred@example.com";
  state.form.student_last_name = "Saved surname";
  const next = wizardReducer(state, { type: "verified", verification: verifiedRecord });
  assert.equal(next.form.current_student_record_id, "42");
  assert.equal(next.form.current_student_verified_program, "BSIT / First Year");
  assert.equal(next.form.contact_email, "preferred@example.com");
  assert.equal(next.form.student_first_name, "Maria");
  assert.equal(next.form.student_last_name, "Saved surname");
  assert.equal(next.form.student_birth_date, "2008-02-29");
  assert.match(next.existingStudentNotice!.message, /check your email/);
  const edited = wizardReducer(next, { type: "fieldChanged", field: "current_student_email", value: "other@example.com" });
  assert.equal(edited.existingStudentNotice, null);
  assert.equal(edited.form.current_student_record_id, "");
});

test("submission failure permits retry, confirmation is retained, and reset clears every transient state", () => {
  let state = { ...createWizardState(), form: populatedForm(), consent: true };
  state = wizardReducer(state, { type: "submissionStarted" });
  assert.equal(state.submissionStatus, "submitting");
  state = wizardReducer(state, { type: "submissionFailed", message: "Try again" });
  assert.equal(state.submissionStatus, "idle");
  assert.equal(state.submissionError, "Try again");
  assert.equal(state.form.student_first_name, "value");
  const confirmation = { message: "Received", submissionId: "12345678", submittedAt: "2026-10-11T00:00:00Z" };
  state = wizardReducer(state, { type: "submitted", confirmation, index: 6 });
  assert.equal(state.submissionStatus, "submitted");
  assert.equal(state.confirmation, confirmation);
  assert.equal(state.currentIndex, 6);
  const reset = wizardReducer(state, { type: "reset" });
  assert.deepEqual(reset, createWizardState());
  reset.form.student_first_name = "Another student";
  assert.equal(initialFormValues.student_first_name, "");
});
