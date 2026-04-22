"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  Send,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { steps, type Step, type StepId } from "./config";
import ApplicantStep from "./applicant-step";
import ContactStep from "./contact-step";
import CurrentStudentStep, {
  type CurrentStudentFieldName,
  type CurrentStudentStepHandle,
  type CurrentStudentVerification,
} from "./current-student-step";
import GuardianStep from "./guardian-step";
import LastSchoolStep from "./last-school-step";
import ProgramStep from "./program-step";
import ReviewStep from "./review-step";
import StudentStep from "./student-step";

export const initialFormValues = {
  applicant_type: "",
  branch_id: "",
  branch_code: "",
  branch_title: "",
  program_type: "",
  program_id: "",
  program_code: "",
  program_label: "",
  academic_level_id: "",
  academic_level_label: "",
  student_first_name: "",
  student_last_name: "",
  student_middle_name: "",
  student_suffix: "",
  student_birth_date: "",
  student_gender: "",
  student_civil_status: "",
  student_citizenship: "",
  student_birthplace: "",
  student_religion: "",
  contact_email: "",
  contact_phone: "",
  contact_facebook: "",
  address_house_number: "",
  address_subdivision: "",
  address_street: "",
  address_barangay: "",
  address_city: "",
  address_province: "",
  address_postal_code: "",
  last_school_name: "",
  last_school_id: "",
  last_school_short_name: "",
  last_school_type: "",
  last_school_house_number: "",
  last_school_subdivision: "",
  last_school_street: "",
  last_school_barangay: "",
  last_school_city: "",
  last_school_province: "",
  last_school_postal_code: "",
  last_school_year: "",
  last_school_graduation_date: "",
  last_school_year_level: "",
  guardian_last_name: "",
  guardian_first_name: "",
  guardian_middle_name: "",
  guardian_suffix: "",
  guardian_relationship: "",
  guardian_contact_number: "",
  guardian_occupation: "",
  current_student_number: "",
  current_student_email: "",
  current_student_first_name: "",
  current_student_last_name: "",
  current_student_birth_date: "",
  current_last_school_year_attended: "",
  current_student_record_id: "",
  current_student_verified_name: "",
  current_student_verified_school_year: "",
  current_student_verified_program: "",
  current_student_verified_branch: "",
  current_year_level: "",
  current_section: "",
  current_school_year: "",
};

type FieldName = keyof typeof initialFormValues;
type AdmissionFormValues = typeof initialFormValues;
type SubmissionStatus = "idle" | "submitting" | "submitted";
type AdmissionSubmissionResponse = {
  submitted?: boolean;
  submissionId?: string;
  submittedAt?: string;
  message?: string;
};
type AdmissionConfirmation = {
  message: string;
  submissionId: string;
  submittedAt: string;
};

const EXISTING_STUDENT = "Existing Student";

const currentStudentInputFields = new Set<FieldName>([
  "current_student_number",
  "current_student_email",
  "current_student_first_name",
  "current_student_last_name",
  "current_student_birth_date",
  "current_last_school_year_attended",
]);

function isCurrentStudentInputField(
  field: FieldName
): field is CurrentStudentFieldName {
  return currentStudentInputFields.has(field);
}

function clearCurrentStudentVerification(form: AdmissionFormValues) {
  return {
    ...form,
    current_student_record_id: "",
    current_student_verified_name: "",
    current_student_verified_school_year: "",
    current_student_verified_program: "",
    current_student_verified_branch: "",
  };
}

function clearProgramSelection(form: AdmissionFormValues) {
  return {
    ...form,
    branch_code: "",
    branch_title: "",
    program_type: "",
    program_id: "",
    program_code: "",
    program_label: "",
    academic_level_id: "",
    academic_level_label: "",
  };
}

function getVisibleSteps(applicantType: string) {
  return steps.filter(
    (step) =>
      step.id !== "currentStudent" || applicantType === EXISTING_STUDENT
  );
}

function StepHeader({
  step,
  currentIndex,
  totalSteps,
}: {
  step: Step;
  currentIndex: number;
  totalSteps: number;
}) {
  const Icon = step.icon;

  return (
    <div className="border-b border-gray-200 px-5 py-5 sm:px-7">
      <p className="text-xs font-bold uppercase tracking-widest text-secondary">
        Step {currentIndex + 1} of {totalSteps} / {step.eyebrow}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Icon className="size-7 text-primary" aria-hidden="true" />
        <h2 className="text-2xl font-bold tracking-tight text-gray-950">
          {step.title}
        </h2>
      </div>
    </div>
  );
}

function stepIsComplete(
  stepId: StepId,
  form: AdmissionFormValues,
  consent: boolean
) {
  switch (stepId) {
    case "applicant":
      return Boolean(form.applicant_type && form.branch_id);
    case "program":
      return Boolean(
        form.program_type && form.program_id && form.academic_level_id
      );
    case "student":
      return Boolean(
        form.student_first_name &&
          form.student_last_name &&
          form.student_birth_date &&
          form.student_gender &&
          form.student_civil_status &&
          form.student_citizenship &&
          form.student_birthplace
      );
    case "contact":
      return Boolean(
        form.contact_email &&
          form.contact_phone &&
          form.address_barangay &&
          form.address_city &&
          form.address_province
      );
    case "lastSchool":
      return Boolean(
        form.last_school_name &&
          form.last_school_type &&
          form.last_school_barangay &&
          form.last_school_city &&
          form.last_school_province &&
          form.last_school_year &&
          form.last_school_year_level
      );
    case "guardian":
      return Boolean(
        form.guardian_first_name &&
          form.guardian_last_name &&
          form.guardian_relationship &&
          form.guardian_contact_number
      );
    case "currentStudent":
      if (form.applicant_type !== EXISTING_STUDENT) {
        return true;
      }

      return Boolean(
        form.current_student_number &&
          form.current_student_email &&
          form.current_student_first_name &&
          form.current_student_last_name &&
          form.current_student_birth_date &&
          form.current_last_school_year_attended &&
          form.current_student_record_id
      );
    case "review":
      return consent;
    default:
      return false;
  }
}

function currentStudentInputsComplete(form: AdmissionFormValues) {
  if (form.applicant_type !== EXISTING_STUDENT) {
    return true;
  }

  return Boolean(
    form.current_student_number &&
      form.current_student_email &&
      form.current_student_first_name &&
      form.current_student_last_name &&
      form.current_student_birth_date &&
      form.current_last_school_year_attended
  );
}

function firstIncompleteStepIndex(
  form: AdmissionFormValues,
  consent: boolean,
  visibleSteps: Step[]
) {
  return visibleSteps.findIndex(
    (step) => !stepIsComplete(step.id, form, consent)
  );
}

async function submitAdmission(
  form: AdmissionFormValues,
  consent: boolean
) {
  const response = await fetch("/api/admissions/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      form,
      consent,
    }),
  });

  const data = (await response.json()) as AdmissionSubmissionResponse;

  if (
    !response.ok ||
    !data.submitted ||
    !data.submissionId ||
    !data.submittedAt
  ) {
    throw new Error(
      data.message ??
        "We could not submit your admission form right now. Please try again."
    );
  }

  return {
    message:
      data.message ??
      "Your admission form has been submitted to the registrar for review.",
    submissionId: data.submissionId,
    submittedAt: data.submittedAt,
  } satisfies AdmissionConfirmation;
}

export default function AdmissionWizard() {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [form, setForm] = React.useState<AdmissionFormValues>(
    () => ({ ...initialFormValues })
  );
  const [consent, setConsent] = React.useState(false);
  const [verifyingCurrentStudent, setVerifyingCurrentStudent] =
    React.useState(false);
  const [submissionStatus, setSubmissionStatus] =
    React.useState<SubmissionStatus>("idle");
  const [submissionError, setSubmissionError] = React.useState("");
  const [confirmation, setConfirmation] =
    React.useState<AdmissionConfirmation | null>(null);
  const currentStudentStepRef =
    React.useRef<CurrentStudentStepHandle | null>(null);

  const visibleSteps = React.useMemo(
    () => getVisibleSteps(form.applicant_type),
    [form.applicant_type]
  );
  const safeCurrentIndex = Math.min(currentIndex, visibleSteps.length - 1);
  const currentStep = visibleSteps[safeCurrentIndex];
  const isFirstStep = safeCurrentIndex === 0;
  const isLastStep = safeCurrentIndex === visibleSteps.length - 1;
  const currentStepComplete = stepIsComplete(currentStep.id, form, consent);
  const currentStepReadyToContinue =
    currentStep.id === "currentStudent"
      ? currentStudentInputsComplete(form)
      : currentStepComplete;
  const incompleteStepIndex = firstIncompleteStepIndex(
    form,
    consent,
    visibleSteps
  );
  const formComplete = incompleteStepIndex === -1;

  React.useEffect(() => {
    if (currentIndex !== safeCurrentIndex) {
      setCurrentIndex(safeCurrentIndex);
    }
  }, [currentIndex, safeCurrentIndex]);

  function canNavigateToStep(index: number) {
    if (index === safeCurrentIndex) {
      return true;
    }

    return visibleSteps
      .slice(0, index)
      .every((step) => stepIsComplete(step.id, form, consent));
  }

  function updateField(field: FieldName, value: string) {
    setVerifyingCurrentStudent(false);
    setSubmissionError("");
    setConsent(false);
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (isCurrentStudentInputField(field)) {
        return clearCurrentStudentVerification(next);
      }

      if (field === "branch_id") {
        return clearProgramSelection(clearCurrentStudentVerification(next));
      }

      if (field === "applicant_type" && value !== EXISTING_STUDENT) {
        return clearCurrentStudentVerification(next);
      }

      return next;
    });
  }

  function handleCurrentStudentVerified(
    verification: CurrentStudentVerification
  ) {
    setConsent(false);
    setForm((prev) => ({
      ...prev,
      current_student_record_id: verification.recordId,
      current_student_verified_name: verification.displayName,
      current_student_verified_school_year: verification.schoolYear,
      current_student_verified_program: verification.program,
      current_student_verified_branch: verification.branch,
      contact_email: prev.contact_email || prev.current_student_email,
      student_first_name:
        prev.student_first_name || prev.current_student_first_name,
      student_last_name: prev.student_last_name || prev.current_student_last_name,
      student_birth_date:
        prev.student_birth_date || prev.current_student_birth_date,
    }));
  }

  function resetWizard() {
    setCurrentIndex(0);
    setForm({ ...initialFormValues });
    setConsent(false);
    setVerifyingCurrentStudent(false);
    setSubmissionStatus("idle");
    setSubmissionError("");
    setConfirmation(null);
  }

  async function goNext() {
    const nextIndex = Math.min(safeCurrentIndex + 1, visibleSteps.length - 1);

    if (
      !currentStepReadyToContinue ||
      verifyingCurrentStudent ||
      submissionStatus === "submitting"
    ) {
      return;
    }

    if (currentStep.id === "currentStudent" && !form.current_student_record_id) {
      setVerifyingCurrentStudent(true);

      try {
        const verified = await currentStudentStepRef.current?.verify();

        if (!verified) {
          return;
        }
      } finally {
        setVerifyingCurrentStudent(false);
      }
    }

    setCurrentIndex(nextIndex);
  }

  function goBack() {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionError("");

    const invalidStepIndex = firstIncompleteStepIndex(
      form,
      consent,
      visibleSteps
    );

    if (invalidStepIndex !== -1) {
      setCurrentIndex(invalidStepIndex);
      setSubmissionError(
        "Complete the remaining admission steps before submitting your application."
      );
      return;
    }

    try {
      setSubmissionStatus("submitting");
      const result = await submitAdmission(form, consent);
      setConfirmation(result);
      setSubmissionStatus("submitted");
      setCurrentIndex(visibleSteps.length - 1);
    } catch (error) {
      setSubmissionStatus("idle");
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "We could not submit your admission form right now. Please try again."
      );
    }
  }

  function renderStep() {
    switch (currentStep.id) {
      case "applicant":
        return <ApplicantStep form={form} onChange={updateField} />;
      case "program":
        return <ProgramStep form={form} onChange={updateField} />;
      case "student":
        return <StudentStep form={form} onChange={updateField} />;
      case "contact":
        return <ContactStep form={form} onChange={updateField} />;
      case "lastSchool":
        return <LastSchoolStep form={form} onChange={updateField} />;
      case "guardian":
        return <GuardianStep form={form} onChange={updateField} />;
      case "currentStudent":
        return (
          <CurrentStudentStep
            ref={currentStudentStepRef}
            form={form}
            onChange={updateField}
            onVerified={handleCurrentStudentVerified}
          />
        );
      case "review":
        return (
          <ReviewStep
            form={form}
            consent={consent}
            onConsentChange={setConsent}
          />
        );
      default:
        return null;
    }
  }

  return (
    <section id="admission-form" className="relative z-10 bg-gray-50 pb-16">
      <div className="mx-auto -mt-12 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[290px_1fr]">
          <aside className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-500">
                Admission progress
              </p>
              <p className="mt-2 text-2xl font-bold text-gray-950">
                {safeCurrentIndex + 1}/{visibleSteps.length}
              </p>
            </div>

            <ol className="grid gap-1 p-3">
              {visibleSteps.map((step, index) => {
                const Icon = step.icon;
                const active = index === safeCurrentIndex;
                const complete = stepIsComplete(step.id, form, consent);
                const canNavigate = canNavigateToStep(index);

                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (canNavigate) {
                          setCurrentIndex(index);
                        }
                      }}
                      disabled={
                        !canNavigate ||
                        submissionStatus === "submitting" ||
                        Boolean(confirmation)
                      }
                      className={cn(
                        "flex min-h-14 w-full items-center gap-3 rounded-md px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-primary/25",
                        active
                          ? "bg-primary text-white"
                          : canNavigate
                            ? "text-gray-700 hover:bg-gray-100"
                            : "cursor-not-allowed text-gray-400 opacity-70"
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-md border",
                          active
                            ? "border-white/35 bg-white/15"
                            : complete
                              ? "border-primary bg-primary text-white"
                              : "border-gray-200 bg-white text-gray-500"
                        )}
                      >
                        {complete && !active ? (
                          <Check size={16} aria-hidden="true" />
                        ) : (
                          <Icon size={16} aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {step.label}
                        </span>
                        <span
                          className={cn(
                            "block truncate text-xs",
                            active ? "text-white/80" : "text-gray-500"
                          )}
                        >
                          {step.eyebrow}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="border-t border-gray-200 p-5">
              <div className="flex items-start gap-3 text-sm leading-6 text-gray-600">
                <BookOpenCheck
                  className="mt-0.5 size-5 shrink-0 text-secondary"
                  aria-hidden="true"
                />
                <p>
                  Prepare a valid ID, report card or transcript, birth
                  certificate, and latest 2x2 photo before submission.
                </p>
              </div>
            </div>
          </aside>

          <form
            onSubmit={handleSubmit}
            className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
          >
            <StepHeader
              step={currentStep}
              currentIndex={safeCurrentIndex}
              totalSteps={visibleSteps.length}
            />

            <div className="min-h-140 px-5 py-6 sm:px-7">
              {confirmation ? (
                <div className="mx-auto flex h-full max-w-2xl items-center">
                  <div className="w-full rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
                        <Check size={18} aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                          Submission received
                        </p>
                        <h3 className="mt-1 text-2xl font-bold text-gray-950">
                          Your admission form is now in the registrar queue.
                        </h3>
                        <p className="mt-3 text-sm leading-6 text-gray-700">
                          {confirmation.message}
                        </p>
                      </div>
                    </div>

                    <dl className="mt-6 grid gap-4 rounded-xl border border-emerald-200 bg-white/80 p-4 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="font-semibold text-gray-600">
                          Submission reference
                        </dt>
                        <dd className="mt-1 font-mono text-gray-950">
                          {confirmation.submissionId}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-gray-600">
                          Submitted at
                        </dt>
                        <dd className="mt-1 text-gray-950">
                          {new Intl.DateTimeFormat("en-PH", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(confirmation.submittedAt))}
                        </dd>
                      </div>
                    </dl>

                    <p className="mt-4 text-sm leading-6 text-gray-600">
                      Keep this reference number for follow-up questions while
                      your documents are being reviewed.
                    </p>
                  </div>
                </div>
              ) : (
                renderStep()
              )}
            </div>

            <div className="flex flex-col gap-4 border-t border-gray-200 bg-gray-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              {submissionError ? (
                <p className="text-sm font-medium text-red-700">
                  {submissionError}
                </p>
              ) : !confirmation && !currentStepComplete ? (
                <p className="text-sm font-medium text-secondary">
                  {currentStep.id === "currentStudent" &&
                  currentStudentInputsComplete(form)
                    ? "Continue will verify your student record before you can proceed."
                    : currentStep.id === "review"
                      ? "Review the application details and provide consent before submitting."
                      : "Complete the required fields to continue."}
                </p>
              ) : null}

              <div className="flex flex-col gap-3 sm:ml-auto sm:flex-row">
                <button
                  type="button"
                  onClick={confirmation ? resetWizard : goBack}
                  disabled={
                    submissionStatus === "submitting" ||
                    (!confirmation && isFirstStep)
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirmation ? (
                    <>
                      <ArrowLeft size={16} aria-hidden="true" />
                      Start another application
                    </>
                  ) : (
                    <>
                      <ArrowLeft size={16} aria-hidden="true" />
                      Back
                    </>
                  )}
                </button>

                {!confirmation && isLastStep ? (
                  <button
                    type="submit"
                    disabled={!formComplete || submissionStatus === "submitting"}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-secondary px-5 text-sm font-semibold text-white transition hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submissionStatus === "submitting"
                      ? "Submitting..."
                      : "Submit for Review"}
                    <Send size={16} aria-hidden="true" />
                  </button>
                ) : !confirmation ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={
                      !currentStepReadyToContinue ||
                      verifyingCurrentStudent ||
                      submissionStatus === "submitting"
                    }
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {verifyingCurrentStudent ? "Verifying record..." : "Continue"}
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
