import { steps, type Step, type StepId } from "./config";
import { currentStudentFields, detailsSteps, type CurrentStudentFieldName, type DetailsFieldName } from "./form-schema";
import type { CurrentStudentVerification } from "./current-student-step";
import { EXISTING_STUDENT } from "@/lib/admission/constants";

export { EXISTING_STUDENT } from "@/lib/admission/constants";

const detailFields = Object.values(detailsSteps).flatMap((step) =>
  step.sections.flatMap((section) => section.fields)
);

const emptyVerification = {
  current_student_record_id: "",
  current_student_verified_name: "",
  current_student_verified_school_year: "",
  current_student_verified_program: "",
  current_student_verified_branch: "",
};

export const emptyProgramSelection = {
  branch_code: "",
  branch_title: "",
  program_type: "",
  program_id: "",
  program_code: "",
  program_label: "",
  academic_level_id: "",
  academic_level_label: "",
};

export const initialFormValues = {
  ...Object.fromEntries(detailFields.map(({ id }) => [id, ""])) as Record<DetailsFieldName, string>,
  ...Object.fromEntries(currentStudentFields.map(({ id }) => [id, ""])) as Record<CurrentStudentFieldName, string>,
  ...emptyVerification,
  ...emptyProgramSelection,
  applicant_type: "",
  branch_id: "",
  current_year_level: "",
  current_section: "",
  current_school_year: "",
};

export type AdmissionFormValues = typeof initialFormValues;
export type FieldName = keyof AdmissionFormValues;
export type AdmissionConfirmation = { message: string; submissionId: string; submittedAt: string };

const requiredFields: Partial<Record<StepId, readonly FieldName[]>> = {
  applicant: ["applicant_type", "branch_id"],
  program: ["program_type", "program_id", "academic_level_id"],
  currentStudent: [...currentStudentFields.map(({ id }) => id), "current_student_record_id"],
  ...Object.fromEntries(Object.entries(detailsSteps).map(([id, step]) => [
    id, step.sections.flatMap((section) => section.fields.filter((field) => field.required).map((field) => field.id)),
  ])),
};

export function getVisibleSteps(applicantType: string) {
  return steps.filter((step) => applicantType === EXISTING_STUDENT
    ? step.id === "applicant" || step.id === "currentStudent"
    : step.id !== "currentStudent");
}

export function stepIsComplete(stepId: StepId, form: AdmissionFormValues, consent: boolean) {
  if (stepId === "review") return consent;
  if (stepId === "currentStudent" && form.applicant_type !== EXISTING_STUDENT) return true;
  return (requiredFields[stepId] ?? []).every((field) => Boolean(form[field]));
}

export function currentStudentInputsComplete(form: Pick<AdmissionFormValues, "applicant_type" | CurrentStudentFieldName>) {
  return form.applicant_type !== EXISTING_STUDENT || currentStudentFields.every(({ id }) => Boolean(form[id]));
}

export function firstIncompleteStepIndex(form: AdmissionFormValues, consent: boolean, visibleSteps: Step[]) {
  return visibleSteps.findIndex((step) => !stepIsComplete(step.id, form, consent));
}

export function updateFormField(form: AdmissionFormValues, field: FieldName, value: string): AdmissionFormValues {
  const next = { ...form, [field]: value };
  if (field === "branch_id") return { ...next, ...emptyProgramSelection, ...emptyVerification };
  if (currentStudentFields.some(({ id }) => id === field) || (field === "applicant_type" && value !== EXISTING_STUDENT)) {
    return { ...next, ...emptyVerification };
  }
  return next;
}

export function createWizardState() {
  return {
    currentIndex: 0,
    form: { ...initialFormValues },
    consent: false,
    verifyingCurrentStudent: false,
    submissionStatus: "idle" as "idle" | "submitting" | "submitted",
    submissionError: "",
    confirmation: null as AdmissionConfirmation | null,
    existingStudentNotice: null as { message: string } | null,
  };
}

export type WizardState = ReturnType<typeof createWizardState>;
export type WizardAction =
  | { type: "fieldChanged"; field: FieldName; value: string }
  | { type: "navigated"; index: number }
  | { type: "back" }
  | { type: "consentChanged"; value: boolean }
  | { type: "verificationPending"; value: boolean }
  | { type: "verified"; verification: CurrentStudentVerification }
  | { type: "submissionStarted" }
  | { type: "submitted"; confirmation: AdmissionConfirmation; index: number }
  | { type: "submissionFailed"; message: string }
  | { type: "errorChanged"; message: string }
  | { type: "reset" };

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "fieldChanged":
      return {
        ...state,
        form: updateFormField(state.form, action.field, action.value),
        currentIndex: action.field === "applicant_type"
          ? Math.min(state.currentIndex, getVisibleSteps(action.value).length - 1)
          : state.currentIndex,
        consent: false, verifyingCurrentStudent: false, submissionError: "", existingStudentNotice: null,
      };
    case "navigated": return { ...state, currentIndex: action.index };
    case "back": return { ...state, currentIndex: Math.max(state.currentIndex - 1, 0) };
    case "consentChanged": return { ...state, consent: action.value };
    case "verificationPending": return { ...state, verifyingCurrentStudent: action.value };
    case "verified": {
      const { verification } = action;
      const form = state.form;
      return {
        ...state, consent: false,
        existingStudentNotice: { message: verification.message ?? "Student record verified. Please check your email inbox or spam folder for the update link." },
        form: {
          ...form,
          current_student_record_id: verification.recordId,
          current_student_verified_name: verification.displayName,
          current_student_verified_school_year: verification.schoolYear,
          current_student_verified_program: verification.program,
          current_student_verified_branch: verification.branch,
          contact_email: form.contact_email || form.current_student_email,
          student_first_name: form.student_first_name || form.current_student_first_name,
          student_last_name: form.student_last_name || form.current_student_last_name,
          student_birth_date: form.student_birth_date || form.current_student_birth_date,
        },
      };
    }
    case "submissionStarted": return { ...state, submissionStatus: "submitting" };
    case "submitted": return { ...state, confirmation: action.confirmation, submissionStatus: "submitted", currentIndex: action.index };
    case "submissionFailed": return { ...state, submissionStatus: "idle", submissionError: action.message };
    case "errorChanged": return { ...state, submissionError: action.message };
    case "reset": return createWizardState();
  }
}
